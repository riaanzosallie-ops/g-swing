import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Crown, Sparkles, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import type { LeaderboardRow, Tournament } from "@/lib/tournament-engine";
import { buildAwards, awardsSummaryText, type TournamentAward } from "@/lib/tournament-moments";
import type { GswingWeather } from "@/lib/gswing-weather";
import { TournamentResultsPoster } from "./TournamentResultsPoster";
import { WeatherPill } from "@/components/gswing/WeatherPill";

const iconFor = (key: string) => {
  if (key === "gross_champion") return <Crown className="h-5 w-5 text-gold" />;
  if (key === "net_champion") return <Crown className="h-5 w-5 text-emerald-300" />;
  if (key === "runner_up") return <Medal className="h-5 w-5 text-gold/80" />;
  if (key === "third") return <Medal className="h-5 w-5 text-amber-700" />;
  return <Trophy className="h-5 w-5 text-gold" />;
};

type Props = {
  tournament: Tournament;
  rows: LeaderboardRow[];
  prevPositions?: Record<string, number>;
  weather?: GswingWeather | null;
  sponsor?: string | null;
};

export const TournamentAwards = ({ tournament, rows, prevPositions, weather, sponsor }: Props) => {
  const { awards } = useMemo(
    () => buildAwards(tournament, rows, prevPositions),
    [tournament, rows, prevPositions],
  );
  const [revealed, setRevealed] = useState(false);

  const summary = useMemo(() => awardsSummaryText(tournament, awards), [tournament, awards]);
  const champ = awards.find((a) => a.key === "gross_champion");

  const copy = async () => {
    await navigator.clipboard.writeText(summary);
    toast.success("Results copied");
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: tournament.name, text: summary });
      else await copy();
    } catch { /* user cancelled */ }
  };

  if (awards.length === 0) {
    return (
      <Card className="border-dashed border-gold/25 bg-black/30 p-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-gold/70" />
        <p className="mt-2 font-serif text-base text-gold">Awards ceremony pending</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Final results are calculated from submitted scorecards only.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Winner reveal */}
      {champ && (
        <Card className="relative overflow-hidden border-gold/50 bg-gradient-to-br from-black via-[hsl(45_30%_8%)] to-black p-5 shadow-gold">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-3xl animate-glow-pulse" />
          <div className="relative text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">Champion</p>
            <Crown className="mx-auto mt-2 h-10 w-10 text-gold" />
            <p className={`mt-2 font-serif text-3xl text-gradient-gold transition-all duration-700 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
              {champ.playerName}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{champ.detail}</p>
            {!revealed && (
              <Button onClick={() => setRevealed(true)} className="mt-3 gradient-gold text-primary-foreground">
                Reveal Champion
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Award grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {awards.filter((a) => a.key !== "gross_champion").map((a) => (
          <AwardTile key={a.key} award={a} />
        ))}
      </div>

      {/* Coming soon placeholders */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="border-dashed border-gold/15 bg-black/30 p-3">
          <p className="text-[9px] uppercase tracking-widest text-gold/60">Closest to Pin</p>
          <p className="mt-1 text-xs text-muted-foreground">Coming soon</p>
        </Card>
        <Card className="border-dashed border-gold/15 bg-black/30 p-3">
          <p className="text-[9px] uppercase tracking-widest text-gold/60">Longest Drive</p>
          <p className="mt-1 text-xs text-muted-foreground">Coming soon</p>
        </Card>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="border-gold/30" onClick={copy}>
          <Copy className="mr-2 h-4 w-4" /> Copy Results
        </Button>
        <Button className="gradient-gold text-primary-foreground" onClick={share}>
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
      </div>

      {/* Sponsor thank-you */}
      <Card className="border-dashed border-gold/20 bg-black/30 p-4 text-center">
        <p className="text-[9px] uppercase tracking-[0.3em] text-gold/70">Thank you to our sponsor</p>
        <p className="mt-1 font-serif text-base text-muted-foreground">
          {sponsor ?? "Your sponsor here"}
        </p>
      </Card>

      {weather && (
        <Card className="border-gold/20 bg-black/40 p-3 text-center">
          <p className="text-[9px] uppercase tracking-[0.3em] text-gold/70">Conditions</p>
          <div className="mt-2 flex items-center justify-center">
            <WeatherPill w={weather} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{weather.conditionLabel}</p>
        </Card>
      )}

      <TournamentResultsPoster
        tournament={tournament}
        rows={rows}
        weather={weather ?? null}
        sponsor={sponsor ?? null}
        prevPositions={prevPositions}
      />

      <p className="px-2 text-center text-[10px] text-muted-foreground">
        Final results are calculated from submitted scorecards only.
      </p>
      <p className="pb-2 text-center text-[10px] uppercase tracking-[0.3em] text-gold/60">
        Powered by G Swing
      </p>
    </div>
  );
};

const AwardTile = ({ award }: { award: TournamentAward }) => (
  <Card className="flex items-center gap-3 border-gold/20 bg-black/50 p-3">
    <div className="rounded-xl border border-gold/30 bg-gold/10 p-2">{iconFor(award.key)}</div>
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-widest text-gold/70">{award.title}</p>
      <p className="truncate font-serif text-sm">{award.playerName}</p>
      <p className="truncate text-[11px] text-muted-foreground">{award.detail}</p>
    </div>
  </Card>
);