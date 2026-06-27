// Public G-Swing service facade for course data.
// Routes through the provider abstraction so future providers (iGolf,
// Golf Intelligence, OSM) can be added without touching call sites.

import { supabase } from "@/integrations/supabase/client";
import { golfCourseApiProvider, findSharjah, getOfflineCourse, saveOfflineCourse } from "./course-providers/golfcourse-api";
import type {
  CourseDataProvider,
  NormalisedCourse,
  NormalisedHole,
  NormalisedSearchHit,
  NormalisedTee,
  ProviderId,
} from "./course-providers/types";

const PROVIDERS: Record<ProviderId, CourseDataProvider | null> = {
  GolfCourseAPI: golfCourseApiProvider,
  iGolf: null,
  GolfIntelligence: null,
  OpenStreetMap: null,
};

export function getProvider(id: ProviderId = "GolfCourseAPI"): CourseDataProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Provider not implemented: ${id}`);
  return p;
}

// --- Spec'd surface (lib/golfcourse-api.ts) ---------------------------

export async function searchCourses(query: string): Promise<NormalisedSearchHit[]> {
  return getProvider().search(query);
}

export async function getCourse(externalId: string | number): Promise<NormalisedCourse> {
  try {
    const course = await getProvider().getCourse(externalId);
    saveOfflineCourse(course);
    return course;
  } catch (e) {
    // Offline fallback — never block GPS when provider is down.
    const cached = getOfflineCourse(String(externalId));
    if (cached) return cached;
    throw e;
  }
}

export async function getHole(externalId: string | number, holeNumber: number): Promise<NormalisedHole | null> {
  const course = await getCourse(externalId);
  return course.holes.find((h) => h.hole_number === holeNumber) ?? null;
}

export async function getScorecard(externalId: string | number): Promise<NormalisedHole[]> {
  return (await getCourse(externalId)).holes;
}

export async function getTeeInformation(externalId: string | number): Promise<NormalisedTee[]> {
  return (await getCourse(externalId)).tees;
}

// GolfCourseAPI does not expose green coordinates / hazard geometry today.
// These are kept on the surface so future providers can fulfil them
// without changing call sites.
export async function getCourseGeometry(_externalId: string | number) {
  return { available: false as const, reason: "GolfCourseAPI does not expose green/fairway geometry." };
}
export async function getGreenCoordinates(_externalId: string | number) {
  return { available: false as const, reason: "GolfCourseAPI does not expose green coordinates." };
}
export async function getHazards(_externalId: string | number) {
  return { available: false as const, reason: "GolfCourseAPI does not expose hazard geometry." };
}

export { findSharjah };

// --- Owner sync workflow ---------------------------------------------

export interface SyncDiffRow {
  hole_number: number;
  field: "par" | "yardage" | "handicap";
  gswing: number | null;
  provider: number | null;
  status: "identical" | "minor" | "major" | "missing-gswing" | "missing-provider";
}

function classify(field: SyncDiffRow["field"], a: number | null, b: number | null): SyncDiffRow["status"] {
  if (a === null && b === null) return "identical";
  if (a === null) return "missing-gswing";
  if (b === null) return "missing-provider";
  if (a === b) return "identical";
  const delta = Math.abs(a - b);
  if (field === "par") return delta === 0 ? "identical" : "major";
  if (field === "handicap") return delta <= 1 ? "minor" : "major";
  // yardage
  if (delta <= 5) return "minor";
  return "major";
}

export interface GswingHoleSnapshot {
  hole_number: number;
  par: number | null;
  length_yards: number | null;
  handicap: number | null;
}

export function buildDiff(
  gswing: GswingHoleSnapshot[],
  provider: NormalisedHole[],
): SyncDiffRow[] {
  const rows: SyncDiffRow[] = [];
  const numbers = Array.from(new Set([...gswing.map((g) => g.hole_number), ...provider.map((p) => p.hole_number)])).sort((a, b) => a - b);
  for (const n of numbers) {
    const g = gswing.find((x) => x.hole_number === n);
    const p = provider.find((x) => x.hole_number === n);
    (["par", "yardage", "handicap"] as const).forEach((field) => {
      const gVal = field === "yardage" ? (g?.length_yards ?? null) : ((g?.[field as "par" | "handicap"] ?? null));
      const pVal = field === "yardage" ? (p?.yardage ?? null) : ((p?.[field as "par" | "handicap"] ?? null));
      rows.push({ hole_number: n, field, gswing: gVal, provider: pVal, status: classify(field, gVal, pVal) });
    });
  }
  return rows;
}

/**
 * Persists the link between a G-Swing course map and an external provider.
 * Does NOT mutate hole geometry — owner-driven import is a separate step
 * (caller decides which diff rows to accept).
 */
export async function linkCourseToProvider(params: {
  courseMapId: string;
  provider: ProviderId;
  externalId: string;
}): Promise<void> {
  const { courseMapId, provider, externalId } = params;
  const { error } = await supabase
    .from("gswing_course_maps")
    .update({
      external_provider: provider,
      external_course_id: externalId,
      last_synced: new Date().toISOString(),
    })
    .eq("id", courseMapId);
  if (error) throw error;
}

export async function recordSyncHistory(params: {
  courseMapId: string;
  provider: ProviderId;
  externalId: string;
  changes: unknown;
  accepted: unknown;
  rejected: unknown;
  notes?: string;
}): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await supabase.from("course_sync_history").insert({
    course_map_id: params.courseMapId,
    provider: params.provider,
    external_course_id: params.externalId,
    changes: params.changes as never,
    accepted: params.accepted as never,
    rejected: params.rejected as never,
    notes: params.notes ?? null,
    owner_id: session.user?.id ?? null,
  });
  if (error) throw error;
}

/**
 * Convenience for the GPS engine / debug HUD to surface which source
 * is currently authoritative for a hole's distances.
 */
export type { YardageSource } from "./course-providers/types";

export async function syncCourse(courseMapId: string, externalId: string): Promise<NormalisedCourse> {
  const course = await getCourse(externalId);
  await linkCourseToProvider({ courseMapId, provider: "GolfCourseAPI", externalId: String(externalId) });
  return course;
}