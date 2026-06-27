/**
 * G-Swing live data helpers — single source of truth for honest data display.
 * Never fabricate values. If data is missing, surface an honest empty label.
 */

export function isRealValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function displayOrEmpty(value: unknown, emptyLabel: string): string {
  return isRealValue(value) ? String(value) : emptyLabel;
}

export function formatLiveStat(value: unknown, label: string, emptyLabel: string) {
  const real = isRealValue(value);
  return {
    value: real ? String(value) : "--",
    label: real ? label : emptyLabel,
    isLive: real,
  };
}

export function hasLiveRoundData(rounds: unknown): boolean {
  return Array.isArray(rounds) && rounds.length > 0;
}

export function hasCourseConnection(course: unknown): boolean {
  if (!course || typeof course !== "object") return false;
  const c = course as Record<string, unknown>;
  return isRealValue(c.id) && isRealValue(c.name);
}

export function hasGpsMapping(hole: unknown): boolean {
  if (!hole || typeof hole !== "object") return false;
  const h = hole as Record<string, unknown>;
  // Must have at least a green or tee geometry to be considered mapped
  return isRealValue(h.green) || isRealValue(h.tee) || isRealValue(h.geometry);
}

export function safeLiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export const EMPTY_LABELS = {
  noRounds: "No rounds played yet.",
  startFirst: "Start your first round to unlock live stats.",
  courseNotConnected: "Course not connected yet.",
  weatherUnavailable: "Weather unavailable until course location is added.",
  gpsMappingRequired: "GPS mapping required for this hole.",
  noTournaments: "No tournament data yet.",
  notEnoughData: "Not enough data available.",
  handicapPending: "Handicap pending",
  hazardMappingRequired: "Hazard mapping required.",
  yardageUnavailable: "Yardage unavailable",
  waitingForScores: "Waiting for scores to come in.",
  sponsorAvailable: "Sponsor slot available.",
} as const;