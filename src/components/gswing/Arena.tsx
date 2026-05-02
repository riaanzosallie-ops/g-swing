import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMatch, type MatchType } from "@/lib/gswing-store";
import { Trophy, Users, Coins, Plus } from "lucide-react";

const TYPES: { id: MatchType; label: string; hint: string }[] = [
  { id: "Stroke", label: "Stroke Play", hint: "Lowest total wins" },
  { id: "Match", label: "Match Play", hint: "Holes won decide" },
  { id: "ClosestPin", label: "Closest to Pin", hint: "Single-hole skin" },
  { id: "LongestDrive", label: "Longest Drive", hint: "Driver duel" },
];

const NEARBY = ["Nievo", "Toto", "Docco", "Khalid", "Jens"];

export const Arena = ({ go }: { go: (id: string) => void }) => {
  const [match, setMatch] = useMatch();
  const [type, setType] = useState<MatchType>(match.type);
  const [stake, setStake] = useState(match.stake);
  const [course, setCourse] = useState(match.course);
  const [invited, setInvited] = useState<string[]>(match.players.slice(1).map((p) => p.name));

  const toggle = (n: string) =>
    setInvited((arr) => (arr.includes(n) ? arr.filter((x) => x !== n) : [...arr, n]));

  const launch = () => {
    setMatch((m) => ({
      ...m,
      type, stake, course, status: "live",
      players: [
        m.players[0],
        ...invited.map((n, i) => ({
          id: `inv-${i}`, name: n, handicap: [8, 12, 6, 14, 10][i % 5],
          scores: [], currentHole: 1, distanceToPin: 200 + i * 10, shots: 0,
        })),
      ],
    }));
    go("live");
  };

  return (
    <div className="space-y-4 pb-28">
      <Card className="gradient-card border-gold/30 p-4 shadow-gold">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-gold" />
          <h2 className="font-serif text-xl">Betting Arena</h2>
          <Badge variant="outline" className="ml-auto border-gold/40 text-gold">Live-synced</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Create a match, invite players, and stake AED. Leaderboard syncs to the unified live dashboard.</p>
      </Card>

      <Card className="gradient-card border-gold/20 p-4 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gold/80">Course</p>
          <Input value={course} onChange={(e) => setCourse(e.target.value)} className="mt-1 bg-input" />
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest text-gold/80">Match Type</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => setType(t.id)}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${type === t.id ? "border-gold bg-gold/10" : "border-border hover:border-gold/40"}`}>
                <p className="font-serif text-sm">{t.label}</p>
                <p className="text-[10px] text-muted-foreground">{t.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest text-gold/80 flex items-center gap-1">
            <Coins className="h-3 w-3" /> Stake (AED)
          </p>
          <Input type="number" value={stake} onChange={(e) => setStake(Number(e.target.value) || 0)} className="mt-1 bg-input" />
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest text-gold/80 flex items-center gap-1">
            <Users className="h-3 w-3" /> Invite Nearby Players
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {NEARBY.map((n) => (
              <button key={n} onClick={() => toggle(n)}
                className={`rounded-full border px-3 py-1 text-xs transition ${invited.includes(n) ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground"}`}>
                {invited.includes(n) ? "✓ " : <Plus className="mr-1 inline h-3 w-3" />}{n}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={launch} className="w-full gradient-gold text-primary-foreground">
          Launch Match → Live Dashboard
        </Button>
      </Card>

      <Card className="gradient-card border-gold/20 p-4">
        <p className="mb-2 font-serif text-sm">Active Match</p>
        <div className="flex items-center justify-between text-xs">
          <div>
            <p>{match.course} · {match.type}</p>
            <p className="text-muted-foreground">{match.players.length} players · {match.currency} {match.stake}</p>
          </div>
          <Button size="sm" onClick={() => go("live")} variant="outline" className="border-gold/40">Open</Button>
        </div>
      </Card>
    </div>
  );
};