// Generate a Mapbox Static Images URL showing a shot's path overlay.
// Uses publishable token already fetched at runtime — never bundled.

import type { LatLng } from "@/lib/gps-utils";

function encodePath(points: LatLng[]): string {
  // Mapbox Static `path` overlay: path-{stroke}+{color}-{opacity}({lng},{lat};...)
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  return `path-4+f5c84b-1(${coords})`;
}

function encodePin(point: LatLng, color: string, label: string): string {
  return `pin-s-${label}+${color}(${point.lng.toFixed(6)},${point.lat.toFixed(6)})`;
}

export interface StaticShotImageOptions {
  token: string;
  start: LatLng;
  end: LatLng;
  width?: number;
  height?: number;
  style?: string;
}

export function buildStaticShotImageUrl({
  token,
  start,
  end,
  width = 360,
  height = 180,
  style = "mapbox/satellite-streets-v12",
}: StaticShotImageOptions): string {
  const overlays = [
    encodePath([start, end]),
    encodePin(start, "34d399", "a"),
    encodePin(end, "f5c84b", "b"),
  ].join(",");
  return `https://api.mapbox.com/styles/v1/${style}/static/${overlays}/auto/${width}x${height}@2x?access_token=${token}&attribution=false&logo=false`;
}