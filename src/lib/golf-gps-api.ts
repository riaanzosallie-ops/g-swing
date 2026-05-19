// Frontend API client for the golf GPS backend (Supabase Edge Functions).
// All functions are typed end-to-end and return typed responses.
// Import the supabase env vars from Vite's import.meta.env.

import type { LatLng } from "./gps-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GpsUnit = "yards" | "meters";

export interface GolfCourse {
  id: string;
  name: string;
  city: string;
  country: string;       // "AE" | "ZA" | etc.
  lat: number;
  lng: number;
  holes_count: number;
  par: number;
  website: string | null;
  timezone: string;
  created_at: string;
}

export interface CourseArrivalDetection {
  arrived: boolean;
  should_auto_select: boolean;
  nearest: GolfCourse | null;
  nearest_candidate: GolfCourse | null;
  distance_meters: number | null;
  arrival_radius_meters: number;
  player_position: LatLng;
  message?: string;
}

export interface TeeBox {
  color: string;         // "championship" | "white" | "red" | "yellow"
  yardage: number;
  lat: number;
  lng: number;
}

export interface GreenData {
  center: LatLng;
  front:  LatLng;
  back:   LatLng;
  pin:    LatLng | null;
  polygon: GeoJsonPolygon | null;
  depth_yards: number;
  width_yards: number;
}

export interface Hazard {
  type: "bunker" | "water" | "dogleg" | "layup" | "ob" | "trees";
  label: string | null;
  lat:   number | null;
  lng:   number | null;
  geometry: GeoJsonPolygon | GeoJsonLineString | null;
  carry_yards_from_tee: number | null;
}

export interface HoleDistances {
  to_center_of_green: number;
  to_front_of_green:  number;
  to_back_of_green:   number;
  to_pin:             number | null;
  to_tee_box:         number | null;
  hazards:            Record<string, number>;
}

export interface HoleGpsResponse {
  course_id:   string;
  hole_number: number;
  par:         number;
  handicap:    number;
  notes:       string | null;
  unit:        GpsUnit;
  status:      "ok" | "no_data";
  message?:    string;
  tee_boxes:   TeeBox[];
  green:       GreenData | null;
  hazards:     Hazard[];
  player_position: LatLng | null;
  distances:   HoleDistances | null;
  recommended_target: string | null;
}

export interface HoleSummary {
  id: string;
  hole_number: number;
  par: number;
  handicap: number;
  notes: string | null;
  tee_boxes: TeeBox[];
  greens: Pick<GreenData, "center" | "depth_yards" | "width_yards"> | null;
}

export interface ActiveRound {
  id: string;
  course_id: string;
  session_id: string;
  current_hole: number;
  player_lat: number | null;
  player_lng: number | null;
  unit: GpsUnit;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface HoleState {
  id: string;
  round_id: string;
  hole_number: number;
  score: number | null;
  putts: number | null;
  fairway_hit: boolean | null;
  gir: boolean | null;
  notes: string | null;
}

export interface Shot {
  id: string;
  round_id: string;
  hole_number: number;
  shot_number: number;
  start_lat: number;
  start_lng: number;
  end_lat: number | null;
  end_lng: number | null;
  distance_yards: number | null;
  club_used: string | null;
  started_at: string;
  ended_at: string | null;
}

// GeoJSON minimal types
export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}
export interface GeoJsonLineString {
  type: "LineString";
  coordinates: [number, number][];
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}/functions/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `API error ${res.status}`);
  return data as T;
}

// ─── Course API ───────────────────────────────────────────────────────────────

/** List all courses, optionally filtered by country code ("AE", "ZA", …). */
export async function fetchCourses(country?: string): Promise<GolfCourse[]> {
  const qs = country ? `?country=${encodeURIComponent(country)}` : "";
  const data = await apiFetch<{ courses: GolfCourse[] }>(`golf-courses${qs}`);
  return data.courses;
}

/** Get a single course by id. */
export async function fetchCourse(courseId: string): Promise<GolfCourse> {
  const data = await apiFetch<{ course: GolfCourse }>(`golf-courses/${courseId}`);
  return data.course;
}

/** List all holes for a course (summary, no hazards). */
export async function fetchCourseHoles(courseId: string): Promise<HoleSummary[]> {
  const data = await apiFetch<{ holes: HoleSummary[] }>(`golf-courses/${courseId}/holes`);
  return data.holes;
}

/**
 * Full GPS data for a single hole.
 * Pass `playerPos` to receive computed distances from the player's location.
 */
export async function fetchHoleGps(
  courseId: string,
  holeNumber: number,
  options: { playerPos?: LatLng; unit?: GpsUnit } = {},
): Promise<HoleGpsResponse> {
  const qs = new URLSearchParams({ unit: options.unit ?? "yards" });
  if (options.playerPos) {
    qs.set("lat", String(options.playerPos.lat));
    qs.set("lng", String(options.playerPos.lng));
  }
  return apiFetch<HoleGpsResponse>(
    `golf-courses/${courseId}/holes/${holeNumber}/gps?${qs}`,
  );
}

/** Find the nearest course to a GPS position. */
export async function fetchNearestCourse(
  pos: LatLng,
): Promise<{ nearest: GolfCourse | null; distance_meters: number }> {
  const qs = new URLSearchParams({ lat: String(pos.lat), lng: String(pos.lng) });
  return apiFetch(`golf-courses?${qs}`);
}

/** Detect whether a player has arrived at a course and should auto-select it. */
export async function detectCourseArrival(
  pos: LatLng,
  options: { radiusMeters?: number; country?: string } = {},
): Promise<CourseArrivalDetection> {
  const qs = new URLSearchParams({ lat: String(pos.lat), lng: String(pos.lng) });
  if (options.radiusMeters) qs.set("radius_meters", String(options.radiusMeters));
  if (options.country) qs.set("country", options.country);
  return apiFetch<CourseArrivalDetection>(`golf-courses/detect?${qs}`);
}

// ─── Round API ────────────────────────────────────────────────────────────────

/** Start a new active round. `sessionId` should be a UUID stored client-side. */
export async function startRound(params: {
  courseId: string;
  sessionId: string;
  unit?: GpsUnit;
}): Promise<ActiveRound> {
  const data = await apiFetch<{ round: ActiveRound }>("golf-rounds/start", {
    method: "POST",
    body: JSON.stringify({
      course_id:  params.courseId,
      session_id: params.sessionId,
      unit:       params.unit ?? "yards",
    }),
  });
  return data.round;
}

/** Get the full state of a round including hole states and any active shot. */
export async function fetchRound(roundId: string): Promise<{
  round: ActiveRound;
  hole_states: HoleState[];
  active_shot: Shot | null;
}> {
  return apiFetch(`golf-rounds/${roundId}`);
}

/** Push the player's latest GPS position. Returns the updated round and whether hole auto-changed. */
export async function updatePlayerLocation(
  roundId: string,
  pos: LatLng,
): Promise<{ round: ActiveRound; hole_changed: boolean; nearest_hole: number | null }> {
  return apiFetch(`golf-rounds/${roundId}/location`, {
    method: "PATCH",
    body: JSON.stringify({ lat: pos.lat, lng: pos.lng }),
  });
}

/** Manually set the current hole (1-18). */
export async function setCurrentHole(
  roundId: string,
  holeNumber: number,
): Promise<{ round: ActiveRound }> {
  return apiFetch(`golf-rounds/${roundId}/hole`, {
    method: "PATCH",
    body: JSON.stringify({ hole_number: holeNumber }),
  });
}

/** Begin tracking a shot from the player's current position. */
export async function startShot(
  roundId: string,
  pos: LatLng,
  clubUsed?: string,
): Promise<Shot> {
  const data = await apiFetch<{ shot: Shot }>(`golf-rounds/${roundId}/shots/start`, {
    method: "POST",
    body: JSON.stringify({ lat: pos.lat, lng: pos.lng, club_used: clubUsed }),
  });
  return data.shot;
}

/** Mark a shot as landed. Returns the shot with `distance_yards` computed. */
export async function endShot(
  roundId: string,
  endPos: LatLng,
  shotId?: string,
): Promise<{ shot: Shot; distance_yards: number }> {
  return apiFetch(`golf-rounds/${roundId}/shots/end`, {
    method: "POST",
    body: JSON.stringify({ lat: endPos.lat, lng: endPos.lng, shot_id: shotId }),
  });
}

/** Save or update the score for a hole. All fields are optional except hole_number. */
export async function saveHoleScore(
  roundId: string,
  params: {
    hole_number: number;
    score?: number;
    putts?: number;
    fairway_hit?: boolean;
    gir?: boolean;
    notes?: string;
  },
): Promise<HoleState> {
  const data = await apiFetch<{ hole_state: HoleState }>(`golf-rounds/${roundId}/score`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
  return data.hole_state;
}

// ─── Session ID helper ────────────────────────────────────────────────────────

/** Get or generate a persistent anonymous session ID stored in localStorage. */
export function getOrCreateSessionId(): string {
  const KEY = "gswing.gps.sessionId";
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(KEY, id);
  return id;
}
