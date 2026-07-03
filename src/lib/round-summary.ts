// G-Swing Round Summary Engine.
// -----------------------------
// Pure functions that turn a persisted RoundState (round-engine.ts) into:
//   • Basic post-round stats (holes played, longest shot, avg distance,
//     most-used club, distance walked).
//   • A stable "memories" foundation the future Fairway Memories /
//     Replay Studio surfaces can consume without a rewrite.
//
// Zero side effects, zero network. All distances are converted to the
// requested unit at read time so the engine stays unit-agnostic.

import type { PathPoint, RoundState, SavedMeasurement } from "@/lib/round-engine";

const YARDS_PER_METER = 1.09361;

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function toDisplay(distance: number, from: "yards" | "meters", to: "yards" | "meters"): number {
  if (from === to) return distance;
  return from === "meters" ? distance * YARDS_PER_METER : distance / YARDS_PER_METER;
}

export interface RoundStats {
  holesPlayed: number;
  measurementsSaved: number;
  clubsUsed: number;
  longestShot: { distance: number; label: string | null; club: string | null } | null;
  averageTargetDistance: number | null;
  mostUsedClub: { name: string; count: number } | null;
  distanceWalked: number; // in the requested display unit
  durationMinutes: number;
  startedAt: number;
  endedAt: number | null;
  unit: "yards" | "meters";
}

export function buildRoundStats(
  round: RoundState,
  unit: "yards" | "meters" = "yards",
): RoundStats {
  const measurements = round.measurements;
  const holes = new Set(measurements.map((m) => m.holeNumber));
  for (const v of round.holeVisits) holes.add(v.holeNumber);

  let longest: RoundStats["longestShot"] = null;
  let sum = 0;
  const clubCounts = new Map<string, number>();
  for (const m of measurements) {
    const d = toDisplay(m.distance, m.unit, unit);
    sum += d;
    if (!longest || d > longest.distance) {
      longest = {
        distance: Math.round(d),
        label: m.targetLabel ?? null,
        club: m.clubName ?? null,
      };
    }
    if (m.clubName) clubCounts.set(m.clubName, (clubCounts.get(m.clubName) ?? 0) + 1);
  }

  let mostUsedClub: RoundStats["mostUsedClub"] = null;
  for (const [name, count] of clubCounts) {
    if (!mostUsedClub || count > mostUsedClub.count) mostUsedClub = { name, count };
  }

  let walkedM = 0;
  const path = round.path;
  for (let i = 1; i < path.length; i++) {
    walkedM += haversineMeters(path[i - 1], path[i]);
  }
  const walked = unit === "meters" ? walkedM : walkedM * YARDS_PER_METER;

  const end = round.endedAt ?? Date.now();
  const durationMinutes = Math.max(0, Math.round((end - round.startedAt) / 60000));

  return {
    holesPlayed: holes.size,
    measurementsSaved: measurements.length,
    clubsUsed: clubCounts.size,
    longestShot: longest ? { ...longest, distance: Math.round(longest.distance) } : null,
    averageTargetDistance: measurements.length
      ? Math.round(sum / measurements.length)
      : null,
    mostUsedClub,
    distanceWalked: Math.round(walked),
    durationMinutes,
    startedAt: round.startedAt,
    endedAt: round.endedAt,
    unit,
  };
}

/** Timeline row for the round summary UI and Fairway Memories. */
export interface RoundTimelineEntry {
  holeNumber: number;
  enteredAt: number;
  exitedAt: number | null;
  measurements: SavedMeasurement[];
  path: PathPoint[];
  longestShot: SavedMeasurement | null;
}

export function buildRoundTimeline(round: RoundState): RoundTimelineEntry[] {
  const byHole = new Map<number, RoundTimelineEntry>();
  for (const v of round.holeVisits) {
    byHole.set(v.holeNumber, {
      holeNumber: v.holeNumber,
      enteredAt: v.enteredAt,
      exitedAt: v.exitedAt,
      measurements: [],
      path: [],
      longestShot: null,
    });
  }
  for (const m of round.measurements) {
    const entry =
      byHole.get(m.holeNumber) ??
      byHole
        .set(m.holeNumber, {
          holeNumber: m.holeNumber,
          enteredAt: m.savedAt,
          exitedAt: null,
          measurements: [],
          path: [],
          longestShot: null,
        })
        .get(m.holeNumber)!;
    entry.measurements.push(m);
    if (!entry.longestShot || m.distance > entry.longestShot.distance) {
      entry.longestShot = m;
    }
  }
  for (const p of round.path) {
    if (p.holeNumber == null) continue;
    const entry = byHole.get(p.holeNumber);
    if (entry) entry.path.push(p);
  }
  return Array.from(byHole.values()).sort((a, b) => a.enteredAt - b.enteredAt);
}

/** Fairway Memories foundation — a stable, serializable per-round record. */
export interface FairwayMemoriesSnapshot {
  roundId: string;
  courseId: string | null;
  courseName: string | null;
  startedAt: number;
  endedAt: number | null;
  unit: "yards" | "meters";
  stats: RoundStats;
  timeline: RoundTimelineEntry[];
}

export function buildFairwayMemories(
  round: RoundState,
  unit: "yards" | "meters" = "yards",
): FairwayMemoriesSnapshot {
  return {
    roundId: round.roundId,
    courseId: round.courseId,
    courseName: round.courseName,
    startedAt: round.startedAt,
    endedAt: round.endedAt,
    unit,
    stats: buildRoundStats(round, unit),
    timeline: buildRoundTimeline(round),
  };
}