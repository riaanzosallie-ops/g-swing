// G-Swing — OpenStreetMap course geometry.
// ------------------------------------------
// Fetches real, surveyed golf features (fairways, greens, bunkers, water,
// tree masses, hole centrelines) from OpenStreetMap via the Overpass API
// and matches them to individual holes. This is the highest-fidelity
// free source of hole shapes: wherever a course has been traced in OSM,
// the Premium renderer draws the real geometry instead of a synthesized
// approximation.
//
// Design constraints:
// - Never blocks rendering: callers race this against a timeout and fall
//   back to pure synthesis when OSM has nothing (or is slow/offline).
// - One Overpass request per course, cached in localStorage (14 days)
//   and in-memory, with an in-flight dedupe so hole switches never
//   re-query.
// - Ways only (v1). All rings returned as [lng, lat] to match MappedHole.

import type { LatLng } from "@/lib/gps-utils";

export type Ring = Array<[number, number]>;

export interface OsmCourseGeometry {
  fetchedAt: number;
  center: LatLng;
  fairways: Ring[];
  greens: Ring[];
  tees: Ring[];
  bunkers: Ring[];
  water: Ring[];
  trees: Ring[];
  /** golf=hole centrelines, keyed order; ref is the hole number when tagged. */
  holeLines: Array<{ ref: number | null; line: LatLng[] }>;
}

/** Per-hole slice of the course geometry, ready for the synthesizer. */
export interface OsmHoleGeometry {
  holeLine: LatLng[] | null;
  fairway: Ring | null;
  green: Ring | null;
  bunkers: Ring[];
  water: Ring[];
  trees: Ring[];
}

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const FETCH_TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 14 * 24 * 3600 * 1000;
const CACHE_PREFIX = "gswing-osm-v1:";
const COURSE_RADIUS_M = 1600;

const memoryCache = new Map<string, OsmCourseGeometry | null>();
const inFlight = new Map<string, Promise<OsmCourseGeometry | null>>();

function cacheKey(center: LatLng): string {
  // ~110m grid so slightly different course anchors share a cache entry.
  return `${CACHE_PREFIX}${center.lat.toFixed(3)},${center.lng.toFixed(3)}`;
}

function readLocalCache(key: string): OsmCourseGeometry | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OsmCourseGeometry;
    if (!parsed?.fetchedAt || Date.now() - parsed.fetchedAt > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache(key: string, data: OsmCourseGeometry): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota / private mode — memory cache still works */
  }
}

function buildQuery(center: LatLng, radiusM: number): string {
  const dLat = radiusM / 111000;
  const dLng = radiusM / (111000 * Math.max(0.1, Math.cos((center.lat * Math.PI) / 180)));
  const bbox = [
    (center.lat - dLat).toFixed(6),
    (center.lng - dLng).toFixed(6),
    (center.lat + dLat).toFixed(6),
    (center.lng + dLng).toFixed(6),
  ].join(",");
  return `[out:json][timeout:25];(
way["golf"~"^(hole|fairway|green|bunker|tee|water_hazard|lateral_water_hazard)$"](${bbox});
way["natural"="water"](${bbox});
way["natural"="wood"](${bbox});
way["landuse"="forest"](${bbox});
);out geom;`;
}

interface OverpassWay {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

/** Parse an Overpass `out geom` response into course geometry. Exported for tests. */
export function parseOverpassCourse(
  elements: OverpassWay[],
  center: LatLng,
): OsmCourseGeometry {
  const out: OsmCourseGeometry = {
    fetchedAt: Date.now(),
    center,
    fairways: [],
    greens: [],
    tees: [],
    bunkers: [],
    water: [],
    trees: [],
    holeLines: [],
  };
  for (const el of elements) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags ?? {};
    const golf = tags.golf ?? "";
    if (golf === "hole") {
      const refNum = Number.parseInt(tags.ref ?? "", 10);
      out.holeLines.push({
        ref: Number.isFinite(refNum) ? refNum : null,
        line: el.geometry.map((g) => ({ lat: g.lat, lng: g.lon })),
      });
      continue;
    }
    if (el.geometry.length < 3) continue;
    const ring: Ring = el.geometry.map((g) => [g.lon, g.lat] as [number, number]);
    if (
      ring[0][0] !== ring[ring.length - 1][0] ||
      ring[0][1] !== ring[ring.length - 1][1]
    ) {
      ring.push(ring[0]);
    }
    if (golf === "fairway") out.fairways.push(ring);
    else if (golf === "green") out.greens.push(ring);
    else if (golf === "tee") out.tees.push(ring);
    else if (golf === "bunker") out.bunkers.push(ring);
    else if (
      golf === "water_hazard" ||
      golf === "lateral_water_hazard" ||
      tags.natural === "water"
    ) out.water.push(ring);
    else if (tags.natural === "wood" || tags.landuse === "forest") out.trees.push(ring);
  }
  return out;
}

/**
 * Fetch (with cache) every OSM golf feature around a course centre.
 * Resolves null when OSM is unreachable — callers must treat that as
 * "no OSM data" and synthesize as before.
 */
export async function fetchOsmCourseGeometry(
  center: LatLng,
): Promise<OsmCourseGeometry | null> {
  const key = cacheKey(center);
  if (memoryCache.has(key)) return memoryCache.get(key) ?? null;
  const cached = readLocalCache(key);
  if (cached) {
    memoryCache.set(key, cached);
    return cached;
  }
  const pending = inFlight.get(key);
  if (pending) return pending;

  const job = (async (): Promise<OsmCourseGeometry | null> => {
    const query = buildQuery(center, COURSE_RADIUS_M);
    for (const mirror of OVERPASS_MIRRORS) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(mirror, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) continue;
        const json = (await res.json()) as { elements?: OverpassWay[] };
        const parsed = parseOverpassCourse(json.elements ?? [], center);
        memoryCache.set(key, parsed);
        writeLocalCache(key, parsed);
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.info("[gswing.osm] course geometry loaded", {
            fairways: parsed.fairways.length,
            greens: parsed.greens.length,
            bunkers: parsed.bunkers.length,
            water: parsed.water.length,
            trees: parsed.trees.length,
            holeLines: parsed.holeLines.length,
          });
        }
        return parsed;
      } catch {
        /* try next mirror */
      }
    }
    // Negative-cache in memory only, so a flaky network retries next session.
    memoryCache.set(key, null);
    return null;
  })();
  inFlight.set(key, job);
  try {
    return await job;
  } finally {
    inFlight.delete(key);
  }
}

// ── Per-hole matching ───────────────────────────────────────────────────

function metersBetween(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Equirectangular local projection (metres) — fine at hole scale. */
function toLocal(p: LatLng, origin: LatLng): { x: number; y: number } {
  const kx = 111000 * Math.cos((origin.lat * Math.PI) / 180);
  return { x: (p.lng - origin.lng) * kx, y: (p.lat - origin.lat) * 111000 };
}

function pointToPolylineMeters(p: LatLng, line: LatLng[], origin: LatLng): number {
  const pt = toLocal(p, origin);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = toLocal(line[i - 1], origin);
    const b = toLocal(line[i], origin);
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    const t = len2 > 0
      ? Math.max(0, Math.min(1, ((pt.x - a.x) * abx + (pt.y - a.y) * aby) / len2))
      : 0;
    const dx = pt.x - (a.x + abx * t);
    const dy = pt.y - (a.y + aby * t);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

function ringCentroid(ring: Ring): LatLng {
  let lng = 0;
  let lat = 0;
  const n = Math.max(1, ring.length - 1); // last point repeats the first
  for (let i = 0; i < n; i++) {
    lng += ring[i][0];
    lat += ring[i][1];
  }
  return { lat: lat / n, lng: lng / n };
}

function pointInRing(p: LatLng, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      (yi > p.lat) !== (yj > p.lat) &&
      p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Minimum distance (m) from any ring vertex to the hole polyline. */
function ringToPolylineMeters(ring: Ring, line: LatLng[], origin: LatLng): number {
  let best = Infinity;
  for (const [lng, lat] of ring) {
    best = Math.min(best, pointToPolylineMeters({ lat, lng }, line, origin));
    if (best === 0) break;
  }
  return best;
}

/** Max distance (m) from any ring vertex to the corridor polyline. */
function ringMaxToPolylineMeters(ring: Ring, line: LatLng[], origin: LatLng): number {
  let worst = 0;
  for (const [lng, lat] of ring) {
    worst = Math.max(worst, pointToPolylineMeters({ lat, lng }, line, origin));
  }
  return worst;
}

/**
 * Slice course geometry down to a single hole. `tee` and `greenCenter`
 * come from GolfAPI — they anchor the corridor features are matched to.
 */
export function extractOsmHoleGeometry(
  course: OsmCourseGeometry,
  tee: LatLng,
  greenCenter: LatLng,
  holeNumber: number,
): OsmHoleGeometry {
  const origin = tee;

  // Hole centreline: exact ref match first, then a line whose endpoints
  // sit near this tee and green (either direction).
  let holeLine: LatLng[] | null =
    course.holeLines.find((h) => h.ref === holeNumber)?.line ?? null;
  if (!holeLine) {
    for (const h of course.holeLines) {
      const first = h.line[0];
      const last = h.line[h.line.length - 1];
      if (
        metersBetween(first, tee) < 80 && metersBetween(last, greenCenter) < 80
      ) { holeLine = h.line; break; }
      if (
        metersBetween(last, tee) < 80 && metersBetween(first, greenCenter) < 80
      ) { holeLine = h.line.slice().reverse(); break; }
    }
  }
  // Sub-path match: a merged/course-long centreline that passes near both
  // this tee and this green contributes just the segment between them.
  if (!holeLine) {
    for (const h of course.holeLines) {
      let iT = -1, dT = 80, iG = -1, dG = 80;
      for (let i = 0; i < h.line.length; i++) {
        const dt = metersBetween(h.line[i], tee);
        const dg = metersBetween(h.line[i], greenCenter);
        if (dt < dT) { dT = dt; iT = i; }
        if (dg < dG) { dG = dg; iG = i; }
      }
      if (iT >= 0 && iG >= 0 && Math.abs(iT - iG) >= 2) {
        holeLine = iT < iG
          ? h.line.slice(iT, iG + 1)
          : h.line.slice(iG, iT + 1).reverse();
        break;
      }
    }
  }
  // Orient a ref-matched line tee → green.
  if (holeLine && holeLine.length >= 2) {
    const first = holeLine[0];
    const last = holeLine[holeLine.length - 1];
    if (metersBetween(last, tee) < metersBetween(first, tee)) {
      holeLine = holeLine.slice().reverse();
    }
  }

  const corridor: LatLng[] = holeLine ?? [tee, greenCenter];

  // Green: polygon containing the GolfAPI green centre, else nearest
  // centroid within 35m.
  let green: Ring | null = null;
  let bestGreenD = 35;
  for (const g of course.greens) {
    if (pointInRing(greenCenter, g)) { green = g; break; }
    const d = metersBetween(ringCentroid(g), greenCenter);
    if (d < bestGreenD) { bestGreenD = d; green = g; }
  }

  // Fairway: the polygon nearest the corridor (any vertex within 45m),
  // but ONLY if it is single-hole sized — every vertex must stay near
  // this hole's corridor. Merged multi-hole turf blobs (common in
  // imagery-derived data) fail this test and are dropped so the buffer
  // synthesis around the real centreline takes over instead of a
  // sprawling cross-hole polygon.
  let fairway: Ring | null = null;
  let bestFairwayD = 45;
  for (const f of course.fairways) {
    const d = ringToPolylineMeters(f, corridor, origin);
    if (d < bestFairwayD) { bestFairwayD = d; fairway = f; }
  }
  if (fairway && ringMaxToPolylineMeters(fairway, corridor, origin) > 90) {
    fairway = null;
  }

  const near = (rings: Ring[], maxM: number): Ring[] =>
    rings.filter((r) => ringToPolylineMeters(r, corridor, origin) <= maxM);

  return {
    holeLine,
    fairway,
    green,
    bunkers: near(course.bunkers, 90),
    water: near(course.water, 80),
    trees: near(course.trees, 100),
  };
}
