// G Swing — pure yardage + green-intelligence engine.
// Computes Front / Center / Back / Pin yardages, hazard carry distances,
// layup / dogleg targets, distance-from-last-shot, green-mode flag, and a
// suggested-miss-area hint when the supporting geometry is available.
//
// Pure: no React, no Mapbox, no Supabase. Safe to unit-test.

import type { HoleGeometryPayload } from "@/lib/course-geometry";
import {
  bearingDeg,
  haversineYards,
  toDisplayUnit,
  type LatLng,
} from "@/lib/gps-utils";

export type Unit = "yards" | "meters";

export interface CarryTarget {
  id: string;
  kind: "water" | "bunker" | "trees" | "waste" | "ob" | "other";
  label: string;
  /** Yards from player to the *far* edge of the hazard along player→pin. */
  carry: number;
  /** Yards from player to the *near* edge of the hazard. */
  near: number;
}

export interface PointTarget {
  label: string;
  yards: number;
}

export type MissSide = "left" | "right" | "long" | "short" | null;

export interface YardageReadout {
  /** Geometry-derived distances, only present when the row exists. */
  pin: number | null;
  front: number | null;
  center: number | null;
  back: number | null;
  /** Carry distances for hazards roughly between the player and the pin. */
  carries: CarryTarget[];
  /** Named layup targets, if any. */
  layups: PointTarget[];
  /** Dogleg corner targets, if any. */
  doglegs: PointTarget[];
  /** Distance from the last recorded shot's end position to the player. */
  fromLastShot: number | null;
  /** True when the player sits inside the "green intelligence" radius. */
  inGreenMode: boolean;
  /** Daily pin descriptor (label + colour) when the DB has set one. */
  dailyPin: { label: string; color: string } | null;
  /** Recommended miss side, only when geometry actually supports the call. */
  missSide: MissSide;
  /** Free-text reasoning for the miss-side hint. */
  missReason: string | null;
}

/** Player is considered "on/near the green" within this distance to pin. */
export const GREEN_MODE_YARDS = 60;

/** Convert raw yards into the unit the caller wants to display. */
export function asUnit(value: number | null, unit: Unit): number | null {
  if (value == null) return null;
  return toDisplayUnit(value, unit);
}

function angleDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function polygonVertices(geom: GeoJSON.Geometry): LatLng[] {
  const out: LatLng[] = [];
  const pushRing = (ring: number[][]) => {
    for (const c of ring) out.push({ lng: c[0], lat: c[1] });
  };
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) pushRing(ring);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) for (const ring of poly) pushRing(ring);
  }
  return out;
}

function hazardKind(type: string): CarryTarget["kind"] {
  if (type === "water" || type === "creek") return "water";
  if (type === "bunker") return "bunker";
  if (type === "trees" || type === "tree" || type === "woods") return "trees";
  if (type === "waste" || type === "waste_area" || type === "sand_waste") return "waste";
  if (type === "ob") return "ob";
  return "other";
}

function resolvePin(payload: HoleGeometryPayload): LatLng | null {
  const dailyLabel = payload.daily_pin?.pin_label ?? null;
  if (dailyLabel) {
    const labelled = payload.points.find(
      (p) => p.point_type === "pin_position" && p.label === dailyLabel,
    );
    if (labelled) return { lat: labelled.lat, lng: labelled.lng };
  }
  const anyPin = payload.points.find((p) => p.point_type === "pin_position");
  if (anyPin) return { lat: anyPin.lat, lng: anyPin.lng };
  if (payload.green) return { lat: payload.green.center_lat, lng: payload.green.center_lng };
  return null;
}

const PIN_COLORS: Record<string, string> = {
  front: "#34d399",
  middle: "#F5C84B",
  center: "#F5C84B",
  back: "#ef4444",
  "front-left": "#34d399",
  "front-right": "#34d399",
  "back-left": "#ef4444",
  "back-right": "#ef4444",
};

function dailyPinDescriptor(payload: HoleGeometryPayload): YardageReadout["dailyPin"] {
  const label = payload.daily_pin?.pin_label ?? null;
  if (!label) return null;
  const key = label.toLowerCase();
  const color = PIN_COLORS[key] ?? "#F5C84B";
  return { label, color };
}

/**
 * Compute everything the yardage panel needs in one pass. All values are in
 * yards; callers convert with `asUnit` for display. Returns conservative
 * `null` values whenever the supporting geometry is missing — no fabrication.
 */
export function computeYardages(
  player: LatLng | null,
  payload: HoleGeometryPayload | null,
  lastShotEnd: LatLng | null,
): YardageReadout {
  const empty: YardageReadout = {
    pin: null, front: null, center: null, back: null,
    carries: [], layups: [], doglegs: [],
    fromLastShot: null,
    inGreenMode: false,
    dailyPin: null,
    missSide: null,
    missReason: null,
  };
  if (!player || !payload) return empty;

  const pin = resolvePin(payload);
  const greenCenter: LatLng | null = payload.green
    ? { lat: payload.green.center_lat, lng: payload.green.center_lng }
    : null;
  const greenFront = payload.points.find((p) => p.point_type === "green_front");
  const greenBack = payload.points.find((p) => p.point_type === "green_back");

  const pinYards = pin ? haversineYards(player, pin) : null;
  const centerYards = greenCenter ? haversineYards(player, greenCenter) : null;
  const frontYards = greenFront
    ? haversineYards(player, { lat: greenFront.lat, lng: greenFront.lng })
    : centerYards;
  const backYards = greenBack
    ? haversineYards(player, { lat: greenBack.lat, lng: greenBack.lng })
    : centerYards;

  // Carry / hazard intelligence — only for hazards that sit roughly between
  // the player and the pin (≤45° from the player→pin bearing).
  const carries: CarryTarget[] = [];
  if (pin) {
    const pinBearing = bearingDeg(player, pin);
    for (const h of payload.hazards) {
      const kind = hazardKind(h.hazard_type);
      if (kind === "other") continue;
      const verts = polygonVertices(h.geom);
      if (!verts.length) continue;
      // Centre direction filter — skip hazards not between player and pin.
      if (h.center_lat != null && h.center_lng != null) {
        const cBearing = bearingDeg(player, { lat: h.center_lat, lng: h.center_lng });
        if (angleDelta(pinBearing, cBearing) > 55) continue;
        const cDist = haversineYards(player, { lat: h.center_lat, lng: h.center_lng });
        const pDist = haversineYards(player, pin);
        if (cDist > pDist + 25) continue; // hazard is behind the pin
      }
      let near = Infinity;
      let far = 0;
      for (const v of verts) {
        const d = haversineYards(player, v);
        if (d < near) near = d;
        if (d > far) far = d;
      }
      if (!Number.isFinite(near)) continue;
      carries.push({
        id: h.id,
        kind,
        label: h.label ?? kind.charAt(0).toUpperCase() + kind.slice(1),
        carry: far,
        near,
      });
    }
    // Most relevant first: nearest to clear.
    carries.sort((a, b) => a.carry - b.carry);
  }

  const layups: PointTarget[] = [];
  const doglegs: PointTarget[] = [];
  for (const p of payload.points) {
    if (p.point_type === "layup") {
      layups.push({
        label: p.label ?? "Layup",
        yards: haversineYards(player, { lat: p.lat, lng: p.lng }),
      });
    } else if (p.point_type === "dogleg") {
      doglegs.push({
        label: p.label ?? "Dogleg",
        yards: haversineYards(player, { lat: p.lat, lng: p.lng }),
      });
    }
  }

  const fromLastShot = lastShotEnd ? haversineYards(lastShotEnd, player) : null;

  const inGreenMode = pinYards != null && pinYards <= GREEN_MODE_YARDS;

  // Suggested miss area — only when we actually have hazards near the green
  // and a pin. Classify each carry hazard as left/right/long/short relative
  // to the player→pin bearing, then choose the emptiest quadrant.
  let missSide: MissSide = null;
  let missReason: string | null = null;
  if (pin && carries.length) {
    const baseBearing = bearingDeg(player, pin);
    const buckets: Record<"left" | "right" | "long" | "short", number> = {
      left: 0, right: 0, long: 0, short: 0,
    };
    for (const c of carries) {
      const hz = payload.hazards.find((h) => h.id === c.id);
      if (!hz || hz.center_lat == null || hz.center_lng == null) continue;
      const b = bearingDeg(player, { lat: hz.center_lat, lng: hz.center_lng });
      const rel = ((b - baseBearing + 540) % 360) - 180; // -180..180
      if (c.carry > (pinYards ?? 0) + 8) buckets.long += 1;
      else if (c.near < (pinYards ?? 0) - 8) buckets.short += 1;
      else if (rel < -8) buckets.left += 1;
      else if (rel > 8) buckets.right += 1;
    }
    const opposite: Record<keyof typeof buckets, keyof typeof buckets> = {
      left: "right", right: "left", long: "short", short: "long",
    };
    // Find the busiest side, suggest its opposite as the miss side.
    let worst: keyof typeof buckets | null = null;
    let worstCount = 0;
    for (const k of Object.keys(buckets) as Array<keyof typeof buckets>) {
      if (buckets[k] > worstCount) {
        worstCount = buckets[k];
        worst = k;
      }
    }
    if (worst && worstCount > 0) {
      missSide = opposite[worst];
      missReason = `Avoid ${worst} — bail ${opposite[worst]}.`;
    }
  }

  return {
    pin: pinYards,
    front: frontYards,
    center: centerYards,
    back: backYards,
    carries,
    layups,
    doglegs,
    fromLastShot,
    inGreenMode,
    dailyPin: dailyPinDescriptor(payload),
    missSide,
    missReason,
  };
}