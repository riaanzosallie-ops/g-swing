// G Swing — Mapbox camera engine.
// Pure camera-mode controller. Holds no state: each call applies an
// `easeTo` to the provided map. Smoothing is done by Mapbox's internal
// animation; we just feed coherent targets. No layers, no markers.

import mapboxgl from "mapbox-gl";
import type { HoleGeometryPayload } from "@/lib/course-geometry";
import { bearingDeg, type LatLng } from "@/lib/gps-utils";
import { fitHole } from "@/lib/mapbox-course-layers";

export type CameraMode =
  | "broadcast"
  | "playing"
  | "planning"
  | "green"
  | "full"
  | "overview";

export interface CameraContext {
  playerPos: LatLng | null;
  tee: LatLng | null;
  pin: LatLng | null;
  /** Optional course centre (used for overview fallback). */
  courseCenter?: LatLng | null;
  /** Compass bearing the golfer is moving toward, 0-360. May be null. */
  heading?: number | null;
  geometry?: HoleGeometryPayload | null;
}

const EASE_MS = 850;

function targetForFollow(ctx: CameraContext): LatLng | null {
  return ctx.playerPos ?? ctx.tee ?? ctx.pin ?? ctx.courseCenter ?? null;
}

/** Resolve a sensible camera bearing for "over the shoulder" framing. */
function resolveBearing(ctx: CameraContext, fallback: number): number {
  if (ctx.playerPos && ctx.pin) return bearingDeg(ctx.playerPos, ctx.pin);
  if (typeof ctx.heading === "number" && Number.isFinite(ctx.heading)) return ctx.heading;
  if (ctx.tee && ctx.pin) return bearingDeg(ctx.tee, ctx.pin);
  return fallback;
}

/**
 * Apply a camera mode to the map. Returns true when a camera move was
 * issued, false when there isn't enough geometry for that mode.
 */
export function applyMode(
  map: mapboxgl.Map,
  mode: CameraMode,
  ctx: CameraContext,
): boolean {
  switch (mode) {
    case "playing": {
      const target = targetForFollow(ctx);
      if (!target) return false;
      map.easeTo({
        center: [target.lng, target.lat],
        zoom: 18.6,
        pitch: 68,
        bearing: resolveBearing(ctx, map.getBearing()),
        duration: EASE_MS,
      });
      return true;
    }
    case "broadcast": {
      const target = targetForFollow(ctx);
      if (!target) return false;
      map.easeTo({
        center: [target.lng, target.lat],
        zoom: 17.4,
        pitch: 58,
        bearing: resolveBearing(ctx, map.getBearing()),
        duration: EASE_MS,
      });
      return true;
    }
    case "planning": {
      if (ctx.playerPos && ctx.pin) {
        const bounds = new mapboxgl.LngLatBounds(
          [ctx.playerPos.lng, ctx.playerPos.lat],
          [ctx.playerPos.lng, ctx.playerPos.lat],
        );
        bounds.extend([ctx.pin.lng, ctx.pin.lat]);
        map.fitBounds(bounds, {
          padding: { top: 120, right: 80, bottom: 200, left: 80 },
          pitch: 50,
          bearing: resolveBearing(ctx, map.getBearing()),
          duration: EASE_MS,
          maxZoom: 18.5,
        });
        return true;
      }
      return applyMode(map, "playing", ctx);
    }
    case "green": {
      const target = ctx.pin ?? ctx.playerPos;
      if (!target) return false;
      map.easeTo({
        center: [target.lng, target.lat],
        zoom: 19.3,
        pitch: 30,
        bearing: resolveBearing(ctx, 0),
        duration: EASE_MS,
      });
      return true;
    }
    case "full": {
      if (ctx.geometry && fitHole(map, ctx.geometry)) return true;
      if (ctx.tee && ctx.pin) {
        const bounds = new mapboxgl.LngLatBounds(
          [ctx.tee.lng, ctx.tee.lat],
          [ctx.tee.lng, ctx.tee.lat],
        );
        bounds.extend([ctx.pin.lng, ctx.pin.lat]);
        if (ctx.playerPos) bounds.extend([ctx.playerPos.lng, ctx.playerPos.lat]);
        map.fitBounds(bounds, { padding: 80, pitch: 45, duration: EASE_MS, maxZoom: 18.5 });
        return true;
      }
      return false;
    }
    case "overview": {
      const target = ctx.courseCenter ?? targetForFollow(ctx);
      if (!target) return false;
      map.easeTo({
        center: [target.lng, target.lat],
        zoom: 15,
        pitch: 0,
        bearing: 0,
        duration: EASE_MS,
      });
      return true;
    }
  }
}

/**
 * Continuous follow during live GPS — lighter than `applyMode`, intended
 * to be called every time the player position changes. Uses a short
 * ease so successive calls interpolate smoothly.
 */
export function followPlayer(
  map: mapboxgl.Map,
  mode: CameraMode,
  ctx: CameraContext,
): void {
  if (mode !== "playing" && mode !== "broadcast") return;
  if (!ctx.playerPos) return;
  const bearing = resolveBearing(ctx, map.getBearing());
  map.easeTo({
    center: [ctx.playerPos.lng, ctx.playerPos.lat],
    bearing,
    duration: 420,
    easing: (t) => t,
  });
}

/** All selectable modes in the UI, ordered. */
export const CAMERA_MODES: { id: CameraMode; label: string }[] = [
  { id: "playing", label: "Playing" },
  { id: "broadcast", label: "Broadcast" },
  { id: "planning", label: "Planning" },
  { id: "green", label: "Green" },
  { id: "full", label: "Full" },
  { id: "overview", label: "Overview" },
];