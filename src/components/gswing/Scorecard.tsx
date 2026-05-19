import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Plus,
  Minus,
  Save,
  Trophy,
  Sparkles,
  Flame,
  Coins,
  Share2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { useRounds } from "@/lib/gswing-store";
import { toast } from "sonner";

const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 4, 5, 4, 3, 4, 4];
const PAR_TOTAL = PARS.reduce((a, b) => a + b, 0);

type Player = {
  id: string;
  name: string;
  scores: number[];
  hero?: number;
};

const initials = (name: string) => name.slice(0, 2).toUpperCase();

const seedPlayers = (): Player[] => [
  { id: "p1", name: "Riaan", scores: PARS.map(() => 0) },
  { id: "p2", name: "Nievo", scores: PARS.map(() => 0) },
  { id: "p3", name: "Toto", scores: PARS.map(() => 0) },
  { id: "p4", name: "Docco", scores: PARS.map(() => 0) },
];

export const Scorecard = () => {
  const [players, setPlayers] = useState<Player[]>(seedPlayers());
  const [activeHole, setActiveHole] = useState(0);
  const [skinValue, setSkinValue] = useState(20);
  const [pressActive, setPressActive] = useState(false);
  const [presses, setPresses] = useState<{ hole: number; by: string }[]>([]);
  const [rounds, setRounds] = useRounds();

  const setScore = (playerIndex: number, holeIndex: number, value: number) => {
    setPlayers((arr) =>
      arr.map((player, index) => {
        if (index !== playerIndex) return player;
        const scores = [...player.scores];
        scores[holeIndex] = Math.max(0, value);
        return { ...player, scores };
      }),
    );
  };

  const triggerHero = (playerIndex: number, holeIndex: number) => {
    setPlayers((arr) =>
      arr.map((player, index) => {
        if (index !== playerIndex) return player;
        if (player.hero !== undefined) {
          toast.error(`${player.name} already used Hero Mode`);
          return player;
        }
        const scores = [...player.scores];
        scores[holeIndex] = Math.max(1, (scores[holeIndex] || PARS[holeIndex]) - 1);
        toast.success(`Hero Mode: ${player.name} drops one shot on H${holeIndex + 1}`);
        return { ...player, scores, hero: holeIndex };
      }),
    );
  };

  const board = useMemo(() => {
    return players
      .map((player) => {
        const total = player.scores.reduce((a, b) => a + b, 0);
        const holesPlayed = player.scores.filter((score) => score > 0).length;
        const playedPar = player.scores.reduce(
          (sum, score, index) => (score > 0 ? sum + PARS[index] : sum),
          0,
        );
        const diff = total - playedPar;
        return { ...player, total, holesPlayed, diff };
      })
      .sort((a, b) => {
        if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
        if (a.holesPlayed === 0) return 1;
        if (b.holesPlayed === 0) return -1;
        return a.diff - b.diff || a.total - b.total;
      });
  }, [players]);

  const skins = useMemo(() => {
    const won: Record<string, number> = Object.fromEntries(players.map((player) => [player.id, 0]));
    let carry = 0;
    const carryHoles: number[] = [];

    for (let hole = 0; hole < 18; hole += 1) {
      const holeScores = players.map((player) => player.scores[hole]);
      if (holeScores.some((score) => score === 0)) continue;

      const min = Math.min(...holeScores);
      const winners = players.filter((player) => player.scores[hole] === min);
      if (winners.length === 1) {
        won[winners[0].id] += 1 + carry;
        carry = 0;
      } else {
        carry += 1;
        carryHoles.push(hole + 1);
      }
    }

    return { won, carry, carryHoles };
  }, [players]);

  const completedHoleCount = useMemo(() => {
    return PARS.filter((_, holeIndex) => players.every((player) => player.scores[holeIndex] > 0)).length;
  }, [players]);

  const activeHoleComplete = players.every((player) => player.scores[activeHole] > 0);
  const pressSummary = presses.length;

  const goToHole = (holeIndex: number) => {
    setActiveHole(Math.min(17, Math.max(0, holeIndex)));
  };

  const nextHole = () => {
    if (!activeHoleComplete) {
      toast.error(`Enter all 4 scores for Hole ${activeHole + 1} first`);
      return;
    }

    if (activeHole === 17) {
      toast.success("All 18 holes completed");
      return;
    }

    setActiveHole((hole) => hole + 1);
  };

  const callPress = () => {
    const lowestCurrentScore = [...players]
      .filter((player) => player.scores[activeHole] > 0)
      .sort((a, b) => a.scores[activeHole] - b.scores[activeHole])[0];
    const by = lowestCurrentScore?.name ?? "Group";

    setPresses((arr) => [...arr, { hole: activeHole + 1, by }]);
    setPressActive(true);
    toast.success(`Press called on H${activeHole + 1}`);
  };

  const save = () => {
    if (completedHoleCount < 18) {
      toast.error(`Complete all 18 holes first. ${completedHoleCount}/18 done`);
      return;
    }

    const winner = board[0];
    setRounds([
      {
        id: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        course: "Emirates Majlis",
        score: winner.total,
        par: PAR_TOTAL,
        holes: 18,
      },
      ...rounds,
    ]);
    toast.success(`Round saved: ${winner.name} wins`);
  };

  const shareResult = async () => {
    const winner = board[0];
    const text = `G Swing - ${winner.name} wins at Emirates Majlis (${winner.total}, ${
      winner.diff >= 0 ? "+" : ""
    }${winner.diff}). Skins: ${Object.entries(skins.won)
      .map(([id, n]) => `${players.find((player) => player.id === id)?.name} ${n}`)
      .join(", ")}`;

    try {
      if (navigator.share) await navigator.share({ title: "G Swing Result", text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Result copied");
      }
    } catch {
      // User cancelled native share.
    }
  };

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-gold" />
        <h2 className="font-serif text-2xl text-gradient-gold">Scorecard</h2>
        <Badge variant="outline" className="ml-auto border-gold/40 text-gold">
          H{activeHole + 1}/18
        </Badge>
      </div>

      <Card className="gradient-card border-gold/40 p-4 shadow-gold">
        <div className="mb-2 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold" />
          <p className="font-serif text-sm">Live Leaderboard</p>
        </div>
        <div className="space-y-1.5">
          {board.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 transition-all ${
                index === 0 && player.holesPlayed > 0 ? "border-gold/60 bg-gold/10" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-4 text-center text-xs font-serif ${
                    index === 0 && player.holesPlayed > 0 ? "text-gold" : "text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-gold">
                  {initials(player.name)}
                </div>
                <div>
                  <p className="text-xs">
                    {player.name} {player.hero !== undefined && <Flame className="inline h-3 w-3 text-gold" />}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    Thru {player.holesPlayed} · Skins {skins.won[player.id] ?? 0}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-serif text-base">{player.total || "-"}</p>
                <p className={`text-[10px] ${player.diff <= 0 ? "text-emerald-400" : "text-destructive"}`}>
                  {player.holesPlayed === 0 ? "" : player.diff === 0 ? "E" : player.diff > 0 ? `+${player.diff}` : player.diff}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="gradient-card border-gold/30 p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Hole {activeHole + 1} of 18
            </p>
            <h3 className="font-serif text-2xl text-gold">H{activeHole + 1} · Par {PARS[activeHole]}</h3>
            <p className="text-xs text-muted-foreground">
              Enter all four player scores, then tap Next.
            </p>
          </div>
          <div className="rounded-full border border-gold/30 px-3 py-1 text-xs text-gold">
            {completedHoleCount}/18 done
          </div>
        </div>

        <div className="space-y-2">
          {players.map((player, playerIndex) => {
            const score = player.scores[activeHole];
            const isHero = player.hero === activeHole;

            return (
              <div
                key={player.id}
                className={`rounded-xl border p-3 transition ${
                  isHero ? "border-gold bg-gold/10 shadow-gold" : "border-border bg-background/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-gold">
                    {initials(player.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{player.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {score ? `${score - PARS[activeHole] === 0 ? "Par" : score - PARS[activeHole] > 0 ? `+${score - PARS[activeHole]}` : score - PARS[activeHole]} on this hole` : "Score needed"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScore(playerIndex, activeHole, score - 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"
                      aria-label={`Decrease ${player.name} score`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span
                      className={`w-9 text-center font-serif text-2xl ${
                        score && score < PARS[activeHole]
                          ? "text-emerald-400"
                          : score && score > PARS[activeHole]
                            ? "text-destructive"
                            : "text-gold"
                      }`}
                    >
                      {score || "-"}
                    </span>
                    <button
                      onClick={() => setScore(playerIndex, activeHole, score + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"
                      aria-label={`Increase ${player.name} score`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setScore(playerIndex, activeHole, PARS[activeHole])}
                    className="h-8 flex-1 border-gold/20 text-xs"
                  >
                    Par
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setScore(playerIndex, activeHole, Math.max(1, PARS[activeHole] - 1))}
                    className="h-8 flex-1 border-gold/20 text-xs"
                  >
                    Birdie
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => triggerHero(playerIndex, activeHole)}
                    disabled={player.hero !== undefined}
                    className="h-8 flex-1 border-gold/20 text-xs"
                  >
                    <Sparkles className="mr-1 h-3 w-3 text-gold" />
                    {player.hero !== undefined ? "Used" : "Hero"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <Button
            onClick={() => goToHole(activeHole - 1)}
            variant="outline"
            className="border-gold/40 px-3"
            disabled={activeHole === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={nextHole} className="gradient-gold text-primary-foreground">
            {activeHole === 17 ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finish Hole 18
              </>
            ) : (
              <>
                Next Hole
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          <Button
            onClick={() => goToHole(activeHole + 1)}
            variant="outline"
            className="border-gold/40 px-3"
            disabled={activeHole === 17}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-6 gap-1">
        {PARS.map((par, index) => {
          const done = players.every((player) => player.scores[index] > 0);
          return (
            <button
              key={index}
              onClick={() => goToHole(index)}
              className={`rounded-lg border px-1.5 py-2 text-[10px] transition ${
                activeHole === index
                  ? "border-gold bg-gold/15 text-gold"
                  : done
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-border text-muted-foreground"
              }`}
            >
              H{index + 1}
              <span className="block text-[9px] opacity-70">P{par}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={callPress} variant="outline" className="border-gold/40">
          <Flame className="mr-2 h-4 w-4 text-gold" />
          Press {pressSummary > 0 && `(${pressSummary})`}
        </Button>
        <Button
          onClick={() => {
            setPlayers(seedPlayers());
            setActiveHole(0);
            setPresses([]);
            setPressActive(false);
            toast.success("Scorecard reset");
          }}
          variant="outline"
          className="border-gold/40"
        >
          New Round
        </Button>
      </div>

      <Card className="gradient-card border-gold/20 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-gold" />
            <p className="font-serif text-sm">Skins · AED {skinValue}/hole</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setSkinValue(Math.max(5, skinValue - 5))} className="rounded bg-secondary px-2 text-xs">
              -
            </button>
            <button onClick={() => setSkinValue(skinValue + 5)} className="rounded bg-secondary px-2 text-xs">
              +
            </button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 text-center">
          {players.map((player) => (
            <div key={player.id} className="rounded-lg border border-border p-1.5">
              <p className="text-[9px] text-muted-foreground">{player.name}</p>
              <p className="font-serif text-base text-gold">{skins.won[player.id] ?? 0}</p>
              <p className="text-[9px] text-emerald-400">+{(skins.won[player.id] ?? 0) * skinValue}</p>
            </div>
          ))}
        </div>
        {skins.carry > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Carryover: {skins.carry} skin(s) · holes {skins.carryHoles.join(", ")}
          </p>
        )}
        {pressActive && pressSummary > 0 && (
          <p className="mt-1 text-[10px] text-gold">
            {pressSummary} press bet(s) live · last called on H{presses[presses.length - 1]?.hole}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={save} className="gradient-gold text-primary-foreground">
          <Save className="mr-2 h-4 w-4" />
          Save Round
        </Button>
        <Button onClick={shareResult} variant="outline" className="border-gold/40">
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      </div>

      <div>
        <h3 className="mb-2 font-serif text-lg text-foreground">Round History</h3>
        <div className="space-y-2">
          {rounds.map((round) => (
            <Card key={round.id} className="gradient-card flex items-center justify-between border-gold/10 p-3">
              <div>
                <p className="text-sm text-foreground">{round.course}</p>
                <p className="text-[10px] text-muted-foreground">{round.date}</p>
              </div>
              <div className="text-right">
                <p className="font-serif text-xl text-gold">{round.score}</p>
                <p className="text-[10px] text-muted-foreground">
                  {round.score - round.par >= 0 ? "+" : ""}
                  {round.score - round.par}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
