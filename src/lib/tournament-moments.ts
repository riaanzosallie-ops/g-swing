import type { LeaderboardRow, Tournament, TournamentPlayer, TournamentScore } from "./tournament-engine";

export type MomentSeverity = "info" | "good" | "great" | "elite" | "warn";
export type MomentType =
  | "eagle"
  | "birdie"
  | "par"
  | "bogey"
  | "double_plus"
  | "moved_up"
  | "took_lead"
  | "tied_lead"
  | "net_highlight"
  | "final_hole";

export type LiveMoment = {
  id: string;
  type: MomentType;
  playerName: string;
  holeNumber: number;
  label: string;
  description: string;
  severity: MomentSeverity;
  createdAt: string;
};

/** Build evidence-only moments from real stored rows. Never fabricates. */
export function buildLiveMoments(
  tournament: Tournament,
  players: TournamentPlayer[],
  scores: TournamentScore[],
  rows: LeaderboardRow[],
  prevPositions?: Record<string, number>,
  limit = 12,
): LiveMoment[] {
  if (!scores.length) return [];
  const nameOf = new Map(players.map((p) => [p.id, p.player_name]));
  const moments: LiveMoment[] = [];

  const sorted = [...scores].sort((a, b) =>
    (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0),
  );

  for (const s of sorted) {
    const name = nameOf.get(s.player_id);
    if (!name) continue;
    if (s.par && s.strokes > 0) {
      const d = s.strokes - s.par;
      if (d <= -2) {
        moments.push({
          id: `${s.id}-eagle`, type: "eagle", playerName: name, holeNumber: s.hole,
          label: d <= -3 ? "Albatross" : "Eagle",
          description: `${name} carded ${s.strokes} on a par ${s.par} (hole ${s.hole}).`,
          severity: "elite", createdAt: s.updated_at,
        });
      } else if (d === -1) {
        moments.push({
          id: `${s.id}-birdie`, type: "birdie", playerName: name, holeNumber: s.hole,
          label: "Birdie",
          description: `${name} made birdie on hole ${s.hole}.`,
          severity: "great", createdAt: s.updated_at,
        });
      } else if (d === 0) {
        moments.push({
          id: `${s.id}-par`, type: "par", playerName: name, holeNumber: s.hole,
          label: "Par save",
          description: `${name} saved par on hole ${s.hole}.`,
          severity: "good", createdAt: s.updated_at,
        });
      } else if (d === 1) {
        moments.push({
          id: `${s.id}-bogey`, type: "bogey", playerName: name, holeNumber: s.hole,
          label: "Bogey",
          description: `${name} bogeyed hole ${s.hole}.`,
          severity: "info", createdAt: s.updated_at,
        });
      } else if (d >= 2) {
        moments.push({
          id: `${s.id}-dbl`, type: "double_plus", playerName: name, holeNumber: s.hole,
          label: d === 2 ? "Double bogey" : `+${d}`,
          description: `${name} carded ${s.strokes} on hole ${s.hole}.`,
          severity: "warn", createdAt: s.updated_at,
        });
      }
      if (s.hole === tournament.holes) {
        moments.push({
          id: `${s.id}-final`, type: "final_hole", playerName: name, holeNumber: s.hole,
          label: "Finished round",
          description: `${name} completed the final hole.`,
          severity: "info", createdAt: s.updated_at,
        });
      }
    }
  }

  // Movement / lead — only if we have prevPositions reference.
  if (prevPositions) {
    for (const r of rows) {
      const prev = prevPositions[r.player.id];
      if (prev == null) continue;
      if (prev > 1 && r.position === 1) {
        moments.push({
          id: `${r.player.id}-lead-${r.lastUpdate ?? ""}`,
          type: "took_lead", playerName: r.player.player_name, holeNumber: r.thru,
          label: "Took the lead",
          description: `${r.player.player_name} moved to the top of the leaderboard.`,
          severity: "elite", createdAt: r.lastUpdate ?? new Date().toISOString(),
        });
      } else if (prev > r.position) {
        moments.push({
          id: `${r.player.id}-up-${r.lastUpdate ?? ""}`,
          type: "moved_up", playerName: r.player.player_name, holeNumber: r.thru,
          label: `Up to T${r.position}`,
          description: `${r.player.player_name} climbed from ${prev} to ${r.position}.`,
          severity: "good", createdAt: r.lastUpdate ?? new Date().toISOString(),
        });
      }
    }
    // Tied for lead — only if multiple at pos 1
    const leaders = rows.filter((r) => r.position === 1 && r.thru > 0);
    if (leaders.length >= 2) {
      moments.push({
        id: `tied-lead-${leaders.map((l) => l.player.id).join("-")}`,
        type: "tied_lead",
        playerName: leaders.map((l) => l.player.player_name).join(" & "),
        holeNumber: Math.max(...leaders.map((l) => l.thru)),
        label: "Tied for lead",
        description: `${leaders.length} players share the lead.`,
        severity: "great",
        createdAt: leaders.map((l) => l.lastUpdate ?? "").sort().slice(-1)[0] || new Date().toISOString(),
      });
    }
  }

  // Net highlight if net differs meaningfully from gross
  if (tournament.scoring !== "Gross") {
    const netLeader = [...rows].filter((r) => r.thru > 0).sort((a, b) => a.toParNet - b.toParNet)[0];
    if (netLeader && netLeader.player.handicap > 0) {
      moments.push({
        id: `net-${netLeader.player.id}-${netLeader.thru}`,
        type: "net_highlight", playerName: netLeader.player.player_name, holeNumber: netLeader.thru,
        label: "Net leader",
        description: `${netLeader.player.player_name} leads net at ${netLeader.toParNet === 0 ? "E" : netLeader.toParNet > 0 ? `+${netLeader.toParNet}` : netLeader.toParNet}.`,
        severity: "good", createdAt: netLeader.lastUpdate ?? new Date().toISOString(),
      });
    }
  }

  // Dedupe by id and sort newest first
  const seen = new Set<string>();
  const unique = moments.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  unique.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return unique.slice(0, limit);
}

export type TournamentAward = {
  key: string;
  title: string;
  playerName: string;
  detail: string;
};

/** Compute final awards from leaderboard rows. Hides any award lacking evidence. */
export function buildAwards(
  tournament: Tournament,
  rows: LeaderboardRow[],
  prevPositions?: Record<string, number>,
): { awards: TournamentAward[]; toughestHole: { hole: number; avgOverPar: number } | null } {
  const played = rows.filter((r) => r.thru > 0);
  if (played.length === 0) return { awards: [], toughestHole: null };

  const awards: TournamentAward[] = [];
  const fmtPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

  const byGross = [...played].sort((a, b) => a.toPar - b.toPar);
  const champ = byGross[0];
  if (champ) awards.push({
    key: "gross_champion", title: "Gross Champion",
    playerName: champ.player.player_name,
    detail: `${champ.gross} gross · ${fmtPar(champ.toPar)} · thru ${champ.thru}`,
  });

  if (tournament.scoring !== "Gross") {
    const byNet = [...played].sort((a, b) => a.toParNet - b.toParNet);
    const netChamp = byNet[0];
    if (netChamp && netChamp.player.handicap > 0) {
      awards.push({
        key: "net_champion", title: "Net Champion",
        playerName: netChamp.player.player_name,
        detail: `${netChamp.net} net · ${fmtPar(netChamp.toParNet)}`,
      });
    }
  }

  if (byGross[1]) awards.push({
    key: "runner_up", title: "Runner-up",
    playerName: byGross[1].player.player_name,
    detail: `${byGross[1].gross} · ${fmtPar(byGross[1].toPar)}`,
  });
  if (byGross[2]) awards.push({
    key: "third", title: "Third Place",
    playerName: byGross[2].player.player_name,
    detail: `${byGross[2].gross} · ${fmtPar(byGross[2].toPar)}`,
  });

  if (prevPositions) {
    const comeback = [...played]
      .map((r) => ({ r, delta: (prevPositions[r.player.id] ?? r.position) - r.position }))
      .filter((x) => x.delta > 0)
      .sort((a, b) => b.delta - a.delta)[0];
    if (comeback) awards.push({
      key: "best_comeback", title: "Best Comeback",
      playerName: comeback.r.player.player_name,
      detail: `Climbed ${comeback.delta} position${comeback.delta === 1 ? "" : "s"}`,
    });
  }

  const mostBirdies = [...played].sort((a, b) => b.birdies - a.birdies)[0];
  if (mostBirdies && mostBirdies.birdies > 0) awards.push({
    key: "most_birdies", title: "Most Birdies",
    playerName: mostBirdies.player.player_name,
    detail: `${mostBirdies.birdies} birdie${mostBirdies.birdies === 1 ? "" : "s"}`,
  });

  const mostPars = [...played].sort((a, b) => b.pars - a.pars)[0];
  if (mostPars && mostPars.pars > 0) awards.push({
    key: "most_pars", title: "Most Pars",
    playerName: mostPars.player.player_name,
    detail: `${mostPars.pars} par${mostPars.pars === 1 ? "" : "s"}`,
  });

  // Toughest hole — needs scores across players with par
  const holeAgg = new Map<number, { sum: number; n: number }>();
  for (const r of played) {
    for (const s of r.scores) {
      if (!s.par || !s.strokes) continue;
      const a = holeAgg.get(s.hole) ?? { sum: 0, n: 0 };
      a.sum += s.strokes - s.par;
      a.n += 1;
      holeAgg.set(s.hole, a);
    }
  }
  let toughest: { hole: number; avgOverPar: number } | null = null;
  for (const [hole, a] of holeAgg) {
    if (a.n < 2) continue;
    const avg = a.sum / a.n;
    if (!toughest || avg > toughest.avgOverPar) toughest = { hole, avgOverPar: avg };
  }
  if (toughest && toughest.avgOverPar > 0) awards.push({
    key: "toughest_hole", title: "Toughest Hole",
    playerName: `Hole ${toughest.hole}`,
    detail: `Avg ${toughest.avgOverPar >= 0 ? "+" : ""}${toughest.avgOverPar.toFixed(2)} over par`,
  });

  return { awards, toughestHole: toughest };
}

export function awardsSummaryText(t: Tournament, awards: TournamentAward[]): string {
  if (!awards.length) return `${t.name} — final results pending.`;
  const lines = awards.map((a) => `• ${a.title}: ${a.playerName} (${a.detail})`);
  return [`🏆 ${t.name} — Final Results`, `${t.course} · ${t.format}`, "", ...lines, "", "Powered by G Swing"].join("\n");
}