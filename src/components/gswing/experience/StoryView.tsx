import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import { buildGolfStory } from "@/lib/experience/golf-story";
import type { RoundExperienceModel } from "@/lib/experience/experience-engine";

interface Props {
  model: RoundExperienceModel;
}

export function StoryView({ model }: Props) {
  const story = useMemo(() => buildGolfStory(model), [model]);

  if (!story.has_sufficient_evidence) {
    return (
      <Card className="border-gold/20 p-4 text-xs text-muted-foreground">
        Not enough data available. Track shots during your round to unlock Golf Story™.
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
            <BookOpen className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gold-soft">
              Golf Story™
            </p>
            <h3 className="truncate font-serif text-lg text-gradient-gold">
              {story.title}
            </h3>
            {story.subtitle && (
              <p className="text-[11px] text-muted-foreground">{story.subtitle}</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="border-gold/20 bg-background/60 p-4">
        <div className="space-y-3 font-serif text-[15px] leading-relaxed text-foreground">
          {story.sentences.map((s) => (
            <p key={s.id} className="break-words">
              <span className="mr-1 align-middle text-[9px] uppercase tracking-wider text-gold-soft">
                {s.kind.replace("_", " ")}
              </span>
              {s.text}
            </p>
          ))}
        </div>
        <p className="mt-3 border-t border-gold/10 pt-2 text-[10px] italic text-muted-foreground">
          Every sentence is generated only when matching evidence exists in your tracked shots.
        </p>
      </Card>
    </div>
  );
}