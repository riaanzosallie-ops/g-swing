import type {
  LeaderboardRow,
  Tournament,
  TournamentPlayer,
  TournamentScore,
} from "./tournament-engine";

/** Where each player currently is on the course (evidence only). */
export type PlayerHolePosition = {
  playerId: string;
  playerName: string;
  currentHole: number; // 0 means waiting on first tee
  thru: number;
  position: number;
  toPar: number;
  isLeader: boolean;
  finished: boolean;
};

export function derivePlayerHolePositions(
  tournament: Tournament,
  rows: LeaderboardRow[],
): PlayerHolePosition[] {
  if (!rows.length) return [];
  const leaderPos = rows[0]?.position ?? 1;
  return rows.map((r) => {
    const finished = r.thru >= tournament.holes;
    const currentHole = finished
      ? tournament.holes
      : r.thru === 0
        ? 0
        : Math.min(r.thru + 1, tournament.holes);
    return {
      playerId: r.player.id,
      playerName: r.player.player_name,
      currentHole,
      thru: r.thru,
      position: r.position,
      toPar: r.toPar,
      isLeader: r.position === leaderPos && r.thru > 0,
      finished,
    };
  });
}

export type CourseProgress = {
  holes: number;
  totalShots: number;
  completedHoles: number; // holes where every player has scored
  activeHole: number; // most-played hole still in progress, else max(thru)+1
  percent: number; // 0..1 overall fraction of player-holes completed
};

export function deriveCourseProgress(
  tournament: Tournament,
  players: TournamentPlayer[],
  scores: TournamentScore[],
): CourseProgress {
  const holes = tournament.holes;
  const totalShots = scores.length;
  const playerCount = players.length;
  const perHole = new Map<number, number>();
  for (const s of scores) perHole.set(s.hole, (perHole.get(s.hole) ?? 0) + 1);
  let completedHoles = 0;
  let activeHole = 0;
  let maxPlayedHole = 0;
  for (let h = 1; h <= holes; h++) {
    const n = perHole.get(h) ?? 0;
    if (n > 0) maxPlayedHole = h;
    if (playerCount > 0 && n >= playerCount) completedHoles += 1;
    else if (n > 0 && activeHole === 0) activeHole = h;
  }
  if (activeHole === 0) activeHole = Math.min(holes, maxPlayedHole + 1 || 1);
  const possible = Math.max(1, playerCount * holes);
  const percent = Math.min(1, totalShots / possible);
  return { holes, totalShots, completedHoles, activeHole, percent };
}

export type BroadcastBattle = {
  id: string;
  title: string;
  detail: string;
};

export function deriveTournamentBattles(
  tournament: Tournament,
  rows: LeaderboardRow[],
): BroadcastBattle[] {
  const played = rows.filter((r) => r.thru > 0);
  if (played.length < 2) return [];
  const out: BroadcastBattle[] = [];
  const fmt = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  const leader = played[0];
  const chaser = played[1];
  if (leader && chaser) {
    const useNet = tournament.scoring === "Net";
    const a = useNet ? leader.toParNet : leader.toPar;
    const b = useNet ? chaser.toParNet : chaser.toPar;
    const gap = b - a;
    out.push({
      id: "lead_gap",
      title: gap === 0 ? "Tied at the top" : `${leader.player.player_name} leads by ${gap}`,
      detail: `${chaser.player.player_name} chasing · ${fmt(a)} vs ${fmt(b)}`,
    });
  }
  // Tightest pairing anywhere on board
  let tight: { a: LeaderboardRow; b: LeaderboardRow; gap: number } | null = null;
  for (let i = 0; i < played.length - 1; i++) {
    const a = played[i];
    const b = played[i + 1];
    const useNet = tournament.scoring === "Net";
    const gap = (useNet ? b.toParNet : b.toPar) - (useNet ? a.toParNet : a.toPar);
    if (!tight || gap < tight.gap) tight = { a, b, gap };
  }
  if (tight && tight.gap > 0) {
    out.push({
      id: "tightest",
      title: `Closest battle: T${tight.a.position} vs T${tight.b.position}`,
      detail: `${tight.a.player.player_name} vs ${tight.b.player.player_name} · ${tight.gap} stroke${tight.gap === 1 ? "" : "s"}`,
    });
  }
  return out;
}

export type LowerThird = {
  id: string;
  kind: "leader" | "battle" | "moment" | "code" | "sponsor";
  title: string;
  body: string;
};

export function deriveBroadcastLowerThirds(
  tournament: Tournament,
  rows: LeaderboardRow[],
  moments: { id: string; label: string; description: string }[],
  sponsor?: string | null,
): LowerThird[] {
  const items: LowerThird[] = [];
  const fmt = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  const leader = rows.find((r) => r.thru > 0);
  if (leader) {
    items.push({
      id: "ll-leader",
      kind: "leader",
      title: `Leader · ${leader.player.player_name}`,
      body: `${fmt(leader.toPar)} · thru ${leader.thru}`,
    });
  }
  for (const b of deriveTournamentBattles(tournament, rows)) {
    items.push({ id: `ll-${b.id}`, kind: "battle", title: b.title, body: b.detail });
  }
  for (const m of moments.slice(0, 3)) {
    items.push({ id: `ll-${m.id}`, kind: "moment", title: m.label, body: m.description });
  }
  items.push({
    id: "ll-code",
    kind: "code",
    title: `Join code · ${tournament.code}`,
    body: `${tournament.name} · ${tournament.course}`,
  });
  if (sponsor) {
    items.push({ id: "ll-sponsor", kind: "sponsor", title: "Presented by", body: sponsor });
  }
  return items;
}

export type ProjectedLeaders = {
  gross: { name: string; detail: string } | null;
  net: { name: string; detail: string } | null;
  isFinal: boolean;
};

export function deriveProjectedLeaders(
  tournament: Tournament,
  rows: LeaderboardRow[],
): ProjectedLeaders {
  const played = rows.filter((r) => r.thru > 0);
  const isFinal =
    tournament.status === "Closed" ||
    (played.length > 0 && played.every((r) => r.thru >= tournament.holes));
  const fmt = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  const byGross = [...played].sort((a, b) => a.toPar - b.toPar)[0] ?? null;
  const byNet =
    tournament.scoring === "Gross"
      ? null
      : [...played].filter((r) => r.player.handicap > 0).sort((a, b) => a.toParNet - b.toParNet)[0] ?? null;
  return {
    gross: byGross
      ? { name: byGross.player.player_name, detail: `${byGross.gross} · ${fmt(byGross.toPar)} thru ${byGross.thru}` }
      : null,
    net: byNet
      ? { name: byNet.player.player_name, detail: `${byNet.net} · ${fmt(byNet.toParNet)}` }
      : null,
    isFinal,
  };
}