import type mapboxgl from "mapbox-gl";

/**
 * Pluggable satellite imagery provider chain for the G-Swing Live GPS.
 *
 * The Live GPS map should "just work" — the user picks Satellite, we
 * deliver real imagery. Which provider serves it is an implementation
 * detail. This module defines a prioritised list so we can add Bing,
 * Google, or a user-defined tile server later without touching GpsMap.
 *
 * Adding a new provider:
 *   1. Define the SatelliteProvider entry below (id, label, builder).
 *   2. Insert it into SATELLITE_PROVIDER_CHAIN at the priority you want.
 *   3. Done — GpsMap will probe it automatically with the same auth /
 *      tile-error fallback flow used for Mapbox → Esri today.
 */

export type SatelliteProviderId = "mapbox" | "esri" | "bing" | "google" | "custom";

export interface SatelliteProviderContext {
  mapboxToken: string | null;
  /** Future: per-user override (custom XYZ template, Bing key, etc.). */
  customTileTemplate?: string | null;
}

export interface SatelliteProvider {
  id: SatelliteProviderId;
  label: string;
  /** Short suffix shown in the provider badge (e.g. "Fallback"). */
  badgeSuffix?: string;
  /** True if this provider can be used in the current context. */
  isAvailable: (ctx: SatelliteProviderContext) => boolean;
  /**
   * Returns either a Mapbox style URL string (for Mapbox-hosted styles)
   * or a full Style spec (for tokenless raster providers like Esri).
   */
  buildStyle: (ctx: SatelliteProviderContext) => mapboxgl.Style | string;
  /** Sample tile URL used by the owner diagnostics panel. */
  sampleTileUrl: (ctx: SatelliteProviderContext) => string;
  /** Human attribution surfaced on the map and in diagnostics. */
  attribution: string;
  retinaSupport: boolean;
}

function buildEsriStyle(): mapboxgl.Style {
  return {
    version: 8,
    name: "G-Swing Esri Satellite",
    sources: {
      "esri-world-imagery": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution:
          "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "esri-world-imagery",
        type: "raster",
        source: "esri-world-imagery",
        minzoom: 0,
        maxzoom: 22,
      },
    ],
    glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
  } as unknown as mapboxgl.Style;
}

export const SATELLITE_PROVIDERS: Record<SatelliteProviderId, SatelliteProvider> = {
  mapbox: {
    id: "mapbox",
    label: "Mapbox Satellite",
    isAvailable: ({ mapboxToken }) => !!mapboxToken,
    buildStyle: () => "mapbox://styles/mapbox/satellite-streets-v12",
    sampleTileUrl: ({ mapboxToken }) =>
      `https://api.mapbox.com/v4/mapbox.satellite/15/19000/12500@2x.jpg?access_token=${mapboxToken ?? "<missing>"}`,
    attribution: "© Mapbox · © Maxar · © OpenStreetMap",
    retinaSupport: true,
  },
  esri: {
    id: "esri",
    label: "Esri World Imagery",
    badgeSuffix: "Fallback",
    isAvailable: () => true,
    buildStyle: () => buildEsriStyle(),
    sampleTileUrl: () =>
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/12500/19000",
    attribution: "Tiles © Esri — Maxar, Earthstar Geographics, GIS Community",
    retinaSupport: false,
  },
  // Reserved future providers — guarded by license keys we don't ship.
  bing: {
    id: "bing",
    label: "Bing Maps Aerial",
    badgeSuffix: "Fallback",
    isAvailable: () => false,
    buildStyle: () => buildEsriStyle(),
    sampleTileUrl: () => "",
    attribution: "© Microsoft Bing Maps",
    retinaSupport: true,
  },
  google: {
    id: "google",
    label: "Google Satellite",
    badgeSuffix: "Fallback",
    isAvailable: () => false,
    buildStyle: () => buildEsriStyle(),
    sampleTileUrl: () => "",
    attribution: "© Google",
    retinaSupport: true,
  },
  custom: {
    id: "custom",
    label: "Custom Tile Server",
    badgeSuffix: "Custom",
    isAvailable: ({ customTileTemplate }) => !!customTileTemplate,
    buildStyle: ({ customTileTemplate }) => ({
      version: 8,
      name: "G-Swing Custom Satellite",
      sources: {
        "custom-xyz": {
          type: "raster",
          tiles: [customTileTemplate ?? ""],
          tileSize: 256,
        },
      },
      layers: [{ id: "custom-xyz", type: "raster", source: "custom-xyz" }],
      glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
    } as unknown as mapboxgl.Style),
    sampleTileUrl: ({ customTileTemplate }) => customTileTemplate ?? "",
    attribution: "User-provided tile source",
    retinaSupport: false,
  },
};

/** Priority order — first available provider in this list is used. */
export const SATELLITE_PROVIDER_CHAIN: SatelliteProviderId[] = [
  "mapbox",
  "esri",
  "bing",
  "google",
  "custom",
];

/** Returns the first available provider id in the chain, skipping `skip`. */
export function pickSatelliteProvider(
  ctx: SatelliteProviderContext,
  skip: Set<SatelliteProviderId> = new Set(),
): SatelliteProviderId | null {
  for (const id of SATELLITE_PROVIDER_CHAIN) {
    if (skip.has(id)) continue;
    if (SATELLITE_PROVIDERS[id].isAvailable(ctx)) return id;
  }
  return null;
}