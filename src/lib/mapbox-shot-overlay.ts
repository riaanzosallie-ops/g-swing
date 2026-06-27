// G Swing — Slice D additive shot replay overlay.
// Owns ONLY the per-hole shot replay layers. Completely independent
// of Slice A camera/marker, Slice B course layers, and Slice C yardage.
// Idempotent: layers are created once, then data is swapped in/out.

import mapboxgl from "mapbox-gl";
import type { LatLng } from "@/lib/gps-utils";
import type { StoredShot } from "@/lib/shot-tracker";

const SRC = {
  line: "gs-shot-replay-line",
  points: "gs-shot-replay-points",
} as const;

const LAYERS = {
  line: "gs-shot-replay-line-layer",
  pointGlow: "gs-shot-replay-points-glow",
  pointCircle: "gs-shot-replay-points-circle",
  pointLabel: "gs-shot-replay-points-label",
} as const;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function ensureShotOverlayLayers(map: mapboxgl.Map): void {
  if (map.getSource(SRC.line)) return;
  map.addSource(SRC.line, { type: "geojson", data: EMPTY_FC });
  map.addSource(SRC.points, { type: "geojson", data: EMPTY_FC });

  map.addLayer({
    id: LAYERS.line,
    type: "line",
    source: SRC.line,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#fbbf24",
      "line-width": 3,
      "line-opacity": 0.85,
      "line-dasharray": [1.6, 1.2],
    },
  });
  map.addLayer({
    id: LAYERS.pointGlow,
    type: "circle",
    source: SRC.points,
    paint: {
      "circle-radius": 11,
      "circle-color": "#fbbf24",
      "circle-opacity": 0.22,
      "circle-blur": 0.6,
    },
  });
  map.addLayer({
    id: LAYERS.pointCircle,
    type: "circle",
    source: SRC.points,
    paint: {
      "circle-radius": 7,
      "circle-color": "#fbbf24",
      "circle-stroke-color": "#1a1300",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: LAYERS.pointLabel,
    type: "symbol",
    source: SRC.points,
    layout: {
      "text-field": ["to-string", ["get", "n"]],
      "text-size": 11,
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": "#1a1300",
    },
  });
}

export function setShotReplay(map: mapboxgl.Map, shots: StoredShot[]): void {
  if (!map.getSource(SRC.line)) return;
  // Build the polyline through every start→end with a known location.
  const coords: [number, number][] = [];
  const pts: GeoJSON.Feature[] = [];
  const ordered = [...shots].sort((a, b) => (a.shot_number ?? 0) - (b.shot_number ?? 0));
  for (const s of ordered) {
    if (s.start) {
      coords.push([s.start.lng, s.start.lat]);
      pts.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.start.lng, s.start.lat] },
        properties: { n: s.shot_number ?? "", kind: "start" },
      });
    }
    if (s.end) coords.push([s.end.lng, s.end.lat]);
  }
  const lineFc: GeoJSON.FeatureCollection =
    coords.length >= 2
      ? {
          type: "FeatureCollection",
          features: [
            { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} },
          ],
        }
      : EMPTY_FC;
  (map.getSource(SRC.line) as mapboxgl.GeoJSONSource).setData(lineFc);
  (map.getSource(SRC.points) as mapboxgl.GeoJSONSource).setData({
    type: "FeatureCollection",
    features: pts,
  });
}

export function clearShotReplay(map: mapboxgl.Map): void {
  if (!map.getSource(SRC.line)) return;
  (map.getSource(SRC.line) as mapboxgl.GeoJSONSource).setData(EMPTY_FC);
  (map.getSource(SRC.points) as mapboxgl.GeoJSONSource).setData(EMPTY_FC);
}

// Re-export for type cohesion (avoids unused-import lint at callsites).
export type ShotReplayPoint = LatLng;