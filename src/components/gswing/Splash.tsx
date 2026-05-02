import splashBg from "@/assets/gswing-splash.jpg";
import { Button } from "@/components/ui/button";
import { Apple, Mail } from "lucide-react";

export const Splash = ({ onEnter }: { onEnter: () => void }) => (
  <div className="relative min-h-screen w-full overflow-hidden">
    <img src={splashBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
    <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/30 to-background" />

    <div className="relative z-10 flex min-h-screen flex-col items-center justify-between px-6 py-12">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
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