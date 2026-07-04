// Renderability + fallback helpers for the owned-geometry Premium path.
// Ensures Premium never blanks out when new-model data is missing —
// falls back to the existing legacy MappedHole renderer.

import type { GswingHoleDefinition } from "./course-geometry-model";
import type { MappedHole } from "@/types/gswing-course-map";

export type RenderableGeometrySource =
  | "gswing-definition"   // new owned model has enough to render
  | "legacy-mapped"       // fall back to existing MappedHole path
  | "none";               // neither is usable — show gate

export function isRenderableGswingHoleDefinition(
  def: GswingHoleDefinition | null | undefined,
): boolean {
  if (!def) return false;
  const hasTee = def.tees.some((t) => t.markers.length > 0);
  const hasGreen =
    !!def.greenPolygon || !!def.greenRefs.center || !!def.greenRefs.front || !!def.pin;
  return hasTee && hasGreen;
}

export function isRenderableLegacyMappedHole(
  hole: MappedHole | null | undefined,
): boolean {
  if (!hole) return false;
  const hasTee = hole.tees.length > 0;
  const hasGreen =
    !!hole.green.center || !!hole.green.front || !!hole.green.back || !!hole.pin;
  return hasTee || hasGreen;
}

export function getRenderableGeometrySource(input: {
  definition?: GswingHoleDefinition | null;
  legacy?: MappedHole | null;
}): RenderableGeometrySource {
  if (isRenderableGswingHoleDefinition(input.definition ?? null)) return "gswing-definition";
  if (isRenderableLegacyMappedHole(input.legacy ?? null)) return "legacy-mapped";
  return "none";
}
