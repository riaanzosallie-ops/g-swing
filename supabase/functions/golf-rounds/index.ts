// golf-rounds edge function
// Routes:
//   POST   /functions/v1/golf-rounds/start               → start new round
//   GET    /functions/v1/golf-rounds/:id                  → get round state
//   PATCH  /functions/v1/golf-rounds/:id/location         → update player GPS
//   PATCH  /functions/v1/golf-rounds/:id/hole             → switch current hole (manual or auto)
//   POST   /functions/v1/golf-rounds/:id/shots/start      → begin tracking a shot
//   POST   /functions/v1/golf-rounds/:id/shots/end        → end shot (calculates distance)
//   PATCH  /functions/v1/golf-rounds/:id/score            → upsert hole score/putts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(message: string, status = 400) { return json({ error: message }, status); }

// ─── Nearest hole inference ───────────────────────────────────────────────────
async function inferNearestHole(
  supabase: ReturnType<typeof createClient>,
  courseId: string,
  lat: number,
  lng: number,
): Promise<number | null> {
  const { data: greens } = await supabase
    .from("greens")
    .select("center_lat, center_lng, hole_id, course_holes!inner(hole_number, course_id)")
    .eq("course_holes.course_id", courseId);

  if (!greens?.length) return null;

  let best: { dist: number; holeNum: number } | null = null;
  for (const g of greens) {
    const d = haversineMeters(lat, lng, g.center_lat, g.center_lng);
    if (!best || d < best.dist) {
      best = { dist: d, holeNum: (g as any).course_holes?.hole_number ?? 1 };
    }
  }
  return best?.holeNum ?? null;
}

// ─── Round helpers ────────────────────────────────────────────────────────────
async function getRound(supabase: ReturnType<typeof createClient>, roundId: string) {
  const { data, error } = await supabase
    .from("active_rounds")
    .select("*")
    .eq("id", roundId)
    .single();
  return { round: data, error };
}

async function getHoleStates(supabase: ReturnType<typeof createClient>, roundId: string) {
  const { data } = await supabase
    .from("round_hole_states")
    .select("*")
    .eq("round_id", roundId)
    .order("hole_number");
  return data ?? [];
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const stripped = url.pathname.replace(/^\/functions\/v1\/golf-rounds\/?/, "");
  const parts = stripped ? stripped.split("/").filter(Boolean) : [];
  const method = req.method;

  let body: Record<string, unknown> = {};
  if (["POST", "PATCH", "PUT"].includes(method)) {
    try { body = await req.json(); } catch { /* empty body ok */ }
  }

  try {
    // POST /golf-rounds/start
    if (method === "POST" && parts[0] === "start") {
      const { course_id, session_id, unit = "yards" } = body as {
        course_id: string; session_id: string; unit?: string;
      };
      if (!course_id || !session_id) return err("course_id and session_id are required");

      // Verify course exists
      const { data: course } = await supabase
        .from("golf_courses").select("id").eq("id", course_id).single();
      if (!course) return err("Course not found", 404);

      const { data: round, error } = await supabase
        .from("active_rounds")
        .insert({ course_id, session_id, unit, current_hole: 1 })
        .select("*")
        .single();
      if (error) throw error;

      return json({ round }, 201);
    }

    // All remaining routes need a round id
    const roundId = parts[0];
    if (!roundId) return err("Route not found", 404);

    // GET /golf-rounds/:id
    if (method === "GET" && parts.length === 1) {
      const { round, error } = await getRound(supabase, roundId);
      if (error || !round) return err("Round not found", 404);
      const states = await getHoleStates(supabase, roundId);

      // Fetch latest open shot if any
      const { data: openShot } = await supabase
        .from("shots")
        .select("*")
        .eq("round_id", roundId)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      return json({ round, hole_states: states, active_shot: openShot ?? null });
    }

    // PATCH /golf-rounds/:id/location
    if (method === "PATCH" && parts[1] === "location") {
      const { lat, lng } = body as { lat: number; lng: number };
      if (lat === undefined || lng === undefined) return err("lat and lng are required");

      const { round, error: rErr } = await getRound(supabase, roundId);
      if (rErr || !round) return err("Round not found", 404);

      // Auto-detect nearest hole
      const nearest = await inferNearestHole(supabase, round.course_id, lat, lng);
      const updatePayload: Record<string, unknown> = {
        player_lat: lat,
        player_lng: lng,
        updated_at: new Date().toISOString(),
      };
      if (nearest && nearest !== round.current_hole) {
        updatePayload.current_hole = nearest;
      }

      const { data: updated, error: uErr } = await supabase
        .from("active_rounds")
        .update(updatePayload)
        .eq("id", roundId)
        .select("*")
        .single();
      if (uErr) throw uErr;

      return json({
        round:          updated,
        hole_changed:   nearest !== null && nearest !== round.current_hole,
        nearest_hole:   nearest,
      });
    }

    // PATCH /golf-rounds/:id/hole
    if (method === "PATCH" && parts[1] === "hole") {
      const { hole_number } = body as { hole_number: number };
      if (!hole_number || hole_number < 1 || hole_number > 18) return err("hole_number 1-18 required");

      const { data: updated, error } = await supabase
        .from("active_rounds")
        .update({ current_hole: hole_number, updated_at: new Date().toISOString() })
        .eq("id", roundId)
        .select("*")
        .single();
      if (error) return err("Round not found", 404);
      return json({ round: updated });
    }

    // POST /golf-rounds/:id/shots/start
    if (method === "POST" && parts[1] === "shots" && parts[2] === "start") {
      const { lat, lng, club_used } = body as {
        lat: number; lng: number; club_used?: string;
      };
      if (lat === undefined || lng === undefined) return err("lat and lng are required");

      const { round, error: rErr } = await getRound(supabase, roundId);
      if (rErr || !round) return err("Round not found", 404);

      // Auto-number this shot within the hole
      const { count } = await supabase
        .from("shots")
        .select("*", { count: "exact", head: true })
        .eq("round_id", roundId)
        .eq("hole_number", round.current_hole);

      const { data: shot, error } = await supabase
        .from("shots")
        .insert({
          round_id:    roundId,
          hole_number: round.current_hole,
          shot_number: (count ?? 0) + 1,
          start_lat:   lat,
          start_lng:   lng,
          club_used:   club_used ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return json({ shot }, 201);
    }

    // POST /golf-rounds/:id/shots/end
    if (method === "POST" && parts[1] === "shots" && parts[2] === "end") {
      const { lat, lng, shot_id } = body as {
        lat: number; lng: number; shot_id?: string;
      };
      if (lat === undefined || lng === undefined) return err("lat and lng are required");

      // Find the open shot (latest unfinished shot for this round, or by id)
      let query = supabase
        .from("shots")
        .select("*")
        .eq("round_id", roundId)
        .is("ended_at", null);
      if (shot_id) query = query.eq("id", shot_id);
      const { data: openShots } = await query.order("started_at", { ascending: false }).limit(1);
      const openShot = openShots?.[0];
      if (!openShot) return err("No active shot found for this round", 404);

      const distYards = haversineYards(openShot.start_lat, openShot.start_lng, lat, lng);
      const { data: updated, error } = await supabase
        .from("shots")
        .update({
          end_lat:        lat,
          end_lng:        lng,
          distance_yards: distYards,
          ended_at:       new Date().toISOString(),
        })
        .eq("id", openShot.id)
        .select("*")
        .single();
      if (error) throw error;
      return json({ shot: updated, distance_yards: distYards });
    }

    // PATCH /golf-rounds/:id/score
    if (method === "PATCH" && parts[1] === "score") {
      const {
        hole_number, score, putts, fairway_hit, gir, notes,
      } = body as {
        hole_number: number; score?: number; putts?: number;
        fairway_hit?: boolean; gir?: boolean; notes?: string;
      };
      if (!hole_number) return err("hole_number required");

      const { data: state, error } = await supabase
        .from("round_hole_states")
        .upsert({
          round_id:    roundId,
          hole_number,
          score:       score ?? null,
          putts:       putts ?? null,
          fairway_hit: fairway_hit ?? null,
          gir:         gir ?? null,
          notes:       notes ?? null,
        }, { onConflict: "round_id,hole_number" })
        .select("*")
        .single();
      if (error) throw error;
      return json({ hole_state: state });
    }

    return err("Route not found", 404);
  } catch (e) {
    console.error("golf-rounds error:", e);
    return err(e instanceof Error ? e.message : "Internal error", 500);
  }
});
