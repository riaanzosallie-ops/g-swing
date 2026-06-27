import { Card } from "@/components/ui/card";
import { Radio, Trophy, ArrowUp, ArrowDown, Minus, Sparkles } from "lucide-react";
import type { LeaderboardRow, Tournament } from "@/lib/tournament-engine";
import type { LiveMoment } from "@/lib/tournament-moments";

const fmtToPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

type Props = {
  tournament: Tournament;
  rows: LeaderboardRow[];
  moments: LiveMoment[];
  aiSummary?: string | null;
  joinUrl: string;
};

const severityClass: Record<LiveMoment["severity"], string> = {
  elite: "border-gold/60 bg-gold/15 text-gold",
  great: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  good: "border-emerald-300/30 bg-emerald-500/5 text-emerald-200",
  info: "border-gold/15 bg-background/40 text-muted-foreground",
  warn: "border-red-500/30 bg-red-500/10 text-red-300",
};

export const TournamentLiveTV = ({ tournament, rows, moments, aiSummary, joinUrl }: Props) => {
  const leader = rows[0] ?? null;
  const top5 = rows.slice(0, 5);
  const showNet = tournament.scoring !== "Gross";
  const showGross = tournament.scoring !== "Net";

  return (
    <div className="space-y-3">
      {/* Broadcast hero */}
      <Card className="relative overflow-hidden border-gold/40 bg-gradient-to-br from-black via-[hsl(150_40%_5%)] to-[hsl(150_30%_3%)] p-4 shadow-elegant">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-red-300">
                <Radio className="h-3 w-3 animate-pulse" /> Live
              </span>
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-gold">
                {tournament.format}
              </span>
            </div>
            <h2 className="mt-2 truncate font-serif text-xl text-gradient-gold sm:text-2xl">{tournament.name}</h2>
            <p className="truncate text-[11px] text-muted-foreground">{tournament.course} · {tournament.holes}H · Par {tournament.par}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-[0.25em] text-gold/70">Join / Watch</p>
            <p className="font-mono text-2xl font-bold text-gold sm:text-3xl">{tournament.code}</p>
            <p className="mt-0.5 max-w-[140px] truncate text-[9px] text-muted-foreground">{joinUrl}</p>
          </div>
        </div>

        {/* Leader card */}
        {leader ? (
          <div className="mt-4 rounded-2xl border border-gold/30 bg-black/40 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-gold/80">
              <Trophy className="h-3 w-3" /> Tournament Leader
            </div>
            <p className="mt-1 font-serif text-2xl text-gold sm:text-3xl">{leader.player.player_name}</p>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[11px]">
              <Stat label={tournament.format === "Stableford" ? "Pts" : "To Par"}
                value={tournament.format === "Stableford" ? `${leader.stableford}` : fmtToPar(leader.toPar)} />
              {showGross && <Stat label="Gross" value={`${leader.gross || "—"}`} />}
              {showNet && <Stat label="Net" value={`${leader.net || "—"}`} />}
              <Stat label="Thru" value={`${leader.thru}`} />
              <Stat label="Hole" value={leader.thru >= tournament.holes ? "F" : `${leader.thru + 1}`} />
            </div>
          </div>
        ) : (
          <EmptyState />
        )}
      </Card>

      {/* Top 5 */}
      {top5.length > 0 && (
        <Card className="border-gold/20 bg-black/50 p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-gold/80">
            <span>Top 5</span>
            <span>{showGross ? "Gross" : "Net"} · {tournament.format === "Stableford" ? "Pts" : "To Par"}</span>
          </div>
          <ul className="divide-y divide-gold/10">
            {top5.map((r) => (
              <li key={r.player.id} className="grid grid-cols-[28px_1fr_44px_52px] items-center gap-2 py-2">
                <div className="flex items-center gap-1">
                  <span className="font-mono text-sm text-gold">{r.position}</span>
                  {r.movement === 1 && <ArrowUp className="h-3 w-3 text-emerald-400" />}
                  {r.movement === -1 && <ArrowDown className="h-3 w-3 text-red-400" />}
                  {r.movement === 0 && r.thru > 0 && <Minus className="h-3 w-3 text-muted-foreground/50" />}
                </div>
                <p className="truncate font-serif text-sm">{r.player.player_name}</p>
                <span className="text-right font-mono text-xs text-muted-foreground">thru {r.thru}</span>
                <span className="text-right font-mono text-sm text-gold">
                  {tournament.format === "Stableford" ? r.stableford : fmtToPar(showNet ? r.toParNet : r.toPar)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Recent moments */}
      <Card className="border-gold/20 bg-black/50 p-3">
        <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-gold/80">Recent Moments</p>
        {moments.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Waiting for scores to come in.</p>
        ) : (
          <ul className="space-y-2">
            {moments.slice(0, 6).map((m) => (
              <li key={m.id} className={`rounded-xl border px-3 py-2 text-xs ${severityClass[m.severity]}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif text-sm">{m.playerName}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest">{m.label}</span>
                </div>
                <p className="mt-0.5 text-[11px] opacity-80">{m.description}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* AI commentary (only if evidence-backed string already exists) */}
      {aiSummary && (
        <Card className="border-gold/20 bg-black/50 p-3">
          <p className="mb-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-gold/80">
            <Sparkles className="h-3 w-3" /> AI Director
          </p>
          <p className="text-sm leading-relaxed">{aiSummary}</p>
        </Card>
      )}

      {/* Sponsor */}
      <Card className="border-dashed border-gold/20 bg-black/30 p-4 text-center">
        <p className="text-[9px] uppercase tracking-[0.3em] text-gold/70">Presented by</p>
        <p className="mt-1 font-serif text-base text-muted-foreground">Your sponsor here</p>
      </Card>

      <p className="pb-2 text-center text-[10px] uppercase tracking-[0.3em] text-gold/60">
        Powered by G Swing
      </p>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
    <p className="font-mono text-base text-gold">{value}</p>
  </div>
);

const EmptyState = () => (
  <div className="mt-4 rounded-2xl border border-dashed border-gold/25 bg-black/30 p-6 text-center">
    <p className="font-serif text-base text-gold">Waiting for scores to come in.</p>
    <p className="mt-1 text-[11px] text-muted-foreground">The leaderboard will light up the moment the first hole is posted.</p>
  </div>
);