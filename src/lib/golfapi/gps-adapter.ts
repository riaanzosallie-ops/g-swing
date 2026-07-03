// GolfAPI.io → HoleGpsResponse adapter.
// -----------------------------------
// Binds the Live GPS renderer to real cached GolfAPI course data
// (golfapi_courses + golfapi_coordinates + golfapi_tees), so an
// activated golfapi course produces genuine tee / green / pin / hazard
// distances instead of falling back to the Sharjah demo shell.
//
// Pure Supabase read — never triggers a live GolfAPI call during play.

import { supabase } from "@/integrations/supabase/client";
import type {
  GolfCourse,
  GpsUnit,
  Hazard,
  HoleGpsResponse,
  TeeBox,
} from "@/lib/golf-gps-api";
import { haversineYards, toDisplayUnit, type LatLng } from "@/lib/gps-utils";
import type { CachedCourseSummary } from "@/lib/golfapi/client";

/** UUID heuristic — anything not shaped like an UUID is treated as a
 *  provider-native id (GolfAPI course ids are 16-digit numeric strings). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isGolfApiCourseId(id: string | null | undefined): boolean {
  if (!id) return false;
  return !UUID_RE.test(id);
}

/** Convert a cached GolfAPI course summary into the `GolfCourse` shape
 *  the GPS renderer's course list already consumes. */
export function golfApiToGolfCourse(c: CachedCourseSummary): GolfCourse {
  const name = c.courseName?.trim() || c.clubName?.trim() || "Cached course";
  return {
    id: c.courseID,
    name,
    city: c.city ?? "",
    country: c.country ?? "AE",
    lat: c.latitude ?? 0,
    lng: c.longitude ?? 0,
    holes_count: c.numHoles ?? 18,
    par: 72,
    website: null,
    timezone: "Asia/Dubai",
    created_at: c.cachedAt ?? new Date().toISOString(),
  };
}

type CoordRow = {
  hole: number;
  poi: number;
  location: number | null;
  side_fw: number | null;
  latitude: number;
  longitude: number;
};

type CachedTeeRow = {
  tee_name: string | null;
  tee_color: string | null;
  lengths: number[] | null;
};

type CachedCourseRow = {
  course_id: string;
  course_name: string | null;
  num_holes: number | null;
  latitude: number | null;
  longitude: number | null;
  pars_men: number[] | null;
  indexes_men: number[] | null;
};

/**
 * Build a `HoleGpsResponse` for a single hole of a cached GolfAPI course.
 * Returns `null` when the course itself is not cached; returns a partial
 * response (with `status: "no_data"`) when the course exists but no
 * coordinates were cached for the requested hole.
 */
export async function loadGolfApiHoleGps(
  courseId: string,
  holeNumber: number,
  unit: GpsUnit,
  playerPos: LatLng | null,
): Promise<HoleGpsResponse | null> {
  const [courseRes, coordRes, teeRes] = await Promise.all([
    supabase
      .from("golfapi_courses")
      .select("course_id, course_name, num_holes, latitude, longitude, pars_men, indexes_men")
      .eq("course_id", courseId)
      .maybeSingle(),
    supabase
      .from("golfapi_coordinates")
      .select("hole, poi, location, side_fw, latitude, longitude")
      .eq("course_id", courseId)
      .eq("hole", holeNumber),
    supabase
      .from("golfapi_tees")
      .select("tee_name, tee_color, lengths")
      .eq("course_id", courseId),
  ]);

  const course = courseRes.data as CachedCourseRow | null;
  if (!course) return null;

  const coords = (coordRes.data ?? []) as CoordRow[];
  const teeRows = (teeRes.data ?? []) as CachedTeeRow[];
  const parList = Array.isArray(course.pars_men) ? course.pars_men : [];
  const idxList = Array.isArray(course.indexes_men) ? course.indexes_men : [];
  const par = parList[holeNumber - 1] ?? 4;
  const handicap = idxList[holeNumber - 1] ?? 0;

  const display = (yards: number) => toDisplayUnit(yards, unit);

  // --- Tees (poi 11 = front_tee, 12 = back_tee) --------------------------
  const teePoints = coords.filter((c) => c.poi === 11 || c.poi === 12);
  const backTee = teePoints.find((c) => c.poi === 12) ?? null;
  const frontTee = teePoints.find((c) => c.poi === 11) ?? null;

  const tee_boxes: TeeBox[] = [];
  const colorOf = (row: CachedTeeRow, fallback: string): string =>
    (row.tee_color || row.tee_name || fallback).toLowerCase();
  if (backTee) {
    const row = teeRows[0];
    tee_boxes.push({
      color: row ? colorOf(row, "championship") : "championship",
      yardage: row?.lengths?.[holeNumber - 1] ?? 0,
      lat: backTee.latitude,
      lng: backTee.longitude,
    });
  }
  if (frontTee) {
    const row = teeRows[teeRows.length - 1] ?? teeRows[0];
    tee_boxes.push({
      color: row ? colorOf(row, "red") : "red",
      yardage: row?.lengths?.[holeNumber - 1] ?? 0,
      lat: frontTee.latitude,
      lng: frontTee.longitude,
    });
  }

  // --- Green (poi 1, location 1 front / 2 center / 3 back) ---------------
  const greenPoints = coords.filter((c) => c.poi === 1);
  const gFront = greenPoints.find((c) => c.location === 1) ?? null;
  const gCenter = greenPoints.find((c) => c.location === 2) ?? greenPoints[0] ?? null;
  const gBack = greenPoints.find((c) => c.location === 3) ?? null;

  const greenCenter: LatLng | null = gCenter
    ? { lat: gCenter.latitude, lng: gCenter.longitude }
    : null;
  const greenFront: LatLng | null = gFront
    ? { lat: gFront.latitude, lng: gFront.longitude }
    : greenCenter;
  const greenBack: LatLng | null = gBack
    ? { lat: gBack.latitude, lng: gBack.longitude }
    : greenCenter;

  // --- Hazards (bunkers, water, trees) -----------------------------------
  const HAZARD_TYPES: Record<number, Hazard["type"]> = {
    2: "bunker",
    3: "bunker",
    4: "water",
    5: "trees",
  };
  const hazards: Hazard[] = coords
    .filter((c) => HAZARD_TYPES[c.poi])
    .map((c) => ({
      type: HAZARD_TYPES[c.poi],
      label: null,
      lat: c.latitude,
      lng: c.longitude,
      geometry: null,
      carry_yards_from_tee: backTee
        ? Math.round(haversineYards(
            { lat: backTee.latitude, lng: backTee.longitude },
            { lat: c.latitude, lng: c.longitude },
          ))
        : null,
    }));

  const hazardDistances: Record<string, number> = {};
  if (playerPos) {
    hazards.forEach((h, i) => {
      if (h.lat != null && h.lng != null) {
        hazardDistances[`${h.type}_${i}`] = display(
          haversineYards(playerPos, { lat: h.lat, lng: h.lng }),
        );
      }
    });
  }

  const distances = playerPos && greenCenter
    ? {
        to_center_of_green: display(haversineYards(playerPos, greenCenter)),
        to_front_of_green: greenFront
          ? display(haversineYards(playerPos, greenFront))
          : display(haversineYards(playerPos, greenCenter)),
        to_back_of_green: greenBack
          ? display(haversineYards(playerPos, greenBack))
          : display(haversineYards(playerPos, greenCenter)),
        to_pin: display(haversineYards(playerPos, greenCenter)),
        to_tee_box: backTee
          ? display(haversineYards(playerPos, { lat: backTee.latitude, lng: backTee.longitude }))
          : null,
        hazards: hazardDistances,
      }
    : null;

  const status: HoleGpsResponse["status"] =
    greenCenter || tee_boxes.length > 0 ? "ok" : "no_data";
  const message =
    status === "no_data"
      ? "Course data found but GPS coordinates unavailable for this hole"
      : undefined;

  return {
    course_id: courseId,
    hole_number: holeNumber,
    par,
    handicap,
    notes: null,
    unit,
    status,
    message,
    tee_boxes,
    green: greenCenter
      ? {
          center: greenCenter,
          front: greenFront ?? greenCenter,
          back: greenBack ?? greenCenter,
          pin: greenCenter,
          polygon: null,
          depth_yards: greenFront && greenBack
            ? Math.round(haversineYards(greenFront, greenBack))
            : 0,
          width_yards: 0,
        }
      : null,
    hazards,
    player_position: playerPos,
    distances,
    recommended_target: par === 3 ? "Center of green" : "Fairway to green approach",
  };
}

/** Roughly score cached-hole coverage 0..100 (has tee + green + coords). */
export async function computeGolfApiCourseQuality(
  courseId: string,
): Promise<{ score: number; holesWithCoords: number; totalHoles: number }> {
  const [courseRes, coordRes] = await Promise.all([
    supabase
      .from("golfapi_courses")
      .select("num_holes")
      .eq("course_id", courseId)
      .maybeSingle(),
    supabase
      .from("golfapi_coordinates")
      .select("hole, poi")
      .eq("course_id", courseId),
  ]);
  const totalHoles = (courseRes.data?.num_holes as number | null) ?? 18;
  const rows = (coordRes.data ?? []) as Array<{ hole: number; poi: number }>;
  const holesWithGreen = new Set(
    rows.filter((r) => r.poi === 1).map((r) => r.hole),
  ).size;
  const holesWithTee = new Set(
    rows.filter((r) => r.poi === 11 || r.poi === 12).map((r) => r.hole),
  ).size;
  const covered = Math.min(holesWithGreen, holesWithTee);
  const score = totalHoles > 0 ? Math.round((covered / totalHoles) * 100) : 0;
  return { score, holesWithCoords: covered, totalHoles };
}
