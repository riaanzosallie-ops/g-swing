import { useMemo } from "react";
import {
  Bookmark,
  Crosshair,
  Droplets,
  Sparkles,
  Target as TargetIcon,
  Trash2,
  X as XIcon,
} from "lucide-react";
import type { ClubSuggestion } from "@/lib/club-recommender";
import type { SavedMeasurement } from "@/lib/round-engine";

/**
 * Shot Planning Panel
 * -------------------
 * Unified, mode-agnostic UI for the Live GPS + Shot Planning engine.
 * Rendered in BOTH Premium and Satellite so users see the same numbers
 * regardless of which basemap they picked.
 *
 * Contract: parent owns every distance and coordinate. This component
 * is pure presentation + button dispatch — no measurements happen here.
 */
export interface ShotPlanPanelProps {
  /** Remaining distance to the current tap target, in display units. */
  distance: number | null;
  unit: "yards" | "meters";
  /** Carry distance to clear the closest hazard on the shot line. */
  carry?: { label: string; value: number } | null;
  /** Club recommendation for the current distance. */
  clubSuggestion: ClubSuggestion | null;
  /** Optional target chip that fired the current measurement. */
  activeTargetLabel?: string | null;

  /** Saved measurements for the current hole. */
  savedForHole: SavedMeasurement[];
  /** Recall a saved measurement — parent re-applies coordinates. */
  onRecall: (m: SavedMeasurement) => void;
  onRemoveSaved: (id: string) => void;
  onSave: () => void;
  onClear: () => void;

  /** Compact = embedded in the Premium HUD. Roomy = bottom sheet. */
  variant?: "compact" | "roomy";
}

const unitShort = (u: "yards" | "meters") => (u === "meters" ? "m" : "yd");

export function ShotPlanPanel({
  distance,
  unit,
  carry,
  clubSuggestion,
  activeTargetLabel,
  savedForHole,
  onRecall,
  onRemoveSaved,
  onSave,
  onClear,
  variant = "roomy",
}: ShotPlanPanelProps) {
  const u = unitShort(unit);
  const hasShot = distance != null && Number.isFinite(distance);
  const dense = variant === "compact";

  const toneClass = useMemo(() => {
    switch (clubSuggestion?.tone) {
      case "high": return "text-emerald-300 border-emerald-400/40 bg-emerald-400/10";
      case "medium": return "text-gold border-gold/45 bg-gold/10";
      case "low": return "text-amber-300 border-amber-400/40 bg-amber-400/10";
      case "stretch": return "text-rose-300 border-rose-400/40 bg-rose-400/10";
      default: return "text-white/70 border-white/15 bg-white/5";
    }
  }, [clubSuggestion?.tone]);

  return (
    <div
      className={`w-full rounded-2xl border border-gold/30 bg-black/80 backdrop-blur-xl ${
        dense ? "px-3 py-2.5" : "px-3.5 py-3"
      } shadow-[0_-12px_36px_rgba(0,0,0,0.55)]`}
      data-gswing-shot-plan
    >
      {/* Header row: target label + close */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-gold/40 text-gold">
            <Crosshair className="h-2.5 w-2.5" />
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-gold-soft">
            {activeTargetLabel ?? "Shot plan"}
          </span>
        </div>
        {hasShot && (
          <button
            type="button"
            onClick={onClear}
            className="grid h-5 w-5 place-items-center rounded-full text-gold-soft/70 hover:text-gold"
            aria-label="Clear shot plan"
          >
            <XIcon className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Distance / club / confidence row */}
      <div className={`mt-1.5 flex items-end gap-3 ${dense ? "" : "gap-4"}`}>
        <div className="min-w-0">
          <div className={`font-serif tabular-nums leading-none text-gold ${dense ? "text-[34px]" : "text-[42px]"}`}>
            {hasShot ? Math.round(distance!) : "—"}
          </div>
          <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-gold-soft">
            {hasShot ? `${u} remaining` : "Tap a target"}
          </div>
        </div>

        {hasShot && (
          <>
            <div className="h-10 w-px self-center bg-gold/15" />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] uppercase tracking-[0.22em] text-white/55">
                Suggested
              </div>
              <div className={`mt-0.5 truncate font-serif ${dense ? "text-lg" : "text-xl"} text-white`}>
                {clubSuggestion?.club.name ?? "—"}
              </div>
              {clubSuggestion && (
                <div className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
                  <Sparkles className="h-2.5 w-2.5" />
                  {clubSuggestion.confidence}% · {clubSuggestion.tone}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Carry line — only when relevant */}
      {hasShot && carry && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-2 py-1.5">
          <Droplets className="h-3 w-3 text-amber-300" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-amber-100/90">
            Carry {carry.label}
          </span>
          <span className="ml-auto font-serif text-sm tabular-nums text-amber-200">
            {carry.value} {u}
          </span>
        </div>
      )}

      {/* Action row */}
      {hasShot && (
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSave}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-gold/45 bg-gold/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold hover:bg-gold/20"
          >
            <Bookmark className="h-3 w-3" />
            Save shot
          </button>
        </div>
      )}

      {/* Saved history for the current hole */}
      {savedForHole.length > 0 && (
        <div className="mt-2.5 border-t border-gold/15 pt-2">
          <div className="mb-1 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.22em] text-gold-soft/80">
            <TargetIcon className="h-2.5 w-2.5" />
            Saved · this hole
          </div>
          <ul className="space-y-1">
            {savedForHole.slice(0, 4).map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1"
              >
                <button
                  type="button"
                  onClick={() => onRecall(m)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85">
                      {m.targetLabel ?? "Tap"}
                    </span>
                    <span className="font-serif text-xs tabular-nums text-gold">
                      {m.distance}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-white/50">
                      {m.unit === "meters" ? "m" : "yd"}
                    </span>
                    {m.clubName && (
                      <span className="ml-auto truncate text-[10px] text-white/60">
                        {m.clubName}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveSaved(m.id)}
                  className="grid h-5 w-5 place-items-center rounded-full text-white/40 hover:text-rose-300"
                  aria-label="Remove saved shot"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}