import heroBg from "@/assets/gswing-hero-v3.jpg";
import { Apple, ChevronRight, Globe, Lock, ShieldCheck, Target, Trophy, BarChart3, Flag } from "lucide-react";

const Feature = ({
  icon: Icon,
  title,
  sub,
  tint = "gold",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
  tint?: "gold" | "emerald";
}) => (
  <div className="flex flex-col items-center gap-2 text-center">
    <Icon
      className={
        "h-8 w-8 stroke-[1.4] " +
        (tint === "gold" ? "text-gold drop-shadow-[0_0_10px_hsl(var(--gold)/0.35)]" : "text-emerald-300 drop-shadow-[0_0_10px_rgba(110,231,183,0.3)]")
      }
    />
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/95">{title}</div>
    <div className="text-[10px] text-white/70">{sub}</div>
  </div>
);

export const Splash = ({ onEnter }: { onEnter: () => void }) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* Hero background */}
      <img
        src={heroBg}
        alt="Championship golf course at sunrise"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover [animation:splash-pan_40s_ease-in-out_infinite_alternate]"
      />
      {/* Cinematic overlays */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/85" />
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_80%_at_50%_50%,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
      {/* Drifting clouds / light rays */}
      <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen [background:radial-gradient(60%_30%_at_20%_15%,rgba(255,210,140,0.18),transparent_70%),radial-gradient(50%_25%_at_80%_10%,rgba(255,240,200,0.12),transparent_70%)] [animation:splash-clouds_30s_ease-in-out_infinite_alternate]" />

      {/* Top-right LIVE badge */}
      <div className="absolute right-4 top-4 z-20 flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 rounded-full border border-gold/30 bg-black/45 px-3 py-1.5 backdrop-blur-md shadow-[0_4px_18px_rgba(0,0,0,0.5)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[10px] font-semibold tracking-[0.25em] text-white">LIVE</span>
        </div>
        <span className="text-[10px] text-white/70">Global Golf Network</span>
      </div>

      {/* Top-left dot grid accent */}
      <div
        className="absolute left-4 top-4 z-20 h-10 w-16 opacity-60"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--gold)) 1px, transparent 1.4px)",
          backgroundSize: "8px 8px",
        }}
      />

      {/* Main content */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[600px] flex-col items-center px-5 pb-10 pt-10 sm:px-8">
        {/* Logo */}
        <div className="relative mt-2 flex flex-col items-center">
          <div className="relative">
            <span
              className="block text-[120px] font-black leading-none tracking-tight [font-family:Georgia,'Times_New_Roman',serif] text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(180deg,#fff6c9 0%,#f3c969 30%,#a87012 60%,#f5d77a 80%,#7a4d0a 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.55))",
              }}
              aria-hidden
            >
              G
            </span>
            {/* Golf ball inside G */}
            <div
              className="absolute left-1/2 top-1/2 h-[46px] w-[46px] -translate-x-[20%] -translate-y-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, #ffffff 0%, #e8e8e8 40%, #9a9a9a 100%)",
                boxShadow:
                  "inset -6px -8px 14px rgba(0,0,0,0.35), inset 4px 4px 8px rgba(255,255,255,0.7), 0 6px 18px rgba(0,0,0,0.6)",
              }}
              aria-hidden
            >
              {/* dimples */}
              <div
                className="h-full w-full rounded-full opacity-40"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(0,0,0,0.25) 0.8px, transparent 1.2px)",
                  backgroundSize: "6px 6px",
                }}
              />
            </div>
          </div>
          <div
            className="-mt-1 text-[11px] font-semibold uppercase tracking-[0.55em] text-transparent"
            style={{
              backgroundImage: "linear-gradient(180deg,#f5d77a,#a87012)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            Swing
          </div>
        </div>

        {/* Headline */}
        <div className="mt-6 flex flex-col items-center text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.5em] text-white/80">
            Welcome to
          </p>
          <h1
            className="mt-2 text-[44px] sm:text-[56px] font-black leading-none tracking-tight text-transparent [font-family:Georgia,'Times_New_Roman',serif]"
            style={{
              backgroundImage:
                "linear-gradient(180deg,#fff6c9 0%,#f3c969 40%,#a87012 95%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.55))",
            }}
          >
            G-SWING
          </h1>
          <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.35em] text-white/85">
            Where Golf Meets Intelligence
          </p>
        </div>

        {/* Feature glass panel */}
        <div
          className="mt-7 w-full rounded-[32px] border border-gold/25 bg-emerald-950/35 p-5 backdrop-blur-xl"
          style={{
            boxShadow:
              "0 20px 60px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,215,140,0.15)",
          }}
        >
          <div className="grid grid-cols-4 gap-2">
            <Feature icon={Target} title="Play Smarter" sub="AI Powered" />
            <Feature icon={Trophy} title="Compete Live" sub="Tournaments" />
            <Feature icon={BarChart3} title="Track Progress" sub="Stats & Handicap" />
            <Feature icon={Flag} title="Improve Every Round" sub="Insights & Coaching" tint="emerald" />
          </div>
        </div>

        {/* Primary CTA */}
        <button
          onClick={onEnter}
          aria-label="Enter G Swing"
          className="group relative mt-7 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-6 py-4 text-[14px] font-bold uppercase tracking-[0.25em] text-black/85 transition-transform active:scale-[0.98]"
          style={{
            background:
              "linear-gradient(180deg,#ffe89a 0%,#f0c45a 45%,#b87a18 100%)",
            boxShadow:
              "0 14px 40px -10px rgba(240,196,90,0.55), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 0 rgba(120,70,10,0.4)",
          }}
        >
          <span className="relative z-10">Enter G Swing</span>
          <ChevronRight className="relative z-10 h-5 w-5" />
          <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/40 [animation:splash-shine-sweep_3.5s_ease-in-out_infinite]" />
        </button>

        {/* Continue with */}
        <div className="mt-6 flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/40 to-gold/60" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/80">Continue with</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/40 to-gold/60" />
        </div>
        <div className="mt-3 grid w-full grid-cols-2 gap-3">
          <button
            onClick={onEnter}
            aria-label="Continue with Apple"
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-neutral-900 to-black text-sm font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition hover:border-gold/40"
          >
            <Apple className="h-4 w-4" /> Apple
          </button>
          <button
            onClick={onEnter}
            aria-label="Continue with Google"
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-neutral-900 to-black text-sm font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition hover:border-gold/40"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-bold text-black">G</span>
            Google
          </button>
        </div>

        {/* Honest trust row — no fabricated counts */}
        <div className="mt-7 grid w-full grid-cols-3 gap-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gold" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold leading-none">Secure</div>
              <div className="mt-1 text-[10px] text-white/70">Your data</div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Globe className="h-5 w-5 text-emerald-300" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 leading-none">Live GPS</div>
              <div className="mt-1 text-[10px] text-white/70">Mapbox</div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gold" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold leading-none">Private</div>
              <div className="mt-1 text-[10px] text-white/70">Your game</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.35em] text-white/55">
          <Lock className="h-3 w-3 text-gold/80" />
          Secure • Private • Your Game
        </div>
      </div>
    </div>
  );
};