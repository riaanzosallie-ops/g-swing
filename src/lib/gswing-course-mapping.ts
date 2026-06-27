// Pure helpers for the G-Swing Premium Course Mapping Engine.
// All distances are derived from real coordinates only. Never fabricate values
// when geometry is missing — the helpers return null and the UI shows
// "Mapping required".

import { bearingDeg, haversineMeters, metersToYards } from "@/lib/gps-utils";
import type {
  DoglegTarget,
  FairwayLandingZone,
  GolfGpsSnapshot,
  GpsCoordinate,
  GreenGeometry,
  HazardGeometry,
  LayupTarget,
  MappedHole,
  MeasurementLine,
  PinPosition,
} from "@/types/gswing-course-map";

export type DistanceUnit = "yards" | "meters";

const toLatLng = (c: GpsCoordinate) => ({ lat: c.lat, lng: c.lng });

export function distanceMeters(from: GpsCoordinate, to: GpsCoordinate): number {
  return haversineMeters(toLatLng(from), toLatLng(to));
}

export function bearingDegrees(from: GpsCoordinate, to: GpsCoordinate): number {
  return bearingDeg(toLatLng(from), toLatLng(to));
}

export function formatGolfDistance(meters: number | null, unit: DistanceUnit): string {
  if (meters == null || !Number.isFinite(meters)) return "—";
  return unit === "meters" ? `${Math.round(meters)}m` : `${metersToYards(meters)}y`;
}

function toDisplay(meters: number | null, unit: DistanceUnit): number | null {
  if (meters == null) return null;
  return unit === "meters" ? Math.round(meters) : metersToYards(meters);
}

export interface GreenDistances {
  front: number | null;
  center: number | null;
  back: number | null;
  approximate: boolean;
}

export function deriveGreenDistances(
  player: GpsCoordinate | null,
  green: GreenGeometry | null,
  unit: DistanceUnit = "yards",
): GreenDistances {
  if (!player || !green) return { front: null, center: null, back: null, approximate: false };
  const front = green.front ? toDisplay(distanceMeters(player, green.front), unit) : null;
  const center = green.center ? toDisplay(distanceMeters(player, green.center), unit) : null;
  const back = green.back ? toDisplay(distanceMeters(player, green.back), unit) : null;
  const approximate = center != null && front == null && back == null;
  return { front, center, back, approximate };
}

export function derivePinDistance(
  player: GpsCoordinate | null,
  pin: PinPosition | null,
  unit: DistanceUnit = "yards",
): number | null {
  if (!player || !pin) return null;
  return toDisplay(distanceMeters(player, pin.coordinate), unit);
}

export interface HazardDistances {
  id: string;
  name: string;
  type: HazardGeometry["type"];
  side: HazardGeometry["side"];
  reach: number | null;
  carry: number | null;
}

export function deriveHazardDistances(
  player: GpsCoordinate | null,
  hazards: HazardGeometry[],
  unit: DistanceUnit = "yards",
): HazardDistances[] {
  if (!player) return [];
  return hazards.map((h) => ({
    id: h.id,
    name: h.name,
    type: h.type,
    side: h.side,
    reach: h.front ? toDisplay(distanceMeters(player, h.front), unit) : null,
    carry: h.carry ? toDisplay(distanceMeters(player, h.carry), unit) : null,
  }));
}

export function deriveNearestHazards(
  player: GpsCoordinate | null,
  hazards: HazardGeometry[],
  limit = 3,
  unit: DistanceUnit = "yards",
): HazardDistances[] {
  const all = deriveHazardDistances(player, hazards, unit);
  return all
    .filter((h) => h.reach != null || h.carry != null)
    .sort((a, b) => {
      const ad = a.reach ?? a.carry ?? Infinity;
      const bd = b.reach ?? b.carry ?? Infinity;
      return ad - bd;
    })
    .slice(0, limit);
}

export function deriveLayupDistances(
  player: GpsCoordinate | null,
  layups: LayupTarget[],
  unit: DistanceUnit = "yards",
): Array<{ id: string; name: string; distance: number | null }> {
  if (!player) return layups.map((l) => ({ id: l.id, name: l.name, distance: null }));
  return layups.map((l) => ({
    id: l.id,
    name: l.name,
    distance: toDisplay(distanceMeters(player, l.coordinate), unit),
  }));
}

export function deriveDoglegDistance(
  player: GpsCoordinate | null,
  dogleg: DoglegTarget | null,
  unit: DistanceUnit = "yards",
): number | null {
  if (!player || !dogleg) return null;
  return toDisplay(distanceMeters(player, dogleg.coordinate), unit);
}

export function deriveLandingZoneDistances(
  player: GpsCoordinate | null,
  zones: FairwayLandingZone[],
  unit: DistanceUnit = "yards",
): Array<{ id: string; name: string; distance: number | null }> {
  if (!player) return zones.map((z) => ({ id: z.id, name: z.name, distance: null }));
  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    distance: toDisplay(distanceMeters(player, z.coordinate), unit),
  }));
}

function classifyRisk(reach: number | null, unit: DistanceUnit): "low" | "medium" | "high" | null {
  if (reach == null) return null;
  // Same thresholds for yards or meters — within 50 of carry → high.
  if (reach < (unit === "meters" ? 45 : 50)) return "high";
  if (reach < (unit === "meters" ? 90 : 100)) return "medium";
  return "low";
}

export function buildGolfGpsSnapshot(
  player: GpsCoordinate | null,
  hole: MappedHole | null,
  unit: DistanceUnit = "yards",
): GolfGpsSnapshot {
  if (!hole) {
    return {
      hasMapping: false,
      green: { front: null, center: null, back: null, approximate: false },
      pin: null,
      hazards: [],
      layups: [],
      dogleg: null,
      landingZones: [],
    };
  }
  const green = deriveGreenDistances(player, hole.green, unit);
  const hazards = deriveHazardDistances(player, hole.hazards, unit).map((h) => ({
    ...h,
    risk: classifyRisk(h.reach, unit),
  }));
  const layups = deriveLayupDistances(player, hole.layups, unit);
  const landingZones = deriveLandingZoneDistances(player, hole.landingZones, unit);
  const dogleg = deriveDoglegDistance(player, hole.doglegs[0] ?? null, unit);
  return {
    hasMapping: Boolean(hole.green.center || hole.tees.length || hole.hazards.length),
    green,
    pin: derivePinDistance(player, hole.pin, unit),
    hazards,
    layups,
    dogleg,
    landingZones,
  };
}

/** Build a measurement record from a tap on the map. */
export function buildMeasurementLine(
  from: GpsCoordinate | null,
  to: GpsCoordinate | null,
): MeasurementLine | null {
  if (!from || !to) return null;
  return {
    from,
    to,
    distanceMeters: distanceMeters(from, to),
    bearingDeg: bearingDegrees(from, to),
  };
}