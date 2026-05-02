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

/* ============ Fairway Memories ============ */
export type MomentTag = "Great Shot" | "Birdie/Eagle" | "Funny" | "Scenery" | "Group" | "Personal Best" | "Partner";
export type RoundPhoto = {
  id: string;
  dataUrl: string;
  hole: number;
  score?: number;
  ts: string;
  tag?: MomentTag;
  quality: number; // 0-1 AI score
};
export type CollageLayout = "Classic" | "Story" | "Polaroid" | "Minimal" | "GroupWall";
export type FairwayMemory = {
  id: string;
  date: string;
  course: string;
  mode: "solo" | "group";
  players: { name: string; score: number; par: number }[];
  photoIds: string[]; // selected for collage
  layout: CollageLayout;
  caption: string;
  badge?: string;
};

export const useRoundCam = () => useLocal<RoundPhoto[]>("gswing.roundcam", []);
export const useMemories = () => useLocal<FairwayMemory[]>("gswing.memories", []);

/* ============ Live Match / Betting Arena ============ */
export type MatchType = "Stroke" | "Match" | "ClosestPin" | "LongestDrive";
export type MatchPlayer = {
  id: string;
  name: string;
  handicap: number;
  scores: number[];      // per-hole strokes
  currentHole: number;
  distanceToPin: number; // metres, live
  shots: number;
};
export type Match = {
  id: string;
  course: string;
  type: MatchType;
  stake: number;
  currency: string;
  status: "lobby" | "live" | "completed";
  holes: number;
  par: number[];
  createdAt: string;
  players: MatchPlayer[];
  chat: { id: string; from: string; text: string; ts: string; reaction?: string }[];
  winnerId?: string;
  roast?: string;
};

export const PAR_18 = [4,4,3,5,4,4,3,5,4,4,3,4,5,4,3,4,4,5];

const seedMatch = (): Match => ({
  id: "live-1",
  course: "Emirates Majlis",
  type: "Stroke",
  stake: 240,
  currency: "AED",
  status: "live",
  holes: 18,
  par: PAR_18,
  createdAt: new Date().toISOString(),
  players: [
    { id: "p1", name: "Riaan", handicap: 3, scores: [4,3,3,5,4,4], currentHole: 7, distanceToPin: 142, shots: 24 },
    { id: "p2", name: "Nievo", handicap: 8, scores: [5,4,4,5,4,5], currentHole: 7, distanceToPin: 168, shots: 27 },
    { id: "p3", name: "Toto",  handicap: 12, scores: [5,4,3,6,5,4], currentHole: 7, distanceToPin: 155, shots: 27 },
    { id: "p4", name: "Docco", handicap: 6, scores: [4,4,4,5,4,5], currentHole: 7, distanceToPin: 130, shots: 26 },
  ],
  chat: [
    { id: "c1", from: "Nievo", text: "Cracking drive on 6 mate 👏", ts: new Date().toISOString() },
    { id: "c2", from: "Toto", text: "I need ACE more than the rest of you 😅", ts: new Date().toISOString() },
  ],
});

export const useMatch = () => useLocal<Match>("gswing.match", seedMatch());