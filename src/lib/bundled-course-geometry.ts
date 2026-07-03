// G-Swing — bundled course geometry.
// -----------------------------------
// Ships surveyed/derived course geometry with the app for courses that
// are not (yet) traced in OpenStreetMap. Same shape as the OSM course
// geometry, so the per-hole matcher (`extractOsmHoleGeometry`) slices it
// using the live GolfAPI tee/green anchors — no manual hole numbering.
//
// Sharjah G&SC geometry was derived from Esri World Imagery via
// automated turf/canopy segmentation (see repo history), then merged at
// runtime with live OSM bunkers/water.

import type { LatLng } from "@/lib/gps-utils";
import type { OsmCourseGeometry } from "@/lib/osm-course-geometry";
import sharjahGeometry from "@/data/sharjah-course-geometry.json";

interface BundledCourse {
  center: LatLng;
  data: Omit<OsmCourseGeometry, "fetchedAt" | "center">;
}

const BUNDLED: BundledCourse[] = [
  {
    center: { lat: 25.3536, lng: 55.4881 },
    data: sharjahGeometry as BundledCourse["data"],
  },
];

const MATCH_RADIUS_M = 3000;

function metersBetween(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Bundled geometry for a course near `center`, or null. */
export function getBundledCourseGeometry(center: LatLng): OsmCourseGeometry | null {
  for (const c of BUNDLED) {
    if (metersBetween(c.center, center) <= MATCH_RADIUS_M) {
      return {
        fetchedAt: Date.now(),
        center: c.center,
        fairways: c.data.fairways ?? [],
        greens: c.data.greens ?? [],
        tees: c.data.tees ?? [],
        bunkers: c.data.bunkers ?? [],
        water: c.data.water ?? [],
        trees: c.data.trees ?? [],
        holeLines: c.data.holeLines ?? [],
      };
    }
  }
  return null;
}

/**
 * Playable hole count for a bundled course layout near `center`, or
 * null if this course isn't bundled. Used by the GPS header so seeded
 * layouts (e.g. Sharjah's 9 mapped holes) don't advertise the upstream
 * "18" count from GolfAPI when only 9 are actually playable in-app.
 */
export function getBundledCourseHoleCount(center: LatLng): number | null {
  for (const c of BUNDLED) {
    if (metersBetween(c.center, center) <= MATCH_RADIUS_M) {
      const hl = c.data.holeLines?.length ?? 0;
      const fw = c.data.fairways?.length ?? 0;
      const n = Math.max(hl, fw);
      return n > 0 ? n : null;
    }
  }
  return null;
}

/**
 * Merge bundled + live OSM geometry. Bundled features come first so the
 * per-hole matcher prefers them on distance ties; all OSM features are
 * appended (at Sharjah: OSM contributes the surveyed bunkers + lakes).
 */
export function mergeCourseGeometry(
  bundled: OsmCourseGeometry | null,
  osm: OsmCourseGeometry | null,
): OsmCourseGeometry | null {
  if (!bundled) return osm;
  if (!osm) return bundled;
  return {
    fetchedAt: Date.now(),
    center: bundled.center,
    fairways: [...bundled.fairways, ...osm.fairways],
    greens: [...bundled.greens, ...osm.greens],
    tees: [...bundled.tees, ...osm.tees],
    bunkers: [...bundled.bunkers, ...osm.bunkers],
    water: [...bundled.water, ...osm.water],
    trees: [...bundled.trees, ...osm.trees],
    holeLines: [...bundled.holeLines, ...osm.holeLines],
  };
}
