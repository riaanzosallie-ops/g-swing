import splashBg from "@/assets/gswing-splash.jpg";
import golfBall from "@/assets/golf-ball.png";
import { Button } from "@/components/ui/button";
import { Apple, Mail } from "lucide-react";

export const Splash = ({ onEnter }: { onEnter: () => void }) => (
  <div className="relative min-h-screen w-full overflow-hidden">
    <img src={splashBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
    <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/30 to-background" />

    <div className="relative z-10 flex min-h-screen flex-col items-center justify-between px-6 py-12">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="relative flex items-center justify-center">
          <span
            className="font-serif text-[9rem] leading-none text-gradient-gold drop-shadow-[0_10px_40px_hsl(45_85%_55%/0.55)]"
            style={{ fontFamily: "'Playfair Display',serif" }}
          >
            G
          </span>
          <img
            src={golfBall}
            alt=""
            className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 animate-ball-spin drop-shadow-2xl"
          />
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gold/15 blur-3xl" />
        </div>
        <p className="text-sm uppercase tracking-[0.5em] text-gold/85">
          Where Golf Meets Intelligence
        </p>
        <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground/70">
          Powered by the Link-Me Ecosystem
        </p>
      </div>

      <div className="z-10 w-full max-w-sm space-y-3 animate-float-up">
        <Button onClick={onEnter} className="h-12 w-full gradient-gold text-primary-foreground font-semibold shadow-gold animate-glow-pulse">
          Enter G Swing
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="border-gold/40 bg-background/40 backdrop-blur"><Apple className="mr-1" /> Apple</Button>
          <Button variant="outline" className="border-gold/40 bg-background/40 backdrop-blur"><Mail className="mr-1" /> Google</Button>
        </div>
      </div>
    </div>
  </div>
);