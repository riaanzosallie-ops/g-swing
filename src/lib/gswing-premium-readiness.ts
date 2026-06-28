// G-Swing Premium Visual Mapping — readiness model.
// ---------------------------------------------------
// GPS Mapping (tee + green front/center/back + pin) is sufficient for
// distances and is handled elsewhere via `hasUsableHoleMapping`.
//
// Premium Mapping is a SEPARATE concept: the set of drawn polygons that
// allow the Premium Hole Renderer to produce a hand-illustrated aerial
// view. A hole is "Premium Ready" only when each premium layer is either
// drawn or explicitly marked Not Applicable for that hole.

import type { MappedHole } from "@/types/gswing-course-map";

export type PremiumLayerKey =
  | "fairway_polygon"
  | "green_polygon"
  | "tee_polygon"
  | "hole_boundary"
  | "rough_polygon"
  | "bunkers"
  | "water"
  | "trees"
  | "waste"
  | "ob"
  | "cart_path";

export interface PremiumLayerDef {
  key: PremiumLayerKey;
  label: string;
  optional: boolean;
}

/** Canonical premium layer list rendered in the mapper checklist. */
export const PREMIUM_LAYERS: PremiumLayerDef[] = [
  { key: "hole_boundary", label: "Hole boundary", optional: false },
  { key: "fairway_polygon", label: "Fairway polygon", optional: false },
  { key: "green_polygon", label: "Green polygon", optional: false },
  { key: "tee_polygon", label: "Tee polygon", optional: false },
  { key: "rough_polygon", label: "Rough area", optional: true },
  { key: "bunkers", label: "Bunkers", optional: true },
  { key: "water", label: "Water hazards", optional: true },
  { key: "trees", label: "Trees", optional: true },
  { key: "waste", label: "Waste areas", optional: true },
  { key: "ob", label: "OB / Penalty", optional: true },
  { key: "cart_path", label: "Cart path", optional: true },
];

export interface PremiumLayerStatus {
  key: PremiumLayerKey;
  label: string;
  drawn: boolean;
  markedNa: boolean;
  satisfied: boolean;
  optional: boolean;
}

function hasPolygon(p?: Array<[number, number]> | null): boolean {
  return Array.isArray(p) && p.length >= 3;
}

function layerDrawn(hole: MappedHole, key: PremiumLayerKey): boolean {
  switch (key) {
    case "fairway_polygon":
      return hasPolygon(hole.fairwayPolygon ?? null);
    case "green_polygon":
      return hasPolygon(hole.green.polygon);
    case "tee_polygon":
      return hasPolygon(hole.teePolygon ?? null);
    case "hole_boundary":
      return hasPolygon(hole.holeBoundary ?? null);
    case "rough_polygon":
      return (
        hasPolygon(hole.roughPolygon ?? null) ||
        hole.hazards.some((h) => h.type === "rough" && hasPolygon(h.polygon))
      );
    case "bunkers":
      return hole.hazards.some((h) => h.type === "bunker" && hasPolygon(h.polygon));
    case "water":
      return hole.hazards.some(
        (h) => (h.type === "water" || h.type === "penalty_area") && hasPolygon(h.polygon),
      );
    case "trees":
      return hole.hazards.some((h) => h.type === "trees" && hasPolygon(h.polygon));
    case "waste":
      return hole.hazards.some((h) => h.type === "waste_area" && hasPolygon(h.polygon));
    case "ob":
      return hole.hazards.some(
        (h) => h.type === "out_of_bounds" && hasPolygon(h.polygon),
      );
    case "cart_path":
      return hasPolygon(hole.cartPath ?? null);
    default:
      return false;
  }
}

export function evaluatePremiumLayers(hole: MappedHole | null): PremiumLayerStatus[] {
  if (!hole) {
    return PREMIUM_LAYERS.map((l) => ({
      key: l.key,
      label: l.label,
      drawn: false,
      markedNa: false,
      satisfied: false,
      optional: l.optional,
    }));
  }
  const na = new Set(hole.naLayers ?? []);
  return PREMIUM_LAYERS.map((l) => {
    const drawn = layerDrawn(hole, l.key);
    const markedNa = na.has(l.key);
    return {
      key: l.key,
      label: l.label,
      drawn,
      markedNa,
      satisfied: drawn || markedNa,
      optional: l.optional,
    };
  });
}

/**
 * A hole is Premium Ready only when every required layer is either drawn
 * or explicitly marked Not Applicable. Optional layers are nice-to-have
 * but never block readiness.
 */
export function isPremiumReady(hole: MappedHole | null): boolean {
  if (!hole) return false;
  const statuses = evaluatePremiumLayers(hole);
  return statuses.every((s) => s.optional || s.satisfied);
}

export function missingPremiumLayers(hole: MappedHole | null): PremiumLayerStatus[] {
  return evaluatePremiumLayers(hole).filter((s) => !s.optional && !s.satisfied);
}

export function premiumProgress(hole: MappedHole | null): { done: number; total: number } {
  const statuses = evaluatePremiumLayers(hole);
  const required = statuses.filter((s) => !s.optional);
  return {
    done: required.filter((s) => s.satisfied).length,
    total: required.length,
  };
}