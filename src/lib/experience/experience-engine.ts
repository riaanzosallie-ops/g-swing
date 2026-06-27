// G Swing — Experience Engine.
//
// Single source of truth for every premium G Swing experience.
// Builds an immutable "Round Experience Model" entirely from real stored
// evidence (golf_shots, hole geometry, round metadata). Replay Studio,
// Signature Moments, Golf Story, AI Coach, Broadcast, Season Journey
// and Memory Book all consume this model — no module recalculates the
// same data on its own.
//
// Pure: no React, no Mapbox, no IO. Safe to import anywhere.

import { haversineYards } from "@/lib/gps-utils";
import {
  computeRoundStats,
  type ClubStat,
  type MissPattern,
  type RoundStats,
  type StoredShot,
} from "@/lib/shot-tracker";
import type { HoleGeometryPayload } from "@/lib/course-geometry";

/* ============== Types ====================================================== */

export interface RoundMeta {
  /** Stable id (matches golf_shots.round_id). */
  id: string;
  course_id: string | null;
  course_name: string | null;
  started_at: string | null;
  /** Player display name (from useBag/Profile, never fabricated). */
  player_name: string | null;
  unit: "yards" | "meters";
}

export interface HoleExperience {
  hole_number: number;
  par: number | null;
  shots: StoredShot[];
  /** Strokes recorded on this hole (= shots.length when known). */
  strokes: number;
  /** strokes - par (null when par unknown). */
  to_par: number | null;
  /** Total shot distance for the hole, yards (sum of recorded distances). */
  total_yards: number;
  /** Hole geometry payload when available — used by Replay Studio. */
  geometry: HoleGeometryPayload | null;
}

export interface ScoreProgressionPoint {
  hole_number: number;
  cumulative_strokes: number;
  cumulative_par: number | null;
  to_par: number | null;
}

export interface ReplaySegment {
  kind:
    | "opening"
    | "course_flyover"
    | "hole_flyover"
    | "shot"
    | "landing"
    | "score_update"
    | "round_summary"
    | "closing";
  hole_number?: number;
  shot?: StoredShot;
  duration_ms: number;
  caption: string;
  detail?: string | null;
}

export type TimelineItemKind =
  | "shot"
  | "hole_complete"
  | "achievement"
  | "ai_note"
  | "photo"
  | "memory"
  | "coach_note"
  | "broadcast";

export interface TimelineItem {
  id: string;
  kind: TimelineItemKind;
  hole_number: number | null;
  at: string;
  title: string;
  subtitle?: string | null;
  evidence?: { shot_ids?: string[]; achievement_id?: string };
}

export type MomentumDelta = "positive" | "neutral" | "negative";

export interface MomentumPoint {
  hole_number: number;
  shot_number: number;
  shot_id: string;
  momentum: number;
  confidence: number;
  delta: MomentumDelta;
  reason: string;
}

export type SignatureMomentType =
  | "longest_drive"
  | "closest_to_pin"
  | "longest_putt"
  | "best_recovery"
  | "birdie"
  | "eagle"
  | "albatross"
  | "hole_in_one"
  | "career_best"
  | "course_best"
  | "breaking_100"
  | "breaking_90"
  | "breaking_80"
  | "breaking_70"
  | "longest_streak"
  | "most_accurate_driver"
  | "most_accurate_iron"
  | "best_round";

export interface SignatureMoment {
  id: string;
  type: SignatureMomentType;
  title: string;
  subtitle: string;
  hole_number: number | null;
  date: string | null;
  club: string | null;
  distance_yards: number | null;
  shot_ids: string[];
  weather: { temp_c?: number; wind_kph?: number; condition?: string } | null;
  ai_commentary: string;
}

export interface AiEvidencePack {
  round_id: string;
  course_name: string | null;
  total_shots: number;
  holes_played: number;
  fairways: { hit: number | null; attempts: number };
  girs: { hit: number | null; attempts: number };
  putts: number;
  longest_drive_yards: number | null;
  average_drive_yards: number | null;
  miss_pattern: MissPattern;
  club_distances: ClubStat[];
  shots: Array<{
    id: string;
    hole: number | null;
    shot: number | null;
    club: string | null;
    distance_yards: number | null;
    direction: string | null;
    results: string[];
  }>;
}

export interface RoundExperienceModel {
  round: RoundMeta;
  holes: HoleExperience[];
  shots: StoredShot[];
  score_progression: ScoreProgressionPoint[];
  replay_timeline: ReplaySegment[];
  player_timeline: TimelineItem[];
  shot_timeline: TimelineItem[];
  signature_moments: SignatureMoment[];
  milestones: TimelineItem[];
  momentum_timeline: MomentumPoint[];
  confidence_timeline: MomentumPoint[];
  weather: { temp_c?: number; wind_kph?: number; condition?: string } | null;
  player_statistics: RoundStats;
  club_statistics: ClubStat[];
  ai_evidence: AiEvidencePack;
  has_sufficient_evidence: boolean;
}

export interface BuildExperienceInput {
  round: RoundMeta;
  shots: StoredShot[];
  hole_geometries?: Record<number, HoleGeometryPayload | null | undefined>;
  hole_pars?: Record<number, number>;
  weather?: { temp_c?: number; wind_kph?: number; condition?: string } | null;
}

/* ============== Helpers ==================================================== */

function uniqueSortedHoles(shots: StoredShot[]): number[] {
  const set = new Set<number>();
  for (const s of shots) if (s.hole_number != null) set.add(s.hole_number);
  return [...set].sort((a, b) => a - b);
}

function pickHolePar(
  hole: number,
  pars: Record<number, number>,
  geometries: Record<number, HoleGeometryPayload | null | undefined>,
): number | null {
  if (pars[hole] != null) return pars[hole];
  const geom = geometries[hole];
  return geom?.hole?.par ?? null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/* ============== Builders =================================================== */

function buildHoles(
  shots: StoredShot[],
  pars: Record<number, number>,
  geometries: Record<number, HoleGeometryPayload | null | undefined>,
): HoleExperience[] {
  return uniqueSortedHoles(shots).map((hole_number) => {
    const holeShots = shots
      .filter((s) => s.hole_number === hole_number)
      .sort((a, b) => (a.shot_number ?? 0) - (b.shot_number ?? 0));
    const par = pickHolePar(hole_number, pars, geometries);
    const strokes = holeShots.length;
    const total_yards = holeShots.reduce((acc, s) => acc + (s.distance_yards ?? 0), 0);
    return {
      hole_number,
      par,
      shots: holeShots,
      strokes,
      to_par: par != null ? strokes - par : null,
      total_yards: Math.round(total_yards),
      geometry: geometries[hole_number] ?? null,
    };
  });
}

function buildScoreProgression(holes: HoleExperience[]): ScoreProgressionPoint[] {
  let cumStrokes = 0;
  let cumPar = 0;
  let anyParMissing = false;
  return holes.map((h) => {
    cumStrokes += h.strokes;
    if (h.par == null) anyParMissing = true;
    else cumPar += h.par;
    const cumulative_par = anyParMissing ? null : cumPar;
    return {
      hole_number: h.hole_number,
      cumulative_strokes: cumStrokes,
      cumulative_par,
      to_par: cumulative_par != null ? cumStrokes - cumulative_par : null,
    };
  });
}

function buildReplayTimeline(meta: RoundMeta, holes: HoleExperience[]): ReplaySegment[] {
  const out: ReplaySegment[] = [];
  out.push({
    kind: "opening",
    duration_ms: 2200,
    caption: meta.course_name
      ? `${meta.player_name ?? "G Swing"} · ${meta.course_name}`
      : "G Swing Replay",
    detail: meta.started_at
      ? new Date(meta.started_at).toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
      : null,
  });
  out.push({
    kind: "course_flyover",
    duration_ms: 3200,
    caption: meta.course_name ?? "Course Flyover",
    detail: `${holes.length} hole${holes.length === 1 ? "" : "s"} played`,
  });
  for (const hole of holes) {
    out.push({
      kind: "hole_flyover",
      hole_number: hole.hole_number,
      duration_ms: 2400,
      caption: `Hole ${hole.hole_number}`,
      detail: hole.par != null ? `Par ${hole.par}` : null,
    });
    for (const shot of hole.shots) {
      if (!shot.start || !shot.end) continue;
      const dist = shot.distance_yards != null ? `${Math.round(shot.distance_yards)}y` : "—";
      const tags = [shot.direction, ...shot.results].filter(Boolean).join(" · ");
      out.push({
        kind: "shot",
        hole_number: hole.hole_number,
        shot,
        duration_ms: 2600,
        caption: `Hole ${hole.hole_number} · ${shot.club ?? "—"} · ${dist}`,
        detail: tags || null,
      });
      out.push({
        kind: "landing",
        hole_number: hole.hole_number,
        shot,
        duration_ms: 800,
        caption: dist,
      });
    }
    out.push({
      kind: "score_update",
      hole_number: hole.hole_number,
      duration_ms: 1400,
      caption:
        hole.par != null && hole.to_par != null
          ? `${hole.strokes} on Par ${hole.par} (${hole.to_par >= 0 ? "+" : ""}${hole.to_par})`
          : `${hole.strokes} strokes`,
    });
  }
  out.push({
    kind: "round_summary",
    duration_ms: 3000,
    caption: "Round Summary",
    detail: `${holes.length} holes · ${holes.reduce((a, h) => a + h.strokes, 0)} strokes`,
  });
  out.push({
    kind: "closing",
    duration_ms: 1800,
    caption: "G Swing",
    detail: "Every shot. Every story.",
  });
  return out;
}

function momentumDelta(
  shot: StoredShot,
  prev: StoredShot | null,
): { delta: number; reason: string; tone: MomentumDelta } {
  let delta = 0;
  const reasons: string[] = [];
  if (shot.results.includes("FIR")) { delta += 8; reasons.push("Fairway hit"); }
  if (shot.results.includes("GIR")) { delta += 12; reasons.push("Green in regulation"); }
  if (shot.results.includes("Penalty")) { delta -= 18; reasons.push("Penalty stroke"); }
  if (shot.results.includes("Recovery")) { delta += 6; reasons.push("Recovery shot"); }
  if (shot.direction === "straight" && !shot.results.includes("Penalty")) delta += 3;
  if (shot.direction === "left" || shot.direction === "right") delta -= 2;
  if (prev?.results.includes("Penalty") && (shot.results.includes("Recovery") || shot.direction === "straight")) {
    delta += 6;
    reasons.push("Bounce-back after penalty");
  }
  return {
    delta,
    reason: reasons.join(" · ") || "Neutral shot",
    tone: delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral",
  };
}

function buildMomentumTimeline(shots: StoredShot[]): MomentumPoint[] {
  const ordered = [...shots].sort((a, b) => {
    if ((a.hole_number ?? 0) !== (b.hole_number ?? 0))
      return (a.hole_number ?? 0) - (b.hole_number ?? 0);
    return (a.shot_number ?? 0) - (b.shot_number ?? 0);
  });
  let momentum = 50;
  let confidence = 50;
  const out: MomentumPoint[] = [];
  let prev: StoredShot | null = null;
  for (const s of ordered) {
    const { delta, reason, tone } = momentumDelta(s, prev);
    momentum = clamp(momentum + delta, 0, 100);
    confidence = clamp(confidence * 0.7 + momentum * 0.3, 0, 100);
    out.push({
      hole_number: s.hole_number ?? 0,
      shot_number: s.shot_number ?? 0,
      shot_id: s.id,
      momentum: Math.round(momentum),
      confidence: Math.round(confidence),
      delta: tone,
      reason,
    });
    prev = s;
  }
  return out;
}

function detectInRoundMoments(meta: RoundMeta, holes: HoleExperience[]): SignatureMoment[] {
  const out: SignatureMoment[] = [];
  const date = meta.started_at;

  const driverShots = holes
    .flatMap((h) => h.shots)
    .filter((s) => s.club && /driver/i.test(s.club) && s.distance_yards != null);
  if (driverShots.length) {
    const longest = driverShots.reduce((a, b) =>
      (a.distance_yards ?? 0) >= (b.distance_yards ?? 0) ? a : b,
    );
    out.push({
      id: `${meta.id}-longest-drive`,
      type: "longest_drive",
      title: "Longest Drive",
      subtitle: `${Math.round(longest.distance_yards ?? 0)} yards · ${longest.club ?? "Driver"}`,
      hole_number: longest.hole_number,
      date,
      club: longest.club,
      distance_yards: longest.distance_yards,
      shot_ids: [longest.id],
      weather: null,
      ai_commentary: `Your longest drive of the round came on Hole ${longest.hole_number ?? "?"} — ${Math.round(
        longest.distance_yards ?? 0,
      )} yards with ${longest.club ?? "the driver"}.`,
    });
  }

  for (const hole of holes) {
    if (hole.par !== 3) continue;
    const tee = hole.shots.find((s) => s.shot_number === 1);
    const pin =
      hole.geometry?.points.find((p) => p.point_type === "pin_position") ??
      (hole.geometry?.green
        ? { lat: hole.geometry.green.center_lat, lng: hole.geometry.green.center_lng }
        : null);
    if (tee?.end && pin) {
      const yards = haversineYards(tee.end, { lat: pin.lat, lng: pin.lng });
      if (yards <= 30) {
        out.push({
          id: `${meta.id}-ctp-${hole.hole_number}`,
          type: "closest_to_pin",
          title: "Closest to Pin",
          subtitle: `${yards} yards from the pin on Hole ${hole.hole_number}`,
          hole_number: hole.hole_number,
          date,
          club: tee.club,
          distance_yards: tee.distance_yards,
          shot_ids: [tee.id],
          weather: null,
          ai_commentary: `A pure tee shot on the par 3 — ${yards} yards from the flag.`,
        });
      }
    }
  }

  const putts = holes
    .flatMap((h) => h.shots)
    .filter(
      (s) =>
        (s.results.includes("Putt") || (s.club && /putt/i.test(s.club))) &&
        s.distance_yards != null,
    );
  if (putts.length) {
    const longestPutt = putts.reduce((a, b) =>
      (a.distance_yards ?? 0) >= (b.distance_yards ?? 0) ? a : b,
    );
    if ((longestPutt.distance_yards ?? 0) >= 10) {
      out.push({
        id: `${meta.id}-longest-putt`,
        type: "longest_putt",
        title: "Longest Putt",
        subtitle: `${Math.round(longestPutt.distance_yards ?? 0)}y drained on Hole ${longestPutt.hole_number}`,
        hole_number: longestPutt.hole_number,
        date,
        club: longestPutt.club,
        distance_yards: longestPutt.distance_yards,
        shot_ids: [longestPutt.id],
        weather: null,
        ai_commentary: `That ${Math.round(longestPutt.distance_yards ?? 0)}-yard putt on Hole ${longestPutt.hole_number} dropped.`,
      });
    }
  }

  for (const hole of holes) {
    if (hole.to_par == null || hole.to_par > 0) continue;
    const recovery = hole.shots.find((s) => s.results.includes("Recovery"));
    if (recovery) {
      out.push({
        id: `${meta.id}-recovery-${hole.hole_number}`,
        type: "best_recovery",
        title: "Best Recovery",
        subtitle: `Saved par or better on Hole ${hole.hole_number} after a recovery shot`,
        hole_number: hole.hole_number,
        date,
        club: recovery.club,
        distance_yards: recovery.distance_yards,
        shot_ids: [recovery.id],
        weather: null,
        ai_commentary: `Bounce-back of the round — recovery shot on Hole ${hole.hole_number} salvaged par.`,
      });
      break;
    }
  }

  for (const hole of holes) {
    if (hole.to_par == null) continue;
    if (hole.strokes === 1) {
      out.push({
        id: `${meta.id}-hio-${hole.hole_number}`,
        type: "hole_in_one",
        title: "Hole In One",
        subtitle: `Ace on Hole ${hole.hole_number}`,
        hole_number: hole.hole_number,
        date,
        club: hole.shots[0]?.club ?? null,
        distance_yards: hole.shots[0]?.distance_yards ?? null,
        shot_ids: hole.shots.map((s) => s.id),
        weather: null,
        ai_commentary: `An ace on Hole ${hole.hole_number}. The shot you'll talk about forever.`,
      });
      continue;
    }
    if (hole.to_par <= -3) {
      out.push({
        id: `${meta.id}-albatross-${hole.hole_number}`,
        type: "albatross",
        title: "Albatross",
        subtitle: `Three under par on Hole ${hole.hole_number}`,
        hole_number: hole.hole_number,
        date,
        club: null,
        distance_yards: null,
        shot_ids: hole.shots.map((s) => s.id),
        weather: null,
        ai_commentary: `Three under par on Hole ${hole.hole_number} — a once-in-a-lifetime moment.`,
      });
    } else if (hole.to_par === -2) {
      out.push({
        id: `${meta.id}-eagle-${hole.hole_number}`,
        type: "eagle",
        title: "Eagle",
        subtitle: `Two under par on Hole ${hole.hole_number}`,
        hole_number: hole.hole_number,
        date,
        club: null,
        distance_yards: null,
        shot_ids: hole.shots.map((s) => s.id),
        weather: null,
        ai_commentary: `Eagle on Hole ${hole.hole_number}. Elite scoring.`,
      });
    } else if (hole.to_par === -1) {
      out.push({
        id: `${meta.id}-birdie-${hole.hole_number}`,
        type: "birdie",
        title: "Birdie",
        subtitle: `One under par on Hole ${hole.hole_number}`,
        hole_number: hole.hole_number,
        date,
        club: null,
        distance_yards: null,
        shot_ids: hole.shots.map((s) => s.id),
        weather: null,
        ai_commentary: `Birdie on Hole ${hole.hole_number}. Clean execution.`,
      });
    }
  }

  let bestStreak = 0;
  let bestStreakEnd = -1;
  let current = 0;
  holes.forEach((h, i) => {
    if (h.to_par != null && h.to_par <= 0) {
      current += 1;
      if (current > bestStreak) {
        bestStreak = current;
        bestStreakEnd = i;
      }
    } else current = 0;
  });
  if (bestStreak >= 3 && bestStreakEnd >= 0) {
    const endHole = holes[bestStreakEnd];
    out.push({
      id: `${meta.id}-streak-${endHole.hole_number}`,
      type: "longest_streak",
      title: "Longest Streak",
      subtitle: `${bestStreak} consecutive pars or better, through Hole ${endHole.hole_number}`,
      hole_number: endHole.hole_number,
      date,
      club: null,
      distance_yards: null,
      shot_ids: [],
      weather: null,
      ai_commentary: `You strung together ${bestStreak} clean holes in a row.`,
    });
  }

  return out;
}

function buildPlayerTimeline(
  holes: HoleExperience[],
  moments: SignatureMoment[],
): { full: TimelineItem[]; shotsOnly: TimelineItem[]; milestones: TimelineItem[] } {
  const items: TimelineItem[] = [];
  for (const hole of holes) {
    for (const shot of hole.shots) {
      items.push({
        id: `shot-${shot.id}`,
        kind: "shot",
        hole_number: hole.hole_number,
        at: shot.taken_at,
        title: `Hole ${hole.hole_number} · Shot ${shot.shot_number ?? "?"}`,
        subtitle:
          [
            shot.club,
            shot.distance_yards != null ? `${Math.round(shot.distance_yards)}y` : null,
            shot.direction,
            ...shot.results,
          ]
            .filter(Boolean)
            .join(" · ") || null,
        evidence: { shot_ids: [shot.id] },
      });
    }
    const lastShot = hole.shots[hole.shots.length - 1];
    items.push({
      id: `hole-${hole.hole_number}`,
      kind: "hole_complete",
      hole_number: hole.hole_number,
      at: lastShot?.taken_at ?? new Date(0).toISOString(),
      title: `Hole ${hole.hole_number} complete`,
      subtitle:
        hole.par != null && hole.to_par != null
          ? `${hole.strokes} strokes on Par ${hole.par} (${hole.to_par >= 0 ? "+" : ""}${hole.to_par})`
          : `${hole.strokes} strokes`,
    });
  }
  const milestones: TimelineItem[] = moments.map((m) => ({
    id: `moment-${m.id}`,
    kind: "achievement",
    hole_number: m.hole_number,
    at: m.date ?? new Date().toISOString(),
    title: m.title,
    subtitle: m.subtitle,
    evidence: { shot_ids: m.shot_ids, achievement_id: m.id },
  }));
  const full = [...items, ...milestones].sort((a, b) => a.at.localeCompare(b.at));
  const shotsOnly = full.filter((i) => i.kind === "shot");
  return { full, shotsOnly, milestones };
}

function buildAiEvidence(meta: RoundMeta, stats: RoundStats, shots: StoredShot[]): AiEvidencePack {
  return {
    round_id: meta.id,
    course_name: meta.course_name,
    total_shots: stats.totalShots,
    holes_played: stats.totalHoles,
    fairways: { hit: stats.fairwaysHit, attempts: stats.fairwayAttempts },
    girs: { hit: stats.greensInRegulation, attempts: stats.girAttempts },
    putts: stats.putts,
    longest_drive_yards: stats.longestDriveYards,
    average_drive_yards: stats.averageDriveYards,
    miss_pattern: stats.missPattern,
    club_distances: stats.clubs,
    shots: shots.map((s) => ({
      id: s.id,
      hole: s.hole_number,
      shot: s.shot_number,
      club: s.club,
      distance_yards: s.distance_yards,
      direction: s.direction,
      results: s.results,
    })),
  };
}

/* ============== Public API ================================================= */

export function buildRoundExperience(input: BuildExperienceInput): RoundExperienceModel {
  const pars = input.hole_pars ?? {};
  const geometries = input.hole_geometries ?? {};
  const shots = [...input.shots].sort((a, b) => {
    if ((a.hole_number ?? 0) !== (b.hole_number ?? 0))
      return (a.hole_number ?? 0) - (b.hole_number ?? 0);
    return (a.shot_number ?? 0) - (b.shot_number ?? 0);
  });
  const holes = buildHoles(shots, pars, geometries);
  const score_progression = buildScoreProgression(holes);
  const replay_timeline = buildReplayTimeline(input.round, holes);
  const momentum_timeline = buildMomentumTimeline(shots);
  const signature_moments = detectInRoundMoments(input.round, holes);
  const { full, shotsOnly, milestones } = buildPlayerTimeline(holes, signature_moments);
  const player_statistics = computeRoundStats(shots, {
    holePars: pars,
    holeGeometries: geometries,
  });
  const ai_evidence = buildAiEvidence(input.round, player_statistics, shots);
  return {
    round: input.round,
    holes,
    shots,
    score_progression,
    replay_timeline,
    player_timeline: full,
    shot_timeline: shotsOnly,
    signature_moments,
    milestones,
    momentum_timeline,
    confidence_timeline: momentum_timeline,
    weather: input.weather ?? null,
    player_statistics,
    club_statistics: player_statistics.clubs,
    ai_evidence,
    has_sufficient_evidence: shots.length > 0,
  };
}

export function emptyExperienceModel(round: RoundMeta): RoundExperienceModel {
  return buildRoundExperience({ round, shots: [] });
}

export type { StoredShot, RoundStats, ClubStat, MissPattern };
export { computeRoundStats };
