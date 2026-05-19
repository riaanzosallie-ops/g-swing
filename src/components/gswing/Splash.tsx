import splashBg from "@/assets/gswing-splash.jpg";
import { Button } from "@/components/ui/button";
import golfBall from "@/assets/golf-ball.png";
import { Apple, ChevronRight, Mail, Sparkles } from "lucide-react";

export const Splash = ({ onEnter }: { onEnter: () => void }) => (
  <div className="splash-hero relative min-h-screen w-full overflow-hidden bg-background">
    <img src={splashBg} alt="" className="absolute inset-0 h-full w-full object-cover" />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(150_35%_3%/0.18)_0%,hsl(150_35%_3%/0.32)_38%,hsl(150_35%_3%/0.92)_100%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_23%,hsl(45_95%_70%/0.26),transparent_27%),radial-gradient(circle_at_20%_64%,hsl(150_70%_45%/0.24),transparent_34%)]" />
    <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
    <div className="splash-film-grain absolute inset-0" />
    <div className="splash-gold-sweep absolute inset-0" />

    <div className="relative z-10 flex min-h-screen flex-col px-6 pb-8 pt-7">
      <header className="flex items-center justify-between opacity-0 [animation:splash-rise_0.9s_ease-out_0.15s_forwards]">
        <span className="text-[10px] uppercase tracking-[0.34em] text-gold-soft/80">Premium Golf OS</span>
        <span className="text-[10px] uppercase tracking-[0.26em] text-foreground/70">LinkMe</span>
      </header>

      <main className="flex flex-1 flex-col justify-end pb-8">
        <div className="mb-8 flex items-center justify-center">
          <div className="splash-logo relative flex h-44 w-44 items-center justify-center">
            <span className="splash-logo-ring absolute inset-0 rounded-full border border-gold/30" />
            <span className="splash-logo-ring splash-logo-ring-delay absolute inset-5 rounded-full border border-gold/35" />
            <span className="absolute h-28 w-28 rounded-full bg-black/35 shadow-[0_0_80px_hsl(45_80%_58%/0.25)] backdrop-blur-sm" />
            <img src={golfBall} alt="" className="splash-ball absolute h-20 w-20 object-contain drop-shadow-[0_12px_30px_hsl(0_0%_0%/0.65)]" />
            <span className="absolute -bottom-1 font-serif text-5xl font-bold tracking-normal text-gold drop-shadow-[0_8px_28px_hsl(0_0%_0%/0.8)]">
              G
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-black/24 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-gold-soft/90 opacity-0 backdrop-blur-sm [animation:splash-rise_0.9s_ease-out_0.45s_forwards]">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            Live GPS. ACE Caddie. Score.
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
