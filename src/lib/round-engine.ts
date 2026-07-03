// Round Engine — the shared state container for a live G-Swing round.
// Phase 1 focus: persist saved measurements + club recommendations per
// hole so the Shot Planning panel can offer instant recall. Designed as
// a foundation for later phases (auto-hole-detect, strokes gained,
// post-round analytics, Fairway Memories), so all writes flow through a
// single `saveMeasurement()` API.
//
// Storage: localStorage-only for now (matches the rest of gswing-store).
// The shape is stable and versioned so Phase 4 can migrate to Lovable
// Cloud without a client rewrite.

import { useCallback, useEffect, useMemo, useState } from "react";

export interface SavedMeasurement {
  id: string;
  holeNumber: number;
  /** Target coordinate. */
  lat: number;
  lng: number;
  /** Distance in the unit stored below (already display-rounded). */
  distance: number;
  unit: "yards" | "meters";
  /** Optional carry-over hazard distance in the same unit. */
  carry?: number | null;
  /** Chosen target category if the user picked from the quick chips. */
  targetKind?: "pin" | "front" | "center" | "back" | "layup" | "hazard" | "tap";
  targetLabel?: string;
  /** Snapshot of the club suggestion at save time. */
  clubName?: string | null;
  clubConfidence?: number | null;
  savedAt: number;
}

export interface RoundState {
  version: 1;
  roundId: string;
  courseId: string | null;
  courseName: string | null;
  startedAt: number;
  endedAt: number | null;
  measurements: SavedMeasurement[];
}

const STORAGE_KEY = "gswing.round.v1";
const MAX_MEASUREMENTS_PER_HOLE = 8;

function emptyRound(courseId: string | null, courseName: string | null): RoundState {
  return {
    version: 1,
    roundId: (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `r-${Date.now()}`),
    courseId,
    courseName,
    startedAt: Date.now(),
    endedAt: null,
    measurements: [],
  };
}

function readRound(): RoundState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoundState;
    if (parsed?.version !== 1) return null;
    return parsed;
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

/**
 * Hook the GPS surface uses to persist and recall shot-planning data.
 * Automatically starts a new round when the active course changes so
 * saved measurements never bleed between courses.
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
        // Cap per-hole history so the sidebar never overwhelms the HUD.
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
    }));
  }, []);

  const endRound = useCallback(() => {
    setRound((prev) => ({ ...prev, endedAt: Date.now() }));
  }, []);

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
    endRound,
    measurementsForHole,
    stats,
  };
}