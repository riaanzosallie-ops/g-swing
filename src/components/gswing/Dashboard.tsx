import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity, MapPin, Video, Briefcase, Trophy, Newspaper, User, Coins, Shirt,
  Target, BarChart3, Swords, MessagesSquare, Film, Radio, Flag, Sparkles,
  Sun, CloudSun, Bot, Play, Wind,
} from "lucide-react";
import { usePlayer } from "@/lib/gswing-store";

const moreTiles = [
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
  { id: "scorecard", label: "Play Round", icon: Play },
  { id: "tournament", label: "Tournaments", icon: Radio },
  { id: "swing", label: "AI Caddie", icon: Bot },
  { id: "stats", label: "Handicap", icon: Target },
];

export const Dashboard = ({ go }: { go: (id: string) => void }) => {
  const [player] = usePlayer();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6 pb-28">
      {/* ===== CINEMATIC HERO ===== */}
      <section className="relative -mx-4 -mt-4 overflow-hidden hero-bg px-4 pt-6 pb-7">
        {/* Course-line silhouette pattern */}
        <svg
          aria-hidden
          viewBox="0 0 400 220"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-44 w-full opacity-[0.18]"
        >
          <defs>
            <linearGradient id="fwy" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#6BFF74" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0F3D2E" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,200 C80,150 160,170 220,140 C290,105 340,120 400,90 L400,220 L0,220 Z" fill="url(#fwy)" />
          <path d="M0,210 C90,180 180,190 260,160 C330,135 370,150 400,135" stroke="#D4AF37" strokeOpacity="0.35" strokeWidth="1" fill="none" />
        </svg>

        {/* Floating sunrise orb */}
        <div className="hero-orb pointer-events-none absolute right-[-40px] top-[-40px] h-40 w-40 rounded-full"
          style={{ background: "radial-gradient(circle, #D4AF37 0%, rgba(212,175,55,0.4) 35%, transparent 70%)" }} />

        {/* Fog layer */}
        <div className="hero-fog pointer-events-none absolute inset-0" />

        {/* Particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="absolute block h-1 w-1 rounded-full bg-gold/60"
              style={{
                left: `${15 + i * 18}%`,
                bottom: `${10 + (i % 2) * 25}%`,
                animation: `hero-particle ${6 + i}s ease-in-out ${i * 1.2}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Flag silhouette */}
        <div className="pointer-events-none absolute bottom-6 right-6 opacity-60">
          <div className="relative">
            <div className="absolute bottom-0 left-3 h-20 w-px bg-gradient-to-t from-gold/70 to-transparent" />
            <Flag className="hero-flag h-5 w-5 text-gold" />
          </div>
        </div>

        {/* Welcome copy */}
        <div className="relative hero-rise">
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold/80">The Living Golf Club</p>
          <h2 className="mt-1 font-serif text-4xl leading-tight text-foreground">
            {greeting},<br />
            <span className="text-gradient-gold">{player.name}</span>
          </h2>
          <p className="mt-2 max-w-[18rem] text-sm text-muted-foreground">
            Your private golf club in your pocket.
          </p>

          <div className="mt-5 flex items-center gap-3">
            <Button
              onClick={() => go("scorecard")}
              className="gradient-gold text-primary-foreground shadow-gold h-12 px-6 text-sm font-semibold tracking-wide"
            >
              <Play className="mr-1.5 h-4 w-4 fill-current" /> Start Round
            </Button>
            <Button
              onClick={() => go("tournament")}
              variant="outline"
              className="h-12 px-5 border-gold/40 text-gold hover:bg-gold/10 hover:text-gold"
            >
              Tournaments
            </Button>
          </div>
        </div>

        <div className="gold-hairline mt-6" />
      </section>

      {/* ===== TODAY'S PLAY GLASS PANEL ===== */}
      <section className="hero-rise glass-panel hero-sweep relative overflow-hidden rounded-3xl p-5" style={{ animationDelay: "120ms" }}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.35em] text-gold/80">Today's Play</p>
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-300/80">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-serif text-xl text-gold">{player.handicap}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Handicap</p>
          </div>
          <div className="border-x border-gold/15">
            <p className="font-serif text-xl text-gold">#2</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rank</p>
          </div>
          <div>
            <p className="font-serif text-xl text-gold">71</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Best</p>
          </div>
        </div>

        <div className="mt-5 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2"><CloudSun className="h-3.5 w-3.5 text-gold" /> Course conditions ready</div>
          <div className="flex items-center gap-2"><Bot className="h-3.5 w-3.5 text-gold" /> AI caddie ACE available</div>
          <div className="flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-gold" /> Live tournament mode enabled</div>
        </div>
      </section>

      {/* ===== ELITE ACTION DOCK ===== */}
      <section className="hero-rise" style={{ animationDelay: "200ms" }}>
        <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.35em] text-gold/70">The Clubhouse</p>
        <div className="grid grid-cols-4 gap-2.5">
          {dock.map((d) => (
            <button
              key={d.id}
              onClick={() => go(d.id)}
              className="glass-chip group flex flex-col items-center gap-1.5 rounded-2xl py-3.5 transition-all active:scale-95 hover:border-gold/50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 group-hover:gradient-gold transition-all">
                <d.icon className="h-4.5 w-4.5 text-gold group-hover:text-primary-foreground" />
              </div>
              <span className="text-[10px] font-medium text-foreground/90">{d.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ===== SIGNATURE CARD ===== */}
      <section className="hero-rise glass-panel rounded-3xl p-5 text-center" style={{ animationDelay: "260ms" }}>
        <Sparkles className="mx-auto h-4 w-4 text-gold" />
        <p className="mt-2 font-serif text-base leading-snug text-foreground">
          Play smarter. Compete live.<br />Improve every round.
        </p>
        <div className="gold-hairline mx-auto mt-4 w-2/3" />
        <p className="mt-3 text-[10px] uppercase tracking-[0.45em] text-gold/70">G&nbsp;Swing</p>
      </section>

      {/* ===== CLUB-LINK earn ===== */}
      <Card className="glass-panel border-gold/30 p-4 shadow-gold">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gradient-gold">
            <Coins className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest text-gold/80">Earn from your clubs</p>
            <h3 className="font-serif text-lg leading-tight">Become a Linker on Club-Link</h3>
            <p className="mt-1 text-xs text-muted-foreground">List your bag for rental when you're not playing. Verified Linkers earn AED 200–800/week.</p>
            <Button onClick={() => go("clublink")} className="mt-3 gradient-gold text-primary-foreground" size="sm">
              Open Club-Link →
            </Button>
          </div>
        </div>
      </Card>

      {/* ===== MORE OF THE CLUB ===== */}
      <section>
        <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.35em] text-gold/70">More of the Club</p>
        <div className="grid grid-cols-2 gap-3">
          {moreTiles.map((t, i) => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              className="group glass-chip relative flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-all hover:border-gold/50 hover:shadow-gold"
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

      <Card className="glass-chip p-4">
        <div className="flex items-center gap-3">
          <Shirt className="h-8 w-8 text-gold" />
          <div className="flex-1">
            <p className="font-serif text-base">Dress Your Game with Golf Fit</p>
            <p className="text-xs text-muted-foreground">Premium golf apparel from the LinkMe ecosystem.</p>
          </div>
          <Button size="sm" variant="outline" className="border-gold/40">Open</Button>
        </div>
      </Card>
    </div>
  );
};