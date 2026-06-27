// G Swing — Signature Detector.
//
// Cross-round detector that consumes the Experience Engine output for the
// current round plus optional historical aggregates and emits the
// additional Career/Course/Breaking-X moments. Pure, evidence-based, no IO.
// Never fabricates: when history is absent we simply don't emit those types.

import type {
  RoundExperienceModel,
  SignatureMoment,
} from "@/lib/experience/experience-engine";

export interface RoundHistorySummary {
  /** Total strokes per past round (excluding current). */
  best_total_strokes: number | null;
  /** Best total strokes on this specific course (excluding current). */
  best_course_strokes: number | null;
  /** Past longest drive across all rounds (yards). */
  best_drive_yards: number | null;
  /** Past best fairway hit rate (0..1). */
  best_fairway_rate: number | null;
  /** Past best GIR rate (0..1). */
  best_gir_rate: number | null;
  /** Count of past rounds with enough data. */
  rounds_counted: number;
}

export function emptyHistorySummary(): RoundHistorySummary {
  return {
    best_total_strokes: null,
    best_course_strokes: null,
    best_drive_yards: null,
    best_fairway_rate: null,
    best_gir_rate: null,
    rounds_counted: 0,
  };
}

function currentTotalStrokes(model: RoundExperienceModel): number {
  return model.holes.reduce((acc, h) => acc + h.strokes, 0);
}

function rate(hit: number | null, attempts: number): number | null {
  if (hit == null || !attempts) return null;
  return hit / attempts;
}

/**
 * Detect cross-round moments. Returns ONLY moments backed by real evidence.
 * `history` is optional — when omitted, Career/Course/Best-Round/Most-Accurate
 * moments are intentionally skipped.
 */
export function detectCrossRoundMoments(
  model: RoundExperienceModel,
  history?: RoundHistorySummary,
): SignatureMoment[] {
  const out: SignatureMoment[] = [];
  if (!model.has_sufficient_evidence) return out;

  const strokes = currentTotalStrokes(model);
  const meta = model.round;
  const date = meta.started_at;

  // Breaking-X — based purely on total strokes for the round (must have played 18 holes
  // with a known cumulative par so the result is meaningful).
  const lastProg = model.score_progression[model.score_progression.length - 1];
  if (lastProg && lastProg.cumulative_par != null && model.holes.length >= 18) {
    const thresholds: Array<{ t: 100 | 90 | 80 | 70; type: SignatureMoment["type"] }> = [
      { t: 70, type: "breaking_70" },
      { t: 80, type: "breaking_80" },
      { t: 90, type: "breaking_90" },
      { t: 100, type: "breaking_100" },
    ];
    for (const { t, type } of thresholds) {
      if (strokes < t) {
        out.push({
          id: `${meta.id}-${type}`,
          type,
          title: `Broke ${t}`,
          subtitle: `Finished at ${strokes} strokes`,
          hole_number: null,
          date,
          club: null,
          distance_yards: null,
          shot_ids: [],
          weather: null,
          ai_commentary: `You broke ${t} — a milestone round at ${strokes} strokes.`,
        });
        break; // only the strongest threshold counts
      }
    }
  }

  if (history) {
    if (history.best_total_strokes != null && strokes < history.best_total_strokes) {
      out.push({
        id: `${meta.id}-career-best`,
        type: "career_best",
        title: "Career Best",
        subtitle: `${strokes} strokes — your lowest recorded round`,
        hole_number: null,
        date,
        club: null,
        distance_yards: null,
        shot_ids: [],
        weather: null,
        ai_commentary: `New career best. Previous best was ${history.best_total_strokes}.`,
      });
    }
    if (history.best_course_strokes != null && strokes < history.best_course_strokes) {
      out.push({
        id: `${meta.id}-course-best`,
        type: "course_best",
        title: "Course Best",
        subtitle: `${strokes} strokes at ${meta.course_name ?? "this course"}`,
        hole_number: null,
        date,
        club: null,
        distance_yards: null,
        shot_ids: [],
        weather: null,
        ai_commentary: `Your best round ever at ${meta.course_name ?? "this course"}.`,
      });
    }
    const currentLongest = model.player_statistics.longestDriveYards;
    if (
      currentLongest != null &&
      history.best_drive_yards != null &&
      currentLongest > history.best_drive_yards
    ) {
      out.push({
        id: `${meta.id}-best-drive`,
        type: "longest_drive",
        title: "New Longest Drive",
        subtitle: `${Math.round(currentLongest)}y — exceeded previous best of ${Math.round(
          history.best_drive_yards,
        )}y`,
        hole_number: null,
        date,
        club: null,
        distance_yards: currentLongest,
        shot_ids: [],
        weather: null,
        ai_commentary: `You out-drove your previous best by ${Math.round(
          currentLongest - history.best_drive_yards,
        )} yards.`,
      });
    }

    const fwRate = rate(
      model.player_statistics.fairwaysHit,
      model.player_statistics.fairwayAttempts,
    );
    if (
      fwRate != null &&
      history.best_fairway_rate != null &&
      fwRate > history.best_fairway_rate &&
      model.player_statistics.fairwayAttempts >= 6
    ) {
      out.push({
        id: `${meta.id}-most-accurate-driver`,
        type: "most_accurate_driver",
        title: "Most Accurate Driver",
        subtitle: `${Math.round(fwRate * 100)}% fairways — a personal best`,
        hole_number: null,
        date,
        club: null,
        distance_yards: null,
        shot_ids: [],
        weather: null,
        ai_commentary: `Your best driving accuracy yet — ${Math.round(fwRate * 100)}%.`,
      });
    }
    const girRate = rate(
      model.player_statistics.greensInRegulation,
      model.player_statistics.girAttempts,
    );
    if (
      girRate != null &&
      history.best_gir_rate != null &&
      girRate > history.best_gir_rate &&
      model.player_statistics.girAttempts >= 6
    ) {
      out.push({
        id: `${meta.id}-most-accurate-iron`,
        type: "most_accurate_iron",
        title: "Most Accurate Irons",
        subtitle: `${Math.round(girRate * 100)}% greens in regulation — a personal best`,
        hole_number: null,
        date,
        club: null,
        distance_yards: null,
        shot_ids: [],
        weather: null,
        ai_commentary: `Your sharpest iron play yet — ${Math.round(girRate * 100)}% GIR.`,
      });
    }
    if (
      history.best_total_strokes != null &&
      strokes <= history.best_total_strokes &&
      history.rounds_counted >= 1
    ) {
      out.push({
        id: `${meta.id}-best-round`,
        type: "best_round",
        title: "Best Round",
        subtitle: `${strokes} strokes — equals or beats every recorded round`,
        hole_number: null,
        date,
        club: null,
        distance_yards: null,
        shot_ids: [],
        weather: null,
        ai_commentary: `A defining round.`,
      });
    }
  }

  return out;
}

/**
 * Merge the in-round moments (from the Experience Engine) with the
 * cross-round moments. Dedupes by `id`, keeps the most informative copy.
 */
export function mergeMoments(
  inRound: SignatureMoment[],
  cross: SignatureMoment[],
): SignatureMoment[] {
  const map = new Map<string, SignatureMoment>();
  for (const m of [...inRound, ...cross]) {
    map.set(m.id, m);
  }
  return [...map.values()];
}
