import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity, MapPin, Video, Briefcase, Trophy, Newspaper, User, Coins,
  BarChart3, Swords, MessagesSquare, Film, Radio, Flag, Sparkles,
  CloudSun, Bot, Award, CircleDot, Dumbbell, Check, Circle, Map as MapIcon, Globe2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePlayer, useRounds } from "@/lib/gswing-store";
import { listTournaments, type Tournament } from "@/lib/tournament-engine";
import { LaunchIntro } from "./LaunchIntro";
import { HeroAmbience } from "./HeroAmbience";
import { useBrowserCoords, useGswingWeather } from "@/lib/use-gswing-weather";
import { buildGolfWeatherInsight } from "@/lib/gswing-weather";
import { conditionIcon } from "./WeatherPill";
import { useGswingAdmin } from "@/lib/use-gswing-admin";
import { getActiveCourse, subscribeActiveCourse, type ActiveCourse } from "@/lib/active-course";

const moreTiles = [
  { id: "courses", label: "My Courses", icon: MapIcon, hint: "Activate a course to play" },
  { id: "gps", label: "Live GPS", icon: MapPin, hint: "Satellite course view" },
  { id: "arena", label: "Betting Arena", icon: Swords, hint: "Stake & compete" },
  { id: "live", label: "Live Dashboard", icon: Activity, hint: "Match leaderboard" },
  { id: "memories", label: "Fairway Memories", icon: Film, hint: "AI keepsake collage" },
  { id: "swing", label: "Swing Analysis", icon: Video, hint: "Upload & ACE feedback" },
  { id: "bag", label: "My Bag", icon: Briefcase, hint: "Your clubs & distances" },
  { id: "pros", label: "Pros' Bags", icon: Trophy, hint: "PGA & LIV picks" },
  { id: "chat", label: "Round Chat", icon: MessagesSquare, hint: "Talk after the round" },
  { id: "news", label: "Tour News", icon: Newspaper, hint: "Major events" },
  { id: "stats", label: "Performance", icon: BarChart3, hint: "Your stats" },
  { id: "profile", label: "Profile", icon: User, hint: "Avatar & handicap" },
];

const dock = [
  { id: "tournament", label: "Join Tournament", icon: Radio },
  { id: "swing", label: "Practice", icon: Dumbbell },
  { id: "swing", label: "AI Caddie", icon: Bot },
  { id: "stats", label: "Statistics", icon: BarChart3 },
];

export const Dashboard = ({ go }: { go: (id: string) => void }) => {
  const [player] = usePlayer();
  const [rounds] = useRounds();
  const admin = useGswingAdmin();
  const isAdmin = admin.status === "admin";
  const [activeCourse, setActiveCourseState] = useState<ActiveCourse | null>(() => getActiveCourse());
  useEffect(() => subscribeActiveCourse(setActiveCourseState), []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Optional browser geolocation → Open-Meteo weather (silent fallback)
  const coords = useBrowserCoords();
  const weatherState = useGswingWeather(coords);
  const weatherText =
    weatherState.status === "ready"
      ? `${weatherState.data.temperatureC}°C · ${weatherState.data.conditionLabel}`
      : weatherState.status === "loading"
      ? "Reading conditions…"
      : weatherState.status === "no_location"
      ? "Weather ready when course location is added."
      : "Weather unavailable.";
  const WeatherIcon = weatherState.status === "ready"
    ? conditionIcon(weatherState.data.condition)
    : CloudSun;
  const weatherInsight =
    weatherState.status === "ready" ? buildGolfWeatherInsight(weatherState.data) : null;

  const roundsPlayed = rounds.length;
  const bestScore = roundsPlayed ? Math.min(...rounds.map((r) => r.score)) : null;
  const avgScore = roundsPlayed
    ? Math.round(rounds.reduce((a, r) => a + r.score, 0) / roundsPlayed)
    : null;

  // Real tournament data (evidence-only)
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  useEffect(() => {
    let alive = true;
    listTournaments()
      .then((rows) => { if (alive) setTournaments(rows ?? []); })
      .catch(() => { if (alive) setTournaments([]); });
    return () => { alive = false; };
  }, []);

  const liveTournaments = (tournaments ?? []).filter((t) => t.status === "Live" || t.status === "Open");
  const latestTournament = liveTournaments[0];
  const tournamentLabel =
    tournaments === null
      ? "Checking…"
      : liveTournaments.length === 0
      ? "No live tournaments"
      : `${liveTournaments.length} live · ${latestTournament?.name ?? ""}`.trim();

  // Today's Journey — derived from real round evidence
  const latestRound = rounds[0];
  const activeHoles = latestRound?.holes ?? 0;
  const hasActiveRound = roundsPlayed > 0;
  const journey = [
    { label: "Warm Up", done: hasActiveRound },
    { label: "Start Round", done: hasActiveRound },
    { label: "Complete Front Nine", done: activeHoles >= 9 },
    { label: "Back Nine", done: activeHoles >= 18 },
    { label: "Finish Round", done: activeHoles >= 18 },
    { label: "Review with AI", done: activeHoles >= 18 },
  ];

  // Live Activity — only real events
  const activity: string[] = [];
  if (latestRound) activity.push(`Round completed · ${latestRound.course} · ${latestRound.score}`);
  if (bestScore !== null && latestRound && latestRound.score === bestScore) {
    activity.push(`Personal best · ${bestScore}`);
  } else if (bestScore !== null) {
    activity.push(`Season best · ${bestScore}`);
  }
  if (latestTournament) activity.push(`Tournament · ${latestTournament.name}`);
  if (typeof player.handicap === "number") activity.push(`Handicap · ${player.handicap}`);

  const ribbonText =
    activity.length > 0
      ? activity.join("   ◆   ")
      : "Your next achievement starts with your next round.";

  return (
    <div className="space-y-6 pb-28">
      <LaunchIntro />

      {/* ===== CINEMATIC HERO ===== */}
      <section className="relative -mx-4 -mt-4 overflow-hidden hero-bg px-4 pt-6 pb-8">
        <HeroAmbience />
        <div className="hero-fog pointer-events-none absolute inset-0" />

        <div className="relative hero-rise">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold/80">The Living Golf Club</p>
          <h2 className="mt-1 font-serif text-4xl leading-tight text-foreground">
            {greeting},<br />
            <span className="text-gradient-gold">{player.name}</span>
          </h2>
          <p className="mt-2 max-w-[18rem] text-sm text-muted-foreground">
            Your private golf club in your pocket.
          </p>
        </div>

        <div className="gold-hairline mt-6" />
      </section>

      {/* ===== HERO MEMBER CARD ===== */}
      <section
        className="hero-rise glass-panel hero-sweep tactile-card relative overflow-hidden rounded-[2rem] p-6"
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-gold/80">Welcome back</p>
            <h3 className="mt-1 font-serif text-2xl text-foreground">{player.name}</h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold/70">
              <Award className="h-3 w-3" /> Founding Member
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-emerald-500/5 px-2.5 py-1 text-[9px] uppercase tracking-widest text-emerald-300/90">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            On Course
          </span>
        </div>

        <div className="gold-hairline my-5" />

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-serif text-2xl text-gold">{typeof player.handicap === "number" ? player.handicap : "--"}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">{typeof player.handicap === "number" ? "Handicap" : "Handicap pending"}</p>
          </div>
          <div className="border-x border-gold/15">
            <p className="font-serif text-2xl text-gold">{roundsPlayed || "--"}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">Rounds</p>
          </div>
          <div>
            <p className="font-serif text-2xl text-gold">{bestScore ?? "--"}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">Best</p>
          </div>
        </div>

        <div className="mt-5 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2"><WeatherIcon className="h-3.5 w-3.5 text-gold" /> Conditions</span>
            <span className="text-foreground/80 text-right">{weatherText}</span>
          </div>
          {weatherInsight && (
            <p className="border-t border-gold/10 pt-2 text-[11px] italic text-gold/80">
              {weatherInsight}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-gold" /> Tournament</span>
            <span className="text-foreground/80">{tournamentLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Bot className="h-3.5 w-3.5 text-gold" /> AI Caddie</span>
            <span className="text-foreground/80">{roundsPlayed > 0 ? "Ready · evidence-based" : "Not enough data available"}</span>
          </div>
        </div>
      </section>

      {/* ===== PRIMARY CTA + DOCK ===== */}
      <section className="hero-rise space-y-3" style={{ animationDelay: "180ms" }}>
        <div className="glass-panel flex items-center justify-between gap-3 rounded-2xl border border-gold/25 p-4">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.35em] text-gold/70">Active Course</p>
            {activeCourse ? (
              <>
                <p className="truncate font-serif text-base text-foreground">{activeCourse.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {[activeCourse.city, activeCourse.country].filter(Boolean).join(" · ") || `${activeCourse.holes ?? 18} holes`}
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">No course activated yet.</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {activeCourse ? (
              <>
                <Button size="sm" onClick={() => go("gps")} className="h-7 bg-gold text-black hover:bg-gold/85">Open GPS</Button>
                <button onClick={() => go("courses")} className="text-[10px] text-gold/80 underline underline-offset-2">Change</button>
              </>
            ) : (
              <Button size="sm" onClick={() => go("courses")} className="h-7 bg-gold text-black hover:bg-gold/85">Choose course</Button>
            )}
          </div>
        </div>

        <button
          onClick={() => go("scorecard")}
          className="cta-glow gradient-gold tactile-card group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-3xl px-6 py-5 text-primary-foreground"
        >
          <CircleDot className="h-5 w-5" />
          <span className="font-serif text-lg tracking-wide">Start Round</span>
          <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25 transition-transform duration-700 group-hover:translate-x-[400%]" />
        </button>

        <div className="grid grid-cols-4 gap-2">
          {dock.map((d, i) => (
            <button
              key={`${d.id}-${i}`}
              onClick={() => go(d.id)}
              className="glass-chip tactile-card group flex flex-col items-center gap-1.5 rounded-2xl py-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 group-hover:gradient-gold transition-all">
                <d.icon className="h-4 w-4 text-gold group-hover:text-primary-foreground" />
              </div>
              <span className="text-[10px] font-medium text-foreground/90">{d.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ===== TODAY'S JOURNEY ===== */}
      <section
        className="hero-rise glass-panel tactile-card rounded-3xl p-5"
        style={{ animationDelay: "220ms" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.35em] text-gold/80">Today's Journey</p>
          <Flag className="h-3.5 w-3.5 text-gold" />
        </div>
        <ol className="space-y-2.5">
          {journey.map((step) => (
            <li key={step.label} className="flex items-center gap-3 text-xs">
              {step.done ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Circle className="h-4 w-4 text-gold/50" />
              )}
              <span className={step.done ? "text-foreground" : "text-muted-foreground"}>
                {step.label}
              </span>
            </li>
          ))}
        </ol>
        {!roundsPlayed && (
          <p className="mt-4 border-t border-gold/15 pt-3 text-[11px] italic text-gold/70">
            Your story begins on the first tee.
          </p>
        )}
      </section>

      {/* ===== PREMIUM QUICK STATS ===== */}
      <section className="hero-rise grid grid-cols-2 gap-2.5" style={{ animationDelay: "260ms" }}>
        {[
          { label: typeof player.handicap === "number" ? "Current Handicap" : "Handicap pending", value: typeof player.handicap === "number" ? player.handicap : "--" },
          { label: avgScore !== null ? "Average Score" : "No rounds yet", value: avgScore ?? "--" },
          { label: bestScore !== null ? "Season Best" : "No rounds yet", value: bestScore ?? "--" },
          { label: roundsPlayed ? "Rounds Played" : "No rounds played yet", value: roundsPlayed || "--" },
        ].map((s) => (
          <div key={s.label} className="glass-chip tactile-card rounded-2xl p-4">
            <p className="font-serif text-2xl text-gold">{s.value}</p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </section>

      {/* ===== LIVE ACTIVITY RIBBON ===== */}
      <section
        className="hero-rise glass-chip relative overflow-hidden rounded-full py-2.5"
        style={{ animationDelay: "300ms" }}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />
        <div className="ribbon-track flex whitespace-nowrap text-[11px] tracking-wide text-gold/85">
          <span className="px-6">{ribbonText}</span>
          <span className="px-6">{ribbonText}</span>
        </div>
      </section>

      {/* ===== MORE FROM YOUR CLUB ===== */}
      <section>
        <p className="mb-3 px-1 text-[10px] uppercase tracking-[0.35em] text-gold/70">
          More from Your Club
        </p>

        <div className="grid grid-cols-2 gap-3">
          {[
            ...(isAdmin
              ? [
                  { id: "golfapi", label: "Golf API", icon: Globe2 as any, hint: "GolfAPI.io · sole data source" },
                ]
              : []),
            ...moreTiles,
          ].map((t, i) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "golfapi") { window.location.href = "/gswing/golf-api"; return; }
                go(t.id);
              }}
              className="group glass-chip tactile-card relative flex flex-col items-start gap-2 rounded-2xl p-4 text-left"
              style={{ animation: `hero-rise 0.5s ease-out ${i * 40}ms both` }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary group-hover:gradient-gold transition-all">
                <t.icon className="h-5 w-5 text-gold group-hover:text-primary-foreground" />
              </div>
              <p className="font-serif text-base text-foreground">{t.label}</p>
              <p className="text-[10px] text-muted-foreground">{t.hint}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ===== CLUB-LINK (COMING SOON) — moved to bottom, compact ===== */}
      <section aria-label="Club-Link coming soon">
        <Card className="glass-chip tactile-card border-gold/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/5">
              <Coins className="h-5 w-5 text-gold/80" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-[0.3em] text-gold/70">Club-Link</p>
                <span className="rounded-full border border-gold/40 px-2 py-[1px] text-[9px] uppercase tracking-[0.25em] text-gold/90">
                  Coming Soon
                </span>
              </div>
              <h3 className="mt-1 font-serif text-sm leading-tight text-foreground/90">
                Become a Linker on Club-Link
              </h3>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                List your bag for rental when you're not playing.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled
              className="shrink-0 border-gold/30 text-[11px] text-gold/80"
            >
              Coming Soon
            </Button>
          </div>
        </Card>
      </section>

      {/* ===== CREATOR CREDIT ===== */}
      <footer className="pb-2 pt-1 text-center">
        <div className="gold-hairline mx-auto mb-3 w-16 opacity-60" />
        <p className="text-[10px] uppercase tracking-[0.5em] text-gradient-gold">
          Owner · Creator · Riaanzo
        </p>
      </footer>
    </div>
  );
};