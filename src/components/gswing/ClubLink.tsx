import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { useBag } from "@/lib/gswing-store";
import { toast } from "sonner";

export const ClubLink = () => {
  const [bag] = useBag();
  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <Coins className="h-6 w-6 text-gold" />
        <h2 className="font-serif text-2xl text-gradient-gold">Club-Link</h2>
      </div>
      <p className="text-xs text-muted-foreground">Earn from your golf clubs. List your set, verify your profile, and let renters book your bag when you're not playing.</p>

      <Card className="gradient-card border-gold/40 p-4 shadow-gold">
        <p className="text-[10px] uppercase tracking-widest text-gold/80">Estimated Earnings</p>
        <p className="font-serif text-4xl text-gradient-gold">AED 320–680<span className="text-base">/wk</span></p>
        <p className="text-xs text-muted-foreground">Based on your {bag.length}-club set valued at premium tier.</p>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Sparkles, t: "Link Credits", d: "Boost your visibility" },
          { icon: ShieldCheck, t: "Verified", d: "Trust badge for renters" },
          { icon: Coins, t: "Tiered", d: "Earn more at higher tiers" },
        ].map(({ icon: I, t, d }) => (
          <Card key={t} className="gradient-card border-gold/15 p-3 text-center">
            <I className="mx-auto h-5 w-5 text-gold" />
            <p className="mt-1 text-xs font-semibold">{t}</p>
            <p className="text-[10px] text-muted-foreground">{d}</p>
          </Card>
        ))}
      </div>

      <Card className="gradient-card border-gold/20 p-4">
        <p className="font-serif text-base text-foreground">Your Bag (preview listing)</p>
        <ul className="mt-2 space-y-1 text-xs">
          {bag.slice(0, 6).map((c) => (
            <li key={c.id} className="flex justify-between border-b border-gold/10 py-1">
              <span className="text-foreground">{c.name}</span>
              <span className="text-muted-foreground">{c.brand}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Button onClick={() => toast.success("Listing draft created — verification next")} className="w-full h-12 gradient-gold text-primary-foreground shadow-gold">
        Become a Linker <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};