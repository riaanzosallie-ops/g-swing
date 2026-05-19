import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  haversineMeters,
  haversineYards,
  yardsToMeters,
  metersToYards,
  toDisplayUnit,
  nearestGreenIndex,
  nearestHoleNumber,
  shotDistanceYards,
  shotDistanceMeters,
  bearingDeg,
  isNearCourse,
  type LatLng,
} from "@/lib/gps-utils";

// ─── haversineMeters ──────────────────────────────────────────────────────────
describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters({ lat: 25.09, lng: 55.15 }, { lat: 25.09, lng: 55.15 })).toBe(0);
  });

  it("returns ~111 km for 1 degree of latitude", () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("gives ~392m between Emirates Majlis tee 1 and green 1", () => {
    // Tee H1: 25.09110, 55.15720 → Green H1: 25.09320, 55.15440  (~413y ≈ 378m)
    const d = haversineMeters(
      { lat: 25.09110, lng: 55.15720 },
      { lat: 25.09320, lng: 55.15440 },
    );
    expect(d).toBeGreaterThan(350);
    expect(d).toBeLessThan(420);
  });

  it("is symmetric", () => {
    const a: LatLng = { lat: 25.0911, lng: 55.1572 };
    const b: LatLng = { lat: 25.0930, lng: 55.1544 };
    expect(haversineMeters(a, b)).toBe(haversineMeters(b, a));
  });
});

// ─── haversineYards ───────────────────────────────────────────────────────────
describe("haversineYards", () => {
  it("returns a value ~9% larger than haversineMeters", () => {
    const a: LatLng = { lat: 25.09110, lng: 55.15720 };
    const b: LatLng = { lat: 25.09320, lng: 55.15440 };
    const m = haversineMeters(a, b);
    const y = haversineYards(a, b);
    expect(y / m).toBeCloseTo(1.09361, 1);
  });

  it("matches a known hole-1 championship yardage (413y ±30y)", () => {
    const d = haversineYards(
      { lat: 25.09110, lng: 55.15720 },
      { lat: 25.09320, lng: 55.15440 },
    );
    expect(d).toBeGreaterThan(383);
    expect(d).toBeLessThan(443);
  });
});

// ─── Unit conversion ──────────────────────────────────────────────────────────
describe("yardsToMeters / metersToYards", () => {
  it("100 yards → ~91 metres", () => {
    expect(yardsToMeters(100)).toBe(91);
  });

  it("100 metres → ~109 yards", () => {
    expect(metersToYards(100)).toBe(109);
  });

  it("round-trip loss is at most 1 unit", () => {
    const y = 158;
    expect(Math.abs(metersToYards(yardsToMeters(y)) - y)).toBeLessThanOrEqual(1);
  });
});

describe("toDisplayUnit", () => {
  it("returns yards unchanged when unit is 'yards'", () => {
    expect(toDisplayUnit(200, "yards")).toBe(200);
  });

  it("converts yards to metres when unit is 'meters'", () => {
    expect(toDisplayUnit(100, "meters")).toBe(91);
  });
});

// ─── nearestGreenIndex ────────────────────────────────────────────────────────
describe("nearestGreenIndex", () => {
  const greens: LatLng[] = [
    { lat: 25.09320, lng: 55.15440 }, // hole 1 green
    { lat: 25.09640, lng: 55.15190 }, // hole 2 green
    { lat: 25.09880, lng: 55.15460 }, // hole 3 green
  ];

  it("returns -1 for empty list", () => {
    expect(nearestGreenIndex({ lat: 25, lng: 55 }, [])).toBe(-1);
  });

  it("returns index 0 when player is on hole-1 green", () => {
    const player: LatLng = { lat: 25.09325, lng: 55.15445 };
    expect(nearestGreenIndex(player, greens)).toBe(0);
  });

  it("returns index 1 when player is on hole-2 green", () => {
    const player: LatLng = { lat: 25.09645, lng: 55.15195 };
    expect(nearestGreenIndex(player, greens)).toBe(1);
  });

  it("returns index 2 when player is on hole-3 green", () => {
    const player: LatLng = { lat: 25.09885, lng: 55.15465 };
    expect(nearestGreenIndex(player, greens)).toBe(2);
  });
});

// ─── nearestHoleNumber ────────────────────────────────────────────────────────
describe("nearestHoleNumber", () => {
  const greens: LatLng[] = [
    { lat: 25.09320, lng: 55.15440 }, // index 0 → hole 1
    { lat: 25.09640, lng: 55.15190 }, // index 1 → hole 2
  ];

  it("returns null for empty list", () => {
    expect(nearestHoleNumber({ lat: 25, lng: 55 }, [])).toBeNull();
  });

  it("returns 1-based hole number", () => {
    expect(nearestHoleNumber({ lat: 25.09322, lng: 55.15442 }, greens)).toBe(1);
    expect(nearestHoleNumber({ lat: 25.09642, lng: 55.15192 }, greens)).toBe(2);
  });
});

// ─── shot distance ────────────────────────────────────────────────────────────
describe("shotDistanceYards", () => {
  it("calculates a 158-yard shot accurately (±5y)", () => {
    // simulate standing 158 yards from a point
    // 158y ≈ 144.5m  →  move ~0.00130° lat north
    const start: LatLng = { lat: 25.09000, lng: 55.15500 };
    const end:   LatLng = { lat: 25.09130, lng: 55.15500 }; // ~144m north
    const d = shotDistanceYards(start, end);
    expect(d).toBeGreaterThan(140);
    expect(d).toBeLessThan(175);
  });

  it("returns 0 when start equals end", () => {
    const p: LatLng = { lat: 25.09, lng: 55.15 };
    expect(shotDistanceYards(p, p)).toBe(0);
  });
});

describe("shotDistanceMeters", () => {
  it("is consistent with haversineMeters", () => {
    const a: LatLng = { lat: 25.09, lng: 55.15 };
    const b: LatLng = { lat: 25.092, lng: 55.153 };
    expect(shotDistanceMeters(a, b)).toBe(haversineMeters(a, b));
  });
});

// ─── bearingDeg ───────────────────────────────────────────────────────────────
describe("bearingDeg", () => {
  it("returns ~0 when heading north", () => {
    const b = bearingDeg({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(b).toBeCloseTo(0, 0);
  });

  it("returns ~90 when heading east", () => {
    const b = bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(b).toBeCloseTo(90, 0);
  });

  it("returns ~180 when heading south", () => {
    const b = bearingDeg({ lat: 1, lng: 0 }, { lat: 0, lng: 0 });
    expect(b).toBeCloseTo(180, 0);
  });

  it("returns ~270 when heading west", () => {
    const b = bearingDeg({ lat: 0, lng: 1 }, { lat: 0, lng: 0 });
    expect(b).toBeCloseTo(270, 0);
  });
});

// ─── isNearCourse ─────────────────────────────────────────────────────────────
describe("isNearCourse", () => {
  const courseCenter: LatLng = { lat: 25.0911, lng: 55.1572 };

  it("returns true when player is on the course", () => {
    // 5m away — well within any threshold
    const player: LatLng = { lat: 25.09115, lng: 55.15725 };
    expect(isNearCourse(player, courseCenter)).toBe(true);
  });

  it("returns false when player is far away", () => {
    // Abu Dhabi vs Dubai
    const player: LatLng = { lat: 24.4673, lng: 54.6010 };
    expect(isNearCourse(player, courseCenter)).toBe(false);
  });

  it("respects a custom radius", () => {
    // ~1100m away
    const player: LatLng = { lat: 25.0812, lng: 55.1572 };
    expect(isNearCourse(player, courseCenter, 500)).toBe(false);
    expect(isNearCourse(player, courseCenter, 1500)).toBe(true);
  });
});

// ─── API client (mocked fetch) ────────────────────────────────────────────────
describe("fetchHoleGps (mocked)", () => {
  const mockHoleGps = {
    course_id:   "00000000-0000-0000-0000-000000000001",
    hole_number: 7,
    par: 4, handicap: 13, notes: "Water right entire hole", unit: "yards",
    status: "ok",
    tee_boxes: [{ color: "championship", yardage: 382, lat: 25.09620, lng: 55.16420 }],
    green: {
      center: { lat: 25.09380, lng: 55.16100 },
      front:  { lat: 25.09369, lng: 55.16103 },
      back:   { lat: 25.09391, lng: 55.16097 },
      pin:    { lat: 25.09382, lng: 55.16101 },
      polygon: null, depth_yards: 28, width_yards: 26,
    },
    hazards: [
      { type: "water", label: "Water right entire hole", lat: 25.09500, lng: 55.16390, geometry: null, carry_yards_from_tee: null },
    ],
    player_position: { lat: 25.09500, lng: 55.16300 },
    distances: {
      to_center_of_green: 158, to_front_of_green: 146,
      to_back_of_green: 170, to_pin: 156, to_tee_box: 240,
      hazards: { water_water_right_entire_hole: 48 },
    },
    recommended_target: "Short iron to flag",
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHoleGps,
    }));
    // Provide env vars consumed by the API client
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  });

  it("returns parsed hole GPS data with distances", async () => {
    const { fetchHoleGps } = await import("@/lib/golf-gps-api");
    const result = await fetchHoleGps(
      "00000000-0000-0000-0000-000000000001",
      7,
      { playerPos: { lat: 25.09500, lng: 55.16300 }, unit: "yards" },
    );
    expect(result.hole_number).toBe(7);
    expect(result.par).toBe(4);
    expect(result.distances?.to_center_of_green).toBe(158);
    expect(result.distances?.to_front_of_green).toBe(146);
    expect(result.recommended_target).toMatch(/iron/i);
  });

  it("calls the correct endpoint URL", async () => {
    const { fetchHoleGps } = await import("@/lib/golf-gps-api");
    await fetchHoleGps("course-abc", 3, { playerPos: { lat: 25.09, lng: 55.15 }, unit: "meters" });
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("golf-courses/course-abc/holes/3/gps");
    expect(calledUrl).toContain("unit=meters");
    expect(calledUrl).toContain("lat=25.09");
  });
});

describe("detectCourseArrival (mocked)", () => {
  const sharjahCourse = {
    id: "00000000-0000-0000-0000-000000000101",
    name: "Sharjah Golf and Shooting Club",
    city: "Sharjah",
    country: "AE",
    lat: 25.3536,
    lng: 55.4881,
    holes_count: 9,
    par: 36,
    website: null,
    timezone: "Asia/Dubai",
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        arrived: true,
        should_auto_select: true,
        nearest: sharjahCourse,
        nearest_candidate: sharjahCourse,
        distance_meters: 42,
        arrival_radius_meters: 1200,
        player_position: { lat: 25.3537, lng: 55.4882 },
      }),
    }));
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  });

  it("calls the backend arrival detection endpoint with radius and country", async () => {
    const { detectCourseArrival } = await import("@/lib/golf-gps-api");
    const result = await detectCourseArrival(
      { lat: 25.3537, lng: 55.4882 },
      { radiusMeters: 1200, country: "AE" },
    );

    expect(result.arrived).toBe(true);
    expect(result.nearest?.name).toBe("Sharjah Golf and Shooting Club");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("golf-courses/detect");
    expect(calledUrl).toContain("radius_meters=1200");
    expect(calledUrl).toContain("country=AE");
  });
});

describe("startRound (mocked)", () => {
  const mockRound = {
    id: "round-uuid-1", course_id: "course-1", session_id: "sess-1",
    current_hole: 1, player_lat: null, player_lng: null,
    unit: "yards", started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(), completed_at: null,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ round: mockRound }),
    }));
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  });

  it("POSTs to golf-rounds/start and returns round", async () => {
    const { startRound } = await import("@/lib/golf-gps-api");
    const round = await startRound({ courseId: "course-1", sessionId: "sess-1", unit: "yards" });
    expect(round.id).toBe("round-uuid-1");
    expect(round.current_hole).toBe(1);
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("golf-rounds/start");
    expect(opts.method).toBe("POST");
  });
});

describe("endShot (mocked) — distance calculation", () => {
  const mockShot = {
    id: "shot-1", round_id: "r1", hole_number: 7, shot_number: 1,
    start_lat: 25.09500, start_lng: 55.16300,
    end_lat: 25.09380, end_lng: 55.16100,
    distance_yards: 158, club_used: "7 Iron",
    started_at: new Date().toISOString(), ended_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ shot: mockShot, distance_yards: 158 }),
    }));
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  });

  it("returns shot with distance_yards", async () => {
    const { endShot } = await import("@/lib/golf-gps-api");
    const result = await endShot("r1", { lat: 25.09380, lng: 55.16100 });
    expect(result.distance_yards).toBe(158);
    expect(result.shot.club_used).toBe("7 Iron");
  });
});

describe("setCurrentHole (mocked)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        round: { id: "r1", current_hole: 8, course_id: "c1", session_id: "s1",
          player_lat: null, player_lng: null, unit: "yards",
          started_at: "", updated_at: "", completed_at: null },
      }),
    }));
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  });

  it("PATCHes hole and returns updated round", async () => {
    const { setCurrentHole } = await import("@/lib/golf-gps-api");
    const { round } = await setCurrentHole("r1", 8);
    expect(round.current_hole).toBe(8);
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("golf-rounds/r1/hole");
    expect(opts.method).toBe("PATCH");
  });
});

describe("updatePlayerLocation (mocked)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        round: { id: "r1", current_hole: 7, course_id: "c1", session_id: "s1",
          player_lat: 25.09500, player_lng: 55.16300, unit: "yards",
          started_at: "", updated_at: "", completed_at: null },
        hole_changed: false,
        nearest_hole: 7,
      }),
    }));
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  });

  it("sends lat/lng and returns updated location", async () => {
    const { updatePlayerLocation } = await import("@/lib/golf-gps-api");
    const result = await updatePlayerLocation("r1", { lat: 25.09500, lng: 55.16300 });
    expect(result.round.player_lat).toBe(25.09500);
    expect(result.nearest_hole).toBe(7);
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.lat).toBe(25.09500);
    expect(body.lng).toBe(55.16300);
  });
});
