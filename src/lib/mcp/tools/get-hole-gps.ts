import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * G-Swing MCP — get_hole_gps
 * Returns green front/center/back, tee boxes, and hazards for a single
 * hole. Optionally computes distances from a supplied lat/lng.
 */
function haversineYards(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 1.09361);
}

export default defineTool({
  name: "get_hole_gps",
  title: "Get hole GPS data",
  description:
    "Get GPS geometry for one hole: tee boxes, green front/center/back, and hazards. If lat/lng are provided, distances from that point are included.",
  inputSchema: {
    course_id: z.string().uuid().describe("Course id from list_courses."),
    hole_number: z.number().int().min(1).max(36).describe("Hole number, 1-based."),
    lat: z
      .number()
      .nullable()
      .describe("Optional player latitude for distance calculations."),
    lng: z
      .number()
      .nullable()
      .describe("Optional player longitude for distance calculations."),
    unit: z
      .enum(["yards", "meters"])
      .nullable()
      .describe("Distance unit for computed player distances (default yards)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ course_id, hole_number, lat, lng, unit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: hole, error: hErr } = await supabase
      .from("course_holes")
      .select("id,hole_number,par,yardage")
      .eq("course_id", course_id)
      .eq("hole_number", hole_number)
      .maybeSingle();
    if (hErr) {
      return { content: [{ type: "text", text: `Error: ${hErr.message}` }], isError: true };
    }
    if (!hole) {
      return { content: [{ type: "text", text: "Hole not found." }], isError: true };
    }
    const [teesRes, greenRes, hazRes] = await Promise.all([
      supabase.from("tee_boxes").select("*").eq("hole_id", hole.id).order("color"),
      supabase.from("greens").select("*").eq("hole_id", hole.id).maybeSingle(),
      supabase.from("hazards").select("*").eq("hole_id", hole.id).order("type"),
    ]);
    const tees = teesRes.data ?? [];
    const green = greenRes.data ?? null;
    const hazards = hazRes.data ?? [];

    const useMeters = unit === "meters";
    const distYd = (a: { lat: number; lng: number } | null) =>
      a && lat != null && lng != null
        ? haversineYards(lat, lng, a.lat, a.lng)
        : null;
    const conv = (y: number | null) =>
      y == null ? null : useMeters ? Math.round(y * 0.9144) : y;

    const playerDist =
      lat != null && lng != null && green
        ? {
            to_green_front: conv(distYd({ lat: green.front_lat, lng: green.front_lng })),
            to_green_center: conv(distYd({ lat: green.center_lat, lng: green.center_lng })),
            to_green_back: conv(distYd({ lat: green.back_lat, lng: green.back_lng })),
            unit: useMeters ? "m" : "y",
          }
        : null;

    return {
      content: [
        {
          type: "text",
          text: `Hole ${hole.hole_number} — Par ${hole.par ?? "?"}, ${hole.yardage ?? "?"}y\nTees: ${tees.length}, Hazards: ${hazards.length}${
            playerDist
              ? `\nFrom player: F ${playerDist.to_green_front ?? "?"} / C ${playerDist.to_green_center ?? "?"} / B ${playerDist.to_green_back ?? "?"} ${playerDist.unit}`
              : ""
          }`,
        },
      ],
      structuredContent: { hole, tees, green, hazards, player_distances: playerDist },
    };
  },
});