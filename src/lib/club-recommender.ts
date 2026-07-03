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
    return {
      club: cover,
      gapMeters: -gap, // negative = shot is inside the club's carry
      note: gap < 3 ? "Full swing" : `Club up ~${Math.round(gap)}m of green`,
    };
  }

  // Beyond every club — recommend the longest and flag the stretch.
  const longest = playable[playable.length - 1];
  const gap = targetMeters - longest.distance;
  return {
    club: longest,
    gapMeters: gap,
    note: `Stretch · ${Math.round(gap)}m over max carry`,
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