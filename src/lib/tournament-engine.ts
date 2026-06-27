import { supabase } from "@/integrations/supabase/client";

export type TournamentFormat = "Stroke" | "Stableford" | "MatchPlay";
export type TournamentScoring = "Gross" | "Net" | "Both";
export type TournamentStatus = "Open" | "Live" | "Closed";

export type Tournament = {
  id: string;
  code: string;
  name: string;
  course: string;
  format: TournamentFormat;
  scoring: TournamentScoring;
  holes: number;
  par: number;
  status: TournamentStatus;
  director_id: string | null;
  starts_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TournamentPlayer = {
  id: string;
  tournament_id: string;
  player_name: string;
  handicap: number;
  flight: string | null;
  tee_time: string | null;
  user_id: string | null;
  created_at: string;
};

export type TournamentScore = {
  id: string;
  tournament_id: string;
  player_id: string;
  hole: number;
  par: number;
  strokes: number;
  putts: number | null;
  updated_at: string;
};

export type LeaderboardRow = {
  player: TournamentPlayer;
  thru: number;
  gross: number;
  net: number;
  toPar: number;
  toParNet: number;
  stableford: number;
  birdies: number;
  eagles: number;
  pars: number;
  bogeys: number;
  doubles: number;
  position: number;
  movement: 0 | 1 | -1;
  status: "Live" | "Finished" | "Waiting";
  lastUpdate: string | null;
  scores: TournamentScore[];
};

// ---------- Code generation ----------
export function generateJoinCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join("");
}

// ---------- Score math ----------
export function scoreLabel(strokes: number, par: number): string {
  const d = strokes - par;
  if (strokes === 1) return "Hole In One";
  if (d <= -3) return "Albatross";
  if (d === -2) return "Eagle";
  if (d === -1) return "Birdie";
  if (d === 0) return "Par";
  if (d === 1) return "Bogey";
  if (d === 2) return "Double Bogey";
  return `+${d}`;
}

// USGA-ish course handicap allocation — simple proportional by hole index unavailable, so use even allocation.
export function strokesReceivedOnHole(handicap: number, hole: number, totalHoles: number) {
  const ch = Math.max(0, Math.round(handicap));
  const base = Math.floor(ch / totalHoles);
  const extra = ch % totalHoles;
  // Distribute extras to lowest hole numbers deterministically.
  return base + (hole <= extra ? 1 : 0);
}

export function stablefordPoints(strokes: number, par: number, strokesGiven: number) {
  const net = strokes - strokesGiven;
  const d = net - par;
  if (d <= -3) return 5;
  if (d === -2) return 4;
  if (d === -1) return 3;
  if (d === 0) return 2;
  if (d === 1) return 1;
  return 0;
}

// ---------- Leaderboard ----------
export function buildLeaderboard(
  tournament: Tournament,
  players: TournamentPlayer[],
  scores: TournamentScore[],
  prevPositions?: Record<string, number>,
): LeaderboardRow[] {
  const rows: LeaderboardRow[] = players.map((p) => {
    const own = scores.filter((s) => s.player_id === p.id).sort((a, b) => a.hole - b.hole);
    let gross = 0;
    let parPlayed = 0;
    let net = 0;
    let netPar = 0;
    let stab = 0;
    let birdies = 0, eagles = 0, pars = 0, bogeys = 0, doubles = 0;
    let lastUpdate: string | null = null;
    for (const s of own) {
      gross += s.strokes;
      parPlayed += s.par;
      const strokesGiven = strokesReceivedOnHole(p.handicap, s.hole, tournament.holes);
      const netStrokes = s.strokes - strokesGiven;
      net += netStrokes;
      netPar += s.par;
      stab += stablefordPoints(s.strokes, s.par, strokesGiven);
      const d = s.strokes - s.par;
      if (d <= -2) eagles += 1;
      else if (d === -1) birdies += 1;
      else if (d === 0) pars += 1;
      else if (d === 1) bogeys += 1;
      else if (d >= 2) doubles += 1;
      if (!lastUpdate || s.updated_at > lastUpdate) lastUpdate = s.updated_at;
    }
    const thru = own.length;
    return {
      player: p,
      thru,
      gross,
      net,
      toPar: gross - parPlayed,
      toParNet: net - netPar,
      stableford: stab,
      birdies, eagles, pars, bogeys, doubles,
      position: 0,
      movement: 0,
      status: thru === 0 ? "Waiting" : thru >= tournament.holes ? "Finished" : "Live",
      lastUpdate,
      scores: own,
    };
  });

  const sortKey = (r: LeaderboardRow) => {
    if (tournament.format === "Stableford") return -r.stableford;
    if (tournament.scoring === "Net") return r.toParNet;
    return r.toPar;
  };

  rows.sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b);
    if (ka !== kb) return ka - kb;
    return b.thru - a.thru;
  });

  let prevScore = Number.NaN, prevPos = 0;
  rows.forEach((r, i) => {
    const k = sortKey(r);
    if (k !== prevScore) { prevPos = i + 1; prevScore = k; }
    r.position = prevPos;
    const was = prevPositions?.[r.player.id];
    if (was == null) r.movement = 0;
    else if (was > r.position) r.movement = 1;
    else if (was < r.position) r.movement = -1;
    else r.movement = 0;
  });

  return rows;
}

// ---------- Match Play ----------
export function matchPlayState(
  a: LeaderboardRow,
  b: LeaderboardRow,
  holes: number,
) {
  const scoresA = new Map(a.scores.map((s) => [s.hole, s]));
  const scoresB = new Map(b.scores.map((s) => [s.hole, s]));
  let lead = 0; // + means A up
  let holesPlayed = 0;
  for (let h = 1; h <= holes; h++) {
    const sa = scoresA.get(h); const sb = scoresB.get(h);
    if (!sa || !sb) break;
    holesPlayed = h;
    if (sa.strokes < sb.strokes) lead += 1;
    else if (sa.strokes > sb.strokes) lead -= 1;
  }
  const remaining = holes - holesPlayed;
  const closed = Math.abs(lead) > remaining;
  const label =
    lead === 0
      ? holesPlayed === 0 ? "—" : "AS"
      : `${Math.abs(lead)} ${closed ? `&${remaining}` : "UP"}`;
  return { lead, holesPlayed, remaining, closed, label, leaderName: lead > 0 ? a.player.player_name : lead < 0 ? b.player.player_name : null };
}

// ---------- Data access ----------
export async function createTournament(input: Omit<Tournament, "id" | "code" | "created_at" | "updated_at" | "status"> & { code?: string }) {
  const code = input.code ?? generateJoinCode();
  const { data, error } = await supabase
    .from("tournaments")
    .insert({ ...input, code, status: "Open" })
    .select()
    .single();
  if (error) throw error;
  return data as Tournament;
}

export async function joinTournament(code: string, player_name: string, handicap = 0) {
  const { data: t, error: tErr } = await supabase
    .from("tournaments")
    .select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (tErr) throw tErr;
  if (!t) throw new Error("Tournament not found");
  const { data: p, error: pErr } = await supabase
    .from("tournament_players")
    .insert({ tournament_id: t.id, player_name, handicap })
    .select().single();
  if (pErr) throw pErr;
  return { tournament: t as Tournament, player: p as TournamentPlayer };
}

export async function findTournamentByCode(code: string) {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (error) throw error;
  return data as Tournament | null;
}

export async function listTournaments() {
  const { data, error } = await supabase
    .from("tournaments").select("*").order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []) as Tournament[];
}

export async function loadTournamentBundle(tournamentId: string) {
  const [tRes, pRes, sRes] = await Promise.all([
    supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
    supabase.from("tournament_players").select("*").eq("tournament_id", tournamentId).order("created_at"),
    supabase.from("tournament_scores").select("*").eq("tournament_id", tournamentId),
  ]);
  if (tRes.error) throw tRes.error;
  if (pRes.error) throw pRes.error;
  if (sRes.error) throw sRes.error;
  return {
    tournament: tRes.data as Tournament | null,
    players: (pRes.data ?? []) as TournamentPlayer[],
    scores: (sRes.data ?? []) as TournamentScore[],
  };
}

export async function submitScore(args: {
  tournament_id: string; player_id: string; hole: number; par: number; strokes: number; putts?: number | null;
}) {
  const { data, error } = await supabase
    .from("tournament_scores")
    .upsert(
      { ...args, updated_at: new Date().toISOString() },
      { onConflict: "player_id,hole" },
    )
    .select().single();
  if (error) throw error;
  return data as TournamentScore;
}

export async function updateTournamentStatus(id: string, status: TournamentStatus) {
  const { error } = await supabase.from("tournaments").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// ---------- Live subscription ----------
export function subscribeTournament(tournamentId: string, cb: () => void) {
  const channel = supabase
    .channel(`tournament:${tournamentId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_scores", filter: `tournament_id=eq.${tournamentId}` }, cb)
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_players", filter: `tournament_id=eq.${tournamentId}` }, cb)
    .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` }, cb)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ---------- Evidence pack for AI Director ----------
export function buildEvidencePack(t: Tournament, rows: LeaderboardRow[]) {
  const leader = rows[0] ?? null;
  const movers = [...rows].sort((a, b) => b.movement - a.movement).slice(0, 3);
  const bestRound = [...rows].filter((r) => r.thru >= t.holes).sort((a, b) => a.toPar - b.toPar)[0] ?? null;
  const mostBirdies = [...rows].sort((a, b) => b.birdies - a.birdies)[0] ?? null;
  const cleanest = [...rows].filter((r) => r.thru > 0).sort((a, b) => a.doubles - b.doubles || a.toPar - b.toPar)[0] ?? null;
  return {
    tournament: { name: t.name, course: t.course, format: t.format, scoring: t.scoring, holes: t.holes, par: t.par, status: t.status },
    leader: leader && { name: leader.player.player_name, toPar: leader.toPar, thru: leader.thru, gross: leader.gross },
    movers: movers.filter((m) => m.movement !== 0).map((m) => ({ name: m.player.player_name, movement: m.movement, position: m.position })),
    bestRound: bestRound && { name: bestRound.player.player_name, gross: bestRound.gross, toPar: bestRound.toPar },
    mostBirdies: mostBirdies && mostBirdies.birdies > 0 ? { name: mostBirdies.player.player_name, count: mostBirdies.birdies } : null,
    cleanest: cleanest && { name: cleanest.player.player_name, doubles: cleanest.doubles },
    totalPlayers: rows.length,
    finished: rows.filter((r) => r.status === "Finished").length,
    live: rows.filter((r) => r.status === "Live").length,
  };
}