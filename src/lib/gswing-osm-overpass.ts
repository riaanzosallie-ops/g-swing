// G-Swing — OpenStreetMap / Overpass assisted course pickup (temporary helper).
//
// SAFETY MODEL
// ────────────
// 1. OSM is community-mapped and **never** auto-trusted.
// 2. Nothing here writes to the database. Import is performed by the caller and
//    must mark imported features with source = "osm_preview", verified = false,
//    needs_review = true.
// 3. Manually verified G-Swing mapping always wins — see compareOsmToGswingMapping.
// 4. Only owner / platform_owner / admin should be allowed to invoke this lib
//    from the UI. The lib itself does not check roles — that is the caller's
//    responsibility.
// 5. Public Overpass endpoint — caller must rate-limit (single tap, no polling).

export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
export const OSM_MAX_RADIUS_METERS = 1500;

export type OsmGolfFeatureType =
  | "golf_course"
  | "hole"
  | "green"
  | "tee"
  | "bunker"
  | "fairway"
  | "water_hazard"
  | "rough"
  | "pin";

export type OsmConfidence = "high" | "medium" | "low";

export interface OsmGolfFeature {
  osmId: string;            // e.g. "way/123456789"
  type: OsmGolfFeatureType;
  name: string | null;
  holeNumber: number | null;
  par: number | null;
  ref: string | null;
  tags: Record<string, string>;
  centerLat: number | null;
  centerLng: number | null;
  // Polygon ring in [lng, lat] order, closed (first == last). null for points.
  polygon: Array<[number, number]> | null;
  confidence: OsmConfidence;
  geometryKind: "node" | "way" | "relation";
}

export interface OsmGolfBundle {
  fetchedAt: number;
  origin: { lat: number; lng: number; radiusMeters: number };
  course: OsmGolfFeature | null;
  features: OsmGolfFeature[];
  groups: Record<OsmGolfFeatureType, OsmGolfFeature[]>;
}

/** Build the Overpass QL query for the requested radius around a coordinate. */
export function buildOverpassQuery(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): string {
  const r = Math.max(50, Math.min(OSM_MAX_RADIUS_METERS, Math.round(radiusMeters)));
  const lat = latitude.toFixed(6);
  const lng = longitude.toFixed(6);
  return `
[out:json][timeout:25];
(
  way["leisure"="golf_course"](around:${r},${lat},${lng});
  relation["leisure"="golf_course"](around:${r},${lat},${lng});
  way["golf"](around:${r},${lat},${lng});
  relation["golf"](around:${r},${lat},${lng});
  node["golf"](around:${r},${lat},${lng});
);
out body geom;
`.trim();
}

/** Network fetch — throws on transport / non-200 / parse failure. */
export async function fetchOsmGolfFeaturesNear(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  signal?: AbortSignal,
): Promise<OsmGolfBundle> {
  const query = buildOverpassQuery(latitude, longitude, radiusMeters);
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: query }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Overpass HTTP ${res.status}`);
  }
  const json = (await res.json()) as OverpassRaw;
  return parseOsmGolfFeatures(json, {
    lat: latitude,
    lng: longitude,
    radiusMeters,
  });
}

// ── Overpass raw shape (minimal subset we care about) ─────────────────────
interface OverpassRaw {
  elements?: OverpassElement[];
}
interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{
    type: "node" | "way" | "relation";
    role: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
  tags?: Record<string, string>;
}

/** Parse a raw Overpass JSON response into typed G-Swing OSM features. */
export function parseOsmGolfFeatures(
  raw: OverpassRaw,
  origin: { lat: number; lng: number; radiusMeters: number },
): OsmGolfBundle {
  const features: OsmGolfFeature[] = [];
  let course: OsmGolfFeature | null = null;

  for (const el of raw.elements ?? []) {
    const tags = el.tags ?? {};
    const type = classifyOsmTags(tags);
    if (!type) continue;
    const polygon = extractPolygon(el);
    const center = extractCenter(el, polygon);
    const holeNumber = toInt(tags.ref) ?? toInt(tags["golf:hole"]) ?? toInt(tags.hole);
    const par = toInt(tags.par) ?? toInt(tags["golf:par"]);
    const confidence = scoreConfidence(type, tags, polygon, center, holeNumber);
    const feat: OsmGolfFeature = {
      osmId: `${el.type}/${el.id}`,
      type,
      name: tags.name ?? null,
      holeNumber,
      par,
      ref: tags.ref ?? null,
      tags,
      centerLat: center?.lat ?? null,
      centerLng: center?.lng ?? null,
      polygon,
      confidence,
      geometryKind: el.type,
    };
    features.push(feat);
    if (type === "golf_course" && !course) course = feat;
  }

  const groups = groupByType(features);
  return {
    fetchedAt: Date.now(),
    origin,
    course,
    features,
    groups,
  };
}

function classifyOsmTags(tags: Record<string, string>): OsmGolfFeatureType | null {
  if (tags.leisure === "golf_course") return "golf_course";
  const g = tags.golf;
  if (!g) return null;
  switch (g) {
    case "hole":
      return "hole";
    case "green":
      return "green";
    case "tee":
    case "teeing_ground":
      return "tee";
    case "bunker":
    case "sand_trap":
      return "bunker";
    case "fairway":
      return "fairway";
    case "water_hazard":
    case "lateral_water_hazard":
      return "water_hazard";
    case "rough":
      return "rough";
    case "pin":
    case "flag":
      return "pin";
    default:
      return null;
  }
}

function extractPolygon(el: OverpassElement): Array<[number, number]> | null {
  if (el.type === "way" && el.geometry && el.geometry.length >= 3) {
    const ring: Array<[number, number]> = el.geometry.map((p) => [p.lon, p.lat]);
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push(ring[0]);
    }
    return ring;
  }
  if (el.type === "relation" && el.members) {
    const outer = el.members.find(
      (m) => m.type === "way" && (m.role === "outer" || m.role === "") && m.geometry && m.geometry.length >= 3,
    );
    if (outer?.geometry) {
      const ring: Array<[number, number]> = outer.geometry.map((p) => [p.lon, p.lat]);
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push(ring[0]);
      }
      return ring;
    }
  }
  return null;
}

function extractCenter(
  el: OverpassElement,
  polygon: Array<[number, number]> | null,
): { lat: number; lng: number } | null {
  if (el.type === "node" && typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  if (polygon && polygon.length > 0) {
    let sx = 0;
    let sy = 0;
    const ring = polygon.slice(0, -1); // drop closing duplicate
    for (const [lng, lat] of ring) {
      sx += lng;
      sy += lat;
    }
    const n = ring.length || 1;
    return { lat: sy / n, lng: sx / n };
  }
  return null;
}

function scoreConfidence(
  type: OsmGolfFeatureType,
  tags: Record<string, string>,
  polygon: Array<[number, number]> | null,
  center: { lat: number; lng: number } | null,
  holeNumber: number | null,
): OsmConfidence {
  const hasGeometry = !!polygon || !!center;
  if (!hasGeometry) return "low";
  const hasUsefulTags =
    !!tags.name ||
    !!tags.ref ||
    holeNumber !== null ||
    type === "golf_course" ||
    type === "pin";
  if (polygon && polygon.length >= 6 && hasUsefulTags) return "high";
  if (polygon || hasUsefulTags) return "medium";
  return "low";
}

function groupByType(features: OsmGolfFeature[]): Record<OsmGolfFeatureType, OsmGolfFeature[]> {
  const groups: Record<OsmGolfFeatureType, OsmGolfFeature[]> = {
    golf_course: [],
    hole: [],
    green: [],
    tee: [],
    bunker: [],
    fairway: [],
    water_hazard: [],
    rough: [],
    pin: [],
  };
  for (const f of features) groups[f.type].push(f);
  return groups;
}

function toInt(v: string | undefined | null): number | null {
  if (v == null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

// ── Compare against an existing G-Swing mapped hole ───────────────────────

export interface GswingHoleSnapshot {
  holeNumber: number;
  tee: { lat: number; lng: number } | null;
  greenCenter: { lat: number; lng: number } | null;
  pin: { lat: number; lng: number } | null;
  bunkerCount: number;
  waterCount: number;
}

export interface OsmComparisonRow {
  label: string;
  gswing: string;
  osm: string;
  match: "match" | "missing-gswing" | "missing-osm" | "info";
}

export function compareOsmToGswingMapping(
  bundle: OsmGolfBundle,
  snapshot: GswingHoleSnapshot,
): OsmComparisonRow[] {
  const osmHole = bundle.groups.hole.find((h) => h.holeNumber === snapshot.holeNumber) ?? null;
  const osmTee = bundle.groups.tee.find((t) => t.holeNumber === snapshot.holeNumber)
    ?? (osmHole ? null : null);
  const osmGreen = bundle.groups.green.find((g) => g.holeNumber === snapshot.holeNumber) ?? null;
  const osmPin = bundle.groups.pin.find((p) => p.holeNumber === snapshot.holeNumber) ?? null;

  const rows: OsmComparisonRow[] = [];
  rows.push(rowFor("Tee", !!snapshot.tee, !!osmTee));
  rows.push(rowFor("Green", !!snapshot.greenCenter, !!osmGreen));
  rows.push(rowFor("Pin", !!snapshot.pin, !!osmPin));
  rows.push({
    label: "Bunkers",
    gswing: `${snapshot.bunkerCount}`,
    osm: `${bundle.groups.bunker.length}`,
    match: "info",
  });
  rows.push({
    label: "Water hazards",
    gswing: `${snapshot.waterCount}`,
    osm: `${bundle.groups.water_hazard.length}`,
    match: "info",
  });
  return rows;
}

function rowFor(label: string, gs: boolean, osm: boolean): OsmComparisonRow {
  if (gs && osm) return { label, gswing: "saved", osm: "found", match: "match" };
  if (gs && !osm) return { label, gswing: "saved", osm: "missing", match: "missing-osm" };
  if (!gs && osm) return { label, gswing: "missing", osm: "found", match: "missing-gswing" };
  return { label, gswing: "missing", osm: "missing", match: "info" };
}

// ── Preview shape for the importer ────────────────────────────────────────

export interface OsmImportPreviewItem {
  osmId: string;
  type: OsmGolfFeatureType;
  label: string;
  confidence: OsmConfidence;
  centerLat: number | null;
  centerLng: number | null;
  polygon: Array<[number, number]> | null;
  holeNumber: number | null;
  /** Always false until a human verifies. Persist as `verified` flag. */
  verified: false;
  /** Always true. Persist as `needs_review` flag. */
  needsReview: true;
  /** Always "osm_preview". Persist as `source`. */
  source: "osm_preview";
  tags: Record<string, string>;
}

export function buildOsmImportPreview(features: OsmGolfFeature[]): OsmImportPreviewItem[] {
  return features
    .filter((f) => f.centerLat !== null && f.centerLng !== null)
    .map((f) => ({
      osmId: f.osmId,
      type: f.type,
      label: f.name ?? `${f.type}${f.holeNumber ? ` #${f.holeNumber}` : ""}`,
      confidence: f.confidence,
      centerLat: f.centerLat,
      centerLng: f.centerLng,
      polygon: f.polygon,
      holeNumber: f.holeNumber,
      verified: false,
      needsReview: true,
      source: "osm_preview",
      tags: f.tags,
    }));
}