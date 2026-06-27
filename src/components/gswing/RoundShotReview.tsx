import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Flag, MapPin, Share2 } from "lucide-react";
import type { StoredShot } from "@/lib/shot-tracker";
import { buildStaticShotImageUrl } from "@/lib/mapbox-static";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  shots: StoredShot[];
  mapboxToken: string | null;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function fmtCoord(p: { lat: number; lng: number } | null): string {
  if (!p) return "—";
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}

function dirLabel(d: StoredShot["direction"]): string | null {
  if (!d) return null;
  return d === "straight" ? "Straight" : d === "left" ? "Left" : "Right";
}

export function RoundShotReview({ open, onClose, shots, mapboxToken }: Props) {
  const groups = useMemo(() => {
    const map = new Map<number, StoredShot[]>();
    for (const s of shots) {
      const h = s.hole_number ?? 0;
      const arr = map.get(h) ?? [];
      arr.push(s);
      map.set(h, arr);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hole, list]) => ({
        hole,
        shots: [...list].sort((a, b) => (a.shot_number ?? 0) - (b.shot_number ?? 0)),
      }));
  }, [shots]);

  const totalDist = useMemo(
    () => shots.reduce((acc, s) => acc + (s.distance_yards ?? 0), 0),
    [shots],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gradient-card max-h-[88vh] max-w-2xl overflow-y-auto border-gold/30">
        <DialogHeader>
          <DialogTitle className="font-serif text-gold">
            Full Round Shot Review
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          A premium memory book of every shot played — based on real saved GPS paths
          and tags. {shots.length} shot{shots.length === 1 ? "" : "s"} ·{" "}
          {Math.round(totalDist)} yds total · {groups.length} hole
          {groups.length === 1 ? "" : "s"}.
        </p>

        {groups.length === 0 ? (
          <Card className="border-gold/20 p-4 text-xs text-muted-foreground">
            No shots saved yet for this round. Track a shot with Start Shot → End Shot
            and the entry will appear here automatically.
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.hole} className="space-y-2">
                <div className="flex items-center gap-2 border-b border-gold/15 pb-1">
                  <Flag className="h-4 w-4 text-gold" />
                  <p className="font-serif text-lg text-gold">Hole {g.hole}</p>
                  <span className="ml-auto text-[10px] uppercase text-muted-foreground">
                    {g.shots.length} shot{g.shots.length === 1 ? "" : "s"}
                  </span>
                </div>
                {g.shots.map((s) => (
                  <ShotCard key={s.id} shot={s} mapboxToken={mapboxToken} />
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="pt-2">
          <Button variant="outline" className="w-full border-gold/30" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShotCard({ shot, mapboxToken }: { shot: StoredShot; mapboxToken: string | null }) {
  const previewUrl =
    mapboxToken && shot.start && shot.end
      ? buildStaticShotImageUrl({ token: mapboxToken, start: shot.start, end: shot.end })
      : null;

  const handleShare = async () => {
    const lines = [
      `G Swing — Hole ${shot.hole_number ?? "?"} · Shot ${shot.shot_number ?? "?"}`,
      shot.club ? `Club: ${shot.club}` : null,
      shot.distance_yards != null ? `Distance: ${Math.round(shot.distance_yards)}y` : null,
      dirLabel(shot.direction) ? `Direction: ${dirLabel(shot.direction)}` : null,
      shot.results.length ? `Result: ${shot.results.join(", ")}` : null,
      shot.notes ? `Notes: ${shot.notes}` : null,
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: "G Swing Shot", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Shot summary copied");
      }
    } catch {
      // user cancelled — ignore
    }
  };

  return (
    <Card className="border-gold/15 bg-background/40 p-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded bg-gold/15 px-1.5 py-0.5 font-semibold text-gold">
          #{shot.shot_number ?? "—"}
        </span>
        <span className="text-foreground">{shot.club ?? "—"}</span>
        <span className="ml-auto font-serif text-gold">
          {shot.distance_yards != null ? `${Math.round(shot.distance_yards)}y` : "—"}
        </span>
      </div>

      {previewUrl ? (
        <img
          src={previewUrl}
          alt={`Shot ${shot.shot_number ?? ""} path preview`}
          loading="lazy"
          className="mt-2 h-32 w-full rounded border border-gold/20 object-cover"
        />
      ) : (
        <div className="mt-2 flex h-20 items-center justify-center rounded border border-dashed border-gold/20 text-[11px] text-muted-foreground">
          {shot.start && shot.end
            ? "Map preview loading…"
            : "Path unavailable (incomplete GPS)"}
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-[9px] uppercase text-muted-foreground">Start</p>
          <p className="text-foreground">{fmtCoord(shot.start)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase text-muted-foreground">End</p>
          <p className="text-foreground">{fmtCoord(shot.end)}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
        {dirLabel(shot.direction) && (
          <span className="rounded border border-gold/30 px-1.5 py-0.5 text-gold">
            {dirLabel(shot.direction)}
          </span>
        )}
        {shot.results.map((r) => (
          <span
            key={r}
            className="rounded border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-0.5 text-emerald-300"
          >
            {r}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {fmtTime(shot.taken_at)}
        </span>
      </div>

      {shot.notes && (
        <p className="mt-2 rounded border border-gold/10 bg-background/30 px-2 py-1 text-[11px] italic text-muted-foreground">
          “{shot.notes}”
        </p>
      )}

      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="ghost" className="h-7 text-xs text-gold" onClick={handleShare}>
          <Share2 className="mr-1 h-3 w-3" /> Share shot card
        </Button>
      </div>
    </Card>
  );
}