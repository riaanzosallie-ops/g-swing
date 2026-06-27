// G-Swing Premium — additive Mapbox layers for MappedHole data.
// Pure module: no React, idempotent installation of sources/layers, and
// data swaps via setData. Never renders fabricated geometry — only what
// the MappedHole actually contains.

import mapboxgl from "mapbox-gl";
import type { MappedHole } from "@/types/gswing-course-map";

const SRC = {
  hazardPoly: "gsm-hazard-poly",
  greenPts: "gsm-green-pts",
  pin: "gsm-pin",
  layups: "gsm-layups",
  doglegs: "gsm-doglegs",
  landing: "gsm-landing",
  obLines: "gsm-ob-lines",
} as const;

const LAYER = {
  waterFill: "gsm-water-fill",
  waterLine: "gsm-water-line",
  bunkerFill: "gsm-bunker-fill",
  bunkerLine: "gsm-bunker-line",
  penaltyLine: "gsm-penalty-line",
  penaltyFill: "gsm-penalty-fill",
  obDash: "gsm-ob-dash",
  greenFront: "gsm-green-front",
  greenCenter: "gsm-green-center",
  greenBack: "gsm-green-back",
  greenLabels: "gsm-green-labels",
  pin: "gsm-pin",
  pinFlag: "gsm-pin-flag",
  layupRings: "gsm-layup-rings",
  layupLabels: "gsm-layup-labels",
  doglegPoint: "gsm-dogleg",
  doglegLabels: "gsm-dogleg-labels",
  landingFill: "gsm-landing-fill",
  landingLine: "gsm-landing-line",
} as const;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function ensureSource(map: mapboxgl.Map, id: string) {
  if (!map.getSource(id)) {
    map.addSource(id, { type: "geojson", data: EMPTY });
  }
}

export function ensureMappedLayers(map: mapboxgl.Map) {
  ensureSource(map, SRC.hazardPoly);
  ensureSource(map, SRC.greenPts);
  ensureSource(map, SRC.pin);
  ensureSource(map, SRC.layups);
  ensureSource(map, SRC.doglegs);
  ensureSource(map, SRC.landing);
  ensureSource(map, SRC.obLines);

  // Water polygons — deep blue
  if (!map.getLayer(LAYER.waterFill)) {
    map.addLayer({
      id: LAYER.waterFill,
      type: "fill",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "water"],
      paint: { "fill-color": "#1e6fbb", "fill-opacity": 0.55 },
    });
  }
  if (!map.getLayer(LAYER.waterLine)) {
    map.addLayer({
      id: LAYER.waterLine,
      type: "line",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "water"],
      paint: { "line-color": "#bcd8ff", "line-width": 1.2, "line-opacity": 0.8 },
    });
  }

  // Bunkers — muted sand/gold
  if (!map.getLayer(LAYER.bunkerFill)) {
    map.addLayer({
      id: LAYER.bunkerFill,
      type: "fill",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "bunker"],
      paint: { "fill-color": "#dac487", "fill-opacity": 0.7 },
    });
  }
  if (!map.getLayer(LAYER.bunkerLine)) {
    map.addLayer({
      id: LAYER.bunkerLine,
      type: "line",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "bunker"],
      paint: { "line-color": "#8a7332", "line-width": 1, "line-opacity": 0.85 },
    });
  }

  // Penalty — amber/red outline
  if (!map.getLayer(LAYER.penaltyFill)) {
    map.addLayer({
      id: LAYER.penaltyFill,
      type: "fill",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "penalty_area"],
      paint: { "fill-color": "#c0392b", "fill-opacity": 0.22 },
    });
  }
  if (!map.getLayer(LAYER.penaltyLine)) {
    map.addLayer({
      id: LAYER.penaltyLine,
      type: "line",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "penalty_area"],
      paint: { "line-color": "#f5b942", "line-width": 1.5, "line-opacity": 0.95 },
    });
  }

  // OB — red dashed line
  if (!map.getLayer(LAYER.obDash)) {
    map.addLayer({
      id: LAYER.obDash,
      type: "line",
      source: SRC.obLines,
      paint: {
        "line-color": "#ef4444",
        "line-width": 2,
        "line-dasharray": [2, 1.5],
        "line-opacity": 0.95,
      },
    });
  }

  // Green markers — front (emerald), center (gold), back (emerald-dark)
  if (!map.getLayer(LAYER.greenFront)) {
    map.addLayer({
      id: LAYER.greenFront,
      type: "circle",
      source: SRC.greenPts,
      filter: ["==", ["get", "kind"], "front"],
      paint: {
        "circle-radius": 5,
        "circle-color": "#34d399",
        "circle-stroke-color": "#0a0a0a",
        "circle-stroke-width": 1.5,
      },
    });
  }
  if (!map.getLayer(LAYER.greenCenter)) {
    map.addLayer({
      id: LAYER.greenCenter,
      type: "circle",
      source: SRC.greenPts,
      filter: ["==", ["get", "kind"], "center"],
      paint: {
        "circle-radius": 6,
        "circle-color": "#F5C84B",
        "circle-stroke-color": "#1a1300",
        "circle-stroke-width": 1.5,
      },
    });
  }
  if (!map.getLayer(LAYER.greenBack)) {
    map.addLayer({
      id: LAYER.greenBack,
      type: "circle",
      source: SRC.greenPts,
      filter: ["==", ["get", "kind"], "back"],
      paint: {
        "circle-radius": 5,
        "circle-color": "#10b981",
        "circle-stroke-color": "#0a0a0a",
        "circle-stroke-width": 1.5,
      },
    });
  }
  if (!map.getLayer(LAYER.greenLabels)) {
    map.addLayer({
      id: LAYER.greenLabels,
      type: "symbol",
      source: SRC.greenPts,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 10,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#F5C84B",
        "text-halo-color": "#000000",
        "text-halo-width": 1.3,
      },
    });
  }

  // Pin — gold flag (circle stand-in)
  if (!map.getLayer(LAYER.pinFlag)) {
    map.addLayer({
      id: LAYER.pinFlag,
      type: "circle",
      source: SRC.pin,
      paint: {
        "circle-radius": 7,
        "circle-color": "#F5C84B",
        "circle-stroke-color": "#000000",
        "circle-stroke-width": 2,
      },
    });
  }

  // Layups — gold target rings
  if (!map.getLayer(LAYER.layupRings)) {
    map.addLayer({
      id: LAYER.layupRings,
      type: "circle",
      source: SRC.layups,
      paint: {
        "circle-radius": 9,
        "circle-color": "rgba(245,200,75,0.15)",
        "circle-stroke-color": "#F5C84B",
        "circle-stroke-width": 2,
      },
    });
  }
  if (!map.getLayer(LAYER.layupLabels)) {
    map.addLayer({
      id: LAYER.layupLabels,
      type: "symbol",
      source: SRC.layups,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 10,
        "text-offset": [0, -1.4],
        "text-anchor": "bottom",
      },
      paint: {
        "text-color": "#F5C84B",
        "text-halo-color": "#000000",
        "text-halo-width": 1.2,
      },
    });
  }

  // Dogleg marker
  if (!map.getLayer(LAYER.doglegPoint)) {
    map.addLayer({
      id: LAYER.doglegPoint,
      type: "circle",
      source: SRC.doglegs,
      paint: {
        "circle-radius": 6,
        "circle-color": "#ffffff",
        "circle-stroke-color": "#F5C84B",
        "circle-stroke-width": 2,
      },
    });
  }
  if (!map.getLayer(LAYER.doglegLabels)) {
    map.addLayer({
      id: LAYER.doglegLabels,
      type: "symbol",
      source: SRC.doglegs,
      layout: {
        "text-field": "▸ Dogleg",
        "text-size": 10,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#F5C84B",
        "text-halo-color": "#000000",
        "text-halo-width": 1.2,
      },
    });
  }

  // Landing zones — transparent emerald circles
  if (!map.getLayer(LAYER.landingFill)) {
    map.addLayer({
      id: LAYER.landingFill,
      type: "circle",
      source: SRC.landing,
      paint: {
        "circle-radius": 16,
        "circle-color": "rgba(16,185,129,0.18)",
        "circle-stroke-color": "#10b981",
        "circle-stroke-width": 1.5,
      },
    });
  }
}

export function setMappedHoleData(map: mapboxgl.Map, hole: MappedHole | null) {
  ensureMappedLayers(map);

  const hazardFeatures: GeoJSON.Feature[] = [];
  const obFeatures: GeoJSON.Feature[] = [];
  if (hole) {
    for (const h of hole.hazards) {
      if (h.type === "out_of_bounds" && h.polygon) {
        obFeatures.push({
          type: "Feature",
          properties: { id: h.id, name: h.name },
          geometry: { type: "LineString", coordinates: h.polygon },
        });
        continue;
      }
      if (h.polygon) {
        hazardFeatures.push({
          type: "Feature",
          properties: { id: h.id, name: h.name, kind: h.type },
          geometry: { type: "Polygon", coordinates: [h.polygon] },
        });
      }
    }
  }
  (map.getSource(SRC.hazardPoly) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: hazardFeatures,
  });
  (map.getSource(SRC.obLines) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: obFeatures,
  });

  const greenPts: GeoJSON.Feature[] = [];
  if (hole?.green.front) {
    greenPts.push({
      type: "Feature",
      properties: { kind: "front", label: "F" },
      geometry: { type: "Point", coordinates: [hole.green.front.lng, hole.green.front.lat] },
    });
  }
  if (hole?.green.center) {
    greenPts.push({
      type: "Feature",
      properties: { kind: "center", label: "C" },
      geometry: { type: "Point", coordinates: [hole.green.center.lng, hole.green.center.lat] },
    });
  }
  if (hole?.green.back) {
    greenPts.push({
      type: "Feature",
      properties: { kind: "back", label: "B" },
      geometry: { type: "Point", coordinates: [hole.green.back.lng, hole.green.back.lat] },
    });
  }
  (map.getSource(SRC.greenPts) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: greenPts,
  });

  (map.getSource(SRC.pin) as mapboxgl.GeoJSONSource | undefined)?.setData(
    hole?.pin
      ? {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: [hole.pin.coordinate.lng, hole.pin.coordinate.lat] },
            },
          ],
        }
      : EMPTY,
  );

  const layupFeatures: GeoJSON.Feature[] =
    hole?.layups.map((l) => ({
      type: "Feature",
      properties: { label: l.name },
      geometry: { type: "Point", coordinates: [l.coordinate.lng, l.coordinate.lat] },
    })) ?? [];
  (map.getSource(SRC.layups) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: layupFeatures,
  });

  const doglegFeatures: GeoJSON.Feature[] =
    hole?.doglegs.map((d) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [d.coordinate.lng, d.coordinate.lat] },
    })) ?? [];
  (map.getSource(SRC.doglegs) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: doglegFeatures,
  });

  const landingFeatures: GeoJSON.Feature[] =
    hole?.landingZones.map((z) => ({
      type: "Feature",
      properties: { label: z.name },
      geometry: { type: "Point", coordinates: [z.coordinate.lng, z.coordinate.lat] },
    })) ?? [];
  (map.getSource(SRC.landing) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: landingFeatures,
  });
}

export function clearMappedHoleData(map: mapboxgl.Map) {
  setMappedHoleData(map, null);
}