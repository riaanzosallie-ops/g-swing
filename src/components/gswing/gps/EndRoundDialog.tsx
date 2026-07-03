// End-of-round summary dialog. Renders read-only stats derived from the
// Round Engine (round-engine.ts + round-summary.ts). No network calls.

import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Flag, Route, Ruler, Sparkles, Timer } from "lucide-react";
import type { RoundState } from "@/lib/round-engine";
import { buildRoundStats } from "@/lib/round-summary";

export interface EndRoundDialogProps {
  open: boolean;
  round: RoundState;
  unit: "yards" | "meters";
  /** True after `endRound()` has been called — controls copy + actions. */
  ended: boolean;
  onEndRound: () => void;
  onResume: () => void;
  onStartNew: () => void;
  onClose: () => void;
}

export function EndRoundDialog({
  open,
  round,
  unit,
  ended,
  onEndRound,
  onResume,
  onStartNew,
  onClose,
}: EndRoundDialogProps) {
  const stats = useMemo(() => buildRoundStats(round, unit), [round, unit]);
  const u = unit === "meters" ? "m" : "yd";

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md border-gold/30 bg-black/90">
        <DialogHeader>
          <DialogTitle className="font-serif text-gold">
            {ended ? "Round complete" : "End this round?"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Stat icon={<Flag className="h-3.5 w-3.5" />} label="Holes" value={stats.holesPlayed} />
            <Stat icon={<Timer className="h-3.5 w-3.5" />} label="Duration" value={`${stats.durationMinutes}m`} />
            <Stat icon={<Ruler className="h-3.5 w-3.5" />} label="Shots saved" value={stats.measurementsSaved} />
            <Stat icon={<Route className="h-3.5 w-3.5" />} label="Walked" value={`${stats.distanceWalked} ${u}`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="Longest"
              value={
                stats.longestShot
                  ? `${stats.longestShot.distance} ${u}`
                  : "—"
              }
              hint={stats.longestShot?.label ?? stats.longestShot?.club ?? undefined}
            />
            <Stat
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="Most-used club"
              value={stats.mostUsedClub?.name ?? "—"}
              hint={
                stats.mostUsedClub
                  ? `${stats.mostUsedClub.count} shot${stats.mostUsedClub.count === 1 ? "" : "s"}`
                  : undefined
              }
            />
          </div>
          {stats.averageTargetDistance != null && (
            <p className="pt-1 text-center text-[11px] uppercase tracking-[0.22em] text-white/55">
              Avg target · {stats.averageTargetDistance} {u}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {ended ? (
            <>
              <Button variant="outline" onClick={onClose} className="border-gold/40 text-gold">
                Close
              </Button>
              <Button onClick={onStartNew} className="bg-gold text-black hover:bg-gold/85">
                Start new round
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onResume} className="border-gold/40 text-gold">
                Keep playing
              </Button>
              <Button onClick={onEndRound} className="bg-gold text-black hover:bg-gold/85">
                End round
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.22em] text-white/55">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate font-serif text-lg text-gold">{value}</div>
      {hint && <div className="mt-0.5 truncate text-[10px] text-white/50">{hint}</div>}
    </div>
  );
}