import splashBg from "@/assets/gswing-splash.jpg";
import { Button } from "@/components/ui/button";
import golfBall from "@/assets/golf-ball.png";
import { Apple, ChevronRight, Mail, Sparkles } from "lucide-react";

export const Splash = ({ onEnter }: { onEnter: () => void }) => (
  <div className="splash-hero relative min-h-screen w-full overflow-hidden bg-background">
    <div className="absolute inset-0 grid grid-cols-2">
      <div
        className="splash-region splash-region-dubai relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: `url(${splashBg})` }}
      />
      <div
        className="splash-region splash-region-sa relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: `url(${splashBg})` }}
      />
    </div>
    <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-gold/45 to-transparent" />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(150_35%_3%/0.18)_0%,hsl(150_35%_3%/0.26)_38%,hsl(150_35%_3%/0.92)_100%)]" />
    <div className="splash-dubai-sa absolute inset-0" />
    <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
    <div className="splash-film-grain absolute inset-0" />
    <div className="splash-gold-sweep absolute inset-0" />

    <div className="relative z-10 flex min-h-screen flex-col px-6 pb-8 pt-7">
      <header className="flex items-center justify-between pr-24 opacity-0 [animation:splash-rise_0.9s_ease-out_0.15s_forwards]">
        <span className="text-[10px] uppercase tracking-[0.34em] text-gold-soft/80">Premium Golf OS</span>
        <span className="text-[10px] uppercase tracking-[0.26em] text-foreground/70">LinkMe</span>
      </header>

      <div className="pointer-events-none absolute left-6 top-24 flex flex-col gap-2 opacity-0 [animation:splash-rise_0.9s_ease-out_0.36s_forwards]">
        <span className="w-fit rounded-full border border-gold/25 bg-black/22 px-3 py-1 text-[9px] uppercase tracking-[0.28em] text-gold-soft/85 backdrop-blur-sm">
          Dubai
        </span>
        <span className="w-fit rounded-full border border-emerald-200/20 bg-black/20 px-3 py-1 text-[9px] uppercase tracking-[0.28em] text-emerald-100/80 backdrop-blur-sm">
          South Africa
        </span>
      </div>

      <div className="splash-corner-mark absolute right-4 top-4 flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-gold/24" />
        <span className="absolute inset-3 rounded-full border border-gold/24" />
        <span className="absolute inset-[25px] rounded-full bg-black/32 backdrop-blur-[2px]" />
        <img src={golfBall} alt="" className="absolute h-10 w-10 object-contain drop-shadow-[0_7px_18px_hsl(0_0%_0%/0.75)]" />
        <span className="absolute bottom-2 font-serif text-3xl font-bold leading-none tracking-normal text-gold drop-shadow-[0_6px_18px_hsl(0_0%_0%/0.8)]">
          G
        </span>
      </div>

      <main className="flex flex-1 flex-col justify-end pb-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-black/24 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-gold-soft/90 opacity-0 backdrop-blur-sm [animation:splash-rise_0.9s_ease-out_0.45s_forwards]">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            Dubai to South Africa
          </div>

          <h1 className="max-w-[11ch] font-serif text-6xl leading-[0.9] tracking-normal text-foreground opacity-0 drop-shadow-[0_18px_40px_hsl(0_0%_0%/0.75)] [animation:splash-rise_0.9s_ease-out_0.62s_forwards]">
            G Swing
          </h1>

          <p className="splash-shine max-w-xs text-sm leading-6 text-gold-soft/90 opacity-0 [animation:splash-rise_0.9s_ease-out_0.82s_forwards]">
            A cinematic golf companion for live course GPS, scoring, swing intelligence, and premium round moments.
          </p>

          <p className="text-[10px] uppercase tracking-[0.28em] text-foreground/65 opacity-0 [animation:splash-rise_0.9s_ease-out_0.96s_forwards]">
            Owner - Creator Riaanzo
          </p>
        </div>
      </main>

      <div className="z-10 w-full space-y-3 opacity-0 [animation:splash-rise_0.9s_ease-out_1.04s_forwards]">
        <Button
          onClick={onEnter}
          className="h-[52px] w-full justify-between rounded-md gradient-gold px-5 text-base font-semibold text-primary-foreground shadow-gold animate-glow-pulse"
        >
          Enter G Swing
          <ChevronRight className="h-5 w-5" />
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-11 rounded-md border-gold/35 bg-black/24 text-foreground backdrop-blur-md">
            <Apple className="mr-2 h-4 w-4" /> Apple
          </Button>
          <Button variant="outline" className="h-11 rounded-md border-gold/35 bg-black/24 text-foreground backdrop-blur-md">
            <Mail className="mr-2 h-4 w-4" /> Google
          </Button>
        </div>
      </div>
    </div>
  </div>
);
