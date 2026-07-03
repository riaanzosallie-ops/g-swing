// G-Swing Golf API client — the ONLY frontend surface for course data.
// Every request routes through the `golf-api` Edge Function; the API key
// stays server-side. Cache-first reads hit Supabase tables directly (RLS
// grants SELECT to authenticated users); writes go through the edge
// function which owns the service-role.

import { supabase } from "@/integrations/supabase/client";

// ---- Vendor types (normalised where useful) -------------------------------

export interface GolfApiClubHit {
  clubID: string;
  clubName: string;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  distance?: number;
  measureUnit?: string;
  courses: Array<{
    courseID: string;
    courseName: string;
    numHoles: number;
    hasGPS: 0 | 1;
  }>;
}

export interface GolfApiTee {
  teeID: string;
  teeName: string | null;
  teeColor: string | null;
  lengths: number[];
  courseRatingMen: number | null;
  slopeMen: number | null;
  courseRatingWomen: number | null;
  slopeWomen: number | null;
}

export interface GolfApiCourse {
  courseID: string;
  clubID: string | null;
  clubName: string;
  courseName: string;
  numHoles: number;
  hasGPS: boolean;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  parsMen: number[];
  indexesMen: number[];
  parsWomen: number[];
  indexesWomen: number[];
  tees: GolfApiTee[];
  cachedAt: string | null;
  raw: unknown;
}

export type PoiType =
  | "green" | "green_bunker" | "fw_bunker" | "water" | "trees"
  | "marker_100" | "marker_150" | "marker_200"
  | "dogleg" | "road" | "front_tee" | "back_tee" | "unknown";

export interface GolfApiCoordinate {
  hole: number;
  poi: PoiType;
  poiCode: number;
  location: 1 | 2 | 3 | null; // 1 front, 2 middle, 3 back
  sideFw: 1 | 2 | 3 | null;   // 1 left, 2 center, 3 right
  latitude: number;
  longitude: number;
}

// ---- Low-level invoke -----------------------------------------------------

async function invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("golf-api", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || `golf-api ${action} failed`);
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

// ---- Health / stats -------------------------------------------------------

export async function ping(): Promise<{ ok: boolean; apiRequestsLeft: string | null; status: number; error?: string }> {
  return invoke("health");
}

export async function stats(): Promise<{ clubs: number; courses: number; coordinates: number }> {
  return invoke("stats");
}

export interface LogRow {
  id: number;
  endpoint: string;
  params: unknown;
  status: number;
  latency_ms: number;
  api_requests_left: string | null;
  error: string | null;
  user_id: string | null;
  created_at: string;
}
export async function recentLogs(): Promise<LogRow[]> {
  const r = await invoke<{ logs: LogRow[] }>("logs");
  return r.logs;
}

// ---- Search / details -----------------------------------------------------

export interface SearchParams {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;
  measureUnit?: "km" | "mi" | "m" | "yd";
  page?: number;
}

export async function searchClubs(p: SearchParams): Promise<{ apiRequestsLeft: string; numClubs: number; clubs: GolfApiClubHit[] }> {
  return invoke("search", { ...p });
}

// ---- Cache-first course fetch --------------------------------------------

const COURSE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function normaliseTee(row: Record<string, unknown>): GolfApiTee {
  const raw = (row.raw as Record<string, unknown> | null) ?? row;
  return {
    teeID: String(row.tee_id ?? raw.teeID ?? ""),
    teeName: (row.tee_name as string | null) ?? (raw.teeName as string | null) ?? null,
    teeColor: (row.tee_color as string | null) ?? (raw.teeColor as string | null) ?? null,
    lengths: Array.isArray(row.lengths) ? (row.lengths as number[]) : [],
    courseRatingMen: (row.course_rating_men as number | null) ?? null,
    slopeMen: (row.slope_men as number | null) ?? null,
    courseRatingWomen: (row.course_rating_women as number | null) ?? null,
    slopeWomen: (row.slope_women as number | null) ?? null,
  };
}

function normaliseCourse(courseRow: Record<string, unknown>, tees: GolfApiTee[], club: Record<string, unknown> | null): GolfApiCourse {
  const raw = (courseRow.raw as Record<string, unknown> | null) ?? {};
  return {
    courseID: String(courseRow.course_id ?? raw.courseID ?? ""),
    clubID: (courseRow.club_id as string | null) ?? (raw.clubID ? String(raw.clubID) : null),
    clubName: (club?.club_name as string | null) ?? (raw.clubName as string | null) ?? "",
    courseName: (courseRow.course_name as string) ?? (raw.courseName as string) ?? "",
    numHoles: (courseRow.num_holes as number | null) ?? 18,
    hasGPS: !!courseRow.has_gps,
    latitude: (courseRow.latitude as number | null) ?? null,
    longitude: (courseRow.longitude as number | null) ?? null,
    city: (club?.city as string | null) ?? (raw.city as string | null) ?? null,
    state: (club?.state as string | null) ?? (raw.state as string | null) ?? null,
    country: (club?.country as string | null) ?? (raw.country as string | null) ?? null,
    address: (club?.address as string | null) ?? (raw.address as string | null) ?? null,
    parsMen: Array.isArray(courseRow.pars_men) ? (courseRow.pars_men as number[]) : [],
    indexesMen: Array.isArray(courseRow.indexes_men) ? (courseRow.indexes_men as number[]) : [],
    parsWomen: Array.isArray(courseRow.pars_women) ? (courseRow.pars_women as number[]) : [],
    indexesWomen: Array.isArray(courseRow.indexes_women) ? (courseRow.indexes_women as number[]) : [],
    tees,
    cachedAt: (courseRow.cached_at as string | null) ?? null,
    raw,
  };
}

async function loadCachedCourse(courseId: string): Promise<GolfApiCourse | null> {
  const { data: course } = await supabase
    .from("golfapi_courses")
    .select("*")
    .eq("course_id", courseId)
    .maybeSingle();
  if (!course) return null;
  const { data: teeRows } = await supabase
    .from("golfapi_tees")
    .select("*")
    .eq("course_id", courseId);
  const club = course.club_id
    ? (await supabase.from("golfapi_clubs").select("*").eq("club_id", course.club_id).maybeSingle()).data
    : null;
  const tees = (teeRows ?? []).map((t) => normaliseTee(t as Record<string, unknown>));
  return normaliseCourse(course as Record<string, unknown>, tees, club as Record<string, unknown> | null);
}

function isStale(cachedAt: string | null): boolean {
  if (!cachedAt) return true;
  return Date.now() - new Date(cachedAt).getTime() > COURSE_TTL_MS;
}

/** Cache-first course load. Set `force=true` to always re-fetch. */
export async function getCourse(courseId: string, opts: { force?: boolean } = {}): Promise<GolfApiCourse> {
  if (!opts.force) {
    const cached = await loadCachedCourse(courseId);
    if (cached && !isStale(cached.cachedAt)) return cached;
  }
  await invoke("course", { id: courseId });
  const fresh = await loadCachedCourse(courseId);
  if (!fresh) throw new Error("Course not found after sync");
  return fresh;
}

// ---- Coordinates ---------------------------------------------------------

const POI_MAP: Record<number, PoiType> = {
  1: "green", 2: "green_bunker", 3: "fw_bunker", 4: "water", 5: "trees",
  6: "marker_100", 7: "marker_150", 8: "marker_200",
  9: "dogleg", 10: "road", 11: "front_tee", 12: "back_tee",
};

function normaliseCoord(row: Record<string, unknown>): GolfApiCoordinate {
  const code = Number(row.poi) || 0;
  return {
    hole: Number(row.hole) || 0,
    poi: POI_MAP[code] ?? "unknown",
    poiCode: code,
    location: (Number(row.location) || null) as GolfApiCoordinate["location"],
    sideFw: (Number(row.side_fw) || null) as GolfApiCoordinate["sideFw"],
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  };
}

export async function getCoordinates(courseId: string, opts: { force?: boolean } = {}): Promise<GolfApiCoordinate[]> {
  if (!opts.force) {
    const { data } = await supabase
      .from("golfapi_coordinates")
      .select("*")
      .eq("course_id", courseId)
      .order("hole");
    if (data && data.length) return data.map((r) => normaliseCoord(r as Record<string, unknown>));
  }
  await invoke("coordinates", { id: courseId });
  const { data } = await supabase
    .from("golfapi_coordinates")
    .select("*")
    .eq("course_id", courseId)
    .order("hole");
  return (data ?? []).map((r) => normaliseCoord(r as Record<string, unknown>));
}

// ---- List cached (for Manage Courses / offline picker) --------------------

export interface CachedCourseSummary {
  courseID: string;
  clubID: string | null;
  clubName: string;
  courseName: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  hasGPS: boolean;
  numHoles: number;
  cachedAt: string | null;
  hasCoordinates: boolean;
}

export async function listCachedCourses(): Promise<CachedCourseSummary[]> {
  const { data: courses } = await supabase
    .from("golfapi_courses")
    .select("course_id, club_id, course_name, num_holes, has_gps, latitude, longitude, cached_at")
    .order("course_name");
  const list = (courses ?? []) as Array<Record<string, unknown>>;
  if (!list.length) return [];
  const clubIds = [...new Set(list.map((c) => c.club_id).filter(Boolean))] as string[];
  const clubsById = new Map<string, Record<string, unknown>>();
  if (clubIds.length) {
    const { data: clubs } = await supabase.from("golfapi_clubs").select("club_id, club_name, city, country").in("club_id", clubIds);
    for (const c of clubs ?? []) clubsById.set(c.club_id, c as Record<string, unknown>);
  }
  const courseIds = list.map((c) => c.course_id as string);
  const coordCounts = new Map<string, number>();
  if (courseIds.length) {
    // Fetch a light aggregate: which courses have any coordinate rows.
    const { data: coordRows } = await supabase
      .from("golfapi_coordinates")
      .select("course_id")
      .in("course_id", courseIds);
    for (const r of coordRows ?? []) {
      coordCounts.set(r.course_id as string, (coordCounts.get(r.course_id as string) ?? 0) + 1);
    }
  }
  return list.map((c) => {
    const club = c.club_id ? clubsById.get(c.club_id as string) : null;
    return {
      courseID: c.course_id as string,
      clubID: (c.club_id as string | null) ?? null,
      clubName: (club?.club_name as string | null) ?? "",
      courseName: c.course_name as string,
      city: (club?.city as string | null) ?? null,
      country: (club?.country as string | null) ?? null,
      latitude: (c.latitude as number | null) ?? null,
      longitude: (c.longitude as number | null) ?? null,
      hasGPS: !!c.has_gps,
      numHoles: (c.num_holes as number | null) ?? 18,
      cachedAt: (c.cached_at as string | null) ?? null,
      hasCoordinates: (coordCounts.get(c.course_id as string) ?? 0) > 0,
    };
  });
}

export async function deleteCachedCourse(courseId: string): Promise<void> {
  // Cascade removes tees + coordinates.
  const { error } = await supabase.from("golfapi_courses").delete().eq("course_id", courseId);
  if (error) throw error;
}