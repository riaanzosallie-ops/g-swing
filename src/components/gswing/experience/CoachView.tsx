import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Brain, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RoundExperienceModel } from "@/lib/experience/experience-engine";
import { buildMomentumReport } from "@/lib/experience/momentum-engine";

interface Props {
  model: RoundExperienceModel;
}

const QUICK_PROMPTS = [
  "What is my biggest miss pattern?",
  "Which club lost me strokes today?",
  "Where do I lose the most strokes — tee, approach, or putting?",
  "How should I practice this week based on this round?",
];

export function CoachView({ model }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<string[]>([]);

  const evidence = useMemo(() => {
    const momentum = buildMomentumReport(model);
    return {
      current_round: {
        round_id: model.round.id,
        course: model.round.course_name,
        holes_played: model.holes.length,
        score_progression: model.score_progression,
      },
      last_5_rounds: [],
      last_10_rounds: [],
      club_distances: model.club_statistics,
      miss_pattern: model.player_statistics.missPattern,
      stats: {
        fairways: {
          hit: model.player_statistics.fairwaysHit,
          attempts: model.player_statistics.fairwayAttempts,
        },
        girs: {
          hit: model.player_statistics.greensInRegulation,
          attempts: model.player_statistics.girAttempts,
        },
        putts: model.player_statistics.putts,
        longest_drive_yards: model.player_statistics.longestDriveYards,
        average_drive_yards: model.player_statistics.averageDriveYards,
        momentum_scores: momentum.scores.map((s) => ({
          key: s.key,
          value: s.value,
        })),
      },
      shots: model.ai_evidence.shots,
    };
  }, [model]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text) return;
    setLoading(true);
    setAnswer(null);
    setCitations([]);
    try {
      const { data, error } = await supabase.functions.invoke("ace-coach", {
        body: { question: text, evidence },
      });
      if (error) throw error;
      const safeAnswer: string =
        typeof data?.answer === "string" ? data.answer : "Not enough data available.";
      const safeCitations: string[] = Array.isArray(data?.citations)
        ? data.citations
        : [];
      setAnswer(safeAnswer);
      setCitations(safeCitations);
    } catch (e) {
      console.error("ace-coach failed", e);
      toast.error("ACE Coach is unavailable right now.");
    } finally {
      setLoading(false);
    }
  };

  const hasEvidence = (evidence.shots?.length ?? 0) > 0;

  return (
    <div className="space-y-3">
      <Card className="relative overflow-hidden border-gold/30 bg-gradient-to-br from-background to-background/60 p-4 shadow-elegant">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/20 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <span className="rounded-full border border-gold/40 bg-gold/10 p-2 text-gold">
            <Brain className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gold-soft">
              AI Coach™
            </p>
            <h3 className="font-serif text-lg text-gradient-gold">
              Ask ACE about your round
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Answers are grounded in your stored shots only. Every claim is cited.
            </p>
          </div>
        </div>
      </Card>

      {!hasEvidence && (
        <Card className="border-gold/20 p-3 text-[11px] text-muted-foreground">
          Not enough data available. Tag at least a few shots and ACE Coach can analyse them here.
        </Card>
      )}

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {QUICK_PROMPTS.map((q) => (
          <Button
            key={q}
            size="sm"
            variant="outline"
            className="shrink-0 border-gold/30 text-[11px]"
            disabled={loading}
            onClick={() => {
              setQuestion(q);
              ask(q);
            }}
          >
            {q}
          </Button>
        ))}
      </div>

      <Card className="border-gold/20 bg-background/60 p-3">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask ACE about this round…"
          className="min-h-[72px] resize-none border-gold/20 bg-background text-sm"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">
            Evidence: {model.shots.length} shots · {model.holes.length} holes
          </span>
          <Button
            size="sm"
            className="gradient-gold text-primary-foreground"
            disabled={loading || !question.trim()}
            onClick={() => ask(question)}
          >
            <Send className="mr-1 h-3 w-3" />
            {loading ? "Thinking…" : "Ask"}
          </Button>
        </div>
      </Card>

      {answer && (
        <Card className="border-gold/20 bg-background/60 p-3">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {answer}
          </p>
          {citations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-gold/10 pt-2">
              {citations.map((c) => (
                <Badge
                  key={c}
                  variant="outline"
                  className="border-gold/30 text-[10px] text-gold-soft"
                >
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}