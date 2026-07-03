import { describe, expect, it } from "vitest";
import {
  extractOsmHoleGeometry,
  parseOverpassCourse,
  type OsmCourseGeometry,
} from "@/lib/osm-course-geometry";

// Local helper: build a small square ring around a centre (deg offsets).
function squareRing(lat: number, lng: number, d = 0.0002): Array<[number, number]> {
  return [
    [lng - d, lat - d],
    [lng + d, lat - d],
    [lng + d, lat + d],
    [lng - d, lat + d],
    [lng - d, lat - d],
  ];
}

const CENTER = { lat: 25.354, lng: 55.488 };

describe("parseOverpassCourse", () => {
  it("buckets ways by tag and closes open rings", () => {
    const parsed = parseOverpassCourse(
      [
        {
          type: "way",
          id: 1,
          tags: { golf: "bunker", surface: "sand" },
          geometry: [
            { lat: 25.354, lon: 55.488 },
            { lat: 25.3541, lon: 55.488 },
            { lat: 25.3541, lon: 55.4881 },
          ],
        },
        {
          type: "way",
          id: 2,
          tags: { natural: "water" },
          geometry: [
            { lat: 25.355, lon: 55.489 },
            { lat: 25.3551, lon: 55.489 },
            { lat: 25.3551, lon: 55.4891 },
            { lat: 25.355, lon: 55.489 },
          ],
        },
        {
          type: "way",
          id: 3,
          tags: { golf: "hole", ref: "7" },
          geometry: [
            { lat: 25.354, lon: 55.488 },
            { lat: 25.3545, lon: 55.4885 },
            { lat: 25.355, lon: 55.489 },
          ],
        },
        // Too few points → ignored.
        { type: "way", id: 4, tags: { golf: "green" }, geometry: [{ lat: 1, lon: 1 }] },
      ],
      CENTER,
    );
    expect(parsed.bunkers).toHaveLength(1);
    // Open bunker ring must be closed.
    const b = parsed.bunkers[0];
    expect(b[0]).toEqual(b[b.length - 1]);
    expect(parsed.water).toHaveLength(1);
    expect(parsed.holeLines).toHaveLength(1);
    expect(parsed.holeLines[0].ref).toBe(7);
    expect(parsed.greens).toHaveLength(0);
  });
});

describe("extractOsmHoleGeometry", () => {
  const tee = { lat: 25.354, lng: 55.488 };
  const greenC = { lat: 25.357, lng: 55.492 }; // ~500m NE

  function course(overrides: Partial<OsmCourseGeometry>): OsmCourseGeometry {
    return {
      fetchedAt: Date.now(),
      center: CENTER,
      fairways: [],
      greens: [],
      tees: [],
      bunkers: [],
      water: [],
      trees: [],
      holeLines: [],
      ...overrides,
    };
  }

  it("matches the hole line by ref and orients it tee → green", () => {
    const line = [greenC, { lat: 25.3555, lng: 55.49 }, tee]; // reversed
    const out = extractOsmHoleGeometry(
      course({ holeLines: [{ ref: 1, line }] }),
      tee,
      greenC,
      1,
    );
    expect(out.holeLine).not.toBeNull();
    // First point must be the end nearest the tee.
    expect(out.holeLine![0].lat).toBeCloseTo(tee.lat, 6);
  });

  it("keeps bunkers near the corridor and drops far ones", () => {
    const nearBunker = squareRing(25.3555, 55.49); // on the tee→green line
    const farBunker = squareRing(25.362, 55.481); // several hundred m away
    const out = extractOsmHoleGeometry(
      course({ bunkers: [nearBunker, farBunker] }),
      tee,
      greenC,
      1,
    );
    expect(out.bunkers).toHaveLength(1);
    expect(out.bunkers[0]).toBe(nearBunker);
  });

  it("picks the green polygon containing the green centre", () => {
    const rightGreen = squareRing(greenC.lat, greenC.lng, 0.0003);
    const otherGreen = squareRing(25.359, 55.494, 0.0003);
    const out = extractOsmHoleGeometry(
      course({ greens: [otherGreen, rightGreen] }),
      tee,
      greenC,
      1,
    );
    expect(out.green).toBe(rightGreen);
  });

  it("returns nulls when the course has no tracing", () => {
    const out = extractOsmHoleGeometry(course({}), tee, greenC, 1);
    expect(out.holeLine).toBeNull();
    expect(out.fairway).toBeNull();
    expect(out.green).toBeNull();
    expect(out.bunkers).toHaveLength(0);
  });
});
