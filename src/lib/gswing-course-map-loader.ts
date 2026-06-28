// G-Swing Premium Course Mapping Engine — DB loader.
// Reads from gswing_course_maps / gswing_mapped_holes / gswing_hole_features
// and converts rows into the strict MappedHole / CourseMap shapes used by
// the GPS HUD and Mapbox layers. Never fabricates values.

import { supabase } from "@/integrations/supabase/client";
import type {
  CourseMap,
  GpsCoordinate,
  HazardCategory,
  HazardGeometry,
  MappedHole,
  PinPosition,
  SideLabel,
  TeeBoxMarker,
  LayupTarget,
  DoglegTarget,
  FairwayLandingZone,
} from "@/types/gswing-course-map";
import { haversineMeters } from "@/lib/gps-utils";

type CourseMapRow = {
  id: string;
  course_name: string;
  location_label: string | null;
  latitude: number;
  longitude: number;
  updated_at: string | null;
};

type MappedHoleRow = {
  id: string;
  course_map_id: string;
  hole_number: number;
  par: number | null;
  length_yards: number | null;
  length_meters: number | null;
  tee_lat: number | null;
  tee_lng: number | null;
  green_front_lat: number | null;
  green_front_lng: number | null;
  green_center_lat: number | null;
  green_center_lng: number | null;
  green_back_lat: number | null;
  green_back_lng: number | null;
  pin_lat: number | null;
  pin_lng: number | null;
};

export type HoleFeatureType =
  | "tee"
  | "green_front"
  | "green_center"
  | "green_back"
  | "pin"
  | "bunker"
  | "water"
  | "penalty"
  | "ob"
  | "trees"
  | "rough"
  | "waste"
  | "layup"
  | "dogleg"
  | "landing_zone"
  // Premium visual mapping layers — polygons used by the illustrated renderer.
  | "fairway_polygon"
  | "green_polygon"
  | "tee_polygon"
  | "hole_boundary"
  | "rough_polygon"
  | "cart_path"
  // Not-applicable marker — `name` carries the PremiumLayerKey being excluded.
  | "na_marker";

type HoleFeatureRow = {
  id: string;
  mapped_hole_id: string;
  feature_type: HoleFeatureType | string;
  name: string | null;
  side_label: string | null;
  front_lat: number | null;
  front_lng: number | null;
  center_lat: number | null;
  center_lng: number | null;
  carry_lat: number | null;
  carry_lng: number | null;
  polygon_json: unknown;
  notes: string | null;
};

function coord(lat: number | null, lng: number | null): GpsCoordinate | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function parsePolygon(json: unknown): Array<[number, number]> | null {
  if (!json) return null;
  let value: unknown = json;
  if (typeof json === "string") {
    try {
      value = JSON.parse(json);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(value)) return null;
  const ring: Array<[number, number]> = [];
  for (const pt of value) {
    if (Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
      ring.push([Number(pt[0]), Number(pt[1])]);
    }
  }
  return ring.length >= 3 ? ring : null;
}

function ringCentroid(ring: Array<[number, number]>): GpsCoordinate {
  let lng = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

function isHazardCategory(t: string): HazardCategory | null {
  switch (t) {
    case "bunker":
    case "water":
    case "penalty":
    case "trees":
    case "rough":
    case "ob":
    case "waste":
      return t === "penalty"
        ? "penalty_area"
        : t === "ob"
          ? "out_of_bounds"
          : t === "waste"
            ? "waste_area"
            : (t as HazardCategory);
    default:
      return null;
  }
}

function isSideLabel(v: string | null): SideLabel | null {
  if (!v) return null;
  const allowed: SideLabel[] = ["left", "right", "center", "short", "long"];
  return (allowed as string[]).includes(v) ? (v as SideLabel) : null;
}

export function buildMappedHoleFromRows(
  holeRow: MappedHoleRow,
  featureRows: HoleFeatureRow[],
): MappedHole {
  const tees: TeeBoxMarker[] = [];
  const baseTee = coord(holeRow.tee_lat, holeRow.tee_lng);
  if (baseTee) {
    tees.push({ id: `${holeRow.id}-tee-default`, name: "Tee", coordinate: baseTee, yardage: null });
  }

  let frontCoord = coord(holeRow.green_front_lat, holeRow.green_front_lng);
  let centerCoord = coord(holeRow.green_center_lat, holeRow.green_center_lng);
  let backCoord = coord(holeRow.green_back_lat, holeRow.green_back_lng);
  let pinCoord = coord(holeRow.pin_lat, holeRow.pin_lng);

  const hazards: HazardGeometry[] = [];
  const layups: LayupTarget[] = [];
  const doglegs: DoglegTarget[] = [];
  const landingZones: FairwayLandingZone[] = [];

  let fairwayPolygon: Array<[number, number]> | null = null;
  let teePolygon: Array<[number, number]> | null = null;
  let holeBoundary: Array<[number, number]> | null = null;
  let roughPolygon: Array<[number, number]> | null = null;
  let cartPath: Array<[number, number]> | null = null;
  let greenPolygon: Array<[number, number]> | null = null;
  const naLayers: string[] = [];

  for (const f of featureRows) {
    switch (f.feature_type) {
      case "tee": {
        const c = coord(f.center_lat, f.center_lng);
        if (c) tees.push({ id: f.id, name: f.name ?? "Tee", coordinate: c, yardage: null });
        break;
      }
      case "green_front":
        frontCoord = frontCoord ?? coord(f.center_lat, f.center_lng);
        break;
      case "green_center":
        centerCoord = centerCoord ?? coord(f.center_lat, f.center_lng);
        break;
      case "green_back":
        backCoord = backCoord ?? coord(f.center_lat, f.center_lng);
        break;
      case "pin": {
        const c = coord(f.center_lat, f.center_lng);
        if (c) pinCoord = c;
        break;
      }
      case "layup": {
        const c = coord(f.center_lat, f.center_lng);
        if (c) layups.push({ id: f.id, name: f.name ?? "Layup", coordinate: c, targetYardageFromGreen: null, notes: f.notes });
        break;
      }
      case "dogleg": {
        const c = coord(f.center_lat, f.center_lng);
        if (c) doglegs.push({ id: f.id, coordinate: c, notes: f.notes });
        break;
      }
      case "landing_zone": {
        const c = coord(f.center_lat, f.center_lng);
        if (c) landingZones.push({ id: f.id, name: f.name ?? "Landing", coordinate: c, radiusYards: null, notes: f.notes });
        break;
      }
      case "fairway_polygon": {
        const p = parsePolygon(f.polygon_json);
        if (p) fairwayPolygon = p;
        break;
      }
      case "green_polygon": {
        const p = parsePolygon(f.polygon_json);
        if (p) greenPolygon = p;
        break;
      }
      case "tee_polygon": {
        const p = parsePolygon(f.polygon_json);
        if (p) teePolygon = p;
        break;
      }
      case "hole_boundary": {
        const p = parsePolygon(f.polygon_json);
        if (p) holeBoundary = p;
        break;
      }
      case "rough_polygon": {
        const p = parsePolygon(f.polygon_json);
        if (p) roughPolygon = p;
        break;
      }
      case "cart_path": {
        const p = parsePolygon(f.polygon_json);
        if (p) cartPath = p;
        break;
      }
      case "na_marker": {
        if (f.name) naLayers.push(f.name);
        break;
      }
      default: {
        const cat = isHazardCategory(String(f.feature_type));
        if (!cat) break;
        const polygon = parsePolygon(f.polygon_json);
        const center =
          coord(f.center_lat, f.center_lng) ??
          (polygon ? ringCentroid(polygon) : null);
        if (!center) break;
        hazards.push({
          id: f.id,
          name: f.name ?? cat,
          type: cat,
          side: isSideLabel(f.side_label),
          polygon,
          front: coord(f.front_lat, f.front_lng),
          carry: coord(f.carry_lat, f.carry_lng),
          center,
          notes: f.notes,
        });
      }
    }
  }

  const pin: PinPosition | null = pinCoord ? { coordinate: pinCoord, setOn: null, notes: null } : null;

  return {
    id: holeRow.id,
    holeNumber: holeRow.hole_number,
    par: holeRow.par,
    lengthYards: holeRow.length_yards,
    lengthMeters: holeRow.length_meters,
    tees,
    green: {
      front: frontCoord,
      center: centerCoord,
      back: backCoord,
      polygon: greenPolygon,
      slopeNote: null,
    },
    pin,
    hazards,
    layups,
    doglegs,
    landingZones,
    fairwayPolygon,
    teePolygon,
    holeBoundary,
    roughPolygon,
    cartPath,
    naLayers,
  };
}

function buildCourseMap(row: CourseMapRow): CourseMap {
  return {
    id: row.id,
    courseName: row.course_name,
    locationLabel: row.location_label,
    center: { lat: row.latitude, lng: row.longitude },
    boundary: null,
    holes: [],
    updatedAt: row.updated_at,
  };
}

export async function loadCourseMaps(): Promise<CourseMap[]> {
  const { data, error } = await supabase
    .from("gswing_course_maps")
    .select("id, course_name, location_label, latitude, longitude, updated_at")
    .order("course_name");
  if (error || !data) return [];
  return (data as CourseMapRow[]).map(buildCourseMap);
}

export async function loadCourseMapById(courseMapId: string): Promise<CourseMap | null> {
  const { data, error } = await supabase
    .from("gswing_course_maps")
    .select("id, course_name, location_label, latitude, longitude, updated_at")
    .eq("id", courseMapId)
    .maybeSingle();
  if (error || !data) return null;
  return buildCourseMap(data as CourseMapRow);
}

export async function loadHoleFeatures(mappedHoleId: string): Promise<HoleFeatureRow[]> {
  const { data, error } = await supabase
    .from("gswing_hole_features")
    .select("*")
    .eq("mapped_hole_id", mappedHoleId);
  if (error || !data) return [];
  return data as HoleFeatureRow[];
}

export async function loadMappedHole(
  courseMapId: string,
  holeNumber: number,
): Promise<MappedHole | null> {
  const { data: holeData, error: holeErr } = await supabase
    .from("gswing_mapped_holes")
    .select("*")
    .eq("course_map_id", courseMapId)
    .eq("hole_number", holeNumber)
    .maybeSingle();
  if (holeErr || !holeData) return null;
  const holeRow = holeData as MappedHoleRow;
  const featureRows = await loadHoleFeatures(holeRow.id);
  return buildMappedHoleFromRows(holeRow, featureRows);
}

export async function loadAllMappedHoles(courseMapId: string): Promise<MappedHole[]> {
  const { data: holeData, error: holeErr } = await supabase
    .from("gswing_mapped_holes")
    .select("*")
    .eq("course_map_id", courseMapId)
    .order("hole_number");
  if (holeErr || !holeData) return [];
  const rows = holeData as MappedHoleRow[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { data: featData } = await supabase
    .from("gswing_hole_features")
    .select("*")
    .in("mapped_hole_id", ids);
  const features = (featData as HoleFeatureRow[] | null) ?? [];
  const byHole = new Map<string, HoleFeatureRow[]>();
  for (const f of features) {
    const arr = byHole.get(f.mapped_hole_id) ?? [];
    arr.push(f);
    byHole.set(f.mapped_hole_id, arr);
  }
  return rows.map((r) => buildMappedHoleFromRows(r, byHole.get(r.id) ?? []));
}

export async function findNearestCourseMap(
  playerLocation: GpsCoordinate | null,
): Promise<CourseMap | null> {
  if (!playerLocation) return null;
  const all = await loadCourseMaps();
  if (all.length === 0) return null;
  let best: CourseMap | null = null;
  let bestMeters = Infinity;
  for (const c of all) {
    const d = haversineMeters(playerLocation, c.center);
    if (d < bestMeters) {
      bestMeters = d;
      best = c;
    }
  }
  // Within 10km we consider it a valid arrival; otherwise still return nearest.
  return best;
}

export async function findBestMappedHole(
  courseMapId: string,
  currentHoleNumber: number,
): Promise<MappedHole | null> {
  const exact = await loadMappedHole(courseMapId, currentHoleNumber);
  if (exact) return exact;
  // Fall back to any mapped hole so the screen still has reference geometry.
  const all = await loadAllMappedHoles(courseMapId);
  if (all.length === 0) return null;
  return all[0];
}