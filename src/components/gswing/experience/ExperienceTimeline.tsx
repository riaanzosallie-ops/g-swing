// G Swing — Reusable Experience Timeline.
// Consumes TimelineItem[] from the Experience Engine. Every future
// premium feature (Memory Book, Season Journey, Coach Notes, Broadcast)
// renders into this same component.

import { Card } from "@/components/ui/card";
import {
  Award,
  BookOpen,
  Camera,
  Flag,
  MessageSquare,
  MonitorPlay,
  Radio,
  Sparkles,
  Target,
} from "lucide-react";
import type { TimelineItem, TimelineItemKind } from "@/lib/experience/experience-engine";

interface Props {
  items: TimelineItem[];
  emptyLabel?: string;
  onSelect?: (item: TimelineItem) => void;
}

const KIND_META: Record<TimelineItemKind, { icon: typeof Flag; tone: string }> = {
  shot: { icon: Target, tone: "text-gold border-gold/30" },
  hole_complete: { icon: Flag, tone: "text-emerald-300 border-emerald-400/30" },
  achievement: { icon: Award, tone: "text-amber-300 border-amber-400/40" },
  ai_note: { icon: Sparkles, tone: "text-sky-300 border-sky-400/30" },
  photo: { icon: Camera, tone: "text-pink-300 border-pink-400/30" },
  memory: { icon: BookOpen, tone: "text-amber-200 border-amber-300/30" },
  coach_note: { icon: MessageSquare, tone: "text-emerald-200 border-emerald-300/30" },
  broadcast: { icon: MonitorPlay, tone: "text-sky-200 border-sky-300/30" },
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ExperienceTimeline({
  items,
  emptyLabel = "Not enough data available.",
  onSelect,
}: Props) {
  if (!items.length) {
    return (
      <Card className="border-gold/20 bg-background/40 p-4 text-xs text-muted-foreground">
        <Radio className="mr-1 inline h-3 w-3 text-gold" />
        {emptyLabel}
      </Card>
    );
  }
  return (
    <div className="relative pl-5">
      <div className="absolute bottom-1 left-2 top-1 w-px bg-gradient-to-b from-gold/40 via-gold/15 to-transparent" />
      <ol className="space-y-2">
        {items.map((item) => {
          const meta = KIND_META[item.kind];
          const Icon = meta.icon;
          return (
            <li key={item.id} className="relative">
              <span
                className={`absolute -left-3.5 top-2 flex h-5 w-5 items-center justify-center rounded-full border bg-background/80 ${meta.tone}`}
                aria-hidden
              >
                <Icon className="h-3 w-3" />
              </span>
              <button
                type="button"
                onClick={() => onSelect?.(item)}
                disabled={!onSelect}
                className={`block w-full rounded-md border border-gold/10 bg-background/40 px-3 py-2 text-left text-xs transition-colors ${
                  onSelect ? "hover:border-gold/40 hover:bg-background/60" : "cursor-default"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{item.title}</span>
                  <span className="ml-auto text-[10px] uppercase text-muted-foreground">
                    {fmtTime(item.at)}
                  </span>
                </div>
                {item.subtitle && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{item.subtitle}</p>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
