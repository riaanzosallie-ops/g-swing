// G-Swing Premium — additive Mapbox layers for MappedHole data.
// Pure module: no React, idempotent installation of sources/layers, and
// data swaps via setData. Never renders fabricated geometry — only what
// the MappedHole actually contains.

import mapboxgl from "mapbox-gl";
import type { MappedHole } from "@/types/gswing-course-map";

const SRC = {
  hazardPoly: "gsm-hazard-poly",
  hazardLabels: "gsm-hazard-labels",
  greenPoly: "gsm-green-poly",
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
  treesFill: "gsm-trees-fill",
  treesLine: "gsm-trees-line",
  roughFill: "gsm-rough-fill",
  wasteFill: "gsm-waste-fill",
  wasteLine: "gsm-waste-line",
  customFill: "gsm-custom-fill",
  customLine: "gsm-custom-line",
  hazardLabels: "gsm-hazard-labels",
  greenPolyFill: "gsm-green-poly-fill",
  greenPolyGlow: "gsm-green-poly-glow",
  greenPolyStroke: "gsm-green-poly-stroke",
  greenFront: "gsm-green-front",
  greenCenter: "gsm-green-center",
  greenBack: "gsm-green-back",
  greenLabels: "gsm-green-labels",
  pin: "gsm-pin",
  pinFlag: "gsm-pin-flag",
  pinPole: "gsm-pin-pole",
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
  ensureSource(map, SRC.hazardLabels);
  ensureSource(map, SRC.greenPoly);
  ensureSource(map, SRC.greenPts);
  ensureSource(map, SRC.pin);
  ensureSource(map, SRC.layups);
  ensureSource(map, SRC.doglegs);
  ensureSource(map, SRC.landing);
  ensureSource(map, SRC.obLines);

  // ===== Green polygon — emerald glass surface + gold perimeter =====
  if (!map.getLayer(LAYER.greenPolyGlow)) {
    map.addLayer({
      id: LAYER.greenPolyGlow,
      type: "fill",
      source: SRC.greenPoly,
      paint: {
        "fill-color": "#34d399",
        "fill-opacity": 0.18,
      },
    });
  }
  if (!map.getLayer(LAYER.greenPolyFill)) {
    map.addLayer({
      id: LAYER.greenPolyFill,
      type: "fill",
      source: SRC.greenPoly,
      paint: {
        "fill-color": "#10b981",
        "fill-opacity": 0.55,
      },
    });
  }
  if (!map.getLayer(LAYER.greenPolyStroke)) {
    map.addLayer({
      id: LAYER.greenPolyStroke,
      type: "line",
      source: SRC.greenPoly,
      paint: {
        "line-color": "#F5C84B",
        "line-width": 1.6,
        "line-opacity": 0.9,
      },
    });
  }

  // Water polygons — deep blue
  if (!map.getLayer(LAYER.waterFill)) {
    map.addLayer({
      id: LAYER.waterFill,
      type: "fill",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "water"],
      paint: {
        "fill-color": "#1e6fbb",
        "fill-opacity": 0.6,
        "fill-outline-color": "#7ec8ff",
      },
    });
  }
  if (!map.getLayer(LAYER.waterLine)) {
    map.addLayer({
      id: LAYER.waterLine,
      type: "line",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "water"],
      paint: { "line-color": "#bcd8ff", "line-width": 1.4, "line-opacity": 0.85 },
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

  // Trees — dark canopy
  if (!map.getLayer(LAYER.treesFill)) {
    map.addLayer({
      id: LAYER.treesFill,
      type: "fill",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "trees"],
      paint: { "fill-color": "#0d4a2c", "fill-opacity": 0.7 },
    });
  }
  if (!map.getLayer(LAYER.treesLine)) {
    map.addLayer({
      id: LAYER.treesLine,
      type: "line",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "trees"],
      paint: { "line-color": "#1b6b3f", "line-width": 1, "line-opacity": 0.7 },
    });
  }

  // Rough — muted olive overlay
  if (!map.getLayer(LAYER.roughFill)) {
    map.addLayer({
      id: LAYER.roughFill,
      type: "fill",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "rough"],
      paint: { "fill-color": "#3f5c2a", "fill-opacity": 0.45 },
    });
  }

  // Waste area — desaturated tan with gold dash
  if (!map.getLayer(LAYER.wasteFill)) {
    map.addLayer({
      id: LAYER.wasteFill,
      type: "fill",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "waste_area"],
      paint: { "fill-color": "#a89368", "fill-opacity": 0.55 },
    });
  }
  if (!map.getLayer(LAYER.wasteLine)) {
    map.addLayer({
      id: LAYER.wasteLine,
      type: "line",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "waste_area"],
      paint: {
        "line-color": "#F5C84B",
        "line-width": 1,
        "line-dasharray": [3, 2],
        "line-opacity": 0.7,
      },
    });
  }

  // Custom hazards — neutral gold outline
  if (!map.getLayer(LAYER.customFill)) {
    map.addLayer({
      id: LAYER.customFill,
      type: "fill",
      source: SRC.hazardPoly,
      filter: ["==", ["get", "kind"], "custom"],
      paint: { "fill-color": "#F5C84B", "fill-opacity": 0.18 },
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
  if (!map.getLayer(LAYER.pinPole)) {
    map.addLayer({
      id: LAYER.pinPole,
      type: "circle",
      source: SRC.pin,
      paint: {
        "circle-radius": 12,
        "circle-color": "rgba(245,200,75,0.15)",
        "circle-stroke-color": "rgba(245,200,75,0.55)",
        "circle-stroke-width": 1,
      },
    });
  }
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

  // ===== Hazard labels — premium gold typography, hidden when zoomed
  // out so labels never collide at course-overview zoom. =====
  if (!map.getLayer(LAYER.hazardLabels)) {
    map.addLayer({
      id: LAYER.hazardLabels,
      type: "symbol",
      source: SRC.hazardLabels,
      minzoom: 15.5,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 10,
        "text-anchor": "center",
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-padding": 4,
        "text-letter-spacing": 0.08,
        "text-transform": "uppercase",
      },
      paint: {
        "text-color": "#F5C84B",
        "text-halo-color": "#000000",
        "text-halo-width": 1.6,
        "text-halo-blur": 0.4,
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