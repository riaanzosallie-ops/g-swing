// G Swing — premium GPS Caddie helpers.
// Pure (no React, no Mapbox). Reuses gps-utils for coordinate math.

import {
  bearingDeg,
  haversineMeters,
  haversineYards,
  toDisplayUnit,
  unitLabel,
  type LatLng,
} from "@/lib/gps-utils";
import type { YardageReadout } from "@/lib/yardage-engine";
import type { GswingWeather } from "@/lib/gswing-weather";

export type GpsUnit = "yards" | "meters";

export interface GreenDistances {
  front: number | null;
  center: number | null;
  back: number | null;
  /** True when front/back came from real geometry. False = mapping required. */
  hasFront: boolean;
  hasBack: boolean;
}

export interface MeasurementReadout {
  distance: number;
  unit: "y" | "m";
  bearing: number;
}

export function calculateDistanceMeters(from: LatLng, to: LatLng): number {
  return haversineMeters(from, to);
}

export function calculateBearing(from: LatLng, to: LatLng): number {
  return bearingDeg(from, to);
}

export function formatDistance(distanceMeters: number, unit: GpsUnit): string {
  const yards = Math.round(distanceMeters * 1.09361);
  const value = unit === "meters" ? Math.round(distanceMeters) : yards;
  return `${value}${unit === "meters" ? "m" : "y"}`;
}

export function measureBetween(
  from: LatLng,
  to: LatLng,
  unit: GpsUnit,
): MeasurementReadout {
  const yards = haversineYards(from, to);
  return {
    distance: toDisplayUnit(yards, unit),
    unit: unitLabel(unit),
    bearing: bearingDeg(from, to),
  };
}

export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/**
 * Build a single-sentence AI-style caddie insight from real evidence only.
 * Never fabricates wind, hazards or green data — falls back to safe strings.
 */
export function buildGpsCaddieInsight(args: {
  readout: YardageReadout | null;
  weather: GswingWeather | null;
  unit: GpsUnit;
  shotBearing?: number | null;
}): string {
  const { readout, weather, unit, shotBearing } = args;
  const u = unit === "meters" ? "m" : "y";

  const center = readout?.center;
  const front = readout?.front;
  const back = readout?.back;

  // Carry call has highest priority.
  if (readout && readout.carries.length > 0) {
    const worst = [...readout.carries].sort((a, b) => b.carry - a.carry)[0];
    const carry = toDisplayUnit(worst.carry, unit);
    return `${worst.label} carry is ${carry}${u}. Favour the safe side.`;
  }

  if (center != null) {
    const c = toDisplayUnit(center, unit);
    let line = `Center is ${c}${u}.`;
    if (front != null && back != null) {
      const depth = back - front;
      line += ` Green plays ${toDisplayUnit(depth, unit)}${u} deep.`;
    }
    if (weather && typeof shotBearing === "number" && weather.windSpeedKmh > 5) {
      const rel = relativeWind(shotBearing, weather.windDirectionDeg);
      line += ` Wind ${Math.round(weather.windSpeedKmh)} km/h ${rel}.`;
    } else if (weather && weather.windSpeedKmh > 5) {
      line += ` Wind ${Math.round(weather.windSpeedKmh)} km/h from ${weather.windDirectionLabel}.`;
    }
    return line;
  }

  if (!readout || (readout.center == null && readout.front == null && readout.back == null)) {
    return "Green mapping required for front, center and back distances.";
  }

  return "Tracking GPS — distances will appear once geometry loads.";
}

/** Returns a relative wind phrase given a shot bearing + wind FROM direction. */
function relativeWind(shotBearing: number, windFromDeg: number): string {
  // wind "from" → blowing toward (windFromDeg + 180) mod 360
  const windTo = (windFromDeg + 180) % 360;
  let delta = ((windTo - shotBearing + 540) % 360) - 180; // -180..180
  const abs = Math.abs(delta);
  if (abs < 30) return "helping";
  if (abs > 150) return "into the wind";
  return delta > 0 ? "left to right" : "right to left";
}

/** GPS accuracy classification used by the Live badge. */
export type GpsAccuracyTier = "high" | "medium" | "low" | "unknown";
export function classifyAccuracy(accuracyMeters: number | null): GpsAccuracyTier {
  if (accuracyMeters == null) return "unknown";
  if (accuracyMeters <= 8) return "high";
  if (accuracyMeters <= 20) return "medium";
  return "low";
}