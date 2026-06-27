import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trophy, Plus, Radio, Users, ChevronRight, KeyRound } from "lucide-react";
import { usePlayer } from "@/lib/gswing-store";
import {
  Tournament,
  createTournament, findTournamentByCode, joinTournament,
  listTournaments,
} from "@/lib/tournament-engine";

type Props = { onOpen: (tournamentId: string, asSpectator?: boolean) => void };

export const TournamentHub = ({ onOpen }: Props) => {
  const [player] = usePlayer();
  const [list, setList] = useState<Tournament[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("G Swing Open");
  const [course, setCourse] = useState(player.homeCourse || "Sharjah Golf & Shooting Club");
  const [format, setFormat] = useState<"Stroke" | "Stableford" | "MatchPlay">("Stroke");
  const [scoring, setScoring] = useState<"Gross" | "Net" | "Both">("Both");
  const [holes, setHoles] = useState(18);
  const [par, setPar] = useState(72);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"live" | "create" | "join">("live");

  useEffect(() => { listTournaments().then(setList).catch(() => {}); }, []);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const t = await createTournament({
        name, course, format, scoring,
        holes, par, director_id: null, starts_at: null,
      });
      toast.success(`Tournament created. Code ${t.code}`);
      onOpen(t.id);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const handleJoin = async (asSpectator: boolean) => {
    if (!code.trim()) return toast.error("Enter a tournament code");
    setBusy(true);
    try {
      if (asSpectator) {
        const t = await findTournamentByCode(code);
        if (!t) return toast.error("Tournament not found");
        onOpen(t.id, true);
      } else {
        const { tournament } = await joinTournament(code, player.name, player.handicap);
        toast.success(`Joined ${tournament.name}`);
        onOpen(tournament.id);
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 pb-28">
      <Card className="gradient-card border-gold/30 p-4 shadow-gold">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-gold">
            <Trophy className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gold/80">Live Tournament</p>
            <h2 className="font-serif text-lg">G Swing Tournaments</h2>
            <p className="text-xs text-muted-foreground">Run, follow & replay events in real time.</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {(["live", "create", "join"] as const).map((id) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-xl border px-3 py-2 text-xs uppercase tracking-wide transition-colors ${
              tab === id ? "border-gold/60 bg-gold/10 text-gold" : "border-gold/15 text-muted-foreground"
            }`}>
            {id === "live" ? "Live" : id === "create" ? "Create" : "Join"}
          </button>
        ))}
      </div>

      {tab === "live" && (
        <div className="space-y-2">
          {list.length === 0 && (
            <Card className="gradient-card border-gold/15 p-6 text-center text-xs text-muted-foreground">
              No tournaments yet. Create one or join with a code.
            </Card>
          )}
          {list.map((t) => (
            <button key={t.id} onClick={() => onOpen(t.id)}
              className="flex w-full items-center justify-between rounded-2xl border border-gold/15 bg-card p-3 text-left transition hover:border-gold/40">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold">{t.status}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{t.code}</span>
                </div>
                <p className="mt-1 truncate font-serif text-sm">{t.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{t.course} · {t.format} · {t.holes}H</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gold" />
            </button>
          ))}
        </div>
      )}

      {tab === "create" && (
        <Card className="gradient-card border-gold/20 p-4 space-y-3">
          <div>
            <Label className="text-[11px]">Tournament Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-[11px]">Course</Label>
            <Input value={course} onChange={(e) => setCourse(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Stroke">Stroke Play</SelectItem>
                  <SelectItem value="Stableford">Stableford</SelectItem>
                  <SelectItem value="MatchPlay">Match Play</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Scoring</Label>
              <Select value={scoring} onValueChange={(v) => setScoring(v as typeof scoring)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gross">Gross</SelectItem>
                  <SelectItem value="Net">Net</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Holes</Label>
              <Input type="number" value={holes} onChange={(e) => setHoles(+e.target.value || 18)} />
            </div>
            <div>
              <Label className="text-[11px]">Par</Label>
              <Input type="number" value={par} onChange={(e) => setPar(+e.target.value || 72)} />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={busy} className="w-full gradient-gold text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Create Tournament
          </Button>
        </Card>
      )}

      {tab === "join" && (
        <Card className="gradient-card border-gold/20 p-4 space-y-3">
          <div>
            <Label className="text-[11px]">Tournament Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD23"
              className="font-mono text-lg tracking-[0.4em] text-center"
              maxLength={8}
            />
          </div>
          <Button onClick={() => handleJoin(false)} disabled={busy} className="w-full gradient-gold text-primary-foreground">
            <Users className="mr-2 h-4 w-4" /> Join as Player
          </Button>
          <Button onClick={() => handleJoin(true)} disabled={busy} variant="outline" className="w-full border-gold/40">
            <Radio className="mr-2 h-4 w-4" /> Watch as Spectator
          </Button>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <KeyRound className="h-3 w-3" /> Spectators don't need an account.
          </p>
        </Card>
      )}
    </div>
  );
};