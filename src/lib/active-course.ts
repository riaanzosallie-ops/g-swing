// Active course selection — the single source of truth for which course
// the player is currently "playing". Persisted in localStorage so it
// survives app reloads and cold starts, and consumed by the Dashboard
// (Active Course card), Live GPS (skip picker when set), Scorecard,
// Tournament and Round modes.

const KEY = "gswing.activeCourse";
// Backwards-compat: GpsMap also reads this key for its default courseId.
const LEGACY_ID_KEY = "gswing.lastCourseId";

export interface ActiveCourse {
  id: string;
  name: string;
  /** Where the course record lives — mapped table or GolfAPI cache. */
  source: "mapped" | "golfapi" | "catalog";
  city?: string | null;
  country?: string | null;
  holes?: number | null;
  activatedAt: string;
}

export function getActiveCourse(): ActiveCourse | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveCourse;
  } catch {
    return null;
  }
}

export function setActiveCourse(
  input: Omit<ActiveCourse, "activatedAt"> & { activatedAt?: string },
): ActiveCourse {
  const record: ActiveCourse = {
    ...input,
    activatedAt: input.activatedAt ?? new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
    localStorage.setItem(LEGACY_ID_KEY, record.id);
    window.dispatchEvent(
      new CustomEvent("gswing-active-course-changed", { detail: record }),
    );
  } catch {
    /* best-effort */
  }
  return record;
}

export function clearActiveCourse(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_ID_KEY);
    window.dispatchEvent(
      new CustomEvent("gswing-active-course-changed", { detail: null }),
    );
  } catch {
    /* best-effort */
  }
}

export function subscribeActiveCourse(
  cb: (course: ActiveCourse | null) => void,
): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ActiveCourse | null>).detail;
    cb(detail ?? null);
  };
  window.addEventListener("gswing-active-course-changed", handler);
  const storageHandler = (e: StorageEvent) => {
    if (e.key === KEY) cb(getActiveCourse());
  };
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener("gswing-active-course-changed", handler);
    window.removeEventListener("storage", storageHandler);
  };
}