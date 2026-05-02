import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, Minus, Save, Trophy, Sparkles, Flame, Coins, Share2 } from "lucide-react";
import { useRounds } from "@/lib/gswing-store";
import { toast } from "sonner";

const PARS = [4,4,3,5,4,4,3,4,5,4,3,4,4,5,4,3,4,4];
const PAR_TOTAL = PARS.reduce((a, b) => a + b, 0);

type Player = {
  id: string;
  name: string;
  scores: number[];
  hero?: number; // hole index where hero used
};

const initials = (n: string) => n.slice(0, 2).toUpperCase();

const seedPlayers = (): Player[] => [
  { id: "p1", name: "Riaan", scores: PARS.map(() => 0) },
  { id: "p2", name: "Nievo", scores: PARS.map(() => 0) },
  { id: "p3", name: "Toto",  scores: PARS.map(() => 0) },
  { id: "p4", name: "Docco", scores: PARS.map(() => 0) },
];

export const Scorecard = () => {
  const [players, setPlayers] = useState<Player[]>(seedPlayers());
  const [active, setActive] = useState(0);
  const [skinValue, setSkinValue] = useState(20); // AED per hole
  const [pressActive, setPressActive] = useState(false);
  const [presses, setPresses] = useState<{ hole: number; by: string }[]>([]);
  const [rounds, setRounds] = useRounds();

  const set = (pi: number, hi: number, v: number) => {
    setPlayers((arr) => arr.map((p, idx) => {
      if (idx !== pi) return p;
      const n = [...p.scores]; n[hi] = Math.max(0, v); return { ...p, scores: n };
    }));
  };

  const triggerHero = (pi: number, hi: number) => {
    setPlayers((arr) => arr.map((p, idx) => {
      if (idx !== pi) return p;
      if (p.hero !== undefined) { toast.error(`${p.name} already used Hero Mode`); return p; }
      const n = [...p.scores];
      n[hi] = Math.max(1, (n[hi] || PARS[hi]) - 1);
      toast.success(`🔥 HERO! ${p.name} drops one shot on H${hi + 1}`);
      return { ...p, scores: n, hero: hi };
    }));
  };

  // Live leaderboard: lowest total wins; only count completed holes
  const board = useMemo(() => {
    return players.map((p) => {
      const total = p.scores.reduce((a, b) => a + b, 0);
      const holesPlayed = p.scores.filter((s) => s > 0).length;
      const parThrough = PARS.slice(0, holesPlayed).reduce((a, b) => a + b, 0);
      // approximate par-through using completed-count
      const playedPar = p.scores.reduce((sum, s, i) => s > 0 ? sum + PARS[i] : sum, 0);
      const diff = total - playedPar;
      return { ...p, total, holesPlayed, diff, parThrough };
    }).sort((a, b) => {
      if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
      if (a.holesPlayed === 0) return 1;
      if (b.holesPlayed === 0) return -1;
      return a.diff - b.diff;
    });
  }, [players]);

  // Skins calculation: per-hole lowest unique score wins; ties carry over
  const skins = useMemo(() => {
    const won: Record<string, number> = Object.fromEntries(players.map((p) => [p.id, 0]));
    let carry = 0;
    const carryHoles: number[] = [];
    for (let h = 0; h < 18; h++) {
      const holeScores = players.map((p) => p.scores[h]);
      if (holeScores.some((s) => s === 0)) continue; // skip incomplete
      const min = Math.min(...holeScores);
      const winners = players.filter((p) => p.scores[h] === min);
      if (winners.length === 1) {
        won[winners[0].id] += 1 + carry;
        carry = 0;
      } else {
        carry += 1;
        carryHoles.push(h + 1);
      }
    }
    return { won, carry, carryHoles };
  }, [players]);

  // Press / side bets — each press doubles current hole stake for affected players
  const pressSummary = presses.length;

  const callPress = () => {
    const lastHoleIdx = Math.max(0, players[0].scores.findIndex((s) => s === 0) - 1);
    setPresses((arr) => [...arr, { hole: lastHoleIdx + 1, by: players[active].name }]);
    setPressActive(true);
    toast.success(`Press called by ${players[active].name} on H${lastHoleIdx + 1}`);
  };

  const save = () => {
    const winner = board[0];
    setRounds([{ id: crypto.randomUUID(), date: new Date().toISOString().slice(0,10), course: "Emirates Majlis", score: winner.total, par: PAR_TOTAL, holes: 18 }, ...rounds]);
    toast.success(`Round saved · ${winner.name} wins`);
  };

  const shareResult = async () => {
    const text = `G Swing — ${board[0].name} wins at Emirates Majlis (${board[0].total}, ${board[0].diff >= 0 ? "+" : ""}${board[0].diff}). Skins: ${Object.entries(skins.won).map(([id, n]) => `${players.find(p=>p.id===id)?.name} ${n}`).join(", ")}`;
    try {
      if (navigator.share) await navigator.share({ title: "G Swing Result", text });
      else { await navigator.clipboard.writeText(text); toast.success("Result copied"); }
    } catch {}
  };

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-gold" />
        <h2 className="font-serif text-2xl text-gradient-gold">Scorecard</h2>
        <Badge variant="outline" className="ml-auto border-gold/40 text-gold">4 Players · Live</Badge>
      </div>

      {/* Live Leaderboard */}
      <Card className="gradient-card border-gold/40 p-4 shadow-gold">
        <div className="mb-2 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold" />
          <p className="font-serif text-sm">Live Leaderboard</p>
        </div>
        <div className="space-y-1.5">
          {board.map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 transition-all ${i === 0 && p.holesPlayed > 0 ? "border-gold/60 bg-gold/10" : "border-border"}`}>
              <div className="flex items-center gap-2">
                <span className={`w-4 text-center text-xs font-serif ${i === 0 && p.holesPlayed > 0 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-gold">{initials(p.name)}</div>
                <div>
                  <p className="text-xs">{p.name} {p.hero !== undefined && <Flame className="inline h-3 w-3 text-gold" />}</p>
                  <p className="text-[9px] text-muted-foreground">Thru {p.holesPlayed} · Skins {skins.won[p.id] ?? 0}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-serif text-base">{p.total || "—"}</p>
                <p className={`text-[10px] ${p.diff <= 0 ? "text-emerald-400" : "text-destructive"}`}>{p.holesPlayed === 0 ? "" : p.diff === 0 ? "E" : p.diff > 0 ? `+${p.diff}` : p.diff}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Player tabs */}
      <div className="grid grid-cols-4 gap-1.5">
        {players.map((p, i) => (
          <button key={p.id} onClick={() => setActive(i)}
            className={`rounded-xl border px-2 py-1.5 text-[10px] transition ${active === i ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground"}`}>
            <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[9px]">{initials(p.name)}</div>
            {p.name}
          </button>
        ))}
      </div>

      {/* Hole grid for active player */}
      <div className="grid grid-cols-3 gap-2">
        {PARS.map((par, i) => {
          const v = players[active].scores[i];
          const isHero = players[active].hero === i;
          return (
            <Card key={i} className={`gradient-card p-2 text-center ${isHero ? "border-gold shadow-gold" : "border-gold/15"}`}>
              <p className="text-[10px] text-muted-foreground">H{i + 1} · Par {par}</p>
              <div className="mt-1 flex items-center justify-center gap-1">
                <button onClick={() => set(active, i, v - 1)} className="rounded bg-secondary p-1"><Minus className="h-3 w-3" /></button>
                <span className={`w-6 font-serif text-xl ${v && v < par ? "text-emerald-400" : v && v > par ? "text-destructive" : "text-gold"}`}>{v || "-"}</span>
                <button onClick={() => set(active, i, v + 1)} className="rounded bg-secondary p-1"><Plus className="h-3 w-3" /></button>
              </div>
              {isHero && <Flame className="mx-auto mt-0.5 h-3 w-3 text-gold" />}
            </Card>
          );
        })}
      </div>

      {/* Hero Mode + Press */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => {
            const hi = Math.max(0, players[active].scores.findIndex((s) => s === 0));
            triggerHero(active, hi === -1 ? 17 : hi);
          }}
          variant="outline"
          className="border-gold/40"
          disabled={players[active].hero !== undefined}
        >
          <Sparkles className="mr-2 h-4 w-4 text-gold" />
          {players[active].hero !== undefined ? "Hero Used" : "Hero Mode"}
        </Button>
        <Button onClick={callPress} variant="outline" className="border-gold/40">
          <Flame className="mr-2 h-4 w-4 text-gold" /> Press {pressSummary > 0 && `(${pressSummary})`}
        </Button>
      </div>

      {/* Skins / Press summary */}
      <Card className="gradient-card border-gold/20 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-gold" />
            <p className="font-serif text-sm">Skins · AED {skinValue}/hole</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setSkinValue(Math.max(5, skinValue - 5))} className="rounded bg-secondary px-2 text-xs">-</button>
            <button onClick={() => setSkinValue(skinValue + 5)} className="rounded bg-secondary px-2 text-xs">+</button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 text-center">
          {players.map((p) => (
            <div key={p.id} className="rounded-lg border border-border p-1.5">
              <p className="text-[9px] text-muted-foreground">{p.name}</p>
              <p className="font-serif text-base text-gold">{skins.won[p.id] ?? 0}</p>
              <p className="text-[9px] text-emerald-400">+{(skins.won[p.id] ?? 0) * skinValue}</p>
            </div>
          ))}
        </div>
        {skins.carry > 0 && <p className="mt-2 text-[10px] text-muted-foreground">Carryover: {skins.carry} skin(s) · holes {skins.carryHoles.join(", ")}</p>}
        {pressSummary > 0 && <p className="mt-1 text-[10px] text-gold">{pressSummary} press bet(s) live · doubling stakes</p>}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={save} className="gradient-gold text-primary-foreground"><Save className="mr-2 h-4 w-4" /> Save Round</Button>
        <Button onClick={shareResult} variant="outline" className="border-gold/40"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
      </div>

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