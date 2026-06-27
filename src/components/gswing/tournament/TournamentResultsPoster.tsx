import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Crown, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { LeaderboardRow, Tournament } from "@/lib/tournament-engine";
import type { GswingWeather } from "@/lib/gswing-weather";
import { buildAwardsSummary } from "@/lib/tournament-awards";

type Props = {
  tournament: Tournament;
  rows: LeaderboardRow[];
  weather?: GswingWeather | null;
  sponsor?: string | null;
  prevPositions?: Record<string, number>;
};

const fmtPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

export const TournamentResultsPoster = ({
  tournament, rows, weather, sponsor, prevPositions,
}: Props) => {
  const awards = useMemo(
    () => buildAwardsSummary(tournament, rows, prevPositions),
    [tournament, rows, prevPositions],
  );
  const date = useMemo(
    () => new Date(tournament.created_at).toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric",
    }),
    [tournament.created_at],
  );

  const top3 = rows.filter((r) => r.thru > 0).slice(0, 3);

  const summary = useMemo(() => {
    const lines: string[] = [];
    lines.push(`🏆 ${tournament.name}`);
    lines.push(`${tournament.course} · ${tournament.format} · ${date}`);
    lines.push("");
    if (awards.gross) lines.push(`Gross Champion: ${awards.gross.name} (${awards.gross.detail})`);
    if (awards.net) lines.push(`Net Champion: ${awards.net.name} (${awards.net.detail})`);
    if (top3.length) {
      lines.push("");
      lines.push("Top 3:");
      top3.forEach((r, i) => lines.push(`${i + 1}. ${r.player.player_name} — ${r.gross} (${fmtPar(r.toPar)})`));
    }
    if (weather) {
      lines.push("");
      lines.push(`Conditions: ${weather.conditionLabel} · ${weather.temperatureC}°C · wind ${weather.windSpeedKmh} ${weather.windDirectionLabel}`);
    }
    if (sponsor) {
      lines.push("");
      lines.push(`Presented by ${sponsor}`);
    }
    lines.push("");
    lines.push("Powered by G-Swing");
    return lines.join("\n");
  }, [tournament, awards, top3, weather, sponsor, date]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Results copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="space-y-2">
      <Card className="relative overflow-hidden border-gold/40 bg-[radial-gradient(140%_100%_at_0%_0%,rgba(212,175,55,0.18),transparent_55%),linear-gradient(180deg,#03110b_0%,#000_100%)] p-5 shadow-[0_30px_70px_-30px_rgba(212,175,55,0.4)]">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative space-y-3 text-center">
          <p className="text-[9px] uppercase tracking-[0.4em] text-gold/70">Final Results</p>
          <h3 className="font-serif text-xl text-gradient-gold">{tournament.name}</h3>
          <p className="text-[10px] text-muted-foreground">{tournament.course} · {date}</p>

          <div className="gold-hairline mx-auto my-3 w-2/3" />

          {awards.gross ? (
            <div>
              <Crown className="mx-auto h-6 w-6 text-gold" />
              <p className="mt-1 text-[9px] uppercase tracking-widest text-gold/70">Champion</p>
              <p className="font-serif text-lg text-foreground">{awards.gross.name}</p>
              <p className="text-[11px] font-mono text-gold/90">{awards.gross.detail}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Champion calculated from submitted scorecards only.</p>
          )}

          {awards.net && (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-2">
              <p className="text-[9px] uppercase tracking-widest text-emerald-300/80">Net Champion</p>
              <p className="font-serif text-sm text-foreground">{awards.net.name}</p>
              <p className="text-[10px] font-mono text-emerald-300/90">{awards.net.detail}</p>
            </div>
          )}

          {top3.length > 0 && (
            <div className="mx-auto grid w-full grid-cols-3 gap-2 text-center text-[10px]">
              {top3.map((r, i) => (
                <div key={r.player.id} className="rounded-lg border border-gold/15 bg-background/40 p-2">
                  <p className="text-[9px] uppercase tracking-widest text-gold/70">
                    {i === 0 ? "1st" : i === 1 ? "2nd" : "3rd"}
                  </p>
                  <p className="mt-1 truncate font-serif text-xs text-foreground">{r.player.player_name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{r.gross} · {fmtPar(r.toPar)}</p>
                </div>
              ))}
            </div>
          )}

          {weather && (
            <p className="text-[10px] text-muted-foreground">
              Conditions · {weather.conditionLabel} · {weather.temperatureC}°C · wind {weather.windSpeedKmh} {weather.windDirectionLabel}
            </p>
          )}

          <div className="gold-hairline mx-auto my-3 w-2/3" />

          {sponsor ? (
            <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">Presented by {sponsor}</p>
          ) : (
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">Your sponsor here</p>
          )}
          <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.35em] text-gold/70">
            <Trophy className="h-3 w-3" /> Powered by G-Swing
          </div>
        </div>
      </Card>
      <Button onClick={copy} variant="outline" className="w-full border-gold/30">
        <Copy className="mr-2 h-4 w-4" /> Copy results summary
      </Button>
    </div>
  );
};