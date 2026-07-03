// Club recommender — chooses the club from the user's My Bag whose saved
// carry distance best matches a live distance measurement.
//
// Pure module. No network, no GolfAPI calls. All distances are compared
// in metres so we can accept measurements from either the yards or
// metres UI toggle without introducing rounding drift.

import type { Club } from "@/lib/gswing-store";

const YARDS_PER_METER = 1.09361;
const METERS_PER_YARD = 1 / YARDS_PER_METER;

export interface ClubSuggestion {
  club: Club;
  /** Meters the target is beyond (positive) or short of (negative) the club's carry. */
  gapMeters: number;
  /** Copy-ready hint: "Slight left / 4m short" style. */
  note: string;
  /** 0-100 confidence score. 100 = perfect match, 30 = stretch. */
  confidence: number;
  /** Human-facing tone for the badge. */
  tone: "high" | "medium" | "low" | "stretch";
}

/** Convert an incoming display distance to metres. */
function toMeters(distance: number, unit: "yards" | "meters"): number {
  return unit === "meters" ? distance : distance * METERS_PER_YARD;
}

/**
 * Suggest the shortest club in the bag whose stored carry meets or
 * exceeds the target distance. Falls back to the longest club when
 * the shot is beyond every distance in the bag (marked as a "stretch").
 * Putter (distance 0) is always excluded.
 */
export function suggestClub(
  bag: Club[],
  distance: number,
  unit: "yards" | "meters",
): ClubSuggestion | null {
  if (!bag || bag.length === 0) return null;
  const targetMeters = toMeters(distance, unit);
  if (!Number.isFinite(targetMeters) || targetMeters <= 0) return null;

  // Bag distances are stored in metres already (see MyBag input label).
  const playable = bag
    .filter((c) => Number.isFinite(c.distance) && c.distance > 5)
    .slice()
    .sort((a, b) => a.distance - b.distance);
  if (playable.length === 0) return null;

  // Shortest club that carries the target.
  const cover = playable.find((c) => c.distance >= targetMeters);
  if (cover) {
    const gap = cover.distance - targetMeters;
    const abs = Math.abs(gap);
    // Tight fit → high confidence. Wide gap → we're clubbing well up.
    const confidence =
      abs < 3 ? 98
      : abs < 8 ? 92
      : abs < 15 ? 82
      : abs < 25 ? 72
      : 62;
    const tone: ClubSuggestion["tone"] =
      confidence >= 90 ? "high" : confidence >= 75 ? "medium" : "low";
    return {
      club: cover,
      gapMeters: -gap, // negative = shot is inside the club's carry
      note: gap < 3 ? "Full swing" : `Club up ~${Math.round(gap)}m of green`,
      confidence,
      tone,
    };
  }

  // Beyond every club — recommend the longest and flag the stretch.
  const longest = playable[playable.length - 1];
  const gap = targetMeters - longest.distance;
  const confidence = Math.max(28, Math.round(60 - gap * 2));
  return {
    club: longest,
    gapMeters: gap,
    note: `Stretch · ${Math.round(gap)}m over max carry`,
    confidence,
    tone: "stretch",
  };
}

/** Convenience helper for the HUD: single-line suggestion string. */
export function suggestionLabel(
  suggestion: ClubSuggestion | null,
  unit: "yards" | "meters",
): string | null {
  if (!suggestion) return null;
  const carryDisplay =
    unit === "meters"
      ? Math.round(suggestion.club.distance)
      : Math.round(suggestion.club.distance * YARDS_PER_METER);
  const unitShort = unit === "meters" ? "m" : "yd";
  return `${suggestion.club.name} · ${carryDisplay}${unitShort} carry`;
}