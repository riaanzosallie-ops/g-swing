// Premium camera framing for the owned-geometry path.
// Corridor-driven bounds with par-aware padding and shared-geometry
// clipping so distant trees, neighbouring-hole water, and sprawling
// fairway polygons cannot pull the frame off the active hole.

import type { LatLng } from "@/lib/gps-utils";
import type { GpsCoordinate } from "@/types/gswing-course-map";
import type {
  GswingFeaturePolygon,
  GswingHoleDefinition,
  LngLat,
} from "./course-geometry-model";
import type { HoleBounds } from "@/lib/gswing-hole-projection";

/** Corridor buffer in degrees ~ 120 m at typical latitudes. */
const CORRIDOR_BUFFER_DEG = 0.0011;
/** Trees may fall a little further from the corridor and still frame. */
const TREE_BUFFER_DEG = 0.0009;
/** Shared water is clipped tighter so a neighbouring lake never dominates. */
const WATER_BUFFER_DEG = 0.0008;

function pointToSegmentDistSq(
  p: GpsCoordinate, a: GpsCoordinate, b: GpsCoordinate,
): number {
  const cosLat = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lng * cosLat, py = p.lat;
  const ax = a.lng * cosLat, ay = a.lat;
  const bx = b.lng * cosLat, by = b.lat;
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = px - ax, ey = py - ay;
    return ex * ex + ey * ey;
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const rx = px - (ax + t * dx), ry = py - (ay + t * dy);
  return rx * rx + ry * ry;
}

function nearCorridor(p: GpsCoordinate, corridor: GpsCoordinate[], maxDeg: number): boolean {
  if (corridor.length < 2) return true;
  const maxSq = maxDeg * maxDeg;
  for (let i = 0; i + 1 < corridor.length; i++) {
    if (pointToSegmentDistSq(p, corridor[i], corridor[i + 1]) <= maxSq) return true;
  }
  return false;
}

/**
 * Build the playable corridor for a hole: tee(s) → doglegs → layups → green.
 * Returns a polyline of GpsCoordinate suitable for corridor-distance tests.
 */
export function computeHoleCorridor(def: GswingHoleDefinition): GpsCoordinate[] {
  if (def.corridor && def.corridor.length >= 2) {
    return def.corridor.map(([lng, lat]) => ({ lat, lng }));
  }
  const anchors: GpsCoordinate[] = [];
  for (const t of def.tees) for (const m of t.markers) anchors.push(m);
  for (const d of def.doglegs) anchors.push(d.coordinate);
  for (const l of def.layups) anchors.push(l.coordinate);
  if (def.greenRefs.front) anchors.push(def.greenRefs.front);
  if (def.greenRefs.center) anchors.push(def.greenRefs.center);
  if (def.greenRefs.back) anchors.push(def.greenRefs.back);
  if (def.pin) anchors.push(def.pin.coordinate);
  return anchors;
}

function admitRing(
  ring: LngLat[], corridor: GpsCoordinate[], maxDeg: number, out: GpsCoordinate[],
): void {
  const hasCorridor = corridor.length >= 2;
  for (const [lng, lat] of ring) {
    const p: GpsCoordinate = { lat, lng };
    if (!hasCorridor || nearCorridor(p, corridor, maxDeg)) out.push(p);
  }
}

function collectBoundsPoints(
  def: GswingHoleDefinition, corridor: GpsCoordinate[], player: LatLng | null,
): GpsCoordinate[] {
  const pts: GpsCoordinate[] = [];
  // Tees + green refs + pin always admitted.
  for (const t of def.tees) for (const m of t.markers) pts.push(m);
  if (def.greenRefs.front) pts.push(def.greenRefs.front);
  if (def.greenRefs.center) pts.push(def.greenRefs.center);
  if (def.greenRefs.back) pts.push(def.greenRefs.back);
  if (def.pin) pts.push(def.pin.coordinate);
  // Green polygon always admitted (target must remain fully visible).
  if (def.greenPolygon) for (const [lng, lat] of def.greenPolygon.ring) pts.push({ lat, lng });
  // Tee polygons always admitted (tight by construction).
  for (const tp of def.teePolygons) for (const [lng, lat] of tp.ring) pts.push({ lat, lng });
  // Fairway → corridor-clamped.
  const admitFw = (fw: GswingFeaturePolygon) => admitRing(fw.ring, corridor, CORRIDOR_BUFFER_DEG, pts);
  def.fairwayPolygons.forEach(admitFw);
  // Bunkers → corridor-clamped (they sit near the corridor by definition).
  def.bunkers.forEach((b) => admitRing(b.ring, corridor, CORRIDOR_BUFFER_DEG, pts));
  // Water → tighter buffer (shared lakes must not dominate).
  def.water.forEach((w) => admitRing(w.ring, corridor, WATER_BUFFER_DEG, pts));
  def.penaltyAreas.forEach((w) => admitRing(w.ring, corridor, WATER_BUFFER_DEG, pts));
  // Trees → tighter still (scenery, not framing).
  def.trees.clusters.forEach((c) => admitRing(c.ring, corridor, TREE_BUFFER_DEG, pts));
  // Playable point features.
  for (const l of def.layups) pts.push(l.coordinate);
  for (const d of def.doglegs) pts.push(d.coordinate);
  for (const z of def.landingZones) pts.push(z.coordinate);
  if (player) pts.push({ lat: player.lat, lng: player.lng });
  return pts;
}

/** Par-aware padding: par 3 tighter, par 5 wider, par 4 default. */
export function premiumPaddingPx(par: number | null): number {
  if (par === 3) return 22;
  if (par === 5) return 62;
  return 44;
}

/** Corridor-driven bounds for the Premium camera. */
export function computePremiumBounds(
  def: GswingHoleDefinition, player: LatLng | null,
): HoleBounds | null {
  const corridor = computeHoleCorridor(def);
  const pts = collectBoundsPoints(def, corridor, player);
  if (pts.length < 1) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of pts) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const minSpan = 0.0012;
  if (maxLat - minLat < minSpan) {
    const m = (maxLat + minLat) / 2; minLat = m - minSpan / 2; maxLat = m + minSpan / 2;
  }
  if (maxLng - minLng < minSpan) {
    const m = (maxLng + minLng) / 2; minLng = m - minSpan / 2; maxLng = m + minSpan / 2;
  }
  return { minLat, maxLat, minLng, maxLng, centerLat: (minLat + maxLat) / 2 };
}
