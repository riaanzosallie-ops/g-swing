// Offline-ready Course Package structure. Pure, non-networked in V1 —
// this is the shape that future bundle/download/sync layers will
// serialize to and hydrate from. No new live-tile dependency.

import {
  GSWING_COURSE_SCHEMA_VERSION,
  type GswingCourseDefinition,
} from "./course-geometry-model";

export const COURSE_PACKAGE_SCHEMA_VERSION = 1 as const;

export interface CoursePackage {
  packageSchemaVersion: typeof COURSE_PACKAGE_SCHEMA_VERSION;
  courseSchemaVersion: typeof GSWING_COURSE_SCHEMA_VERSION;
  packedAt: string;
  definition: GswingCourseDefinition;
  /** Reserved for future binary assets (e.g. cached tiles, terrain). */
  assets?: Record<string, string>;
}

export function packCourse(definition: GswingCourseDefinition): CoursePackage {
  return {
    packageSchemaVersion: COURSE_PACKAGE_SCHEMA_VERSION,
    courseSchemaVersion: GSWING_COURSE_SCHEMA_VERSION,
    packedAt: new Date().toISOString(),
    definition,
  };
}

export type CoursePackageError =
  | { ok: false; reason: "unsupported-package-version" | "unsupported-course-version" | "malformed" };

export function unpackCourse(
  pkg: unknown,
): { ok: true; definition: GswingCourseDefinition } | CoursePackageError {
  if (!pkg || typeof pkg !== "object") return { ok: false, reason: "malformed" };
  const p = pkg as Partial<CoursePackage>;
  if (p.packageSchemaVersion !== COURSE_PACKAGE_SCHEMA_VERSION) {
    return { ok: false, reason: "unsupported-package-version" };
  }
  if (p.courseSchemaVersion !== GSWING_COURSE_SCHEMA_VERSION) {
    return { ok: false, reason: "unsupported-course-version" };
  }
  if (!p.definition || typeof p.definition !== "object") {
    return { ok: false, reason: "malformed" };
  }
  return { ok: true, definition: p.definition as GswingCourseDefinition };
}

/** Convenience serializer for future storage layers (IndexedDB, file). */
export function serializePackage(pkg: CoursePackage): string {
  return JSON.stringify(pkg);
}

export function deserializePackage(
  raw: string,
): { ok: true; definition: GswingCourseDefinition } | CoursePackageError {
  try {
    return unpackCourse(JSON.parse(raw));
  } catch {
    return { ok: false, reason: "malformed" };
  }
}
