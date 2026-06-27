import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Radio, Trophy, Sparkles, Flag, Award, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type {
  LeaderboardRow,
  Tournament,
  TournamentPlayer,
  TournamentScore,
} from "@/lib/tournament-engine";
import { buildEvidencePack } from "@/lib/tournament-engine";
import type { LiveMoment } from "@/lib/tournament-moments";
import type { GswingWeather } from "@/lib/gswing-weather";
import { buildGolfWeatherInsight } from "@/lib/gswing-weather";
import { WeatherPill, conditionIcon } from "@/components/gswing/WeatherPill";
import {
  derivePlayerHolePositions,
  deriveCourseProgress,
  deriveBroadcastLowerThirds,
  deriveProjectedLeaders,
} from "@/lib/tournament-broadcast";

type Props = {
  tournament: Tournament;
  players: TournamentPlayer[];
  scores: TournamentScore[];
  rows: LeaderboardRow[];
  moments: LiveMoment[];
  sponsor?: string | null;
  weather?: GswingWeather | null;
  onOpenAwards?: () => void;
};

const fmtPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

export const TournamentBroadcastCenter = ({
  tournament,
  players,
  scores,
  rows,
  moments,
  sponsor,
  weather,
  onOpenAwards,
}: Props) => {
  const progress = useMemo(
    () => deriveCourseProgress(tournament, players, scores),
    [tournament, players, scores],
  );
  const positions = useMemo(
    () => derivePlayerHolePositions(tournament, rows),
    [tournament, rows],
  );
  const lowerThirds = useMemo(
    () => deriveBroadcastLowerThirds(tournament, rows, moments, sponsor ?? null),
    [tournament, rows, moments, sponsor],
  );
  const projected = useMemo(
    () => deriveProjectedLeaders(tournament, rows),
    [tournament, rows],
  );

  // Lower-third rotator
  const [ltIndex, setLtIndex] = useState(0);
  useEffect(() => {
    if (lowerThirds.length === 0) return;
    const id = setInterval(
      () => setLtIndex((i) => (i + 1) % lowerThirds.length),
      4500,
    );
    return () => clearInterval(id);
  }, [lowerThirds.length]);
  const lt = lowerThirds[ltIndex % Math.max(1, lowerThirds.length)];

  // AI Director
  const [directorText, setDirectorText] = useState<string | null>(null);
  const [directorBusy, setDirectorBusy] = useState(false);
  const directorAbort = useRef(false);
  const runDirector = async () => {
    setDirectorBusy(true);
    setDirectorText(null);
    directorAbort.current = false;
    try {
      const evidence = buildEvidencePack(tournament, rows);
      const hasEvidence =
        (evidence.leader ?? null) !== null || (evidence.totalPlayers ?? 0) > 0;
      if (!hasEvidence) {
        setDirectorText("Not enough data available.");
        return;
      }
      const { data, error } = await supabase.functions.invoke(
        "ace-tournament-director",
        { body: { evidence } },
      );
      if (error) throw error;
      if (directorAbort.current) return;
      const summary = (data as { summary?: string })?.summary;
      setDirectorText(summary && summary.trim() ? summary : "Not enough data available.");
    } catch {
      setDirectorText("Not enough data available.");
    } finally {
      setDirectorBusy(false);
    }
  };
  useEffect(() => () => { directorAbort.current = true; }, []);

  const topEight = rows.slice(0, 8);
  const holes = Array.from({ length: tournament.holes }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      {/* 1) Broadcast header */}
      <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(212,175,55,0.10),transparent_60%),linear-gradient(180deg,#05120c_0%,#020805_100%)] p-3 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(212,175,55,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.6)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {tournament.status === "Live" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-red-400">
                  <Radio className="h-3 w-3 animate-pulse" /> Live
                </span>
              ) : (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {tournament.status}
                </span>
              )}
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold">
                {tournament.format}
              </span>
            </div>
            <h2 className="mt-1 truncate font-serif text-base text-foreground">{tournament.name}</h2>
            <p className="truncate text-[11px] text-muted-foreground">
              {tournament.course} · {players.length} player{players.length === 1 ? "" : "s"} · {progress.completedHoles}/{tournament.holes} holes complete
            </p>
          </div>
          <div className="rounded-lg border border-gold/30 px-2 py-1 text-center">
            <p className="text-[9px] uppercase tracking-widest text-gold/80">Code</p>
            <p className="font-mono text-sm text-gold">{tournament.code}</p>
          </div>
        </div>
        <div className="relative mt-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Powered by G-Swing</span>
          <span className="rounded-full border border-dashed border-gold/20 px-2 py-0.5 text-gold/60">
            {sponsor ? `Presented by ${sponsor}` : "Your sponsor here"}
          </span>
        </div>
      </div>

      {/* 2) 3D course flow map */}
      <Card className="relative overflow-hidden border-gold/20 bg-[linear-gradient(180deg,#03110b_0%,#020805_100%)] p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-gold/80">Course Flow</p>
          <p className="text-[10px] text-muted-foreground">Active hole {progress.activeHole}</p>
        </div>
        {scores.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-gold/20 bg-background/40 p-6 text-center text-xs text-muted-foreground">
            Waiting for first tee-off
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto pb-1 [perspective:900px]">
            <div
              className="mx-auto min-w-[640px] origin-bottom"
              style={{ transform: "rotateX(22deg)" }}
            >
              <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-900/40 via-emerald-700/30 to-emerald-900/40">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold/60 to-amber-300/70 shadow-[0_0_18px_rgba(212,175,55,0.45)]"
                  style={{ width: `${Math.round(progress.percent * 100)}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-18 gap-1" style={{ gridTemplateColumns: `repeat(${tournament.holes}, minmax(0,1fr))` }}>
                {holes.map((h) => {
                  const here = positions.filter((p) => p.currentHole === h);
                  const isActive = h === progress.activeHole;
                  const isComplete = h <= progress.completedHoles;
                  return (
                    <div key={h} className="flex flex-col items-center gap-1">
                      <div
                        className={[
                          "flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-mono",
                          isActive
                            ? "border-lime-300/70 bg-lime-400/20 text-lime-200 shadow-[0_0_14px_rgba(163,230,53,0.4)]"
                            : isComplete
                              ? "border-emerald-700/40 bg-emerald-900/30 text-emerald-300/70"
                              : "border-gold/20 bg-background/40 text-gold/80",
                        ].join(" ")}
                      >
                        {h}
                      </div>
                      <div className="flex min-h-[14px] flex-wrap items-center justify-center gap-0.5">
                        {here.slice(0, 4).map((p) => (
                          <span
                            key={p.playerId}
                            title={`${p.playerName} · thru ${p.thru}`}
                            className={[
                              "h-1.5 w-1.5 rounded-full",
                              p.isLeader
                                ? "bg-gold shadow-[0_0_8px_rgba(212,175,55,0.9)]"
                                : "bg-emerald-300/80",
                            ].join(" ")}
                          />
                        ))}
                        {here.length > 4 && (
                          <span className="text-[8px] text-muted-foreground">+{here.length - 4}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 3) Live leaderboard wall */}
      <Card className="border-gold/20 bg-background/40 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-gold/80">Leaderboard Wall</p>
          <Trophy className="h-3 w-3 text-gold/70" />
        </div>
        {topEight.length === 0 ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">Waiting for scorecards</p>
        ) : (
          <ul className="mt-2 divide-y divide-gold/10">
            {topEight.map((r) => {
              const isLeader = r.position === 1 && r.thru > 0;
              const score =
                tournament.format === "Stableford"
                  ? `${r.stableford} pts`
                  : tournament.scoring === "Net"
                    ? fmtPar(r.toParNet)
                    : fmtPar(r.toPar);
              return (
                <li
                  key={r.player.id}
                  className={[
                    "flex items-center justify-between gap-2 py-1.5 text-xs",
                    isLeader ? "rounded-md bg-gold/5 px-1" : "",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={[
                        "w-6 text-center font-mono text-[11px]",
                        isLeader ? "text-gold" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      T{r.position}
                    </span>
                    <span className={["truncate", isLeader ? "text-gold" : "text-foreground"].join(" ")}>
                      {r.player.player_name}
                    </span>
                    {r.movement === 1 && <span className="text-[10px] text-emerald-400">▲</span>}
                    {r.movement === -1 && <span className="text-[10px] text-red-400">▼</span>}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-muted-foreground">thru {r.thru}</span>
                    <span className={isLeader ? "text-gold" : "text-foreground"}>{score}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* 4) Momentum panel */}
      <Card className="border-gold/20 bg-background/40 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-gold/80">Momentum</p>
          <Activity className="h-3 w-3 text-gold/70" />
        </div>
        {moments.length === 0 ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">Waiting for scoring moments.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {moments.slice(0, 5).map((m) => (
              <li key={m.id} className="flex items-start gap-2 text-[11px]">
                <span
                  className={[
                    "mt-1 h-1.5 w-1.5 rounded-full",
                    m.severity === "elite"
                      ? "bg-gold shadow-[0_0_8px_rgba(212,175,55,0.8)]"
                      : m.severity === "great"
                        ? "bg-emerald-300"
                        : m.severity === "good"
                          ? "bg-emerald-500/70"
                          : m.severity === "warn"
                            ? "bg-red-400"
                            : "bg-muted-foreground/60",
                  ].join(" ")}
                />
                <div className="min-w-0">
                  <p className="text-foreground">
                    <span className="font-medium">{m.label}</span>
                    <span className="text-muted-foreground"> · {m.playerName} · H{m.holeNumber}</span>
                  </p>
                  <p className="truncate text-muted-foreground">{m.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 5) AI Director booth */}
      <Card className="border-gold/20 bg-background/40 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-gold/80">AI Director · Booth</p>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] uppercase tracking-widest text-emerald-300">
            Evidence only
          </span>
        </div>
        <Button
          onClick={runDirector}
          disabled={directorBusy}
          size="sm"
          className="mt-2 w-full gradient-gold text-primary-foreground"
        >
          <Sparkles className="mr-2 h-3 w-3" />
          {directorBusy ? "Director thinking…" : "Generate broadcast call"}
        </Button>
        <div className="mt-2 min-h-[44px] rounded-lg border border-gold/15 bg-background/40 p-2 text-xs leading-relaxed">
          {directorText ?? "Tap to call the director. Commentary is built from scorecard evidence only."}
        </div>
      </Card>

      {/* 6) Broadcast lower-third */}
      {/* Course Conditions panel — broadcast graphic */}
      <Card className="border-gold/20 bg-[linear-gradient(180deg,#03110b_0%,#020805_100%)] p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-gold/80">Course Conditions</p>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] uppercase tracking-widest text-emerald-300">
            On-air
          </span>
        </div>
        {weather ? (
          (() => {
            const Icon = conditionIcon(weather.condition);
            return (
              <>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[10px]">
                  <div className="rounded-lg border border-gold/15 bg-background/40 p-2">
                    <Icon className="mx-auto h-4 w-4 text-gold" />
                    <p className="mt-1 font-mono text-sm text-gold">{weather.temperatureC}°</p>
                    <p className="text-muted-foreground">{weather.conditionLabel}</p>
                  </div>
                  <div className="rounded-lg border border-gold/15 bg-background/40 p-2">
                    <p className="text-muted-foreground">Wind</p>
                    <p className="mt-1 font-mono text-sm text-gold">{weather.windSpeedKmh}</p>
                    <p className="text-muted-foreground">km/h {weather.windDirectionLabel}</p>
                  </div>
                  <div className="rounded-lg border border-gold/15 bg-background/40 p-2">
                    <p className="text-muted-foreground">Rain</p>
                    <p className="mt-1 font-mono text-sm text-gold">
                      {weather.rainProbability != null ? `${weather.rainProbability}%` : "—"}
                    </p>
                    <p className="text-muted-foreground">prob.</p>
                  </div>
                  <div className="rounded-lg border border-gold/15 bg-background/40 p-2">
                    <p className="text-muted-foreground">UV</p>
                    <p className="mt-1 font-mono text-sm text-gold">
                      {weather.uvIndex != null ? weather.uvIndex.toFixed(1) : "—"}
                    </p>
                    <p className="text-muted-foreground">index</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] italic text-gold/85">{buildGolfWeatherInsight(weather)}</p>
              </>
            );
          })()
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Course conditions appear when location is available.
          </p>
        )}
        {weather && (
          <div className="mt-2 flex justify-end">
            <WeatherPill w={weather} />
          </div>
        )}
      </Card>

      <div className="relative overflow-hidden rounded-xl border border-gold/25 bg-[linear-gradient(90deg,rgba(0,0,0,0.65),rgba(8,30,20,0.55))] p-3 shadow-[0_20px_40px_-25px_rgba(0,0,0,0.8)]">
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-gold to-amber-300" />
        {lt ? (
          <div key={lt.id} className="ml-2 animate-fade-in">
            <p className="text-[9px] uppercase tracking-[0.18em] text-gold/80">{lt.kind}</p>
            <p className="font-serif text-sm text-foreground">{lt.title}</p>
            <p className="text-[11px] text-muted-foreground">{lt.body}</p>
          </div>
        ) : (
          <div className="ml-2">
            <p className="text-[9px] uppercase tracking-[0.18em] text-gold/80">Code</p>
            <p className="font-serif text-sm text-foreground">{tournament.code}</p>
            <p className="text-[11px] text-muted-foreground">Waiting for scores.</p>
          </div>
        )}
      </div>

      {/* 7) Awards teaser */}
      <Card className="border-gold/20 bg-background/40 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-gold/80">
            {projected.isFinal ? "Final Leaders" : "Projected Leaders"}
          </p>
          <Award className="h-3 w-3 text-gold/70" />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-gold/15 bg-background/40 p-2">
            <p className="text-[10px] text-muted-foreground">Gross</p>
            {projected.gross ? (
              <>
                <p className="font-serif text-sm text-foreground">{projected.gross.name}</p>
                <p className="font-mono text-[11px] text-gold/90">{projected.gross.detail}</p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">No scores yet.</p>
            )}
          </div>
          <div className="rounded-lg border border-gold/15 bg-background/40 p-2">
            <p className="text-[10px] text-muted-foreground">Net</p>
            {projected.net ? (
              <>
                <p className="font-serif text-sm text-foreground">{projected.net.name}</p>
                <p className="font-mono text-[11px] text-gold/90">{projected.net.detail}</p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {tournament.scoring === "Gross" ? "Gross-only event." : "No net data yet."}
              </p>
            )}
          </div>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {projected.isFinal
            ? "Final results — see Awards tab for ceremony."
            : "Final awards calculated from submitted scorecards."}
        </p>
        {onOpenAwards && (
          <Button
            onClick={onOpenAwards}
            size="sm"
            variant="outline"
            className="mt-2 w-full border-gold/30"
          >
            <Flag className="mr-2 h-3 w-3" /> Open Awards
          </Button>
        )}
      </Card>
    </div>
  );
};