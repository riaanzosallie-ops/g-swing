import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Radio, Share2, ChevronLeft, Trophy, Target, Sparkles, Tv2, Users,
  Copy, Play, Lock, CheckCircle2, RefreshCw, Award,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/lib/gswing-store";
import {
  Tournament, TournamentPlayer, TournamentScore, LeaderboardRow,
  loadTournamentBundle, subscribeTournament, buildLeaderboard,
  joinTournament, updateTournamentStatus, buildEvidencePack, matchPlayState,
} from "@/lib/tournament-engine";
import { Leaderboard } from "./Leaderboard";
import { LiveScoringSheet } from "./LiveScoringSheet";
import { TournamentLiveTV } from "./TournamentLiveTV";
import { TournamentAwards } from "./TournamentAwards";
import { buildLiveMoments } from "@/lib/tournament-moments";
import { TournamentBroadcastCenter } from "./TournamentBroadcastCenter";

type Props = { tournamentId: string; spectator?: boolean; onExit: () => void };

export const TournamentDashboard = ({ tournamentId, spectator, onExit }: Props) => {
  const [me] = usePlayer();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [scores, setScores] = useState<TournamentScore[]>([]);
  const prevPosRef = useRef<Record<string, number>>({});
  const [tab, setTab] = useState<"board" | "score" | "broadcast" | "livetv" | "director" | "awards">("board");
  const prevPosForMomentsRef = useRef<Record<string, number>>({});
  const [scoring, setScoring] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const reload = useCallback(async () => {
    const b = await loadTournamentBundle(tournamentId);
    if (b.tournament) setTournament(b.tournament);
    setPlayers(b.players);
    setScores(b.scores);
  }, [tournamentId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const off = subscribeTournament(tournamentId, () => { reload(); });
    return () => { off(); };
  }, [tournamentId, reload]);

  const rows: LeaderboardRow[] = useMemo(() => {
    if (!tournament) return [];
    const out = buildLeaderboard(tournament, players, scores, prevPosRef.current);
    prevPosRef.current = Object.fromEntries(out.map((r) => [r.player.id, r.position]));
    return out;
  }, [tournament, players, scores]);

  const moments = useMemo(() => {
    if (!tournament) return [];
    const list = buildLiveMoments(tournament, players, scores, rows, prevPosForMomentsRef.current);
    prevPosForMomentsRef.current = Object.fromEntries(rows.map((r) => [r.player.id, r.position]));
    return list;
  }, [tournament, players, scores, rows]);

  const myPlayer = useMemo(
    () => players.find((p) => p.player_name.toLowerCase() === me.name.toLowerCase()) ?? null,
    [players, me.name],
  );

  const handleJoinAsMe = async () => {
    if (!tournament) return;
    try {
      await joinTournament(tournament.code, me.name, me.handicap);
      toast.success("Joined tournament");
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleShare = async () => {
    if (!tournament) return;
    const url = `${window.location.origin}/?t=${tournament.code}`;
    const text = `Watch ${tournament.name} live on G Swing — code ${tournament.code}\n${url}`;
    try {
      if (navigator.share) await navigator.share({ title: tournament.name, text, url });
      else { await navigator.clipboard.writeText(text); toast.success("Link copied"); }
    } catch {}
  };

  const copyCode = async () => {
    if (!tournament) return;
    await navigator.clipboard.writeText(tournament.code);
    toast.success(`Code ${tournament.code} copied`);
  };

  const runDirector = async () => {
    if (!tournament) return;
    setAiBusy(true);
    setAiSummary(null);
    try {
      const evidence = buildEvidencePack(tournament, rows);
      const { data, error } = await supabase.functions.invoke("ace-tournament-director", { body: { evidence } });
      if (error) throw error;
      setAiSummary((data as { summary?: string })?.summary ?? "Not enough data available.");
    } catch (e) {
      setAiSummary("Not enough data available.");
      toast.error((e as Error).message);
    } finally { setAiBusy(false); }
  };

  const setStatus = async (s: "Open" | "Live" | "Closed") => {
    if (!tournament) return;
    try { await updateTournamentStatus(tournament.id, s); toast.success(`Status: ${s}`); reload(); }
    catch (e) { toast.error((e as Error).message); }
  };

  if (!tournament) {
    return <div className="py-10 text-center text-xs text-muted-foreground">Loading tournament…</div>;
  }

  const leader = rows[0];
  const next = rows[1];
  const matchView = tournament.format === "MatchPlay" && rows.length >= 2 ? matchPlayState(rows[0], rows[1], tournament.holes) : null;

  return (
    <div className="space-y-3 pb-32">
      {/* Header */}
      <Card className="gradient-card border-gold/30 p-3 shadow-gold">
        <div className="flex items-start gap-2">
          <button onClick={onExit} className="mt-1 rounded-full p-1 text-gold"><ChevronLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {tournament.status === "Live" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-red-400">
                  <Radio className="h-3 w-3 animate-pulse" /> Live
                </span>
              )}
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold">{tournament.format}</span>
              {spectator && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">Spectator</span>}
            </div>
            <h2 className="mt-1 truncate font-serif text-base">{tournament.name}</h2>
            <p className="truncate text-[11px] text-muted-foreground">{tournament.course} · {tournament.holes}H · Par {tournament.par}</p>
          </div>
          <button onClick={copyCode} className="rounded-lg border border-gold/30 px-2 py-1 text-center">
            <p className="text-[9px] uppercase tracking-widest text-gold/80">Code</p>
            <p className="font-mono text-sm text-gold">{tournament.code}</p>
          </button>
        </div>

        {/* Quick stats */}
        <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px]">
          <div className="rounded-lg bg-background/40 py-1">
            <p className="text-muted-foreground">Players</p>
            <p className="font-mono text-gold">{players.length}</p>
          </div>
          <div className="rounded-lg bg-background/40 py-1">
            <p className="text-muted-foreground">Live</p>
            <p className="font-mono text-emerald-400">{rows.filter((r) => r.status === "Live").length}</p>
          </div>
          <div className="rounded-lg bg-background/40 py-1">
            <p className="text-muted-foreground">Finished</p>
            <p className="font-mono text-gold">{rows.filter((r) => r.status === "Finished").length}</p>
          </div>
        </div>

        {/* Header actions */}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button size="sm" variant="outline" className="border-gold/30" onClick={handleShare}>
            <Share2 className="mr-1 h-3 w-3" /> Share
          </Button>
          <Button size="sm" variant="outline" className="border-gold/30" onClick={copyCode}>
            <Copy className="mr-1 h-3 w-3" /> Copy
          </Button>
          <Button size="sm" variant="outline" className="border-gold/30" onClick={reload}>
            <RefreshCw className="mr-1 h-3 w-3" /> Sync
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-6 gap-1 bg-secondary">
          <TabsTrigger value="board" className="text-[10px]"><Trophy className="mr-1 h-3 w-3" />Board</TabsTrigger>
          <TabsTrigger value="score" className="text-[10px]" disabled={spectator}><Target className="mr-1 h-3 w-3" />Score</TabsTrigger>
          <TabsTrigger value="broadcast" className="text-[10px]"><Radio className="mr-1 h-3 w-3" />Cast</TabsTrigger>
          <TabsTrigger value="livetv" className="text-[10px]"><Tv2 className="mr-1 h-3 w-3" />Live TV</TabsTrigger>
          <TabsTrigger value="director" className="text-[10px]"><Sparkles className="mr-1 h-3 w-3" />Dir.</TabsTrigger>
          <TabsTrigger value="awards" className="text-[10px]"><Award className="mr-1 h-3 w-3" />Awards</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-3 space-y-3">
          <Leaderboard tournament={tournament} rows={rows} highlightPlayerId={myPlayer?.id} />
          {matchView && (
            <Card className="gradient-card border-gold/20 p-3">
              <p className="text-[10px] uppercase tracking-widest text-gold/80">Match Play</p>
              <p className="font-serif text-sm">
                {matchView.leaderName ? `${matchView.leaderName} ${matchView.label}` : "All Square"}
                <span className="ml-2 text-xs text-muted-foreground">thru {matchView.holesPlayed}</span>
              </p>
            </Card>
          )}
          {!spectator && !myPlayer && (
            <Button onClick={handleJoinAsMe} className="w-full gradient-gold text-primary-foreground">
              <Users className="mr-2 h-4 w-4" /> Join as {me.name}
            </Button>
          )}
          {!spectator && (
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant="outline" className="border-gold/30" onClick={() => setStatus("Open")}><Users className="mr-1 h-3 w-3" />Open</Button>
              <Button size="sm" variant="outline" className="border-gold/30" onClick={() => setStatus("Live")}><Play className="mr-1 h-3 w-3" />Go Live</Button>
              <Button size="sm" variant="outline" className="border-gold/30" onClick={() => setStatus("Closed")}><Lock className="mr-1 h-3 w-3" />Close</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="score" className="mt-3 space-y-3">
          {myPlayer ? (
            <>
              <Card className="gradient-card border-gold/20 p-3">
                <p className="text-[10px] uppercase tracking-widest text-gold/80">Your Card · {myPlayer.player_name}</p>
                <div className="mt-1 grid grid-cols-4 gap-2 text-center text-xs">
                  <div><p className="text-muted-foreground text-[10px]">Thru</p><p className="font-mono text-gold">{rows.find((r) => r.player.id === myPlayer.id)?.thru ?? 0}</p></div>
                  <div><p className="text-muted-foreground text-[10px]">Gross</p><p className="font-mono text-gold">{rows.find((r) => r.player.id === myPlayer.id)?.gross ?? 0}</p></div>
                  <div><p className="text-muted-foreground text-[10px]">To Par</p><p className="font-mono text-gold">{(() => { const r = rows.find((r) => r.player.id === myPlayer.id); if (!r) return "—"; return r.toPar === 0 ? "E" : r.toPar > 0 ? `+${r.toPar}` : r.toPar; })()}</p></div>
                  <div><p className="text-muted-foreground text-[10px]">Pts</p><p className="font-mono text-gold">{rows.find((r) => r.player.id === myPlayer.id)?.stableford ?? 0}</p></div>
                </div>
              </Card>
              <Button onClick={() => setScoring(true)} className="w-full gradient-gold text-primary-foreground">
                <Target className="mr-2 h-4 w-4" /> Enter Hole Score
              </Button>
            </>
          ) : (
            <Card className="gradient-card border-gold/20 p-4 text-center text-xs text-muted-foreground">
              Join the tournament from the Board tab to start scoring.
            </Card>
          )}
        </TabsContent>

        <TabsContent value="director" className="mt-3 space-y-3">
          <Card className="gradient-card border-gold/20 p-3">
            <p className="text-[10px] uppercase tracking-widest text-gold/80">AI Tournament Director</p>
            <p className="mt-1 text-xs text-muted-foreground">Evidence-only commentary from live scores.</p>
            <Button onClick={runDirector} disabled={aiBusy} className="mt-2 w-full gradient-gold text-primary-foreground">
              <Sparkles className="mr-2 h-4 w-4" /> {aiBusy ? "Calling Director…" : "Generate Live Summary"}
            </Button>
            {aiSummary && (
              <div className="mt-3 rounded-xl border border-gold/15 bg-background/40 p-3 text-sm leading-relaxed">
                {aiSummary}
              </div>
            )}
          </Card>

          {/* Evidence quick chips */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {leader && (
              <Card className="gradient-card border-gold/15 p-3">
                <p className="text-[10px] uppercase tracking-widest text-gold/80">Leader</p>
                <p className="font-serif text-sm">{leader.player.player_name}</p>
                <p className="text-muted-foreground">{leader.toPar === 0 ? "E" : leader.toPar > 0 ? `+${leader.toPar}` : leader.toPar} thru {leader.thru}</p>
              </Card>
            )}
            {next && (
              <Card className="gradient-card border-gold/15 p-3">
                <p className="text-[10px] uppercase tracking-widest text-gold/80">Chasing</p>
                <p className="font-serif text-sm">{next.player.player_name}</p>
                <p className="text-muted-foreground">{next.toPar === 0 ? "E" : next.toPar > 0 ? `+${next.toPar}` : next.toPar} thru {next.thru}</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="broadcast" className="mt-3">
          <TournamentBroadcastCenter
            tournament={tournament}
            players={players}
            scores={scores}
            rows={rows}
            moments={moments}
            onOpenAwards={() => setTab("awards")}
          />
        </TabsContent>

        <TabsContent value="livetv" className="mt-3">
          <TournamentLiveTV
            tournament={tournament}
            rows={rows}
            moments={moments}
            aiSummary={aiSummary}
            joinUrl={`${window.location.origin}/?t=${tournament.code}`}
          />
        </TabsContent>

        <TabsContent value="awards" className="mt-3">
          <TournamentAwards tournament={tournament} rows={rows} prevPositions={prevPosRef.current} />
        </TabsContent>
      </Tabs>

      {/* Sticky action bar (player) */}
      {!spectator && myPlayer && (
        <div className="fixed bottom-16 left-1/2 z-30 w-full max-w-md -translate-x-1/2 px-4">
          <Button onClick={() => setScoring(true)} className="w-full gradient-gold text-primary-foreground shadow-gold">
            <Target className="mr-2 h-4 w-4" /> Enter Score · Hole {(rows.find((r) => r.player.id === myPlayer.id)?.thru ?? 0) + 1}
          </Button>
        </div>
      )}

      <Drawer open={scoring} onOpenChange={setScoring}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="pb-1">
            <DrawerTitle className="font-serif text-base text-gradient-gold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-gold" /> Live Scoring
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-3 pb-6">
            {myPlayer && (
              <LiveScoringSheet
                tournament={tournament}
                player={myPlayer}
                scores={scores.filter((s) => s.player_id === myPlayer.id)}
                onClose={() => setScoring(false)}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};