// G-Swing Rendering Platform — Canonical owned-geometry model (V1)
// -----------------------------------------------------------------
// Additive. Does NOT replace MappedHole. A non-destructive adapter
// (fromMappedHole) promotes legacy holes into GswingHoleDefinition
// so both paths coexist during the incremental rollout.

import type {
  GpsCoordinate,
  HazardCategory,
  MappedHole,
  SideLabel,
} from "@/types/gswing-course-map";

export const GSWING_COURSE_SCHEMA_VERSION = 1 as const;

export type LngLat = [number, number];
export type Ring = LngLat[];

export type GswingGeometrySource =
  | "mapped"
  | "imported-osm"
  | "imported-golfapi"
  | "auto-generated"
  | "unknown";

export type GswingValidationStatus =
  | "draft"
  | "needs-review"
  | "validated"
  | "published";

export interface GswingSourceMetadata {
  source: GswingGeometrySource;
  sourceRevision?: string | null;
  importedAt?: string | null;
  importedBy?: string | null;
  notes?: string | null;
}

export interface GswingRenderingHints {
  paddingPx?: number;
  corridor?: LngLat[] | null;
  ambientTag?: string | null;
}

export interface GswingFeaturePoint {
  id: string;
  name?: string | null;
  coordinate: GpsCoordinate;
  notes?: string | null;
}

export interface GswingFeaturePolygon {
  id: string;
  name?: string | null;
  ring: Ring;
  holes?: Ring[];
  side?: SideLabel | null;
  notes?: string | null;
}

export interface GswingFeaturePolyline {
  id: string;
  name?: string | null;
  path: LngLat[];
  notes?: string | null;
}

export type GswingBunker = GswingFeaturePolygon;
export type GswingWater = GswingFeaturePolygon;
export type GswingRough = GswingFeaturePolygon;
export type GswingWaste = GswingFeaturePolygon;
export type GswingOutOfBounds = GswingFeaturePolygon;
export type GswingPenaltyArea = GswingFeaturePolygon;
export type GswingTreeCluster = GswingFeaturePolygon;
export type GswingCartPath = GswingFeaturePolyline;

export interface GswingTreePoint extends GswingFeaturePoint {
  radiusMeters?: number | null;
}

export interface GswingTeeDefinition {
  id: string;
  name: string;
  colorHex?: string | null;
  yardage?: number | null;
  markers: GpsCoordinate[];
  polygon?: Ring | null;
}

export interface GswingGreenReferences {
  front: GpsCoordinate | null;
  center: GpsCoordinate | null;
  back: GpsCoordinate | null;
}

export interface GswingPinPosition {
  coordinate: GpsCoordinate;
  setOn?: string | null;
  notes?: string | null;
}

export interface GswingLabelAnchor {
  id: string;
  text: string;
  coordinate: GpsCoordinate;
  kind?: "distance" | "hazard" | "layup" | "landing" | "note";
}

export interface GswingHoleDefinition {
  schemaVersion: typeof GSWING_COURSE_SCHEMA_VERSION;
  holeNumber: number;
  par: number | null;
  strokeIndex?: number | null;
  lengthYards?: number | null;
  lengthMeters?: number | null;
  tees: GswingTeeDefinition[];
  teePolygons: GswingFeaturePolygon[];
  fairwayPolygons: GswingFeaturePolygon[];
  greenPolygon: GswingFeaturePolygon | null;
  greenRefs: GswingGreenReferences;
  pin: GswingPinPosition | null;
  bunkers: GswingBunker[];
  water: GswingWater[];
  trees: { clusters: GswingTreeCluster[]; points: GswingTreePoint[] };
  rough: GswingRough[];
  waste: GswingWaste[];
  cartPaths: GswingCartPath[];
  outOfBounds: GswingOutOfBounds[];
  penaltyAreas: GswingPenaltyArea[];
  layups: GswingFeaturePoint[];
  landingZones: GswingFeaturePoint[];
  doglegs: GswingFeaturePoint[];
  labels: GswingLabelAnchor[];
  corridor: LngLat[] | null;
  renderingHints?: GswingRenderingHints;
  source: GswingSourceMetadata;
  naLayers?: string[];
  metadata?: Record<string, unknown>;
}

export interface GswingCourseDefinition {
  schemaVersion: typeof GSWING_COURSE_SCHEMA_VERSION;
  courseId: string;
  name: string;
  locationLabel?: string | null;
  center: GpsCoordinate;
  revision: number;
  updatedAt: string;
  validationStatus: GswingValidationStatus;
  confidence?: number | null;
  source: GswingSourceMetadata;
  boundary?: { ring: Ring; name?: string | null } | null;
  holes: GswingHoleDefinition[];
  metadata?: Record<string, unknown>;
}

function toRing(poly: Array<[number, number]> | null | undefined): Ring | null {
  if (!poly || poly.length === 0) return null;
  return poly.map(([lng, lat]) => [lng, lat] as LngLat);
}

function categoryToBucket(cat: HazardCategory):
  | "bunker" | "water" | "trees" | "rough" | "waste"
  | "outOfBounds" | "penaltyAreas" | "other" {
  switch (cat) {
    case "bunker": return "bunker";
    case "water": return "water";
    case "trees": return "trees";
    case "rough": return "rough";
    case "waste_area": return "waste";
    case "out_of_bounds": return "outOfBounds";
    case "penalty_area": return "penaltyAreas";
    default: return "other";
  }
}

/** Promote a legacy MappedHole into a GswingHoleDefinition (non-destructive). */
export function fromMappedHole(
  hole: MappedHole,
  source: GswingSourceMetadata = { source: "mapped" },
): GswingHoleDefinition {
  const bunkers: GswingBunker[] = [];
  const water: GswingWater[] = [];
  const rough: GswingRough[] = [];
  const waste: GswingWaste[] = [];
  const oob: GswingOutOfBounds[] = [];
  const penalties: GswingPenaltyArea[] = [];
  const treeClusters: GswingTreeCluster[] = [];
  const treePoints: GswingTreePoint[] = [];

  hole.hazards.forEach((h, i) => {
    const ring = toRing(h.polygon);
    const bucket = categoryToBucket(h.type);
    if (bucket === "trees") {
      if (ring) {
        treeClusters.push({ id: h.id ?? `tree-${i}`, name: h.name ?? null, side: h.side ?? null, ring, notes: h.notes ?? null });
      } else {
        treePoints.push({ id: h.id ?? `tree-${i}`, name: h.name ?? null, coordinate: h.center, notes: h.notes ?? null });
      }
      return;
    }
    if (!ring) return;
    const poly: GswingFeaturePolygon = {
      id: h.id ?? `hz-${i}`, name: h.name ?? null, side: h.side ?? null, ring, notes: h.notes ?? null,
    };
    switch (bucket) {
      case "bunker": bunkers.push(poly); break;
      case "water": water.push(poly); break;
      case "rough": rough.push(poly); break;
      case "waste": waste.push(poly); break;
      case "outOfBounds": oob.push(poly); break;
      case "penaltyAreas": penalties.push(poly); break;
      default: break;
    }
  });

  const tees: GswingTeeDefinition[] = hole.tees.length
    ? [{
        id: "tees-primary",
        name: "Tees",
        markers: hole.tees.map((t) => t.coordinate),
        polygon: toRing(hole.teePolygon),
        yardage: hole.lengthYards ?? null,
      }]
    : [];

  const fairwayRing = toRing(hole.fairwayPolygon);
  const fairwayPolygons: GswingFeaturePolygon[] = fairwayRing
    ? [{ id: "fw-1", name: "Fairway", ring: fairwayRing }]
    : [];

  const greenRing = toRing(hole.green.polygon);
  const greenPolygon: GswingFeaturePolygon | null = greenRing
    ? { id: "green", name: "Green", ring: greenRing }
    : null;

  const roughRing = toRing(hole.roughPolygon);
  if (roughRing) rough.push({ id: "rough-1", name: "Rough", ring: roughRing });

  const cartPaths: GswingCartPath[] = hole.cartPath && hole.cartPath.length
    ? [{ id: "cart-1", name: "Cart Path", path: hole.cartPath.map(([lng, lat]) => [lng, lat] as LngLat) }]
    : [];

  return {
    schemaVersion: GSWING_COURSE_SCHEMA_VERSION,
    holeNumber: hole.holeNumber,
    par: hole.par,
    lengthYards: hole.lengthYards,
    lengthMeters: hole.lengthMeters,
    tees,
    teePolygons: [],
    fairwayPolygons,
    greenPolygon,
    greenRefs: { front: hole.green.front, center: hole.green.center, back: hole.green.back },
    pin: hole.pin ? { coordinate: hole.pin.coordinate, setOn: hole.pin.setOn, notes: hole.pin.notes } : null,
    bunkers,
    water,
    trees: { clusters: treeClusters, points: treePoints },
    rough,
    waste,
    cartPaths,
    outOfBounds: oob,
    penaltyAreas: penalties,
    layups: hole.layups.map((l) => ({ id: l.id, name: l.name, coordinate: l.coordinate, notes: l.notes })),
    landingZones: hole.landingZones.map((z) => ({ id: z.id, name: z.name, coordinate: z.coordinate, notes: z.notes })),
    doglegs: hole.doglegs.map((d) => ({ id: d.id, coordinate: d.coordinate, notes: d.notes })),
    labels: [],
    corridor: null,
    source,
    naLayers: hole.naLayers ?? [],
  };
}
