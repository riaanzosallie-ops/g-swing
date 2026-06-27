// GolfCourseAPI provider — talks only to our Edge Function, never the
// vendor directly. Normalises responses to G-Swing internal types.

import { supabase } from "@/integrations/supabase/client";
import type {
  CourseDataProvider,
  NormalisedCourse,
  NormalisedHole,
  NormalisedSearchHit,
  NormalisedTee,
} from "./types";

interface RawTee {
  tee_name?: string;
  total_yards?: number;
  total_meters?: number;
  par_total?: number;
  course_rating?: number;
  slope_rating?: number;
  holes?: Array<{ par?: number; yardage?: number; handicap?: number }>;
}

interface RawCourse {
  id: number | string;
  club_name?: string;
  course_name?: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  tees?: { male?: RawTee[]; female?: RawTee[] };
}

async function invoke(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("golfcourse-api", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message || "GolfCourseAPI request failed");
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data;
}

function normaliseTees(raw?: RawCourse["tees"]): { tees: NormalisedTee[]; holes: NormalisedHole[] } {
  const tees: NormalisedTee[] = [];
  const collectHoles: NormalisedHole[] = [];
  (["male", "female"] as const).forEach((gender) => {
    (raw?.[gender] ?? []).forEach((t) => {
      tees.push({
        tee_name: t.tee_name ?? "Tee",
        gender,
        total_yards: t.total_yards ?? null,
        total_meters: t.total_meters ?? null,
        par_total: t.par_total ?? null,
        course_rating: t.course_rating ?? null,
        slope_rating: t.slope_rating ?? null,
      });
      if (collectHoles.length === 0 && t.holes?.length) {
        t.holes.forEach((h, idx) => {
          collectHoles.push({
            hole_number: idx + 1,
            par: h.par ?? null,
            yardage: h.yardage ?? null,
            handicap: h.handicap ?? null,
          });
        });
      }
    });
  });
  return { tees, holes: collectHoles };
}

function normaliseCourse(raw: RawCourse): NormalisedCourse {
  const { tees, holes } = normaliseTees(raw.tees);
  return {
    provider: "GolfCourseAPI",
    external_id: String(raw.id),
    club_name: raw.club_name ?? "",
    course_name: raw.course_name ?? raw.club_name ?? "",
    address: raw.location?.address ?? null,
    city: raw.location?.city ?? null,
    country: raw.location?.country ?? null,
    latitude: raw.location?.latitude ?? null,
    longitude: raw.location?.longitude ?? null,
    tees,
    holes,
    raw,
  };
}

export const golfCourseApiProvider: CourseDataProvider = {
  id: "GolfCourseAPI",
  async search(query: string) {
    const data = await invoke("search", { query });
    const list = ((data as { courses?: RawCourse[] })?.courses ?? []) as RawCourse[];
    return list.map<NormalisedSearchHit>((c) => ({
      provider: "GolfCourseAPI",
      external_id: String(c.id),
      club_name: c.club_name ?? "",
      course_name: c.course_name ?? c.club_name ?? "",
      address: c.location?.address ?? null,
    }));
  },
  async getCourse(externalId) {
    const data = await invoke("get", { id: externalId });
    const course = (data as { course?: RawCourse })?.course;
    if (!course) throw new Error("Course not found");
    return normaliseCourse(course);
  },
};

export async function findSharjah(): Promise<NormalisedSearchHit[]> {
  const data = await invoke("sharjah");
  const list = ((data as { courses?: RawCourse[] })?.courses ?? []) as RawCourse[];
  return list.map((c) => ({
    provider: "GolfCourseAPI" as const,
    external_id: String(c.id),
    club_name: c.club_name ?? "",
    course_name: c.course_name ?? c.club_name ?? "",
    address: c.location?.address ?? null,
  }));
}

// ---------------- Offline cache (localStorage, normalised courses) -----
const OFFLINE_KEY = "gswing.golfcourseapi.cache.v1";

interface OfflineCache {
  [externalId: string]: { course: NormalisedCourse; cachedAt: number };
}

function readOffline(): OfflineCache {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    return raw ? (JSON.parse(raw) as OfflineCache) : {};
  } catch { return {}; }
}
function writeOffline(c: OfflineCache) {
  try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(c)); } catch { /* ignore quota */ }
}

export function getOfflineCourse(externalId: string): NormalisedCourse | null {
  const entry = readOffline()[externalId];
  return entry?.course ?? null;
}

export function saveOfflineCourse(course: NormalisedCourse) {
  const cache = readOffline();
  cache[course.external_id] = { course, cachedAt: Date.now() };
  writeOffline(cache);
}