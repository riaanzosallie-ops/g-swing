// Pure GPS math — no React, no side-effects. Safe to import in edge functions or tests.

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;
const YARDS_PER_METER = 1.09361;
const METERS_PER_YARD = 0.9144;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversinePart(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  return (
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  );
}

/** Geodesic distance in metres (haversine formula). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(haversinePart(a, b))));
}

/** Geodesic distance in yards. */
export function haversineYards(a: LatLng, b: LatLng): number {
  return Math.round(haversineMeters(a, b) * YARDS_PER_METER);
}

/** Convert yards to metres, rounded to nearest integer. */
export function yardsToMeters(yards: number): number {
  return Math.round(yards * METERS_PER_YARD);
}

/** Convert metres to yards, rounded to nearest integer. */
export function metersToYards(meters: number): number {
  return Math.round(meters * YARDS_PER_METER);
}

/** Return the distance in the display unit requested. */
export function toDisplayUnit(yards: number, unit: "yards" | "meters"): number {
  return unit === "meters" ? yardsToMeters(yards) : yards;
}

export type UnitLabel = "y" | "m";
export function unitLabel(unit: "yards" | "meters"): UnitLabel {
  return unit === "meters" ? "m" : "y";
}

/**
 * Return the 0-based index of the element in `greens` whose centre is
 * closest to `player`. Returns -1 if the array is empty.
 */
export function nearestGreenIndex(player: LatLng, greens: LatLng[]): number {
  if (!greens.length) return -1;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < greens.length; i++) {
    const d = haversineMeters(player, greens[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx  = i;
    }
  }
  return bestIdx;
}

/**
 * Return the nearest 1-based hole number from a list of green centres.
 * `greenCentres[i]` should correspond to hole i+1.
 * Returns null if the list is empty.
 */
export function nearestHoleNumber(player: LatLng, greenCentres: LatLng[]): number | null {
  const idx = nearestGreenIndex(player, greenCentres);
  return idx === -1 ? null : idx + 1;
}

/** Shot distance between two GPS points, in yards. */
export function shotDistanceYards(start: LatLng, end: LatLng): number {
  return haversineYards(start, end);
}

/** Shot distance between two GPS points, in metres. */
export function shotDistanceMeters(start: LatLng, end: LatLng): number {
  return haversineMeters(start, end);
}

/**
 * Rough compass bearing from `a` to `b`, in degrees 0-360 (0 = North).
 * Useful for wind-direction relative distance labels.
 */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const dLon  = toRad(b.lng - a.lng);
  const lat1  = toRad(a.lat);
  const lat2  = toRad(b.lat);
  const y     = Math.sin(dLon) * Math.cos(lat2);
  const x     = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/**
 * Check whether a player is within `radiusYards` of a course centre.
 * Used to decide whether to auto-select a course.
 */
export function isNearCourse(player: LatLng, courseCenter: LatLng, radiusYards = 6000): boolean {
  return haversineYards(player, courseCenter) <= radiusYards;
}
