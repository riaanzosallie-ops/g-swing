import { useEffect, useState } from "react";

export type Club = { id: string; name: string; type: string; distance: number; brand?: string };
export type Round = { id: string; date: string; course: string; score: number; par: number; holes: number };
export type SwingAnalysis = { id: string; date: string; club: string; notes: string; analysis: string };

export const DEFAULT_BAG: Club[] = [
  { id: "1", name: "Driver", type: "Driver", distance: 265, brand: "TaylorMade Qi10" },
  { id: "2", name: "3 Wood", type: "Wood", distance: 235, brand: "TaylorMade Qi10" },
  { id: "3", name: "5 Wood", type: "Wood", distance: 215, brand: "Callaway Paradym" },
  { id: "4", name: "4 Hybrid", type: "Hybrid", distance: 200, brand: "Ping G430" },
  { id: "5", name: "5 Iron", type: "Iron", distance: 185, brand: "Mizuno JPX 923" },
  { id: "6", name: "6 Iron", type: "Iron", distance: 172, brand: "Mizuno JPX 923" },
  { id: "7", name: "7 Iron", type: "Iron", distance: 160, brand: "Mizuno JPX 923" },
  { id: "8", name: "8 Iron", type: "Iron", distance: 148, brand: "Mizuno JPX 923" },
  { id: "9", name: "9 Iron", type: "Iron", distance: 135, brand: "Mizuno JPX 923" },
  { id: "10", name: "PW", type: "Wedge", distance: 120, brand: "Vokey SM10" },
  { id: "11", name: "52° Wedge", type: "Wedge", distance: 100, brand: "Vokey SM10" },
  { id: "12", name: "56° Wedge", type: "Wedge", distance: 80, brand: "Vokey SM10" },
  { id: "13", name: "60° Wedge", type: "Wedge", distance: 60, brand: "Vokey SM10" },
  { id: "14", name: "Putter", type: "Putter", distance: 0, brand: "Scotty Cameron Phantom" },
];

function useLocal<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal] as const;
}

export const useBag = () => useLocal<Club[]>("gswing.bag", DEFAULT_BAG);
export const useRounds = () => useLocal<Round[]>("gswing.rounds", [
  { id: "r1", date: "2026-04-21", course: "Emirates Majlis", score: 74, par: 72, holes: 18 },
  { id: "r2", date: "2026-04-14", course: "Yas Links", score: 78, par: 72, holes: 18 },
  { id: "r3", date: "2026-04-07", course: "Trump Dubai", score: 71, par: 72, holes: 18 },
]);
export const useSwings = () => useLocal<SwingAnalysis[]>("gswing.swings", []);
export const usePlayer = () => useLocal("gswing.player", {
  name: "Riaan", handicap: 3, country: "UAE", homeCourse: "Emirates Majlis", hand: "Right",
});