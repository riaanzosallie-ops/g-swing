import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, MapPin, Video, Briefcase, Trophy, Newspaper, User, Coins, Shirt, Target, BarChart3 } from "lucide-react";
import { usePlayer } from "@/lib/gswing-store";
import courseBg from "@/assets/course-bg.jpg";

const tiles = [
  { id: "gps", label: "Live GPS", icon: MapPin, hint: "Satellite course view" },
  { id: "swing", label: "Swing Analysis", icon: Video, hint: "Upload & ACE feedback" },
  { id: "scorecard", label: "Scorecard", icon: Target, hint: "Track your round" },
  { id: "bag", label: "My Bag", icon: Briefcase, hint: "Your clubs & distances" },
  { id: "pros", label: "Pros' Bags", icon: Trophy, hint: "PGA & LIV picks" },
  { id: "news", label: "Tour News", icon: Newspaper, hint: "Major events" },
  { id: "stats", label: "Performance", icon: BarChart3, hint: "Your stats" },
  { id: "profile", label: "Profile", icon: User, hint: "Avatar & handicap" },
];

export const Dashboard = ({ go }: { go: (id: string) => void }) => {
  const [player] = usePlayer();
  return (
    <div className="space-y-5 pb-28">
      <div className="relative overflow-hidden rounded-3xl border border-gold/20 shadow-elegant">
        <img src={courseBg} alt="" className="h-44 w-full object-cover opacity-60" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">LinkMe Ecosystem</p>
          <h2 className="font-serif text-3xl text-foreground">Welcome back, <span className="text-gradient-gold">{player.name}</span></h2>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>Handicap <span className="text-gold font-semibold">{player.handicap}</span></span>
            <span>Rank <span className="text-gold font-semibold">#2</span></span>
            <span>Best <span className="text-gold font-semibold">71</span></span>
          </div>
        </div>
      </div>

      <Card className="gradient-card border-gold/30 p-4 shadow-gold">
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

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t, i) => (
          <button key={t.id} onClick={() => go(t.id)}
            className="group animate-float-up gradient-card relative flex flex-col items-start gap-2 rounded-2xl border border-gold/15 p-4 text-left transition-all hover:border-gold/50 hover:shadow-gold"
            style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary group-hover:gradient-gold transition-all">
              <t.icon className="h-5 w-5 text-gold group-hover:text-primary-foreground" />
            </div>
            <p className="font-serif text-base text-foreground">{t.label}</p>
            <p className="text-[10px] text-muted-foreground">{t.hint}</p>
          </button>
        ))}
      </div>

      <Card className="gradient-card border-gold/20 p-4">
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