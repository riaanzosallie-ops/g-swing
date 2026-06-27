// G Swing — Slice D shot tracker.
// Pure data module: persists shots into the existing `golf_shots`
// table (no schema changes), loads shots back for hole replay and
// round-intelligence stats, and derives all stats from REAL stored
// shots only. Never fabricates values.

import { supabase } from "@/integrations/supabase/client";
import { haversineYards, type LatLng } from "@/lib/gps-utils";
import type { HoleGeometryPayload } from "@/lib/course-geometry";

export interface StoredShot {
  id: string;
  round_id: string | null;
  hole_number: number | null;
  shot_number: number | null;
  club: string | null;
  start: LatLng | null;
  end: LatLng | null;
  distance_yards: number | null;
  taken_at: string;
}

interface RawShotRow {
  id: string;
  round_id: string | null;
  hole_number: number | null;
  shot_number: number | null;
  club: string | null;
  distance_yards: number | string | null;
  taken_at: string;
  // PostGIS geography columns are returned as WKB hex strings via the
  // Data API. We parse them lazily below.
  start_location: string | null;
  end_location: string | null;
}

// ---- WKB hex → LatLng (Point, 4326) -----------------------------------------
// Parses a Postgres `geography(Point,4326)` value returned as an EWKB hex
// string. Supports both little- and big-endian. Returns null on any failure
// so callers can gracefully ignore malformed values.
export function parseWkbPoint(hex: string | null | undefined): LatLng | null {
  if (!hex || hex.length < 42) return null;
  try {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    const dv = new DataView(bytes.buffer);
    const little = bytes[0] === 1;
    const type = dv.getUint32(1, little);
    const hasSrid = (type & 0x20000000) !== 0;
    const baseType = type & 0xff;
    if (baseType !== 1) return null; // Point only
    const offset = hasSrid ? 9 : 5;
    if (bytes.length < offset + 16) return null;
    const lng = dv.getFloat64(offset, little);
    const lat = dv.getFloat64(offset + 8, little);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function rowToShot(row: RawShotRow): StoredShot {
  const distance =
    row.distance_yards == null
      ? null
      : typeof row.distance_yards === "string"
        ? Number(row.distance_yards)
        : row.distance_yards;
  return {
    id: row.id,
    round_id: row.round_id,
    hole_number: row.hole_number,
    shot_number: row.shot_number,
    club: row.club,
    start: parseWkbPoint(row.start_location),
    end: parseWkbPoint(row.end_location),
    distance_yards: distance != null && Number.isFinite(distance) ? distance : null,
    taken_at: row.taken_at,
  };
}

const SHOT_COLS =
  "id, round_id, hole_number, shot_number, club, distance_yards, taken_at, start_location, end_location";

/** Persist a completed shot into the existing golf_shots table. */
export async function persistShot(input: {
  roundId: string;
  courseId: string | null;
  holeId?: string | null;
  holeNumber: number;
  shotNumber: number;
  club: string | null;
  start: LatLng;
  end: LatLng;
  distanceYards: number;
}): Promise<StoredShot | null> {
  const startWkt = `SRID=4326;POINT(${input.start.lng} ${input.start.lat})`;
  const endWkt = `SRID=4326;POINT(${input.end.lng} ${input.end.lat})`;
  const { data, error } = await supabase
    .from("golf_shots")
    .insert({
      round_id: input.roundId,
      course_id: input.courseId,
      hole_id: input.holeId ?? null,
      hole_number: input.holeNumber,
      shot_number: input.shotNumber,
      club: input.club,
      distance_yards: input.distanceYards,
      start_location: startWkt,
      end_location: endWkt,
    })
    .select(SHOT_COLS)
    .single();
  if (error || !data) return null;
  return rowToShot(data as RawShotRow);
}

/** All shots for a round (ordered by hole + shot number). */
export async function fetchRoundShots(roundId: string): Promise<StoredShot[]> {
  const { data, error } = await supabase
    .from("golf_shots")
    .select(SHOT_COLS)
    .eq("round_id", roundId)
    .order("hole_number", { ascending: true })
    .order("shot_number", { ascending: true });
  if (error || !data) return [];
  return (data as RawShotRow[]).map(rowToShot);
}

/** Shots for a single hole within a round. */
export function shotsForHole(shots: StoredShot[], holeNumber: number): StoredShot[] {
  return shots.filter((s) => s.hole_number === holeNumber);
}

// ---- Stats engine -----------------------------------------------------------

export interface ClubStat {
  club: string;
  count: number;
  avg: number;
  longest: number;
}

export interface MissPattern {
  left: number;
  right: number;
  short: number;
  long: number;
}

export interface RoundStats {
  totalShots: number;
  totalHoles: number;
  fairwaysHit: number | null;       // null if no fairway geometry was ever available
  fairwayAttempts: number;
  greensInRegulation: number | null; // null when no green geometry available
  girAttempts: number;
  scrambling: { saves: number; opportunities: number } | null;
  putts: number;
  averageDriveYards: number | null;
  longestDriveYards: number | null;
  clubs: ClubStat[];
  missPattern: MissPattern;
  shotHistory: StoredShot[];
}

function isLikelyPutt(shot: StoredShot): boolean {
  if (shot.club && /putt/i.test(shot.club)) return true;
  // Heuristic: very short shot (< 25y) on shot #3+ counts as a putt only
  // if the club is unknown — otherwise trust the club label.
  if (!shot.club && shot.distance_yards != null && shot.distance_yards < 25 && (shot.shot_number ?? 0) >= 2) {
    return true;
  }
  return false;
}

function isDriver(shot: StoredShot): boolean {
  if (!shot.club) return false;
  return /driver/i.test(shot.club);
}

/**
 * Pure stats derivation. `holeGeometries` may be partial; missing geometry
 * means the corresponding stat is omitted (returned as null) instead of
 * fabricated. `holePars` is required only for GIR (par - 2 = regulation).
 */
export function computeRoundStats(
  shots: StoredShot[],
  opts: {
    holePars?: Record<number, number>;
    holeGeometries?: Record<number, HoleGeometryPayload | null | undefined>;
  } = {},
): RoundStats {
  const { holePars = {}, holeGeometries = {} } = opts;
  const holeNumbers = Array.from(
    new Set(shots.map((s) => s.hole_number).filter((h): h is number => h != null)),
  );

  // Club aggregation
  const clubAgg = new Map<string, { sum: number; count: number; longest: number }>();
  for (const s of shots) {
    if (!s.club || s.distance_yards == null) continue;
    if (isLikelyPutt(s)) continue;
    const cur = clubAgg.get(s.club) ?? { sum: 0, count: 0, longest: 0 };
    cur.sum += s.distance_yards;
    cur.count += 1;
    cur.longest = Math.max(cur.longest, s.distance_yards);
    clubAgg.set(s.club, cur);
  }
  const clubs: ClubStat[] = [...clubAgg.entries()]
    .map(([club, v]) => ({
      club,
      count: v.count,
      avg: Math.round(v.sum / v.count),
      longest: Math.round(v.longest),
    }))
    .sort((a, b) => b.avg - a.avg);

  // Driver stats
  const driverShots = shots.filter((s) => isDriver(s) && s.distance_yards != null);
  const longestDrive = driverShots.length
    ? Math.round(Math.max(...driverShots.map((s) => s.distance_yards as number)))
    : null;
  const avgDrive = driverShots.length
    ? Math.round(driverShots.reduce((acc, s) => acc + (s.distance_yards as number), 0) / driverShots.length)
    : null;

  // Putts
  const putts = shots.filter(isLikelyPutt).length;

  // Fairways / GIR — require geometry per hole; skip silently when missing
  let fairwaysHit = 0;
  let fairwayAttempts = 0;
  let gir = 0;
  let girAttempts = 0;
  let scrambleSaves = 0;
  let scrambleOpps = 0;
  let anyFairway = false;
  let anyGreen = false;
  let anyPar = false;

  for (const hole of holeNumbers) {
    const geom = holeGeometries[hole];
    const par = holePars[hole];
    const holeShots = shots.filter((s) => s.hole_number === hole);
    const par4plus = par != null && par >= 4;

    // FAIRWAY: requires a fairway polygon AND a tee shot with an end location.
    const fairwayPoly = geom?.fairway?.polygon?.coordinates?.[0] as
      | [number, number][]
      | undefined;
    if (fairwayPoly && par4plus) {
      anyFairway = true;
      const tee = holeShots.find((s) => s.shot_number === 1);
      if (tee?.end) {
        fairwayAttempts += 1;
        if (pointInPolygon(tee.end, fairwayPoly)) fairwaysHit += 1;
      }
    }

    // GIR: green polygon + par + shot whose end is on the green in <= par-2.
    const greenPoly = geom?.green?.polygon?.coordinates?.[0] as
      | [number, number][]
      | undefined;
    if (greenPoly && par != null) {
      anyGreen = true;
      anyPar = true;
      girAttempts += 1;
      const regulation = par - 2;
      let onIn: number | null = null;
      for (const s of holeShots) {
        if (!s.end) continue;
        if (pointInPolygon(s.end, greenPoly)) {
          onIn = s.shot_number ?? 99;
          break;
        }
      }
      if (onIn != null && onIn <= regulation) gir += 1;

      // SCRAMBLING: missed GIR but still made par or better => save
      const holePutts = holeShots.filter(isLikelyPutt).length;
      const score = holeShots.length; // total strokes recorded on the hole
      if (onIn == null || onIn > regulation) {
        scrambleOpps += 1;
        if (score > 0 && score <= par && holePutts <= 2) scrambleSaves += 1;
      }
    }
  }

  // Miss pattern — relative to tee→pin bearing per hole that has both geometry endpoints.
  const miss: MissPattern = { left: 0, right: 0, short: 0, long: 0 };
  for (const hole of holeNumbers) {
    const geom = holeGeometries[hole];
    const pinPt = geom?.points.find((p) => p.point_type === "pin_position");
    const pin: LatLng | null = pinPt
      ? { lat: pinPt.lat, lng: pinPt.lng }
      : geom?.green
        ? { lat: geom.green.center_lat, lng: geom.green.center_lng }
        : null;
    const teeRow =
      geom?.points.find((p) => p.point_type === "tee_back") ??
      geom?.points.find((p) => p.point_type === "tee_middle") ??
      geom?.points.find((p) => p.point_type === "tee_front");
    const teePt: LatLng | null = teeRow ? { lat: teeRow.lat, lng: teeRow.lng } : null;
    if (!pin || !teePt) continue;
    const aim = bearingDegrees(teePt, pin);
    const totalDist = haversineYards(teePt, pin);
    const holeShots = shots.filter((s) => s.hole_number === hole && s.end);
    for (const s of holeShots) {
      if (!s.end) continue;
      const toEnd = bearingDegrees(teePt, s.end);
      let delta = ((toEnd - aim + 540) % 360) - 180; // -180..180
      const distToTeeAlong = haversineYards(teePt, s.end);
      if (Math.abs(delta) > 8) {
        if (delta < 0) miss.left += 1;
        else miss.right += 1;
      }
      if (Math.abs(delta) <= 8) {
        if (distToTeeAlong < totalDist - 12) miss.short += 1;
        else if (distToTeeAlong > totalDist + 12) miss.long += 1;
      }
    }
  }

  return {
    totalShots: shots.length,
    totalHoles: holeNumbers.length,
    fairwaysHit: anyFairway ? fairwaysHit : null,
    fairwayAttempts,
    greensInRegulation: anyGreen && anyPar ? gir : null,
    girAttempts,
    scrambling: anyGreen && anyPar ? { saves: scrambleSaves, opportunities: scrambleOpps } : null,
    putts,
    averageDriveYards: avgDrive,
    longestDriveYards: longestDrive,
    clubs,
    missPattern: miss,
    shotHistory: [...shots].sort((a, b) => b.taken_at.localeCompare(a.taken_at)),
  };
}

// ---- Geometry helpers --------------------------------------------------------

function pointInPolygon(p: LatLng, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > p.lat !== yj > p.lat &&
      p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function bearingDegrees(from: LatLng, to: LatLng): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}