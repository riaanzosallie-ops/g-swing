// G Swing — Premium collectible card for a single Signature Moment.
// Consumes SignatureMoment from the Experience Engine; never recomputes.

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, CalendarDays, Cloud, Flag, MapPin, Play, Share2, Sparkles } from "lucide-react";
import type { SignatureMoment } from "@/lib/experience/experience-engine";
import { toast } from "sonner";

interface Props {
  moment: SignatureMoment;
  courseName?: string | null;
  onReplay?: (moment: SignatureMoment) => void;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function SignatureMomentCard({ moment, courseName, onReplay }: Props) {
  const handleShare = async () => {
    const text = [
      `🏌️ G Swing — ${moment.title}`,
      moment.subtitle,
      courseName ? `Course: ${courseName}` : null,
      moment.hole_number ? `Hole: ${moment.hole_number}` : null,
      moment.distance_yards ? `Distance: ${Math.round(moment.distance_yards)}y` : null,
      moment.ai_commentary,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: `G Swing — ${moment.title}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Moment copied to clipboard");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Card className="relative overflow-hidden border-gold/30 bg-gradient-to-br from-background via-background/85 to-background/60 p-4 shadow-elegant animate-fade-in">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl"
      />

      <div className="relative flex items-center gap-2">
        <span className="rounded-full border border-gold/40 bg-gold/10 p-1.5 text-gold">
          <Award className="h-3.5 w-3.5" />
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-gold-soft">
          Signature Moment
        </span>
        <span className="ml-auto text-[10px] uppercase text-muted-foreground">
          #{moment.type.replace(/_/g, " ")}
        </span>
      </div>

      <h3 className="relative mt-1 font-serif text-2xl text-gradient-gold">{moment.title}</h3>
      <p className="relative text-xs text-foreground/80">{moment.subtitle}</p>

      <div className="relative mt-3 grid grid-cols-2 gap-2 text-[11px]">
        {courseName && (
          <Field icon={MapPin} label="Course" value={courseName} />
        )}
        {moment.hole_number != null && (
          <Field icon={Flag} label="Hole" value={`#${moment.hole_number}`} />
        )}
        <Field icon={CalendarDays} label="Date" value={fmtDate(moment.date)} />
        {moment.club && <Field icon={Award} label="Club" value={moment.club} />}
        {moment.distance_yards != null && (
          <Field
            icon={Award}
            label="Distance"
            value={`${Math.round(moment.distance_yards)}y`}
          />
        )}
        {moment.weather?.condition && (
          <Field icon={Cloud} label="Weather" value={moment.weather.condition} />
        )}
      </div>

      <div className="relative mt-3 rounded-md border border-gold/15 bg-background/40 px-3 py-2 text-[11px] italic text-foreground/80">
        <Sparkles className="mr-1 inline h-3 w-3 text-gold" />
        {moment.ai_commentary}
      </div>

      <div className="relative mt-3 flex gap-2">
        {onReplay && (
          <Button
            size="sm"
            variant="outline"
            className="border-gold/40"
            onClick={() => onReplay(moment)}
          >
            <Play className="mr-1 h-3 w-3" />
            Replay
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-gold"
          onClick={handleShare}
        >
          <Share2 className="mr-1 h-3 w-3" />
          Share
        </Button>
      </div>
    </Card>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-gold/10 bg-background/40 px-2 py-1">
      <p className="flex items-center gap-1 text-[9px] uppercase text-muted-foreground">
        <Icon className="h-3 w-3 text-gold" />
        {label}
      </p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
