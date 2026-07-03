// Round Engine — the shared state container for a live G-Swing round.
// v2 adds: hole visit timeline, GPS breadcrumb path, resume detection,
// and a stable data shape the Stats + Fairway Memories foundations
// consume. All writes still flow through this module so a future
// Lovable Cloud migration is a one-file swap.
//
// Storage: localStorage only (matches the rest of gswing-store).
// Versioned; v1 payloads are auto-migrated on read.

import { useCallback, useEffect, useMemo, useState } from "react";

export interface SavedMeasurement {
  id: string;
  holeNumber: number;
  lat: number;
  lng: number;
  distance: number;
  unit: "yards" | "meters";
  carry?: number | null;
  targetKind?: "pin" | "front" | "center" | "back" | "layup" | "hazard" | "tap";
  targetLabel?: string;
  clubName?: string | null;
  clubConfidence?: number | null;
  savedAt: number;
}

/** A hole the player has visited during this round. */
export interface HoleVisit {
  holeNumber: number;
  enteredAt: number;
  exitedAt: number | null;
}

/** A single GPS breadcrumb — used by Fairway Memories / walking distance. */
export interface PathPoint {
  holeNumber: number | null;
  lat: number;
  lng: number;
  ts: number;
}

export interface RoundState {
  version: 2;
  roundId: string;
  courseId: string | null;
  courseName: string | null;
  startedAt: number;
  endedAt: number | null;
  measurements: SavedMeasurement[];
  holeVisits: HoleVisit[];
  path: PathPoint[];
  lastPlayerPosition: PathPoint | null;
}

const STORAGE_KEY = "gswing.round.v2";
const LEGACY_STORAGE_KEY = "gswing.round.v1";
const MAX_MEASUREMENTS_PER_HOLE = 8;
const MAX_PATH_POINTS = 720; // ~4h at 1 sample per 20s
/** Minimum meters between breadcrumbs. Keeps path storage sane. */
const PATH_MIN_METERS = 8;

function emptyRound(courseId: string | null, courseName: string | null): RoundState {
  return {
    version: 2,
    roundId: (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `r-${Date.now()}`),
    courseId,
    courseName,
    startedAt: Date.now(),
    endedAt: null,
    measurements: [],
    holeVisits: [],
    path: [],
    lastPlayerPosition: null,
  };
}

function migrate(raw: unknown): RoundState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<RoundState> & { version?: number };
  if (r.version === 2) return r as RoundState;
  if (r.version === 1) {
    return {
      ...emptyRound(r.courseId ?? null, r.courseName ?? null),
      roundId: r.roundId ?? emptyRound(null, null).roundId,
      startedAt: r.startedAt ?? Date.now(),
      endedAt: r.endedAt ?? null,
      measurements: Array.isArray(r.measurements) ? r.measurements : [],
    };
  }
  return null;
}

function readRound(): RoundState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return migrate(JSON.parse(legacy));
    return null;
  } catch {
    return null;
  }
}

function writeRound(round: RoundState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(round));
  } catch {
    /* quota — ignore */
  }
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Hook the GPS surface uses to persist and recall shot-planning data.
 * Automatically starts a new round when the active course changes so
 * saved data never bleeds between courses. Resumes an existing round
 * if the last saved state is unfinished and targets the same course.
 */
export function useRound(courseId: string | null, courseName: string | null) {
  const [round, setRound] = useState<RoundState>(() => {
    const existing = readRound();
    if (existing && existing.courseId === courseId && existing.endedAt == null) {
      return existing;
    }
    return emptyRound(courseId, courseName);
  });

  // Course switch → open a fresh round (do not leak measurements).
  useEffect(() => {
    if (round.courseId === courseId) return;
    const next = emptyRound(courseId, courseName);
    setRound(next);
    writeRound(next);
  }, [courseId, courseName, round.courseId]);

  useEffect(() => {
    writeRound(round);
  }, [round]);

  const saveMeasurement = useCallback(
    (m: Omit<SavedMeasurement, "id" | "savedAt">) => {
      setRound((prev) => {
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `m-${Date.now()}`;
        const entry: SavedMeasurement = { ...m, id, savedAt: Date.now() };
        const perHole = prev.measurements.filter((x) => x.holeNumber === m.holeNumber);
        const others = prev.measurements.filter((x) => x.holeNumber !== m.holeNumber);
        const trimmed = [entry, ...perHole].slice(0, MAX_MEASUREMENTS_PER_HOLE);
        return { ...prev, measurements: [...trimmed, ...others] };
      });
    },
    [],
  );

  const removeMeasurement = useCallback((id: string) => {
    setRound((prev) => ({
      ...prev,
      measurements: prev.measurements.filter((m) => m.id !== id),
    }));
  }, []);

  const clearHole = useCallback((holeNumber: number) => {
    setRound((prev) => ({
      ...prev,
      measurements: prev.measurements.filter((m) => m.holeNumber !== holeNumber),
      holeVisits: prev.holeVisits.filter((v) => v.holeNumber !== holeNumber),
      path: prev.path.filter((p) => p.holeNumber !== holeNumber),
    }));
  }, []);

  /** Mark a hole as entered. Closes the previous open visit. */
  const visitHole = useCallback((holeNumber: number) => {
    setRound((prev) => {
      const now = Date.now();
      const closed = prev.holeVisits.map((v) =>
        v.exitedAt == null && v.holeNumber !== holeNumber
          ? { ...v, exitedAt: now }
          : v,
      );
      const alreadyOpen = closed.find(
        (v) => v.holeNumber === holeNumber && v.exitedAt == null,
      );
      if (alreadyOpen) return { ...prev, holeVisits: closed };
      return {
        ...prev,
        holeVisits: [...closed, { holeNumber, enteredAt: now, exitedAt: null }],
      };
    });
  }, []);

  /** Append a breadcrumb — dedupes tiny movements so storage stays bounded. */
  const logPosition = useCallback(
    (pos: { lat: number; lng: number }, holeNumber: number | null) => {
      setRound((prev) => {
        if (prev.endedAt != null) return prev;
        const last = prev.lastPlayerPosition;
        if (
          last &&
          last.holeNumber === holeNumber &&
          haversineMeters(last, pos) < PATH_MIN_METERS
        ) {
          return prev;
        }
        const point: PathPoint = {
          holeNumber,
          lat: pos.lat,
          lng: pos.lng,
          ts: Date.now(),
        };
        const path = [...prev.path, point].slice(-MAX_PATH_POINTS);
        return { ...prev, path, lastPlayerPosition: point };
      });
    },
    [],
  );

  const endRound = useCallback(() => {
    setRound((prev) => {
      const now = Date.now();
      const closed = prev.holeVisits.map((v) =>
        v.exitedAt == null ? { ...v, exitedAt: now } : v,
      );
      return { ...prev, holeVisits: closed, endedAt: now };
    });
  }, []);

  /** Start a brand-new round for the current course, discarding drafts. */
  const resetRound = useCallback(() => {
    const fresh = emptyRound(courseId, courseName);
    setRound(fresh);
    writeRound(fresh);
  }, [courseId, courseName]);

  const measurementsForHole = useCallback(
    (holeNumber: number) =>
      round.measurements
        .filter((m) => m.holeNumber === holeNumber)
        .sort((a, b) => b.savedAt - a.savedAt),
    [round.measurements],
  );

  const stats = useMemo(
    () => ({
      total: round.measurements.length,
      holesTouched: new Set(round.measurements.map((m) => m.holeNumber)).size,
    }),
    [round.measurements],
  );

  return {
    round,
    saveMeasurement,
    removeMeasurement,
    clearHole,
    visitHole,
    logPosition,
    endRound,
    resetRound,
    measurementsForHole,
    stats,
  };
}