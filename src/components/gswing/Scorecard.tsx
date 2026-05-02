import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Plus, Minus, Save } from "lucide-react";
import { useRounds } from "@/lib/gswing-store";
import { toast } from "sonner";

const PARS = [4,4,3,5,4,4,3,4,5,4,3,4,4,5,4,3,4,4];

export const Scorecard = () => {
  const [scores, setScores] = useState<number[]>(PARS.map(() => 0));
  const [, setRounds] = useRounds();
  const [rounds] = useRounds();

  const total = scores.reduce((a, b) => a + b, 0);
  const par = PARS.reduce((a, b) => a + b, 0);
  const set = (i: number, v: number) => { const n = [...scores]; n[i] = Math.max(0, v); setScores(n); };

  const save = () => {
    setRounds([{ id: crypto.randomUUID(), date: new Date().toISOString().slice(0,10), course: "Emirates Majlis", score: total, par, holes: 18 }, ...rounds]);
    toast.success("Round saved");
  };

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-gold" />
        <h2 className="font-serif text-2xl text-gradient-gold">Scorecard</h2>
      </div>

      <Card className="gradient-card border-gold/40 p-4 shadow-gold flex justify-between items-center">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="font-serif text-4xl text-gradient-gold">{total}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">vs Par {par}</p>
          <p className="font-serif text-2xl text-foreground">{total ? (total - par >= 0 ? `+${total - par}` : total - par) : "—"}</p>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {PARS.map((p, i) => (
          <Card key={i} className="gradient-card border-gold/15 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">H{i + 1} · Par {p}</p>
            <div className="mt-1 flex items-center justify-center gap-1">
              <button onClick={() => set(i, scores[i] - 1)} className="rounded bg-secondary p-1"><Minus className="h-3 w-3" /></button>
              <span className="w-6 font-serif text-xl text-gold">{scores[i] || "-"}</span>
              <button onClick={() => set(i, scores[i] + 1)} className="rounded bg-secondary p-1"><Plus className="h-3 w-3" /></button>
            </div>
          </Card>
        ))}
      </div>

      <Button onClick={save} className="w-full gradient-gold text-primary-foreground"><Save className="mr-2 h-4 w-4" /> Save Round</Button>

      <div>
        <h3 className="mb-2 font-serif text-lg text-foreground">Round History</h3>
        <div className="space-y-2">
          {rounds.map((r) => (
            <Card key={r.id} className="gradient-card border-gold/10 p-3 flex justify-between items-center">
              <div>
                <p className="text-sm text-foreground">{r.course}</p>
                <p className="text-[10px] text-muted-foreground">{r.date}</p>
              </div>
              <div className="text-right">
                <p className="font-serif text-xl text-gold">{r.score}</p>
                <p className="text-[10px] text-muted-foreground">{r.score - r.par >= 0 ? "+" : ""}{r.score - r.par}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};