// G Swing — Golf Story™
//
// Generates a premium written round story directly from a RoundExperienceModel.
// Every sentence must be backed by real stored evidence. If the evidence is
// missing, the sentence is omitted — never fabricated.
//
// Pure module. No IO. Safe to import anywhere.

import type {
  RoundExperienceModel,
  HoleExperience,
} from "@/lib/experience/experience-engine";

export interface StorySentence {
  /** Stable id so React can key the rendered sentence. */
  id: string;
  /** Short tag — used for badges / grouping. */
  kind:
    | "opening"
    | "front_nine"
    | "back_nine"
    | "highlight"
    | "drive"
    | "putting"
    | "recovery"
    | "momentum"
    | "scoring"
    | "closing";
  text: string;
  /** Evidence references — shot ids / hole numbers / moment ids. */
  evidence: {
    shot_ids?: string[];
    hole_numbers?: number[];
    moment_ids?: string[];
  };
}

export interface GolfStory {
  title: string;
  subtitle: string | null;
  sentences: StorySentence[];
  has_sufficient_evidence: boolean;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function lowOrBetter(h: HoleExperience): boolean {
  return h.to_par != null && h.to_par <= 0;
}

export function buildGolfStory(model: RoundExperienceModel): GolfStory {
  const sentences: StorySentence[] = [];
  const { round, holes, signature_moments, player_statistics, momentum_timeline } = model;

  const title = round.course_name
    ? `${round.course_name} — Your Round`
    : "Your Round";
  const subtitle = fmtDate(round.started_at);

  if (!model.has_sufficient_evidence || holes.length === 0) {
    return { title, subtitle, sentences, has_sufficient_evidence: false };
  }

  // Opening — only states what we know: course, holes played, player.
  const player = round.player_name?.trim();
  const openingBits: string[] = [];
  if (player) openingBits.push(player);
  openingBits.push(`played ${holes.length} hole${holes.length === 1 ? "" : "s"}`);
  if (round.course_name) openingBits.push(`at ${round.course_name}`);
  sentences.push({
    id: "opening",
    kind: "opening",
    text: `${openingBits.join(" ")}.`,
    evidence: { hole_numbers: holes.map((h) => h.hole_number) },
  });

  // Front nine summary — only if we have at least one front nine hole with par.
  const front = holes.filter((h) => h.hole_number <= 9 && h.to_par != null);
  if (front.length >= 3) {
    const toPar = front.reduce((a, h) => a + (h.to_par ?? 0), 0);
    const sign = toPar > 0 ? `+${toPar}` : `${toPar}`;
    sentences.push({
      id: "front-nine",
      kind: "front_nine",
      text: `Through the front, the card read ${sign} across ${front.length} hole${front.length === 1 ? "" : "s"}.`,
      evidence: { hole_numbers: front.map((h) => h.hole_number) },
    });
  }

  // Back nine summary.
  const back = holes.filter((h) => h.hole_number >= 10 && h.to_par != null);
  if (back.length >= 3) {
    const toPar = back.reduce((a, h) => a + (h.to_par ?? 0), 0);
    const sign = toPar > 0 ? `+${toPar}` : `${toPar}`;
    sentences.push({
      id: "back-nine",
      kind: "back_nine",
      text: `The back nine settled in at ${sign} across ${back.length} hole${back.length === 1 ? "" : "s"}.`,
      evidence: { hole_numbers: back.map((h) => h.hole_number) },
    });
  }

  // Driving — only if we actually measured a drive.
  if (player_statistics.longestDriveYards != null) {
    const yards = Math.round(player_statistics.longestDriveYards);
    const avg = player_statistics.averageDriveYards
      ? ` Average off the tee landed at ${Math.round(player_statistics.averageDriveYards)} yards.`
      : "";
    sentences.push({
      id: "driving",
      kind: "drive",
      text: `The longest drive of the day measured ${yards} yards.${avg}`,
      evidence: {},
    });
  }

  // Fairways / Greens — only if we tracked attempts.
  if (
    player_statistics.fairwayAttempts > 0 &&
    player_statistics.fairwaysHit != null
  ) {
    sentences.push({
      id: "fairways",
      kind: "scoring",
      text: `Fairways were found ${player_statistics.fairwaysHit} of ${player_statistics.fairwayAttempts} times.`,
      evidence: {},
    });
  }
  if (player_statistics.girAttempts > 0 && player_statistics.greensInRegulation != null) {
    sentences.push({
      id: "girs",
      kind: "scoring",
      text: `Greens in regulation came on ${player_statistics.greensInRegulation} of ${player_statistics.girAttempts} holes.`,
      evidence: {},
    });
  }

  // Putting — only if we have putts recorded.
  if (player_statistics.putts > 0) {
    sentences.push({
      id: "putts",
      kind: "putting",
      text: `${player_statistics.putts} putt${player_statistics.putts === 1 ? "" : "s"} were holed across the round.`,
      evidence: {},
    });
  }

  // Highlights — only from real detected signature moments.
  const featured = signature_moments.slice(0, 3);
  for (const m of featured) {
    sentences.push({
      id: `moment-${m.id}`,
      kind: "highlight",
      text: m.subtitle.endsWith(".") ? m.subtitle : `${m.subtitle}.`,
      evidence: {
        moment_ids: [m.id],
        shot_ids: m.shot_ids,
        hole_numbers: m.hole_number != null ? [m.hole_number] : undefined,
      },
    });
  }

  // Streak / momentum — only if any holes were par-or-better consecutively.
  let bestStreak = 0;
  let streakEnd: HoleExperience | null = null;
  let cur = 0;
  for (const h of holes) {
    if (lowOrBetter(h)) {
      cur += 1;
      if (cur > bestStreak) {
        bestStreak = cur;
        streakEnd = h;
      }
    } else cur = 0;
  }
  if (bestStreak >= 3 && streakEnd) {
    sentences.push({
      id: "streak",
      kind: "momentum",
      text: `A run of ${bestStreak} clean holes carried through Hole ${streakEnd.hole_number}.`,
      evidence: { hole_numbers: [streakEnd.hole_number] },
    });
  }

  // Recovery — only if a recovery shot exists in stored data.
  const recoveryShots = model.shots.filter((s) => s.results.includes("Recovery"));
  if (recoveryShots.length > 0) {
    sentences.push({
      id: "recovery",
      kind: "recovery",
      text: `Trouble was answered with ${recoveryShots.length} recovery shot${recoveryShots.length === 1 ? "" : "s"}.`,
      evidence: { shot_ids: recoveryShots.map((s) => s.id) },
    });
  }

  // Closing — only if we have a final score progression entry.
  const finalProg = model.score_progression[model.score_progression.length - 1];
  if (finalProg) {
    if (finalProg.to_par != null && finalProg.cumulative_par != null) {
      const sign = finalProg.to_par > 0 ? `+${finalProg.to_par}` : `${finalProg.to_par}`;
      sentences.push({
        id: "closing",
        kind: "closing",
        text: `Final card: ${finalProg.cumulative_strokes} strokes (${sign}) across ${holes.length} hole${holes.length === 1 ? "" : "s"}.`,
        evidence: { hole_numbers: holes.map((h) => h.hole_number) },
      });
    } else {
      sentences.push({
        id: "closing",
        kind: "closing",
        text: `Final card: ${finalProg.cumulative_strokes} strokes across ${holes.length} hole${holes.length === 1 ? "" : "s"}.`,
        evidence: { hole_numbers: holes.map((h) => h.hole_number) },
      });
    }
  }

  // Momentum tone — only if we have momentum points to back it.
  if (momentum_timeline.length >= 5) {
    const last = momentum_timeline[momentum_timeline.length - 1];
    if (last.momentum >= 65) {
      sentences.push({
        id: "tone",
        kind: "momentum",
        text: "The round closed with momentum trending upward.",
        evidence: { shot_ids: [last.shot_id] },
      });
    } else if (last.momentum <= 35) {
      sentences.push({
        id: "tone",
        kind: "momentum",
        text: "The round closed with momentum working against the player.",
        evidence: { shot_ids: [last.shot_id] },
      });
    }
  }

  return {
    title,
    subtitle,
    sentences,
    has_sufficient_evidence: sentences.length > 1,
  };
}