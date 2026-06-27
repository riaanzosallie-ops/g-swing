import type { LeaderboardRow, Tournament } from "./tournament-engine";

const fmtPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

export type AwardEntry = { name: string; detail: string } | null;

export function deriveGrossChampion(rows: LeaderboardRow[]): AwardEntry {
  const played = rows.filter((r) => r.thru > 0);
  const r = [...played].sort((a, b) => a.toPar - b.toPar)[0];
  if (!r) return null;
  return { name: r.player.player_name, detail: `${r.gross} · ${fmtPar(r.toPar)} thru ${r.thru}` };
}

export function deriveNetChampion(tournament: Tournament, rows: LeaderboardRow[]): AwardEntry {
  if (tournament.scoring === "Gross") return null;
  const played = rows.filter((r) => r.thru > 0 && r.player.handicap > 0);
  const r = [...played].sort((a, b) => a.toParNet - b.toParNet)[0];
  if (!r) return null;
  return { name: r.player.player_name, detail: `${r.net} net · ${fmtPar(r.toParNet)}` };
}

export function derivePodium(rows: LeaderboardRow[]): { gold: AwardEntry; silver: AwardEntry; bronze: AwardEntry } {
  const played = [...rows.filter((r) => r.thru > 0)].sort((a, b) => a.toPar - b.toPar);
  const make = (r?: LeaderboardRow): AwardEntry =>
    r ? { name: r.player.player_name, detail: `${r.gross} · ${fmtPar(r.toPar)}` } : null;
  return { gold: make(played[0]), silver: make(played[1]), bronze: make(played[2]) };
}

export function deriveMostBirdies(rows: LeaderboardRow[]): AwardEntry {
  const r = [...rows].sort((a, b) => b.birdies - a.birdies)[0];
  if (!r || r.birdies <= 0) return null;
  return { name: r.player.player_name, detail: `${r.birdies} birdie${r.birdies === 1 ? "" : "s"}` };
}

export function deriveMostPars(rows: LeaderboardRow[]): AwardEntry {
  const r = [...rows].sort((a, b) => b.pars - a.pars)[0];
  if (!r || r.pars <= 0) return null;
  return { name: r.player.player_name, detail: `${r.pars} par${r.pars === 1 ? "" : "s"}` };
}

export function deriveToughestHole(rows: LeaderboardRow[]): { hole: number; avgOverPar: number } | null {
  const agg = new Map<number, { sum: number; n: number }>();
  for (const r of rows) {
    for (const s of r.scores) {
      if (!s.par || !s.strokes) continue;
      const a = agg.get(s.hole) ?? { sum: 0, n: 0 };
      a.sum += s.strokes - s.par;
      a.n += 1;
      agg.set(s.hole, a);
    }
  }
  let tough: { hole: number; avgOverPar: number } | null = null;
  for (const [hole, a] of agg) {
    if (a.n < 2) continue;
    const avg = a.sum / a.n;
    if (!tough || avg > tough.avgOverPar) tough = { hole, avgOverPar: avg };
  }
  return tough && tough.avgOverPar > 0 ? tough : null;
}

export function deriveBestComeback(
  rows: LeaderboardRow[],
  prevPositions?: Record<string, number>,
): AwardEntry {
  if (!prevPositions) return null;
  const played = rows.filter((r) => r.thru > 0);
  const best = played
    .map((r) => ({ r, delta: (prevPositions[r.player.id] ?? r.position) - r.position }))
    .filter((x) => x.delta > 0)
    .sort((a, b) => b.delta - a.delta)[0];
  if (!best) return null;
  return {
    name: best.r.player.player_name,
    detail: `Climbed ${best.delta} position${best.delta === 1 ? "" : "s"}`,
  };
}

export type AwardsSummary = {
  gross: AwardEntry;
  net: AwardEntry;
  podium: { gold: AwardEntry; silver: AwardEntry; bronze: AwardEntry };
  mostBirdies: AwardEntry;
  mostPars: AwardEntry;
  toughestHole: { hole: number; avgOverPar: number } | null;
  bestComeback: AwardEntry;
};

export function buildAwardsSummary(
  tournament: Tournament,
  rows: LeaderboardRow[],
  prevPositions?: Record<string, number>,
): AwardsSummary {
  return {
    gross: deriveGrossChampion(rows),
    net: deriveNetChampion(tournament, rows),
    podium: derivePodium(rows),
    mostBirdies: deriveMostBirdies(rows),
    mostPars: deriveMostPars(rows),
    toughestHole: deriveToughestHole(rows),
    bestComeback: deriveBestComeback(rows, prevPositions),
  };
}