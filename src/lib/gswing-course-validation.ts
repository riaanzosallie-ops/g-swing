/**
 * G-Swing course validation — honest checks on course/hole data.
 * Returns evidence about completeness; never fabricates data.
 */

import { isRealValue } from "./gswing-live-data";

export type HoleLike = {
  hole_number?: number | null;
  par?: number | null;
  yardage?: number | null;
  length_white?: number | null;
  length_blue?: number | null;
  green?: unknown;
  tee?: unknown;
  geometry?: unknown;
};

export type CourseLike = {
  id?: string | null;
  name?: string | null;
  total_holes?: number | null;
  holes?: HoleLike[];
};

export type CourseDataStatus =
  | "complete"
  | "partial"
  | "mapping_required"
  | "not_connected";

export function validateHolePar(hole: HoleLike): { ok: boolean; reason?: string } {
  if (!isRealValue(hole.hole_number)) return { ok: false, reason: "Missing hole number" };
  const n = hole.hole_number as number;
  if (n < 1 || n > 18) return { ok: false, reason: "Hole number out of range" };
  if (!isRealValue(hole.par)) return { ok: false, reason: "Par unavailable" };
  if (![3, 4, 5].includes(hole.par as number)) return { ok: false, reason: "Par must be 3, 4, or 5" };
  return { ok: true };
}

export function validateCourseLayout(course: CourseLike): {
  ok: boolean;
  issues: string[];
  holesWithPar: number;
  holesWithMapping: number;
  totalHoles: number;
} {
  const issues: string[] = [];
  const holes = course.holes ?? [];
  const totalHoles = holes.length;

  if (!isRealValue(course.id) || !isRealValue(course.name)) {
    issues.push("Course not connected");
  }

  let holesWithPar = 0;
  let holesWithMapping = 0;
  for (const h of holes) {
    if (validateHolePar(h).ok) holesWithPar++;
    if (isRealValue(h.green) || isRealValue(h.geometry) || isRealValue(h.tee)) holesWithMapping++;
  }

  if (totalHoles === 0) issues.push("No holes defined");
  if (holesWithPar < totalHoles) issues.push(`${totalHoles - holesWithPar} hole(s) missing par`);
  if (holesWithMapping === 0 && totalHoles > 0) issues.push("Mapping required");

  return {
    ok: issues.length === 0,
    issues,
    holesWithPar,
    holesWithMapping,
    totalHoles,
  };
}

export function getCourseDataStatus(course: CourseLike): CourseDataStatus {
  if (!isRealValue(course.id) || !isRealValue(course.name)) return "not_connected";
  const holes = course.holes ?? [];
  if (holes.length === 0) return "not_connected";
  const mapped = holes.filter((h) => isRealValue(h.green) || isRealValue(h.geometry) || isRealValue(h.tee)).length;
  if (mapped === 0) return "mapping_required";
  if (mapped < holes.length) return "partial";
  return "complete";
}