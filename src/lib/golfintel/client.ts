import { supabase } from "@/integrations/supabase/client";

export interface GiSearchResult {
  giCourseId: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  holes: number | null;
}

export interface GiCourseRow {
  gi_course_id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  detail: any;
  scorecard: any;
  gps: any;
  detail_fetched_at: string | null;
  scorecard_fetched_at: string | null;
  gps_fetched_at: string | null;
}

async function invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("golfintel-proxy", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data as T;
}

export const giClient = {
  search: (query: string) => invoke<{ results: GiSearchResult[] }>("search", { query }),
  courseDetail: (giCourseId: string) =>
    invoke<{ source: "cache" | "live"; course: GiCourseRow }>("course-detail", { giCourseId }),
  scorecard: (giCourseId: string) =>
    invoke<{ source: "cache" | "live"; scorecard: any }>("scorecard", { giCourseId }),
  gps: (giCourseId: string) => invoke<{ source: "cache" | "live"; gps: any }>("gps", { giCourseId }),
  holeAsset: (giCourseId: string, holeNumber: number, assetType: "green_slope" | "elevation") =>
    invoke<{ source: "cache" | "live"; url: string | null; payload: any }>("hole-asset", {
      giCourseId,
      holeNumber,
      assetType,
    }),
  creditStatus: () => invoke<{ used: number; limit: number; remaining: number }>("credit-status"),
};

/** Read the local cache directly (free). */
export async function readCachedCourseIds(): Promise<Set<string>> {
  const { data } = await supabase.from("gi_courses").select("gi_course_id");
  return new Set((data ?? []).map((r) => r.gi_course_id));
}

export async function readCachedCourse(giCourseId: string): Promise<GiCourseRow | null> {
  const { data } = await supabase
    .from("gi_courses")
    .select("*")
    .eq("gi_course_id", giCourseId)
    .maybeSingle();
  return (data as GiCourseRow | null) ?? null;
}