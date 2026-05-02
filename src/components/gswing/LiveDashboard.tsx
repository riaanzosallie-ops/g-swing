import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMatch } from "@/lib/gswing-store";
import { Activity, Flag, MapPin, Trophy, Plus, Minus } from "lucide-react";

const totalScore = (s: number[]) => s.reduce((a, b) => a + b, 0);
const parThrough = (par: number[], holes: number) => par.slice(0, holes).reduce((a, b) => a + b, 0);

export const LiveDashboard = ({ go }: { go?: (id: string) => void }) => {
  const [match, setMatch] = useMatch();

  // Live "shot tracking" simulator — distance to pin ticks down
  useEffect(() => {
    if (match.status !== "live") return;
    const t = setInterval(() => {
      setMatch((m) => ({
        ...m,
        players: m.players.map((p) => ({
          ...p,
          distanceToPin: Math.max(4, p.distanceToPin - Math.round(Math.random() * 8)),
        })),
      }));
    }, 2500);
    return () => clearInterval(t);
  }, [match.status, setMatch]);

  const ranked = [...match.players].sort((a, b) => {
    const av = totalScore(a.scores) - parThrough(match.par, a.scores.length);
    const bv = totalScore(b.scores) - parThrough(match.par, b.scores.length);
    return av - bv;
  });

  const adjustScore = (pid: string, delta: number) => {
    setMatch((m) => ({
      ...m,
      players: m.players.map((p) => {
        if (p.id !== pid) return p;
        const scores = [...p.scores];
        const idx = scores.length - 1;
        if (idx < 0) return p;
        scores[idx] = Math.max(1, scores[idx] + delta);
        return { ...p, scores, shots: p.shots + delta };
      }),
    }));
  };

  const submitHole = (pid: string, strokes: number) => {
    setMatch((m) => ({
      ...m,
      players: m.players.map((p) =>
        p.id !== pid
          ? p
          : {
              ...p,
              scores: [...p.scores, strokes],
              currentHole: Math.min(m.holes, p.currentHole + 1),
              distanceToPin: 180 + Math.floor(Math.random() * 80),
              shots: p.shots + strokes,
            },
      ),
    }));
  };

  const finishMatch = () => {
    const winner = ranked[0];
    setMatch((m) => ({ ...m, status: "completed", winnerId: winner.id }));
    go?.("roast");
  };

  return (
    <div className="space-y-4 pb-28">
      <Card className="gradient-card border-gold/30 p-4 shadow-gold">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">Unified Live Dashboard</p>
            <h2 className="font-serif text-xl">{match.course} · {match.type}</h2>
          </div>
          <Badge className="gradient-gold text-primary-foreground">
            <Activity className="mr-1 h-3 w-3" /> {match.status.toUpperCase()}
          </Badge>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span>Stake <span className="text-gold font-semibold">{match.currency} {match.stake}</span></span>
          <span>Holes <span className="text-gold font-semibold">{match.holes}</span></span>
          <span>Players <span className="text-gold font-semibold">{match.players.length}</span></span>
        </div>
      </Card>

      <Card className="gradient-card border-gold/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold" />
          <p className="font-serif text-sm">Live Leaderboard</p>
        </div>
        <div className="space-y-2">
          {ranked.map((p, i) => {
            const t = totalScore(p.scores);
            const par = parThrough(match.par, p.scores.length);
            const diff = t - par;
            return (
              <div key={p.id} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${i === 0 ? "border-gold/60 bg-gold/5" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-5 text-center font-serif ${i === 0 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</span>
                  <div>
                    <p className="text-sm">{p.name} <span className="text-[10px] text-muted-foreground">hcp {p.handicap}</span></p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                      <Flag className="h-3 w-3" /> H{p.currentHole}
                      <MapPin className="h-3 w-3" /> {p.distanceToPin}m
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-serif text-base">{t}</p>
                  <p className={`text-[10px] ${diff <= 0 ? "text-emerald-400" : "text-destructive"}`}>{diff === 0 ? "E" : diff > 0 ? `+${diff}` : diff}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="gradient-card border-gold/20 p-4">
        <p className="mb-3 font-serif text-sm">Score Sync · Hole-by-Hole</p>
        <div className="space-y-3">
          {match.players.map((p) => {
            const par = match.par[p.scores.length] ?? 4;
            const lastIdx = p.scores.length - 1;
            const last = lastIdx >= 0 ? p.scores[lastIdx] : par;
            return (
              <div key={p.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">Next: Hole {Math.min(match.holes, p.currentHole)} · Par {par}</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => adjustScore(p.id, -1)} className="h-8 w-8 p-0"><Minus className="h-3 w-3" /></Button>
                  <span className="w-8 text-center font-serif">{last}</span>
                  <Button size="sm" variant="outline" onClick={() => adjustScore(p.id, +1)} className="h-8 w-8 p-0"><Plus className="h-3 w-3" /></Button>
                  <Button size="sm" className="ml-auto gradient-gold text-primary-foreground" onClick={() => submitHole(p.id, par)}>
                    Submit Par
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => submitHole(p.id, par - 1)}>Birdie</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex gap-2">
        <Button onClick={() => go?.("chat")} variant="outline" className="flex-1 border-gold/30">Round Chat</Button>
        <Button onClick={finishMatch} className="flex-1 gradient-gold text-primary-foreground">Finish & Roast</Button>
      </div>
    </div>
  );
};