import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Minus, Plus, Save } from "lucide-react";
import {
  Tournament, TournamentPlayer, TournamentScore,
  submitScore, scoreLabel,
} from "@/lib/tournament-engine";

type Props = {
  tournament: Tournament;
  player: TournamentPlayer;
  scores: TournamentScore[];
  onClose: () => void;
};

export const LiveScoringSheet = ({ tournament, player, scores, onClose }: Props) => {
  const filled = useMemo(() => new Map(scores.map((s) => [s.hole, s])), [scores]);
  const firstEmpty = (() => {
    for (let h = 1; h <= tournament.holes; h++) if (!filled.has(h)) return h;
    return tournament.holes;
  })();
  const [hole, setHole] = useState(firstEmpty);
  const existing = filled.get(hole);
  const defaultPar = existing?.par ?? 4;
  const [par, setPar] = useState(defaultPar);
  const [strokes, setStrokes] = useState(existing?.strokes ?? defaultPar);
  const [busy, setBusy] = useState(false);

  const goHole = (h: number) => {
    const e = filled.get(h);
    setHole(h);
    setPar(e?.par ?? 4);
    setStrokes(e?.strokes ?? (e?.par ?? 4));
  };

  const save = async () => {
    if (strokes < 1) return toast.error("Strokes must be at least 1");
    setBusy(true);
    try {
      await submitScore({
        tournament_id: tournament.id, player_id: player.id, hole, par, strokes,
      });
      toast.success(`Hole ${hole}: ${scoreLabel(strokes, par)}`);
      if (hole < tournament.holes) goHole(hole + 1);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="gradient-card border-gold/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gold/80">Scoring · {player.player_name}</p>
          <h3 className="font-serif text-base">Hole {hole} of {tournament.holes}</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>

      {/* Hole chips */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {Array.from({ length: tournament.holes }, (_, i) => i + 1).map((h) => {
          const e = filled.get(h);
          const active = h === hole;
          return (
            <button key={h} onClick={() => goHole(h)}
              className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-mono ${
                active ? "border-gold bg-gold/15 text-gold" :
                e ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" :
                "border-gold/15 text-muted-foreground"
              }`}>
              {h}{e ? `·${e.strokes}` : ""}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gold/15 bg-background/40 p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Par</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <button onClick={() => setPar(Math.max(3, par - 1))} className="rounded-full bg-secondary p-2"><Minus className="h-4 w-4" /></button>
            <span className="w-10 text-center font-serif text-3xl text-gold">{par}</span>
            <button onClick={() => setPar(Math.min(6, par + 1))} className="rounded-full bg-secondary p-2"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="rounded-xl border border-gold/15 bg-background/40 p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Strokes</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <button onClick={() => setStrokes(Math.max(1, strokes - 1))} className="rounded-full bg-secondary p-3"><Minus className="h-5 w-5" /></button>
            <span className="w-12 text-center font-serif text-3xl text-gold">{strokes}</span>
            <button onClick={() => setStrokes(strokes + 1)} className="rounded-full bg-secondary p-3"><Plus className="h-5 w-5" /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1 text-[10px]">
        {["−2", "−1", "Par", "+1", "+2"].map((lbl, i) => {
          const target = par + (i - 2);
          if (target < 1) return <span key={lbl} />;
          return (
            <button key={lbl} onClick={() => setStrokes(target)}
              className={`rounded-lg border px-1 py-2 ${
                strokes === target ? "border-gold bg-gold/15 text-gold" : "border-gold/15 text-muted-foreground"
              }`}>
              {lbl}<br /><span className="font-mono text-xs">{target}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-gold/20 bg-background/40 p-3 text-center">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Result</p>
        <p className="font-serif text-lg text-gold">{scoreLabel(strokes, par)}</p>
      </div>

      <Button onClick={save} disabled={busy} className="w-full gradient-gold text-primary-foreground">
        <Save className="mr-2 h-4 w-4" /> Save & Next
      </Button>
    </Card>
  );
};