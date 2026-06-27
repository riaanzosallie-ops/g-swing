// G Swing — Mapbox course-layer engine.
// Owns every Mapbox GeoJSON source + layer that visualises a hole's
// PostGIS geometry (fairway, green, hazards, tees, pin, layup, dogleg,
// yardage labels). Idempotent: layers are created once via
// ensureCourseLayers, then data is swapped in/out via setData.
//
// Pure: no React, no DOM outside the Mapbox map handle.

import mapboxgl from "mapbox-gl";
import type { HoleGeometryPayload } from "@/lib/course-geometry";
import { bearingDeg, haversineYards, toDisplayUnit, type LatLng } from "@/lib/gps-utils";

const SRC = {
  fairway: "gs-fairway",
  green: "gs-green",
  hazards: "gs-hazards",
  points: "gs-points",
  pin: "gs-pin",
  yardage: "gs-yardage",
  playerTrail: "gs-player-trail",
} as const;

const LAYERS = {
  fairwayFill: "gs-fairway-fill",
  fairwayLine: "gs-fairway-line",
  greenFill: "gs-green-fill",
  greenLine: "gs-green-line",
  waterFill: "gs-hazard-water-fill",
  waterLine: "gs-hazard-water-line",
  bunkerFill: "gs-hazard-bunker-fill",
  bunkerLine: "gs-hazard-bunker-line",
  obFill: "gs-hazard-ob-fill",
  obLine: "gs-hazard-ob-line",
  otherFill: "gs-hazard-other-fill",
  otherLine: "gs-hazard-other-line",
  cartLine: "gs-hazard-cart-line",
  hazardPoints: "gs-hazard-points",
  teeCircles: "gs-tee-circles",
  teeLabels: "gs-tee-labels",
  greenPtCircles: "gs-green-pts",
  greenPtLabels: "gs-green-pts-labels",
  layupCircles: "gs-layup-circles",
  layupLabels: "gs-layup-labels",
  pinOuter: "gs-pin-outer",
  pinInner: "gs-pin-inner",
  yardage: "gs-yardage-labels",
  playerTrail: "gs-player-trail-line",
} as const;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

type HazardCategory = "water" | "bunker" | "ob" | "cartpath" | "other";

function hazardCategory(type: string): HazardCategory {
  if (type === "water" || type === "creek") return "water";
  if (type === "bunker") return "bunker";
  if (type === "ob") return "ob";
  if (type === "cart_path") return "cartpath";
  return "other";
}

function pointFeature(
  lng: number,
  lat: number,
  properties: Record<string, unknown>,
): GeoJSON.Feature<GeoJSON.Point> {
  return { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties };
}

function setSourceData(map: mapboxgl.Map, id: string, data: GeoJSON.FeatureCollection) {
  const src = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
  if (src) src.setData(data);
}

/** Resolve today's pin: prefer daily_pin label → matching pin_position row → first pin → green centre. */
export function resolvePin(payload: HoleGeometryPayload): LatLng | null {
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

/**
 * Create every G Swing source + layer if they don't yet exist. Safe to call
 * multiple times; later calls are no-ops. Must be called after style.load.
 */
export function ensureCourseLayers(map: mapboxgl.Map): void {
  if (map.getSource(SRC.fairway)) return;

  for (const id of Object.values(SRC)) {
    if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY_FC });
  }

  // Fairway — dark emerald translucent + subtle gold outline.
  map.addLayer({
    id: LAYERS.fairwayFill,
    type: "fill",
    source: SRC.fairway,
    paint: { "fill-color": "#0e3a25", "fill-opacity": 0.42 },
  });
  map.addLayer({
    id: LAYERS.fairwayLine,
    type: "line",
    source: SRC.fairway,
    paint: { "line-color": "#F5C84B", "line-width": 1.2, "line-opacity": 0.55 },
  });

  // Green — brighter translucent emerald with soft halo outline.
  map.addLayer({
    id: LAYERS.greenFill,
    type: "fill",
    source: SRC.green,
    paint: { "fill-color": "#3ade8b", "fill-opacity": 0.5 },
  });
  map.addLayer({
    id: LAYERS.greenLine,
    type: "line",
    source: SRC.green,
    paint: { "line-color": "#aef3c8", "line-width": 1.8, "line-opacity": 0.9, "line-blur": 0.5 },
  });

  // Hazards (polygons, filtered by category).
  const hazardFill = (id: string, cat: HazardCategory, color: string, opacity: number) =>
    map.addLayer({
      id,
      type: "fill",
      source: SRC.hazards,
      filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "category"], cat]],
      paint: { "fill-color": color, "fill-opacity": opacity },
    });
  const hazardLine = (id: string, cat: HazardCategory, color: string, opacity: number, width = 1) =>
    map.addLayer({
      id,
      type: "line",
      source: SRC.hazards,
      filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "category"], cat]],
      paint: { "line-color": color, "line-width": width, "line-opacity": opacity },
    });

  hazardFill(LAYERS.waterFill, "water", "#3aa9ff", 0.5);
  hazardLine(LAYERS.waterLine, "water", "#bee8ff", 0.75);
  hazardFill(LAYERS.bunkerFill, "bunker", "#e8cf8f", 0.7);
  hazardLine(LAYERS.bunkerLine, "bunker", "#f7e5a7", 0.85);
  hazardFill(LAYERS.obFill, "ob", "#ef4444", 0.22);
  hazardLine(LAYERS.obLine, "ob", "#ef4444", 0.85, 1.4);
  hazardFill(LAYERS.otherFill, "other", "#7c5cff", 0.28);
  hazardLine(LAYERS.otherLine, "other", "#a48bff", 0.6);

  // Cart path — LineString hazards rendered as silver line.
  map.addLayer({
    id: LAYERS.cartLine,
    type: "line",
    source: SRC.hazards,
    filter: ["all", ["==", ["geometry-type"], "LineString"], ["==", ["get", "category"], "cartpath"]],
    paint: { "line-color": "#cbd5e1", "line-width": 1.4, "line-opacity": 0.8 },
  });

  // Point hazards (when the DB stores a single coordinate, not a polygon).
  map.addLayer({
    id: LAYERS.hazardPoints,
    type: "circle",
    source: SRC.hazards,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 5,
      "circle-color": [
        "match",
        ["get", "category"],
        "water", "#3aa9ff",
        "bunker", "#e8cf8f",
        "ob", "#ef4444",
        "#7c5cff",
      ],
      "circle-stroke-color": "#0a0a0a",
      "circle-stroke-width": 1.2,
    },
  });

  // Tees — gold circles with label below.
  map.addLayer({
    id: LAYERS.teeCircles,
    type: "circle",
    source: SRC.points,
    filter: ["==", ["get", "kind"], "tee"],
    paint: {
      "circle-radius": 5,
      "circle-color": "#F5C84B",
      "circle-stroke-color": "#1a1300",
      "circle-stroke-width": 1.5,
    },
  });
  map.addLayer({
    id: LAYERS.teeLabels,
    type: "symbol",
    source: SRC.points,
    filter: ["==", ["get", "kind"], "tee"],
    layout: {
      "text-field": ["get", "label"],
      "text-size": 10,
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
    },
    paint: { "text-color": "#F5C84B", "text-halo-color": "#000", "text-halo-width": 1.2 },
  });

  // Green Front / Center / Back markers.
  map.addLayer({
    id: LAYERS.greenPtCircles,
    type: "circle",
    source: SRC.points,
    filter: ["==", ["get", "kind"], "green"],
    paint: {
      "circle-radius": 4,
      "circle-color": "#aef3c8",
      "circle-stroke-color": "#0a3a22",
      "circle-stroke-width": 1.2,
    },
  });
  map.addLayer({
    id: LAYERS.greenPtLabels,
    type: "symbol",
    source: SRC.points,
    filter: ["==", ["get", "kind"], "green"],
    layout: {
      "text-field": ["get", "label"],
      "text-size": 9.5,
      "text-offset": [0, -1.2],
      "text-anchor": "bottom",
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
    },
    paint: { "text-color": "#aef3c8", "text-halo-color": "#000", "text-halo-width": 1 },
  });

  // Layup / dogleg targets.
  map.addLayer({
    id: LAYERS.layupCircles,
    type: "circle",
    source: SRC.points,
    filter: ["in", ["get", "kind"], ["literal", ["layup", "dogleg"]]],
    paint: {
      "circle-radius": 5,
      "circle-color": "#ffffff",
      "circle-stroke-color": "#F5C84B",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: LAYERS.layupLabels,
    type: "symbol",
    source: SRC.points,
    filter: ["in", ["get", "kind"], ["literal", ["layup", "dogleg"]]],
    layout: {
      "text-field": ["get", "label"],
      "text-size": 10,
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
    },
    paint: { "text-color": "#F5C84B", "text-halo-color": "#000", "text-halo-width": 1.2 },
  });

  // Pin — premium gold marker with dark centre dot.
  map.addLayer({
    id: LAYERS.pinOuter,
    type: "circle",
    source: SRC.pin,
    paint: {
      "circle-radius": 9,
      "circle-color": "#F5C84B",
      "circle-opacity": 0.95,
      "circle-stroke-color": "#1a1300",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: LAYERS.pinInner,
    type: "circle",
    source: SRC.pin,
    paint: { "circle-radius": 3, "circle-color": "#1a1300" },
  });

  // Yardage labels — compact glass-style text.
  map.addLayer({
    id: LAYERS.yardage,
    type: "symbol",
    source: SRC.yardage,
    layout: {
      "text-field": ["get", "label"],
      "text-size": 11,
      "text-anchor": "left",
      "text-offset": [0.85, 0],
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": "#fff7d0",
      "text-halo-color": "#000",
      "text-halo-width": 1.4,
    },
  });

  // Player trail — soft emerald breadcrumb of recent GPS positions.
  map.addLayer({
    id: LAYERS.playerTrail,
    type: "line",
    source: SRC.playerTrail,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#34d399",
      "line-width": 3,
      "line-opacity": 0.7,
      "line-blur": 0.4,
    },
  });
}

/** Push the latest player breadcrumb trail into the trail source. */
export function updatePlayerTrail(map: mapboxgl.Map, trail: LatLng[]): void {
  if (!map.getSource(SRC.playerTrail)) return;
  const fc: GeoJSON.FeatureCollection = trail.length >= 2
    ? {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: trail.map((p) => [p.lng, p.lat] as [number, number]),
            },
            properties: {},
          },
        ],
      }
    : EMPTY_FC;
  setSourceData(map, SRC.playerTrail, fc);
}

/** Reset every G Swing source to an empty feature collection. */
export function clearCourseGeometry(map: mapboxgl.Map): void {
  if (!map.getSource(SRC.fairway)) return;
  for (const id of Object.values(SRC)) setSourceData(map, id, EMPTY_FC);
}

/** Push the hole's PostGIS geometry into the existing Mapbox sources. */
export function applyCourseGeometry(map: mapboxgl.Map, payload: HoleGeometryPayload): void {
  ensureCourseLayers(map);

  setSourceData(map, SRC.fairway, {
    type: "FeatureCollection",
    features: payload.fairway
      ? [{ type: "Feature", geometry: payload.fairway.polygon, properties: {} }]
      : [],
  });

  setSourceData(map, SRC.green, {
    type: "FeatureCollection",
    features: payload.green
      ? [{ type: "Feature", geometry: payload.green.polygon, properties: {} }]
      : [],
  });

  setSourceData(map, SRC.hazards, {
    type: "FeatureCollection",
    features: payload.hazards.map((h) => ({
      type: "Feature",
      geometry: h.geom,
      properties: {
        category: hazardCategory(h.hazard_type),
        hazard_type: h.hazard_type,
        label: h.label,
      },
    })),
  });

  const pointFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const p of payload.points) {
    if (p.point_type === "pin_position") continue;
    let kind: string | null = null;
    let label = p.label ?? "";
    if (p.point_type.startsWith("tee_")) {
      kind = "tee";
      if (!label) {
        const tag = p.point_type.replace("tee_", "");
        label = `${tag.charAt(0).toUpperCase()}${tag.slice(1)} tee`;
      }
    } else if (p.point_type === "green_front") {
      kind = "green";
      label = label || "Front";
    } else if (p.point_type === "green_center") {
      kind = "green";
      label = label || "Center";
    } else if (p.point_type === "green_back") {
      kind = "green";
      label = label || "Back";
    } else if (p.point_type === "layup") {
      kind = "layup";
      label = label || "Layup";
    } else if (p.point_type === "dogleg") {
      kind = "dogleg";
      label = label || "Dogleg";
    }
    if (!kind) continue;
    pointFeatures.push(pointFeature(p.lng, p.lat, { kind, label, point_type: p.point_type }));
  }
  setSourceData(map, SRC.points, { type: "FeatureCollection", features: pointFeatures });

  const pin = resolvePin(payload);
  setSourceData(map, SRC.pin, {
    type: "FeatureCollection",
    features: pin ? [pointFeature(pin.lng, pin.lat, { label: "Pin" })] : [],
  });
}

/**
 * Recompute live yardage labels for every point of interest, anchored at the
 * target (not at the player). Updates the dedicated yardage source only.
 */
export function updateYardageLabels(
  map: mapboxgl.Map,
  playerPos: LatLng | null,
  payload: HoleGeometryPayload | null,
  unit: "yards" | "meters",
): void {
  if (!map.getSource(SRC.yardage)) return;

  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  if (playerPos && payload) {
    const suffix = unit === "meters" ? "m" : "y";
    const dist = (target: LatLng) => toDisplayUnit(haversineYards(playerPos, target), unit);
    const push = (target: LatLng, prefix: string) =>
      features.push(pointFeature(target.lng, target.lat, { label: `${prefix} ${dist(target)}${suffix}` }));

    const pin = resolvePin(payload);
    if (pin) push(pin, "PIN");
    if (payload.green) {
      push({ lat: payload.green.center_lat, lng: payload.green.center_lng }, "CENTER");
    }
    for (const p of payload.points) {
      const ll = { lat: p.lat, lng: p.lng };
      if (p.point_type === "green_front") push(ll, "FRONT");
      else if (p.point_type === "green_back") push(ll, "BACK");
      else if (p.point_type === "layup") push(ll, "LAYUP");
      else if (p.point_type === "dogleg") push(ll, "DOGLEG");
    }
    for (const h of payload.hazards) {
      if (h.center_lat == null || h.center_lng == null) continue;
      const cat = hazardCategory(h.hazard_type);
      const tag =
        cat === "water" ? "WATER" :
        cat === "bunker" ? "BUNKER" :
        cat === "ob" ? "OB" :
        cat === "cartpath" ? "PATH" :
        "HAZARD";
      push({ lat: h.center_lat, lng: h.center_lng }, tag);
    }
  }

  setSourceData(map, SRC.yardage, { type: "FeatureCollection", features });
}

export type LayerGroup = "overlays" | "hazards" | "labels" | "markers";

const GROUP_LAYERS: Record<LayerGroup, string[]> = {
  overlays: [LAYERS.fairwayFill, LAYERS.fairwayLine, LAYERS.greenFill, LAYERS.greenLine],
  hazards: [
    LAYERS.waterFill, LAYERS.waterLine, LAYERS.bunkerFill, LAYERS.bunkerLine,
    LAYERS.obFill, LAYERS.obLine, LAYERS.otherFill, LAYERS.otherLine,
    LAYERS.cartLine, LAYERS.hazardPoints,
  ],
  labels: [LAYERS.teeLabels, LAYERS.greenPtLabels, LAYERS.layupLabels, LAYERS.yardage],
  markers: [
    LAYERS.teeCircles, LAYERS.greenPtCircles, LAYERS.layupCircles,
    LAYERS.pinOuter, LAYERS.pinInner,
  ],
};

export function setLayerGroupVisibility(map: mapboxgl.Map, group: LayerGroup, visible: boolean): void {
  for (const id of GROUP_LAYERS[group]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }
}

function collectCoords(geom: GeoJSON.Geometry, push: (lng: number, lat: number) => void): void {
  switch (geom.type) {
    case "Point":
      push(geom.coordinates[0], geom.coordinates[1]);
      break;
    case "MultiPoint":
    case "LineString":
      for (const c of geom.coordinates) push(c[0], c[1]);
      break;
    case "MultiLineString":
    case "Polygon":
      for (const ring of geom.coordinates) for (const c of ring) push(c[0], c[1]);
      break;
    case "MultiPolygon":
      for (const poly of geom.coordinates) for (const ring of poly) for (const c of ring) push(c[0], c[1]);
      break;
    case "GeometryCollection":
      for (const g of geom.geometries) collectCoords(g, push);
      break;
  }
}

/** Fit the map viewport around all geometry for the current hole. */
export function fitHole(map: mapboxgl.Map, payload: HoleGeometryPayload | null): boolean {
  if (!payload) return false;
  const coords: [number, number][] = [];
  const push = (lng: number, lat: number) => coords.push([lng, lat]);
  if (payload.fairway) collectCoords(payload.fairway.polygon, push);
  if (payload.green) collectCoords(payload.green.polygon, push);
  for (const p of payload.points) push(p.lng, p.lat);
  for (const h of payload.hazards) collectCoords(h.geom, push);
  if (!coords.length) return false;

  const bounds = new mapboxgl.LngLatBounds(coords[0], coords[0]);
  for (const c of coords) bounds.extend(c);
  map.fitBounds(bounds, { padding: 60, duration: 900, maxZoom: 19, pitch: 55 });
  return true;
}

/**
 * Cinematic hole flyover: tee → (dogleg/layup) → green. Resolves to false when
 * the geometry is too incomplete to animate meaningfully.
 */
export async function runFlyover(
  map: mapboxgl.Map,
  payload: HoleGeometryPayload | null,
): Promise<boolean> {
  if (!payload || !payload.green) return false;
  const tee =
    payload.points.find((p) => p.point_type === "tee_back") ??
    payload.points.find((p) => p.point_type === "tee_middle") ??
    payload.points.find((p) => p.point_type === "tee_front");
  if (!tee) return false;

  const greenCenter: LatLng = { lat: payload.green.center_lat, lng: payload.green.center_lng };
  const bearing = bearingDeg({ lat: tee.lat, lng: tee.lng }, greenCenter);

  const stops: Array<{ lng: number; lat: number; zoom: number; pitch: number; duration: number }> = [
    { lng: tee.lng, lat: tee.lat, zoom: 18, pitch: 72, duration: 1400 },
  ];
  const turn =
    payload.points.find((p) => p.point_type === "dogleg") ??
    payload.points.find((p) => p.point_type === "layup");
  if (turn) stops.push({ lng: turn.lng, lat: turn.lat, zoom: 17.6, pitch: 68, duration: 1600 });
  stops.push({ lng: greenCenter.lng, lat: greenCenter.lat, zoom: 18.6, pitch: 62, duration: 1800 });

  for (const s of stops) {
    await new Promise<void>((resolve) => {
      map.easeTo({
        center: [s.lng, s.lat],
        zoom: s.zoom,
        pitch: s.pitch,
        bearing,
        duration: s.duration,
      });
      window.setTimeout(resolve, s.duration + 60);
    });
  }
  return true;
}