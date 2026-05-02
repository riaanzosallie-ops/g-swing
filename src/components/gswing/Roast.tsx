import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMatch } from "@/lib/gswing-store";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Trophy, Share2, Facebook, Instagram, Music2, MessageCircle, Film } from "lucide-react";
import { toast } from "sonner";

const totalScore = (s: number[]) => s.reduce((a, b) => a + b, 0);

export const Roast = () => {
  const [match, setMatch] = useMatch();
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState("");
  const [body, setBody] = useState("");

  const ranked = [...match.players].sort((a, b) => totalScore(a.scores) - totalScore(b.scores));
  const winner = ranked[0];

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ace-roast", {
        body: { match: { ...match, winnerName: winner?.name } },
      });
      if (error) throw error;
      const text: string = data?.text ?? "";
      const cap = text.match(/CAPTION:\s*(.+)$/m)?.[1]?.trim() ?? "Big round on G Swing! ⛳🔥";
      const main = text.replace(/CAPTION:.*$/m, "").trim();
      setCaption(cap);
      setBody(main);
      setMatch((m) => ({ ...m, roast: text }));
    } catch (e: any) {
      toast.error("ACE is busy — try again");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (!match.roast) generate(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    if (match.roast) {
      const cap = match.roast.match(/CAPTION:\s*(.+)$/m)?.[1]?.trim() ?? "";
      setCaption(cap);
      setBody(match.roast.replace(/CAPTION:.*$/m, "").trim());
    }
  }, [match.roast]);

  const share = (network: string) => {
    toast.success(`Shared to ${network}`, { description: caption });
  };

  return (
    <div className="space-y-4 pb-28">
      <Card className="gradient-card border-gold/40 p-4 shadow-gold">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-gold" />
          <p className="font-serif text-lg">Winner · {winner?.name}</p>
          <Badge className="ml-auto gradient-gold text-primary-foreground">+{match.currency} {match.stake * (match.players.length - 1)}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {ranked.map((p, i) => (
            <div key={p.id} className={`rounded-xl border p-2 ${i === 0 ? "border-gold/60 bg-gold/5" : "border-border"}`}>
              <p className="text-sm">{i + 1}. {p.name}</p>
              <p className="text-muted-foreground">Total {totalScore(p.scores)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="gradient-card border-gold/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <p className="font-serif text-sm">ACE Roast & Toast</p>
          <Button size="sm" variant="outline" className="ml-auto border-gold/30" onClick={generate} disabled={loading}>
            {loading ? "Generating…" : "Regenerate"}
          </Button>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {loading && !body ? "ACE is writing your recap…" : body || "Tap regenerate to get ACE's take."}
        </p>
      </Card>

      <Card className="gradient-card border-gold/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Film className="h-4 w-4 text-gold" />
          <p className="font-serif text-sm">Animated Highlight Reel</p>
        </div>
        <div className="relative h-40 overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-emerald-900/40 via-background to-background">
          <div className="animate-glow-pulse absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">G Swing Recap</p>
            <p className="font-serif text-2xl text-gradient-gold">{winner?.name} wins!</p>
            <p className="text-xs text-muted-foreground">{match.course} · {match.type}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Hole 1 Birdie · Hole 6 Skin · Hole 18 Victory</p>
          </div>
        </div>
      </Card>

      <Card className="gradient-card border-gold/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Share2 className="h-4 w-4 text-gold" />
          <p className="font-serif text-sm">Share</p>
        </div>
        <p className="rounded-lg border border-border bg-input/40 p-2 text-xs text-muted-foreground">{caption || "Generating caption…"}</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <Button size="sm" variant="outline" className="border-gold/30" onClick={() => share("Facebook")}><Facebook className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" className="border-gold/30" onClick={() => share("Instagram")}><Instagram className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" className="border-gold/30" onClick={() => share("WhatsApp")}><MessageCircle className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" className="border-gold/30" onClick={() => share("TikTok")}><Music2 className="h-4 w-4" /></Button>
        </div>
      </Card>
    </div>
  );
};