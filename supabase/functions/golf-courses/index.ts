// golf-courses edge function
// Routes (all GET):
//   /functions/v1/golf-courses                         → list all courses
//   /functions/v1/golf-courses/:id                     → course detail
//   /functions/v1/golf-courses/:id/holes               → all holes summary
//   /functions/v1/golf-courses/:id/holes/:num/gps      → full GPS hole data
//   /functions/v1/golf-courses/nearest?lat=&lng=       → nearest course to GPS point
//
// Query params for GPS hole endpoint:
//   ?lat=25.09&lng=55.15&unit=yards   → include player distances

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_ARRIVAL_RADIUS_METERS = 1200;

// ─── Haversine (yards) ────────────────────────────────────────────────────────
function haversineYards(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 1.09361);
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

function toUnit(yards: number, unit: string): number {
  return unit === "meters" ? Math.round(yards * 0.9144) : yards;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return json({ error: message }, status);
}

function parseLatLng(qs: URLSearchParams): { lat: number; lng: number } | null {
  const lat = parseFloat(qs.get("lat") ?? "");
  const lng = parseFloat(qs.get("lng") ?? "");
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function arrivalRadius(qs: URLSearchParams): number {
  const radius = parseInt(qs.get("radius_meters") ?? "", 10);
  if (!Number.isFinite(radius)) return DEFAULT_ARRIVAL_RADIUS_METERS;
  return Math.min(5000, Math.max(100, radius));
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return err("Method not allowed", 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  // Strip prefix: /functions/v1/golf-courses  →  rest of path
  const stripped = url.pathname.replace(/^\/functions\/v1\/golf-courses\/?/, "");
  const parts = stripped ? stripped.split("/").filter(Boolean) : [];
  const qs = url.searchParams;

  try {
    // GET /golf-courses
    if (parts.length === 0 && !qs.has("lat")) {
      const country = qs.get("country"); // optional filter
      let q = supabase.from("golf_courses").select("*").order("country").order("name");
      if (country) q = q.eq("country", country.toUpperCase());
      const { data, error } = await q;
      if (error) throw error;
      return json({ courses: data ?? [] });
    }

    // GET /golf-courses?lat=&lng= or /golf-courses/nearest?lat=&lng=
    if ((parts.length === 0 || (parts.length === 1 && parts[0] === "nearest")) && qs.has("lat") && qs.has("lng")) {
      const pos = parseLatLng(qs);
      if (!pos) return err("Invalid lat/lng");
      const { data: courses, error } = await supabase.from("golf_courses").select("*");
      if (error) throw error;
      if (!courses?.length) return json({ nearest: null });
      const nearest = courses.reduce((best: typeof courses[0], c: typeof courses[0]) => {
        const dBest = haversineMeters(pos.lat, pos.lng, best.lat, best.lng);
        const dC    = haversineMeters(pos.lat, pos.lng, c.lat,    c.lng);
        return dC < dBest ? c : best;
      });
      const distM = haversineMeters(pos.lat, pos.lng, nearest.lat, nearest.lng);
      return json({ nearest, distance_meters: distM });
    }

    // GET /golf-courses/detect?lat=&lng=&radius_meters=&country=
    if (parts.length === 1 && parts[0] === "detect") {
      const pos = parseLatLng(qs);
      if (!pos) return err("Invalid lat/lng");

      const radiusMeters = arrivalRadius(qs);
      const country = qs.get("country")?.toUpperCase();
      let query = supabase.from("golf_courses").select("*");
      if (country) query = query.eq("country", country);

      const { data: courses, error } = await query;
      if (error) throw error;

      if (!courses?.length) {
        return json({
          arrived: false,
          should_auto_select: false,
          nearest: null,
          nearest_candidate: null,
          distance_meters: null,
          arrival_radius_meters: radiusMeters,
          player_position: pos,
        });
      }

      const nearest = courses.reduce((best: typeof courses[0], c: typeof courses[0]) => {
        const dBest = haversineMeters(pos.lat, pos.lng, best.lat, best.lng);
        const dC = haversineMeters(pos.lat, pos.lng, c.lat, c.lng);
        return dC < dBest ? c : best;
      });
      const distanceMeters = haversineMeters(pos.lat, pos.lng, nearest.lat, nearest.lng);
      const arrived = distanceMeters <= radiusMeters;

      return json({
        arrived,
        should_auto_select: arrived,
        nearest: arrived ? nearest : null,
        nearest_candidate: nearest,
        distance_meters: distanceMeters,
        arrival_radius_meters: radiusMeters,
        player_position: pos,
        message: arrived
          ? `Player arrived at ${nearest.name}.`
          : `Nearest course is ${nearest.name}, ${distanceMeters}m away.`,
      });
    }

    const courseId = parts[0];

    // GET /golf-courses/:id
    if (parts.length === 1) {
      const { data, error } = await supabase.from("golf_courses").select("*").eq("id", courseId).single();
      if (error || !data) {
        // Graceful fallback: course not yet in DB. Return 200 so the client
        // can fall back to bundled/offline course metadata without crashing.
        return json({
          course: null,
          course_id: courseId,
          status: "no_data",
          message: "Course metadata not yet available.",
        });
      }
      return json({ course: data });
    }

    // GET /golf-courses/:id/holes
    if (parts.length === 2 && parts[1] === "holes") {
      const { data: holes, error: hErr } = await supabase
        .from("course_holes")
        .select(`
          id, hole_number, par, handicap, notes,
          tee_boxes (color, yardage, lat, lng),
          greens (center_lat, center_lng, depth_yards, width_yards)
        `)
        .eq("course_id", courseId)
        .order("hole_number");
      if (hErr) throw hErr;
      return json({ course_id: courseId, holes: holes ?? [] });
    }

    // GET /golf-courses/:id/holes/:num/gps
    if (parts.length === 4 && parts[1] === "holes" && parts[3] === "gps") {
      const holeNum = parseInt(parts[2], 10);
      if (isNaN(holeNum) || holeNum < 1 || holeNum > 18) return err("Invalid hole number");

      const unit = qs.get("unit") === "meters" ? "meters" : "yards";
      const playerLat = qs.has("lat") ? parseFloat(qs.get("lat")!) : null;
      const playerLng = qs.has("lng") ? parseFloat(qs.get("lng")!) : null;
      const hasPlayer = playerLat !== null && playerLng !== null && !isNaN(playerLat!) && !isNaN(playerLng!);

      // Fetch hole
      const { data: hole, error: hErr } = await supabase
        .from("course_holes")
        .select("id, hole_number, par, handicap, notes")
        .eq("course_id", courseId)
        .eq("hole_number", holeNum)
        .single();

      if (hErr || !hole) {
        // Graceful fallback: hole not in DB yet
        return json({
          course_id: courseId,
          hole_number: holeNum,
          status: "no_data",
          message: "Hole GPS data not yet available for this course.",
          distances: null,
        });
      }

      // Parallel fetches
      const [teesRes, greenRes, hazardsRes] = await Promise.all([
        supabase.from("tee_boxes").select("*").eq("hole_id", hole.id).order("color"),
        supabase.from("greens").select("*").eq("hole_id", hole.id).single(),
        supabase.from("hazards").select("*").eq("hole_id", hole.id).order("type"),
      ]);

      const tees    = teesRes.data    ?? [];
      const green   = greenRes.data;
      const hazards = hazardsRes.data ?? [];

      // Distance calculations (if player position supplied)
      let distances: Record<string, number | null> = {};
      let recommendedTarget: string | null = null;

      if (hasPlayer && green) {
        const pl = playerLat!;
        const pg = playerLng!;
        const toCenter = haversineYards(pl, pg, green.center_lat, green.center_lng);
        const toFront  = haversineYards(pl, pg, green.front_lat,  green.front_lng);
        const toBack   = haversineYards(pl, pg, green.back_lat,   green.back_lng);
        const toPin    = green.pin_lat && green.pin_lng
          ? haversineYards(pl, pg, green.pin_lat, green.pin_lng)
          : null;

        // Nearest tee for player-to-tee reference
        const nearestTee = tees.reduce((b: typeof tees[0] | null, t: typeof tees[0]) => {
          if (!b) return t;
          return haversineYards(pl, pg, t.lat, t.lng) < haversineYards(pl, pg, b.lat, b.lng) ? t : b;
        }, null);

        distances = {
          to_center_of_green: toUnit(toCenter, unit),
          to_front_of_green:  toUnit(toFront,  unit),
          to_back_of_green:   toUnit(toBack,   unit),
          to_pin:             toPin !== null ? toUnit(toPin, unit) : null,
          to_tee_box:         nearestTee ? toUnit(haversineYards(pl, pg, nearestTee.lat, nearestTee.lng), unit) : null,
        };

        // Hazard distances
        const hazardDistances: Record<string, number> = {};
        for (const h of hazards) {
          if (h.lat && h.lng) {
            const key = `${h.type}_${h.label?.toLowerCase().replace(/\s+/g, "_") ?? h.id.slice(0, 8)}`;
            hazardDistances[key] = toUnit(haversineYards(pl, pg, h.lat, h.lng), unit);
          }
        }
        distances.hazards = hazardDistances as unknown as number;

        // Simple target recommendation based on distance to pin
        const dist = toCenter;
        if (dist > 250) recommendedTarget = "Fairway — position for approach";
        else if (dist > 150) recommendedTarget = "Green in regulation target";
        else if (dist > 80)  recommendedTarget = "Short iron to flag";
        else recommendedTarget = "Wedge/chip to pin";
      }

      return json({
        course_id:   courseId,
        hole_number: hole.hole_number,
        par:         hole.par,
        handicap:    hole.handicap,
        notes:       hole.notes,
        unit,
        status: "ok",
        tee_boxes:  tees.map((t: typeof tees[0]) => ({
          color:   t.color,
          yardage: t.yardage,
          lat:     t.lat,
          lng:     t.lng,
        })),
        green: green ? {
          center:      { lat: green.center_lat, lng: green.center_lng },
          front:       { lat: green.front_lat,  lng: green.front_lng  },
          back:        { lat: green.back_lat,   lng: green.back_lng   },
          pin:         green.pin_lat ? { lat: green.pin_lat, lng: green.pin_lng } : null,
          polygon:     green.polygon ?? null,
          depth_yards: green.depth_yards,
          width_yards: green.width_yards,
        } : null,
        hazards: hazards.map((h: typeof hazards[0]) => ({
          type:                 h.type,
          label:                h.label,
          lat:                  h.lat,
          lng:                  h.lng,
          geometry:             h.geometry,
          carry_yards_from_tee: h.carry_yards_from_tee,
        })),
        player_position: hasPlayer ? { lat: playerLat, lng: playerLng } : null,
        distances:       hasPlayer ? distances : null,
        recommended_target: recommendedTarget,
      });
    }

    return err("Route not found", 404);
  } catch (e) {
    console.error("golf-courses error:", e);
    return err(e instanceof Error ? e.message : "Internal error", 500);
  }
});
