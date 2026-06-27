// Course geometry importers. Browser-side helpers that turn user-supplied
// data files (GeoJSON, GPX, CSV) into rows ready for the public.golf_*
// tables. Call `importHoleGeometry` after parsing.
//
// These helpers run client-side for now and use the standard Supabase JS
// client, which means writes require either:
//   (a) an authenticated user whose role allows writes (add an admin policy
//       when the staff UI lands), or
//   (b) the same logic re-used inside an edge function running with the
//       service-role key.
//
// Today the policies only allow read access publicly, so calling these from
// the client without an admin role will be rejected — that is intentional
// until the club-staff UI ships. Keep this module so the parsers themselves
// are ready to use from either surface.

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PointType = Database["public"]["Enums"]["golf_point_type"];
type HazardType = Database["public"]["Enums"]["golf_hazard_type"];

export interface ImportedHoleGeometry {
  course_id: string;
  hole_number: number;
  par?: number;
  handicap?: number;
  length_black?: number;
  length_white?: number;
  length_red?: number;
  points?: Array<{ point_type: PointType; label?: string; lat: number; lng: number }>;
  hazards?: Array<{
    hazard_type: HazardType;
    label?: string;
    geometry: GeoJSON.Geometry;
    carry_yards_from_tee?: number;
  }>;
  green_polygon?: GeoJSON.Polygon;
  fairway_polygon?: GeoJSON.Polygon;
}

/** Parse a GeoJSON FeatureCollection where each feature carries hole metadata. */
export function parseGeoJsonHole(
  feature: GeoJSON.Feature,
  fallbackCourseId: string,
): ImportedHoleGeometry | null {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const courseId = (props.course_id as string) ?? fallbackCourseId;
  const holeNumber = Number(props.hole_number);
  if (!courseId || !Number.isFinite(holeNumber)) return null;

  const geom = feature.geometry;
  const result: ImportedHoleGeometry = {
    course_id: courseId,
    hole_number: holeNumber,
    par: Number.isFinite(props.par) ? Number(props.par) : undefined,
  };

  if (geom.type === "Polygon") {
    if (props.layer === "green") result.green_polygon = geom;
    else if (props.layer === "fairway") result.fairway_polygon = geom;
    else
      result.hazards = [
        {
          hazard_type: (props.hazard_type as HazardType) ?? "other",
          label: props.label as string | undefined,
          geometry: geom,
        },
      ];
  }
  return result;
}

/**
 * CSV row format (header row required):
 *   course_id,hole_number,point_type,label,lat,lng
 * Empty cells are allowed for `label`.
 */
export function parsePointsCsv(csv: string): Array<{
  course_id: string;
  hole_number: number;
  point_type: PointType;
  label: string | null;
  lat: number;
  lng: number;
}> {
  const rows = csv.trim().split(/\r?\n/);
  const [header, ...rest] = rows;
  const cols = header.split(",").map((c) => c.trim().toLowerCase());
  const idx = (key: string) => cols.indexOf(key);
  return rest
    .map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const lat = Number(cells[idx("lat")]);
      const lng = Number(cells[idx("lng")]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        course_id: cells[idx("course_id")],
        hole_number: Number(cells[idx("hole_number")]),
        point_type: cells[idx("point_type")] as PointType,
        label: cells[idx("label")] || null,
        lat,
        lng,
      };
    })
    .filter(Boolean) as ReturnType<typeof parsePointsCsv>;
}

/**
 * Minimal GPX track parser — extracts every `<trkpt>` lat/lon. Useful when
 * a mapper walks the course recording tee/green positions.
 */
export function parseGpxTrackPoints(gpx: string): Array<{ lat: number; lng: number }> {
  const doc = new DOMParser().parseFromString(gpx, "application/xml");
  return Array.from(doc.getElementsByTagName("trkpt")).map((node) => ({
    lat: Number(node.getAttribute("lat")),
    lng: Number(node.getAttribute("lon")),
  }));
}

/**
 * Insert a single hole's worth of geometry. Caller must have write access
 * (admin role or service-role context) — RLS blocks anonymous writes.
 */
export async function importHoleGeometry(payload: ImportedHoleGeometry): Promise<{ hole_id: string }> {
  const { data: hole, error: holeError } = await supabase
    .from("golf_holes")
    .upsert(
      {
        course_id: payload.course_id,
        hole_number: payload.hole_number,
        par: payload.par,
        handicap: payload.handicap,
        length_black: payload.length_black,
        length_white: payload.length_white,
        length_red: payload.length_red,
      },
      { onConflict: "course_id,hole_number" },
    )
    .select("id")
    .single();
  if (holeError || !hole) throw holeError ?? new Error("hole upsert failed");

  const holeId = hole.id;

  if (payload.points?.length) {
    const rows = payload.points.map((p) => ({
      hole_id: holeId,
      point_type: p.point_type,
      label: p.label ?? null,
      location: `SRID=4326;POINT(${p.lng} ${p.lat})`,
    }));
    const { error } = await supabase.from("golf_hole_points").insert(rows);
    if (error) throw error;
  }

  if (payload.green_polygon) {
    const { error } = await supabase.from("golf_green_polygons").upsert(
      {
        hole_id: holeId,
        polygon: JSON.stringify(payload.green_polygon),
      },
      { onConflict: "hole_id" },
    );
    if (error) throw error;
  }

  if (payload.fairway_polygon) {
    const { error } = await supabase.from("golf_fairway_polygons").upsert(
      {
        hole_id: holeId,
        polygon: JSON.stringify(payload.fairway_polygon),
      },
      { onConflict: "hole_id" },
    );
    if (error) throw error;
  }

  if (payload.hazards?.length) {
    const rows = payload.hazards.map((h) => ({
      hole_id: holeId,
      hazard_type: h.hazard_type,
      label: h.label ?? null,
      geom: JSON.stringify(h.geometry),
      carry_yards_from_tee: h.carry_yards_from_tee ?? null,
    }));
    const { error } = await supabase.from("golf_hazards").insert(rows);
    if (error) throw error;
  }

  return { hole_id: holeId };
}