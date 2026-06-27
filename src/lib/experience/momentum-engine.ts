// G Swing — Momentum Engine™
//
// Aggregates the momentum_timeline (already computed inside the Experience
// Engine) into six premium metrics: Confidence, Rhythm, Recovery,
// Consistency, Pressure, and Shot Quality. Every metric is calculated from
// stored shots and stored round events — no estimations, no fabrications.
// Insufficient evidence → metric is returned as `null` (UI surfaces
// "Not enough data available").
//
// Pure module. No IO. Safe to import anywhere.

import type {
  RoundExperienceModel,
  MomentumPoint,
} from "@/lib/experience/experience-engine";
import type { StoredShot } from "@/lib/shot-tracker";

export type MomentumScoreKey =
  | "confidence"
  | "rhythm"
  | "recovery"
  | "consistency"
  | "pressure"
  | "shot_quality";

export interface MomentumScore {
  key: MomentumScoreKey;
  label: string;
  /** 0–100, or null when there is not enough evidence. */
  value: number | null;
  /** One short sentence explaining how the score was derived. */
  explanation: string;
  positives: string[];
  negatives: string[];
  evidence: { shot_ids: string[] };
}

export interface MomentumReport {
  scores: MomentumScore[];
  /** Lightweight series for charts — confidence over shots. */
  series: MomentumPoint[];
  /** True when at least one score could be calculated. */
  has_sufficient_evidence: boolean;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function pushIf(list: string[], cond: boolean, msg: string): void {
  if (cond) list.push(msg);
}

function insufficient(
  key: MomentumScoreKey,
  label: string,
): MomentumScore {
  return {
    key,
    label,
    value: null,
    explanation: "Not enough data available.",
    positives: [],
    negatives: [],
    evidence: { shot_ids: [] },
  };
}

function scoreConfidence(timeline: MomentumPoint[]): MomentumScore {
  if (timeline.length < 3) return insufficient("confidence", "Confidence");
  const last5 = timeline.slice(-5);
  const value = clamp(Math.round(avg(last5.map((p) => p.confidence))));
  const positives: string[] = [];
  const negatives: string[] = [];
  pushIf(positives, last5.filter((p) => p.delta === "positive").length >= 3, "Strong recent shots");
  pushIf(positives, value >= 70, "Trending high into the closing stretch");
  pushIf(negatives, last5.filter((p) => p.delta === "negative").length >= 3, "Multiple negative deltas late in the round");
  pushIf(negatives, value <= 35, "Late-round momentum dipped");
  return {
    key: "confidence",
    label: "Confidence",
    value,
    explanation: `Average confidence across your last ${last5.length} tracked shots.`,
    positives,
    negatives,
    evidence: { shot_ids: last5.map((p) => p.shot_id) },
  };
}

function scoreRhythm(shots: StoredShot[]): MomentumScore {
  const timed = shots.filter((s) => s.taken_at);
  if (timed.length < 4) return insufficient("rhythm", "Rhythm");
  const sorted = [...timed].sort((a, b) => a.taken_at.localeCompare(b.taken_at));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const dt = new Date(sorted[i].taken_at).getTime() - new Date(sorted[i - 1].taken_at).getTime();
    if (dt > 0 && dt < 1000 * 60 * 30) gaps.push(dt / 1000); // ignore huge gaps (turn, lunch)
  }
  if (gaps.length < 3) return insufficient("rhythm", "Rhythm");
  const mean = avg(gaps);
  const variance = avg(gaps.map((g) => (g - mean) ** 2));
  const std = Math.sqrt(variance);
  // Lower coefficient of variation = better rhythm.
  const cv = mean > 0 ? std / mean : 1;
  const value = clamp(Math.round(100 - cv * 60));
  const positives: string[] = [];
  const negatives: string[] = [];
  pushIf(positives, value >= 70, "Consistent pace between shots");
  pushIf(negatives, value <= 40, "Pace between shots varied significantly");
  return {
    key: "rhythm",
    label: "Rhythm",
    value,
    explanation: `Derived from time between ${gaps.length + 1} consecutively tracked shots.`,
    positives,
    negatives,
    evidence: { shot_ids: sorted.map((s) => s.id) },
  };
}

function scoreRecovery(shots: StoredShot[]): MomentumScore {
  const trouble = shots.filter(
    (s) =>
      s.results.includes("Penalty") ||
      s.direction === "left" ||
      s.direction === "right",
  );
  if (trouble.length === 0) return insufficient("recovery", "Recovery");
  // For each trouble shot, look at the next shot on the same hole.
  let saves = 0;
  const evidenceIds: string[] = [];
  for (const t of trouble) {
    const next = shots.find(
      (s) =>
        s.hole_number === t.hole_number &&
        (s.shot_number ?? 0) === (t.shot_number ?? 0) + 1,
    );
    if (!next) continue;
    if (
      next.results.includes("Recovery") ||
      next.results.includes("GIR") ||
      next.direction === "straight"
    ) {
      saves += 1;
      evidenceIds.push(t.id, next.id);
    }
  }
  if (trouble.length < 2 && saves === 0) return insufficient("recovery", "Recovery");
  const value = clamp(Math.round((saves / trouble.length) * 100));
  const positives: string[] = [];
  const negatives: string[] = [];
  pushIf(positives, value >= 60, `Saved ${saves} of ${trouble.length} trouble situations`);
  pushIf(negatives, value < 40, `Recovered on ${saves} of ${trouble.length} trouble situations`);
  return {
    key: "recovery",
    label: "Recovery",
    value,
    explanation: `Successful recoveries on the shot following ${trouble.length} trouble situations.`,
    positives,
    negatives,
    evidence: { shot_ids: evidenceIds },
  };
}

function scoreConsistency(timeline: MomentumPoint[]): MomentumScore {
  if (timeline.length < 5) return insufficient("consistency", "Consistency");
  const vals = timeline.map((p) => p.momentum);
  const mean = avg(vals);
  const variance = avg(vals.map((v) => (v - mean) ** 2));
  const std = Math.sqrt(variance);
  // Smaller std → higher consistency.
  const value = clamp(Math.round(100 - std * 2));
  const positives: string[] = [];
  const negatives: string[] = [];
  pushIf(positives, value >= 70, "Momentum stayed steady across the round");
  pushIf(negatives, value <= 40, "Momentum swung significantly between shots");
  return {
    key: "consistency",
    label: "Consistency",
    value,
    explanation: `Stability of momentum across ${timeline.length} tracked shots.`,
    positives,
    negatives,
    evidence: { shot_ids: timeline.map((p) => p.shot_id) },
  };
}

function scorePressure(
  shots: StoredShot[],
  model: RoundExperienceModel,
): MomentumScore {
  // Pressure shots = final shot on a hole (typically a putt or short shot)
  // OR shots after a penalty.
  const pressureShots: StoredShot[] = [];
  for (const hole of model.holes) {
    if (hole.shots.length >= 2) {
      pressureShots.push(hole.shots[hole.shots.length - 1]);
    }
  }
  shots.forEach((s, i) => {
    const prev = shots[i - 1];
    if (prev?.results.includes("Penalty")) pressureShots.push(s);
  });
  if (pressureShots.length < 3) return insufficient("pressure", "Pressure");
  const good = pressureShots.filter(
    (s) =>
      !s.results.includes("Penalty") &&
      (s.direction === "straight" ||
        s.results.includes("GIR") ||
        s.results.includes("Recovery") ||
        s.results.includes("Putt")),
  ).length;
  const value = clamp(Math.round((good / pressureShots.length) * 100));
  const positives: string[] = [];
  const negatives: string[] = [];
  pushIf(positives, value >= 65, `Held up on ${good} of ${pressureShots.length} pressure shots`);
  pushIf(negatives, value < 45, `Pressure shots converted on ${good} of ${pressureShots.length}`);
  return {
    key: "pressure",
    label: "Pressure",
    value,
    explanation: `Conversion rate on ${pressureShots.length} pressure shots (closing shots and post-penalty shots).`,
    positives,
    negatives,
    evidence: { shot_ids: pressureShots.map((s) => s.id) },
  };
}

function scoreShotQuality(shots: StoredShot[]): MomentumScore {
  if (shots.length < 3) return insufficient("shot_quality", "Shot Quality");
  let pts = 0;
  let max = 0;
  for (const s of shots) {
    max += 4;
    if (s.results.includes("FIR")) pts += 2;
    if (s.results.includes("GIR")) pts += 2;
    if (s.direction === "straight") pts += 1;
    if (s.results.includes("Recovery")) pts += 1;
    if (s.results.includes("Penalty")) pts -= 2;
  }
  const value = clamp(Math.round((pts / max) * 100 + 50));
  const fir = shots.filter((s) => s.results.includes("FIR")).length;
  const gir = shots.filter((s) => s.results.includes("GIR")).length;
  const pen = shots.filter((s) => s.results.includes("Penalty")).length;
  const positives: string[] = [];
  const negatives: string[] = [];
  pushIf(positives, fir >= 3, `${fir} fairways found`);
  pushIf(positives, gir >= 2, `${gir} greens in regulation`);
  pushIf(negatives, pen >= 1, `${pen} penalty stroke${pen === 1 ? "" : "s"}`);
  return {
    key: "shot_quality",
    label: "Shot Quality",
    value,
    explanation: `Weighted score across ${shots.length} tracked shots (FIR / GIR / direction / recoveries / penalties).`,
    positives,
    negatives,
    evidence: { shot_ids: shots.map((s) => s.id) },
  };
}

export function buildMomentumReport(model: RoundExperienceModel): MomentumReport {
  const scores: MomentumScore[] = [
    scoreConfidence(model.confidence_timeline),
    scoreRhythm(model.shots),
    scoreRecovery(model.shots),
    scoreConsistency(model.momentum_timeline),
    scorePressure(model.shots, model),
    scoreShotQuality(model.shots),
  ];
  return {
    scores,
    series: model.confidence_timeline,
    has_sufficient_evidence: scores.some((s) => s.value != null),
  };
}