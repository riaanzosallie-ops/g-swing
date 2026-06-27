import { LeaderboardRow, Tournament } from "@/lib/tournament-engine";
import { ArrowDown, ArrowUp, Minus, CircleDot } from "lucide-react";

const fmtToPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

export const Leaderboard = ({
  tournament, rows, compact = false, highlightPlayerId,
}: {
  tournament: Tournament;
  rows: LeaderboardRow[];
  compact?: boolean;
  highlightPlayerId?: string | null;
}) => {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gold/15 bg-card p-6 text-center text-xs text-muted-foreground">
        No players have joined yet. Share the tournament code.
      </div>
    );
  }

  const showNet = tournament.scoring !== "Gross";
  const showGross = tournament.scoring !== "Net";

  return (
    <div className="overflow-hidden rounded-2xl border border-gold/20 bg-card">
      <div className="grid grid-cols-[28px_1fr_38px_42px_42px] items-center gap-1 border-b border-gold/15 px-2 py-2 text-[9px] uppercase tracking-widest text-muted-foreground">
        <span>Pos</span>
        <span>Player</span>
        <span className="text-right">Thru</span>
        <span className="text-right">{tournament.format === "Stableford" ? "Pts" : "ToPar"}</span>
        <span className="text-right">{showGross ? "Gross" : "Net"}</span>
      </div>
      <ul className="divide-y divide-gold/10">
        {rows.map((r) => {
          const me = r.player.id === highlightPlayerId;
          return (
            <li key={r.player.id} className={`grid grid-cols-[28px_1fr_38px_42px_42px] items-center gap-1 px-2 py-2 text-sm ${me ? "bg-gold/10" : ""}`}>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-gold">{r.position}</span>
                {r.movement === 1 && <ArrowUp className="h-3 w-3 text-emerald-400" />}
                {r.movement === -1 && <ArrowDown className="h-3 w-3 text-red-400" />}
                {r.movement === 0 && r.thru > 0 && <Minus className="h-3 w-3 text-muted-foreground/60" />}
              </div>
              <div className="min-w-0">
                <p className="truncate font-serif text-sm">{r.player.player_name}</p>
                {!compact && (
                  <p className="truncate text-[10px] text-muted-foreground">
                    HCP {r.player.handicap} ·{" "}
                    {r.status === "Live" && <span className="inline-flex items-center gap-1 text-emerald-400"><CircleDot className="h-2.5 w-2.5 animate-pulse" /> Live</span>}
                    {r.status === "Finished" && <span className="text-gold">F</span>}
                    {r.status === "Waiting" && <span>Pending</span>}
                  </p>
                )}
              </div>
              <span className="text-right font-mono text-xs text-muted-foreground">{r.thru}</span>
              <span className="text-right font-mono text-sm text-gold">
                {tournament.format === "Stableford"
                  ? r.stableford
                  : fmtToPar(showNet ? r.toParNet : r.toPar)}
              </span>
              <span className="text-right font-mono text-sm">
                {showGross ? r.gross || "—" : r.net || "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};