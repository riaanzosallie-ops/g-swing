// G-Swing Premium Hole Projection
// ---------------------------------
// Maps real lat/lng coordinates from a mapped hole into a 2D canvas
// viewport (px) and reverses tap coordinates back into real lat/lng so
// tap-to-measure produces a true haversine distance from the live
// player GPS to the tapped point.
//
// Pure math. No React, no Mapbox. Reversible projection (equirectangular
// fit-to-bounds) — adequate at hole scale (<800m) where great-circle
// distortion is negligible.

import { haversineYards, toDisplayUnit, bearingDeg, type LatLng } from "@/lib/gps-utils";
import type {
  GpsCoordinate,
  HazardGeometry,
  MappedHole,
} from "@/types/gswing-course-map";

export interface HoleBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
}

export interface Viewport {
  width: number;
  height: number;
  paddingPx: number;
  /** Optional extra padding reserved at the bottom (e.g. bottom sheet). */
  paddingBottomPx?: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

// ─── Corridor distance helpers (used only for bounds clamping) ───────────────

/**
 * Minimum distance² from point `p` to the line segment `[a, b]`.
 * All values in equirectangular degrees² (cos-corrected longitude).
 */
function pointToSegmentDistSq(
  p: GpsCoordinate,
  a: GpsCoordinate,
  b: GpsCoordinate,
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

/**
 * Is point `p` within `maxDeg` degrees (cos-corrected) of the
 * polyline `corridor`? Used to clamp polygon rings to the active
 * hole's tee→green axis so large OSM/bundled fairway polygons
 * (which can span 300–450m) don't blow up the viewport fit.
 */
function nearCorridor(
  p: GpsCoordinate,
  corridor: GpsCoordinate[],
  maxDeg: number,
): boolean {
  const maxSq = maxDeg * maxDeg;
  for (let i = 0; i + 1 < corridor.length; i++) {
    if (pointToSegmentDistSq(p, corridor[i], corridor[i + 1]) <= maxSq) return true;
  }
  return false;
}

/**
 * Collect every mapped coordinate that should influence the viewport
 * fit. This is intentionally restricted to the *playable hole corridor*
 * — tees, greens, pin, fairway, layups, doglegs, landing zones — and
 * deliberately excludes broad scenery layers such as:
 *
 *   - hole.holeBoundary  (course/hole-wide outline)
 *   - hole.roughPolygon  (huge rough mass)
 *   - hole.cartPath      (can span multiple holes)
 *   - hazard polygons    (trees/water can sprawl beyond the corridor;
 *                         hazard center/front/carry points still count)
 *
 * Those layers still RENDER — they just don't get to control zoom. This
 * keeps the Premium camera centered on tee→green, not on tree bands or
 * course-wide masks that would otherwise force us to zoom out.
 *
 * VIEWPORT FIX: fairwayPolygon vertices are clamped to within
 * MAX_FAIRWAY_DEG of the tee→green corridor. Large OSM/bundled fairway
 * polygons (H6/H8: 374×456m; H7/H9: 337×386m) previously caused the
 * bounds to span the entire course. Only vertices near the active hole
 * axis are admitted; the polygon still renders in full.
 */

/** ~120m at Sharjah latitude — generous enough for a wide par-5 fairway. */
const MAX_FAIRWAY_DEG = 0.0011; // ≈120m

function collectHolePoints(
  hole: MappedHole | null,
  player: LatLng | null,
): GpsCoordinate[] {
  const pts: GpsCoordinate[] = [];
  if (hole) {
    for (const t of hole.tees) pts.push(t.coordinate);
    const g = hole.green;
    [g.front, g.center, g.back].forEach((p) => p && pts.push(p));
    if (g.polygon) for (const [lng, lat] of g.polygon) pts.push({ lat, lng });
    if (hole.pin) pts.push(hole.pin.coordinate);
    // Hazards: only their key points (reach/carry/center), NOT their
    // full polygons — a tree cluster polygon can extend far outside the
    // corridor and would blow up the fit.
    // Additionally, skip pure scenery hazards (trees, rough,
    // out_of_bounds) even for their key points — a distant tree band's
    // centroid can still stretch the fit far off the corridor. Only
    // playable hazards (bunkers, water, penalty areas, waste, custom)
    // are permitted to influence bounds.
    const playableHazard = new Set([
      "bunker",
      "water",
      "penalty_area",
      "waste_area",
      "custom",
    ]);
    for (const h of hole.hazards) {
      if (!playableHazard.has(h.type)) continue;
      pts.push(h.center);
      if (h.front) pts.push(h.front);
      if (h.carry) pts.push(h.carry);
    }
    for (const l of hole.layups) pts.push(l.coordinate);
    for (const d of hole.doglegs) pts.push(d.coordinate);
    for (const z of hole.landingZones) pts.push(z.coordinate);

    // teePolygon is always tight (≤12m radius) — admit all vertices.
    if (hole.teePolygon) {
      for (const [lng, lat] of hole.teePolygon) pts.push({ lat, lng });
    }

    // fairwayPolygon: CLAMP to active-hole corridor.
    // Large OSM/bundled fairway polygons can span 300–460m and include
    // vertices far outside this hole's tee→green axis. We only admit
    // vertices that lie within MAX_FAIRWAY_DEG of the [tee→green] line
    // segment(s) so the bounds stay on the active hole, not the course.
    // The polygon still renders in its entirety — this only gates which
    // vertices can enlarge the viewport bounds.
    if (hole.fairwayPolygon && hole.fairwayPolygon.length > 0) {
      // Build a simple corridor from tee → green (via any doglegs/layups).
      const corridorAnchors: GpsCoordinate[] = [
        ...hole.tees.map((t) => t.coordinate),
        ...hole.doglegs.map((d) => d.coordinate),
        ...hole.layups.map((l) => l.coordinate),
        ...(g.center ? [g.center] : []),
        ...(g.front  ? [g.front]  : []),
      ];
      // Fall back: if no anchors, admit all vertices (safe for synthetic holes).
      const hasCorridor = corridorAnchors.length >= 2;
      for (const [lng, lat] of hole.fairwayPolygon) {
        const pt: GpsCoordinate = { lat, lng };
        if (!hasCorridor || nearCorridor(pt, corridorAnchors, MAX_FAIRWAY_DEG)) {
          pts.push(pt);
        }
      }
    }

    // Intentionally excluded from bounds (still rendered):
    //   hole.holeBoundary, hole.roughPolygon, hole.cartPath
  }
  if (player) pts.push({ lat: player.lat, lng: player.lng });
  return pts;
}

/** Compute lat/lng bounding box for the hole. Returns null if insufficient data. */
export function buildHoleBounds(
  hole: MappedHole | null,
  player: LatLng | null,
): HoleBounds | null {
  const pts = collectHolePoints(hole, player);
  if (pts.length < 1) return null;
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const p of pts) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  // Guarantee a minimum span so a single-point hole still renders.
  const minSpan = 0.0012; // ~120m
  if (maxLat - minLat < minSpan) {
    const m = (maxLat + minLat) / 2;
    minLat = m - minSpan / 2;
    maxLat = m + minSpan / 2;
  }
  if (maxLng - minLng < minSpan) {
    const m = (maxLng + minLng) / 2;
    minLng = m - minSpan / 2;
    maxLng = m + minSpan / 2;
  }
  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    centerLat: (minLat + maxLat) / 2,
  };
}

/**
 * Fit lat/lng bounds inside a viewport preserving aspect ratio (accounting
 * for longitude shrinkage with latitude). Returns the projection scale +
 * offsets used by `projectLatLngToHoleCanvas` / `unprojectHoleCanvasToLatLng`.
 */
export interface FittedProjection {
  bounds: HoleBounds;
  viewport: Viewport;
  scale: number; // pixels per degree (latitude axis)
  offsetX: number;
  offsetY: number;
  cosLat: number;
}

export function fitHoleToViewport(
  bounds: HoleBounds,
  viewport: Viewport,
): FittedProjection {
  const cosLat = Math.cos((bounds.centerLat * Math.PI) / 180);
  const lngSpan = (bounds.maxLng - bounds.minLng) * cosLat;
  const latSpan = bounds.maxLat - bounds.minLat;
  const padSide = viewport.paddingPx;
  const padBottom = viewport.paddingBottomPx ?? viewport.paddingPx;
  const usableW = Math.max(1, viewport.width - padSide * 2);
  const usableH = Math.max(1, viewport.height - padSide - padBottom);
  const scale = Math.min(usableW / lngSpan, usableH / latSpan);
  const projW = lngSpan * scale;
  const projH = latSpan * scale;
  const offsetX = (viewport.width - projW) / 2 - bounds.minLng * cosLat * scale;
  // Center within the usable (top-padded, bottom-padded) band so the fit
  // stays visible above the bottom sheet.
  const usableTop = padSide;
  const offsetY = usableTop + (usableH - projH) / 2 + bounds.maxLat * scale;
  return { bounds, viewport, scale, offsetX, offsetY, cosLat };
}

export function projectLatLngToHoleCanvas(
  point: LatLng | GpsCoordinate,
  p: FittedProjection,
): ProjectedPoint {
  return {
    x: point.lng * p.cosLat * p.scale + p.offsetX,
    y: p.offsetY - point.lat * p.scale,
  };
}

export function unprojectHoleCanvasToLatLng(
  pt: ProjectedPoint,
  p: FittedProjection,
): LatLng {
  const lat = (p.offsetY - pt.y) / p.scale;
  const lng = (pt.x - p.offsetX) / (p.cosLat * p.scale);
  return { lat, lng };
}

/** Real haversine distance from player → tapped point, in display units. */
export function calculateMeasurementFromTap(
  player: LatLng | null,
  tapped: LatLng | null,
  unit: "yards" | "meters",
): { distance: number; unit: "y" | "m"; bearing: number } | null {
  if (!player || !tapped) return null;
  const yards = haversineYards(player, tapped);
  return {
    distance: toDisplayUnit(yards, unit),
    unit: unit === "meters" ? "m" : "y",
    bearing: bearingDeg(player, tapped),
  };
}

/** Centroid of a hazard polygon ring (or its stored center as fallback). */
export function calculateFeatureCentroid(h: HazardGeometry): GpsCoordinate {
  if (h.polygon && h.polygon.length > 0) {
    let lat = 0,
      lng = 0;
    for (const [x, y] of h.polygon) {
      lng += x;
      lat += y;
    }
    return { lat: lat / h.polygon.length, lng: lng / h.polygon.length };
  }
  return h.center;
}

/** Build an SVG `d` attribute that smooths through a list of projected points. */
export function buildSmoothPath(pts: ProjectedPoint[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  const d: string[] = [`M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`];
  for (let i = 1; i < pts.length - 1; i++) {
    const cur = pts[i];
    const next = pts[i + 1];
    const mx = (cur.x + next.x) / 2;
    const my = (cur.y + next.y) / 2;
    d.push(`Q ${cur.x.toFixed(1)} ${cur.y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`);
  }
  const last = pts[pts.length - 1];
  d.push(`L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`);
  return d.join(" ");
}

/** Strict check: is there enough mapped geometry to render a real hole? */
export function hasUsableHoleMapping(hole: MappedHole | null): boolean {
  if (!hole) return false;
  const hasTee = hole.tees.length > 0;
  const hasGreen =
    !!hole.green.center || !!hole.green.front || !!hole.green.back || !!hole.pin;
  return hasTee || hasGreen;
}
