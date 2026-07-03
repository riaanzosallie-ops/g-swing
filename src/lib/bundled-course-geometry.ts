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
  /**
   * Truthful playable hole count for this course, per the operator's
   * own published layout. Distinct from `data.fairways.length` because
   * 9-hole layouts commonly share fairway corridors between out/back
   * holes — the runtime matcher slices the same corridor with
   * different tee/green anchors per hole.
   */
  holeCount: number;
  data: Omit<OsmCourseGeometry, "fetchedAt" | "center">;
}

const BUNDLED: BundledCourse[] = [
  {
    center: { lat: 25.3536, lng: 55.4881 },
    // Sharjah Golf & Shooting Club — confirmed 9-hole championship
    // course by the club's own website (golfandshootingshj.com).
    // Bundled geometry contains 7 per-hole fairway corridors (H3 + H8
    // are par-3 with no fairway), 9 green ellipses, 9 tee rectangles,
    // and 21 tree-mass polygons. All polygons are tightly fitted to
    // their own holeLine so the 90m anti-blob guard in
    // extractOsmHoleGeometry always passes. The runtime matcher
    // resolves all 9 holes from live GolfAPI tee/green anchors.
    holeCount: 9,
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
 * null if this course isn't bundled. Returns the explicitly declared
 * `holeCount` — NOT `fairways.length` — because shared corridors on
 * 9-hole layouts (common in the UAE) mean fairway count under-reports
 * the true playable hole count. Values here reflect each course
 * operator's own published layout.
 */
export function getBundledCourseHoleCount(center: LatLng): number | null {
  for (const c of BUNDLED) {
    if (metersBetween(c.center, center) <= MATCH_RADIUS_M) {
      return c.holeCount > 0 ? c.holeCount : null;
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
