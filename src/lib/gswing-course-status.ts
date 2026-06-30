// Course status helpers — single source of truth for "where is this
// course in the mapping lifecycle?" used by the Manage Courses dashboard,
// the Course Mapper header, Live GPS, and any other surface that needs
// to communicate readiness consistently.

import { supabase } from "@/integrations/supabase/client";

export type CourseStatus =
  | "not_added"
  | "added"
  | "partially_mapped"
  | "fully_mapped"
  | "premium_ready";

export interface CourseStatusInfo {
  status: CourseStatus;
  label: string;
  tone: "slate" | "sky" | "amber" | "emerald" | "gold";
  holesMapped: number;
  holesTotal: number;
  premiumHoles: number;
  progressLabel: string; // e.g. "12/18 holes"
}

export function classifyCourseStatus(input: {
  holesMapped: number;
  holesTotal?: number;
  premiumHoles: number;
}): CourseStatusInfo {
  const total = input.holesTotal ?? 18;
  const mapped = input.holesMapped;
  const premium = input.premiumHoles;
  let status: CourseStatus = "added";
  if (mapped === 0) status = "added";
  else if (mapped < total) status = "partially_mapped";
  else if (premium >= total) status = "premium_ready";
  else status = "fully_mapped";

  const tone: CourseStatusInfo["tone"] =
    status === "premium_ready" ? "gold"
      : status === "fully_mapped" ? "emerald"
      : status === "partially_mapped" ? "amber"
      : "sky";

  const label =
    status === "premium_ready" ? "Premium Ready"
      : status === "fully_mapped" ? "Fully Mapped"
      : status === "partially_mapped" ? `Partially Mapped (${mapped}/${total})`
      : "Added";

  return {
    status,
    label,
    tone,
    holesMapped: mapped,
    holesTotal: total,
    premiumHoles: premium,
    progressLabel: `${mapped}/${total} holes`,
  };
}

export interface CourseSummary {
  id: string;
  course_name: string;
  location_label: string | null;
  latitude: number;
  longitude: number;
  external_provider: string | null;
  external_course_id: string | null;
  last_synced: string | null;
  updated_at: string;
  created_at: string;
  statusInfo: CourseStatusInfo;
}

/**
 * Loads every G-Swing course map with mapping-progress stats in a single
 * round-trip. "Premium hole" = a mapped hole that has both a fairway and
 * green polygon — the minimum requirement for the illustrated renderer.
 */
export async function listCoursesWithStatus(): Promise<CourseSummary[]> {
  const { data: courses, error: courseErr } = await supabase
    .from("gswing_course_maps")
    .select("id, course_name, location_label, latitude, longitude, external_provider, external_course_id, last_synced, updated_at, created_at")
    .order("course_name");
  if (courseErr) throw courseErr;
  const list = (courses ?? []) as Array<Omit<CourseSummary, "statusInfo">>;
  if (list.length === 0) return [];

  const ids = list.map((c) => c.id);
  const { data: holes } = await supabase
    .from("gswing_mapped_holes")
    .select("id, course_map_id, hole_number")
    .in("course_map_id", ids);
  const holesByCourse = new Map<string, Array<{ id: string; hole_number: number }>>();
  for (const h of holes ?? []) {
    const arr = holesByCourse.get(h.course_map_id) ?? [];
    arr.push({ id: h.id, hole_number: h.hole_number });
    holesByCourse.set(h.course_map_id, arr);
  }

  const allHoleIds = (holes ?? []).map((h) => h.id);
  const premiumByHole = new Set<string>();
  if (allHoleIds.length > 0) {
    const { data: feats } = await supabase
      .from("gswing_hole_features")
      .select("mapped_hole_id, feature_type")
      .in("mapped_hole_id", allHoleIds)
      .in("feature_type", ["fairway_polygon", "green_polygon"]);
    const seen = new Map<string, Set<string>>();
    for (const f of feats ?? []) {
      const s = seen.get(f.mapped_hole_id) ?? new Set<string>();
      s.add(f.feature_type);
      seen.set(f.mapped_hole_id, s);
    }
    for (const [holeId, types] of seen) {
      if (types.has("fairway_polygon") && types.has("green_polygon")) {
        premiumByHole.add(holeId);
      }
    }
  }

  return list.map((c) => {
    const courseHoles = holesByCourse.get(c.id) ?? [];
    const premiumCount = courseHoles.filter((h) => premiumByHole.has(h.id)).length;
    const statusInfo = classifyCourseStatus({
      holesMapped: courseHoles.length,
      holesTotal: 18,
      premiumHoles: premiumCount,
    });
    return { ...c, statusInfo };
  });
}

export async function archiveCourse(_id: string): Promise<void> {
  // Soft-archive is not yet schema-backed; surface a clear error so the
  // UI does not pretend to succeed.
  throw new Error("Archive is not enabled yet — use Delete or contact admin.");
}

export async function deleteCourse(id: string): Promise<void> {
  const { error } = await supabase.from("gswing_course_maps").delete().eq("id", id);
  if (error) throw error;
}

export function toneClasses(tone: CourseStatusInfo["tone"]): string {
  switch (tone) {
    case "gold": return "border-gold/50 bg-gold/15 text-gold";
    case "emerald": return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "amber": return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "sky": return "border-sky-500/40 bg-sky-500/10 text-sky-200";
    case "slate": default: return "border-white/15 bg-white/5 text-foreground/70";
  }
}