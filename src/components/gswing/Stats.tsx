import { Card } from "@/components/ui/card";
import { useRounds, useSwings } from "@/lib/gswing-store";
import { BarChart3, TrendingDown, Trophy } from "lucide-react";

export const Stats = () => {
  const [rounds] = useRounds();
  const [swings] = useSwings();
  const avg = rounds.length ? Math.round(rounds.reduce((a, r) => a + r.score, 0) / rounds.length) : 0;
  const best = rounds.length ? Math.min(...rounds.map((r) => r.score)) : 0;

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-gold" />
        <h2 className="font-serif text-2xl text-gradient-gold">Performance</h2>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Card className="gradient-card border-gold/20 p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground">Rounds</p>
          <p className="font-serif text-3xl text-gold">{rounds.length}</p>
        </Card>
        <Card className="gradient-card border-gold/20 p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground">Avg</p>
          <p className="font-serif text-3xl text-gold">{avg || "—"}</p>
        </Card>
        <Card className="gradient-card border-gold/20 p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground">Best</p>
          <p className="font-serif text-3xl text-gold">{best || "—"}</p>
        </Card>
      </div>
      <Card className="gradient-card border-gold/20 p-4">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2"><TrendingDown className="h-4 w-4 text-accent" /> Improvement Trend</p>
        <p className="mt-1 text-xs text-muted-foreground">Your average has dropped 2.4 strokes over the last 5 rounds.</p>
      </Card>
      <Card className="gradient-card border-gold/20 p-4">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Trophy className="h-4 w-4 text-gold" /> Swing Reports</p>
        <p className="mt-1 text-xs text-muted-foreground">{swings.length} ACE swing analyses completed.</p>
      </Card>
    </div>
  );
};