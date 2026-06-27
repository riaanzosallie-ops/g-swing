// Production course geometry loader.
// Reads from the PostGIS-backed tables via the public.get_hole_geometry RPC
// and adapts the payload to the HoleGpsResponse shape used by GpsMap.

import { supabase } from "@/integrations/supabase/client";
import type {
  GpsUnit,
  Hazard,
  HoleGpsResponse,
  TeeBox,
} from "@/lib/golf-gps-api";
import { haversineYards, toDisplayUnit, type LatLng } from "@/lib/gps-utils";

type RpcPoint = {
  id: string;
  point_type:
    | "tee_back" | "tee_middle" | "tee_front"
    | "fairway_start" | "layup"
    | "green_front" | "green_center" | "green_back"
    | "pin_position" | "dogleg";
  label: string | null;
  lat: number;
  lng: number;
  meta: Record<string, unknown>;
};

type RpcHazard = {
  id: string;
  hazard_type: "bunker" | "water" | "trees" | "waste" | "ob" | "cart_path" | "creek" | "other";
  label: string | null;
  geom: GeoJSON.Geometry;
  center_lat: number | null;
  center_lng: number | null;
  carry_yards_from_tee: number | null;
};

type RpcGreen = {
  polygon: GeoJSON.Polygon;
  center_lat: number;
  center_lng: number;
  depth_yards: number | null;
  width_yards: number | null;
} | null;

type RpcFairway = { polygon: GeoJSON.Polygon } | null;

type RpcDailyPin = { pin_label: string; effective_date: string } | null;

type RpcHole = {
  id: string;
  hole_number: number;
  par: number | null;
  handicap: number | null;
  length_black: number | null;
  length_gold: number | null;
  length_blue: number | null;
  length_white: number | null;
  length_red: number | null;
  notes: string | null;
};

export interface HoleGeometryPayload {
  hole: RpcHole;
  points: RpcPoint[];
  hazards: RpcHazard[];
  green: RpcGreen;
  fairway: RpcFairway;
  daily_pin: RpcDailyPin;
}

/**
 * Fetch full hole geometry from the database. Returns `null` when the course
 * or hole has not been mapped yet, so callers can fall back to demo geometry
 * without breaking.
 */
export async function fetchHoleGeometry(
  courseId: string,
  holeNumber: number,
): Promise<HoleGeometryPayload | null> {
  const { data, error } = await supabase.rpc("get_hole_geometry", {
    p_course_id: courseId,
    p_hole_number: holeNumber,
  });
  if (error) throw error;
  if (!data) return null;
  return data as unknown as HoleGeometryPayload;
}

function findPoint(points: RpcPoint[], type: RpcPoint["point_type"]): LatLng | null {
  const found = points.find((p) => p.point_type === type);
  return found ? { lat: found.lat, lng: found.lng } : null;
}

function resolvePin(payload: HoleGeometryPayload): LatLng | null {
  // Daily pin → matching labelled pin_position row.
  const dailyLabel = payload.daily_pin?.pin_label ?? null;
  if (dailyLabel) {
    const labelled = payload.points.find(
      (p) => p.point_type === "pin_position" && p.label === dailyLabel,
    );
    if (labelled) return { lat: labelled.lat, lng: labelled.lng };
  }
  // Fallback to first available pin position, then green center.
  const anyPin = payload.points.find((p) => p.point_type === "pin_position");
  if (anyPin) return { lat: anyPin.lat, lng: anyPin.lng };
  if (payload.green) return { lat: payload.green.center_lat, lng: payload.green.center_lng };
  return null;
}

/**
 * Convert a DB geometry payload into the HoleGpsResponse shape that GpsMap
 * already understands, including computed distances from the player position.
 */
export function geometryToHoleGpsResponse(
  courseId: string,
  payload: HoleGeometryPayload,
  unit: GpsUnit,
  playerPos: LatLng | null,
): HoleGpsResponse {
  const teeBack = findPoint(payload.points, "tee_back");
  const teeMiddle = findPoint(payload.points, "tee_middle");
  const teeFront = findPoint(payload.points, "tee_front");

  const tee_boxes: TeeBox[] = [
    teeBack && {
      color: "championship",
      yardage: payload.hole.length_black ?? payload.hole.length_gold ?? 0,
      lat: teeBack.lat,
      lng: teeBack.lng,
    },
    teeMiddle && {
      color: "white",
      yardage: payload.hole.length_white ?? 0,
      lat: teeMiddle.lat,
      lng: teeMiddle.lng,
    },
    teeFront && {
      color: "red",
      yardage: payload.hole.length_red ?? 0,
      lat: teeFront.lat,
      lng: teeFront.lng,
    },
  ].filter(Boolean) as TeeBox[];

  const greenCenter: LatLng | null = payload.green
    ? { lat: payload.green.center_lat, lng: payload.green.center_lng }
    : null;
  const greenFront = findPoint(payload.points, "green_front");
  const greenBack = findPoint(payload.points, "green_back");
  const pin = resolvePin(payload);

  const display = (yards: number) => toDisplayUnit(yards, unit);

  const hazardEntries: Hazard[] = payload.hazards.map((h) => ({
    type: (h.hazard_type === "cart_path" || h.hazard_type === "creek" || h.hazard_type === "waste"
      ? "ob"
      : h.hazard_type === "other"
        ? "layup"
        : h.hazard_type) as Hazard["type"],
    label: h.label,
    lat: h.center_lat,
    lng: h.center_lng,
    geometry: h.geom as Hazard["geometry"],
    carry_yards_from_tee: h.carry_yards_from_tee,
  }));

  const hazardDistances: Record<string, number> = {};
  if (playerPos) {
    for (const h of payload.hazards) {
      if (h.center_lat != null && h.center_lng != null) {
        const key = (h.label ?? `${h.hazard_type}_${h.id.slice(0, 4)}`)
          .toLowerCase()
          .replace(/\s+/g, "_");
        hazardDistances[key] = display(haversineYards(playerPos, { lat: h.center_lat, lng: h.center_lng }));
      }
    }
  }

  const distances = playerPos && greenCenter
    ? {
        to_center_of_green: display(haversineYards(playerPos, greenCenter)),
        to_front_of_green: greenFront ? display(haversineYards(playerPos, greenFront)) : display(haversineYards(playerPos, greenCenter)),
        to_back_of_green: greenBack ? display(haversineYards(playerPos, greenBack)) : display(haversineYards(playerPos, greenCenter)),
        to_pin: pin ? display(haversineYards(playerPos, pin)) : null,
        to_tee_box: teeBack ? display(haversineYards(playerPos, teeBack)) : null,
        hazards: hazardDistances,
      }
    : null;

  return {
    course_id: courseId,
    hole_number: payload.hole.hole_number,
    par: payload.hole.par ?? 4,
    handicap: payload.hole.handicap ?? 0,
    notes: payload.hole.notes,
    unit,
    status: "ok",
    tee_boxes,
    green: greenCenter
      ? {
          center: greenCenter,
          front: greenFront ?? greenCenter,
          back: greenBack ?? greenCenter,
          pin,
          polygon: payload.green?.polygon
            ? { type: "Polygon", coordinates: payload.green.polygon.coordinates as [number, number][][] }
            : null,
          depth_yards: payload.green?.depth_yards ?? 0,
          width_yards: payload.green?.width_yards ?? 0,
        }
      : null,
    hazards: hazardEntries,
    player_position: playerPos,
    distances,
    recommended_target: payload.hole.par === 3 ? "Center of green" : "Fairway to green approach",
  };
}

export interface CourseSummaryRow {
  id: string;
  name: string;
  club: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  total_holes: number;
  par: number | null;
}

/** List every mapped course from the database. */
export async function fetchMappedCourses(): Promise<CourseSummaryRow[]> {
  const { data, error } = await supabase
    .from("golf_courses")
    .select("id,name,club,city,country,latitude,longitude,total_holes,par")
    .order("name");
  if (error) throw error;
  return (data ?? []) as CourseSummaryRow[];
}