import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { buildMomentumReport } from "@/lib/experience/momentum-engine";
import type { RoundExperienceModel } from "@/lib/experience/experience-engine";

interface Props {
  model: RoundExperienceModel;
}

export function MomentumView({ model }: Props) {
  const report = useMemo(() => buildMomentumReport(model), [model]);

  if (!report.has_sufficient_evidence) {
    return (
      <Card className="border-gold/20 p-4 text-xs text-muted-foreground">
        Not enough data available. Tag more shots to power the Momentum Engine™.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="relative overflow-hidden border-gold/30 bg-gradient-to-br from-background to-background/60 p-4 shadow-elegant">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/20 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <span className="rounded-full border border-gold/40 bg-gold/10 p-2 text-gold">
            <Activity className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gold-soft">
              Momentum Engine™
            </p>
            <h3 className="font-serif text-lg text-gradient-gold">
              How the round actually felt
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Six metrics, calculated only from your stored shots.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        {report.scores.map((s) => (
          <Card key={s.key} className="border-gold/20 bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-serif text-sm text-gold">{s.label}</h4>
              <span
                className={
                  s.value == null
                    ? "text-[11px] text-muted-foreground"
                    : "font-serif text-base text-gradient-gold"
                }
              >
                {s.value == null ? "—" : `${s.value}`}
              </span>
            </div>
            {s.value != null ? (
              <Progress value={s.value} className="mt-2 h-1.5" />
            ) : null}
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {s.explanation}
            </p>
            {(s.positives.length > 0 || s.negatives.length > 0) && (
              <div className="mt-2 space-y-1">
                {s.positives.map((p, i) => (
                  <div
                    key={`p-${i}`}
                    className="flex items-start gap-1.5 text-[11px] text-emerald-400/90"
                  >
                    <TrendingUp className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="break-words">{p}</span>
                  </div>
                ))}
                {s.negatives.map((n, i) => (
                  <div
                    key={`n-${i}`}
                    className="flex items-start gap-1.5 text-[11px] text-rose-400/90"
                  >
                    <TrendingDown className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="break-words">{n}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}