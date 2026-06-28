/**
 * PremiumGpsOverlay — luxury "glance & play" HUD for G-Swing Premium GPS.
 *
 * Design goal (per investor brief): the golfer should know everything they
 * need within one second of unlocking the phone. The map dominates the
 * screen; only the next-shot essentials sit on top of it.
 *
 *  • Dominant distance card (top-left)   — the visual focus.
 *  • Compact hole chip (top-right)        — hole/par/SI + wind.
 *  • Premium/Satellite pill (top-right)   — single tap to switch worlds.
 *  • Premium dock (bottom)                — GPS · Approach · Measure ·
 *                                           Scorecard · Settings.
 *  • Approach drawer                      — optional layups / carries.
 *
 * Everything is glass-morphism on emerald/black/gold, large hit-targets
 * (44px+), safe-area aware. No grey panels, no bright blue.
 */

import { useState } from "react";
import {
  ChevronLeft,
  Crosshair,
  Flag,
  Layers as LayersIcon,
  MoreHorizontal,
  Ruler,
  Settings as SettingsIcon,
  Target as TargetIcon,
  Wind,
  Eye,
  Mountain,
  Droplets,
  Plane,
  RefreshCw,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { GswingWeather } from "@/lib/gswing-weather";
import type { YardageReadout } from "@/lib/yardage-engine";

export interface PremiumGpsOverlayProps {
  /** Hole number being rendered. */
  hole: number;
  par: number | null;
  handicap: number | null;
  totalHoles: number;

  /** Live distance readout — only `front/center/back/carries/layups` used. */
  readout: YardageReadout;
  unit: "yards" | "meters";

  /** Map mode toggle. */
  mapView: "premium" | "satellite";
  onSetMapView: (m: "premium" | "satellite") => void;

  /** Tap-to-measure. */
  measureActive: boolean;
  onToggleMeasure: () => void;

  /** Layer + camera helpers (kept reachable from the More menu). */
  showOverlays: boolean;
  onToggleOverlays: () => void;
  showHazards: boolean;
  onToggleHazards: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  onRecenter: () => void;
  onFitHole: () => void;
  onFlyover: () => void;
  flyoverDisabled: boolean;
  flyoverRunning: boolean;
  onRefreshMapping: () => void;

  /** Live data badges. */
  weather: { status: string; data?: GswingWeather };

  /** Navigation callbacks (dispatched as window events upstream). */
  onBack: () => void;
  onNextHole?: () => void;
  onOpenScorecard: () => void;
  onOpenSettings: () => void;
}

const UNIT_LABEL = { yards: "YARDS", meters: "METERS" } as const;
const UNIT_SHORT = { yards: "y", meters: "m" } as const;

/** yards → display unit (integer). */
function toDisplay(yards: number | null, unit: "yards" | "meters"): number | null {
  // Hard guard: undefined, null, NaN, or non-finite must never surface to UI.
  if (yards == null || !Number.isFinite(yards)) return null;
  const v = unit === "meters" ? yards * 0.9144 : yards;
  return Number.isFinite(v) ? Math.round(v) : null;
}

export function PremiumGpsOverlay(props: PremiumGpsOverlayProps): JSX.Element {
  const {
    hole,
    par,
    handicap,
    totalHoles,
    readout,
    unit,
    mapView,
    onSetMapView,
    measureActive,
    onToggleMeasure,
    showOverlays,
    onToggleOverlays,
    showHazards,
    onToggleHazards,
    showLabels,
    onToggleLabels,
    onRecenter,
    onFitHole,
    onFlyover,
    flyoverDisabled,
    flyoverRunning,
    onRefreshMapping,
    weather,
    onBack,
    onNextHole,
    onOpenScorecard,
    onOpenSettings,
  } = props;

  const [approachOpen, setApproachOpen] = useState(false);

  const center = toDisplay(readout.center, unit);
  const front = toDisplay(readout.front, unit);
  const back = toDisplay(readout.back, unit);
  const wx = weather.status === "ready" && weather.data ? weather.data : null;

  return (
    <>
      {/* ── TOP-LEFT · Dominant distance card ──────────────────────────── */}
      <div className="pointer-events-none absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-start gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="pointer-events-auto mt-1 grid h-10 w-10 place-items-center rounded-full border border-gold/40 bg-black/55 text-gold-soft backdrop-blur-md transition-all hover:text-gold active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="pointer-events-auto relative overflow-hidden rounded-[22px] border border-gold/45 bg-gradient-to-br from-emerald-950/85 via-black/75 to-emerald-950/85 px-4 py-3 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.7),0_0_0_1px_rgba(245,200,75,0.08)] backdrop-blur-xl">
          {/* gold corner shine */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-gold/15 blur-2xl" />
          <div className="relative flex items-baseline gap-2">
            {center != null ? (
              <>
                <span className="font-serif text-[64px] leading-none tracking-tight text-gold drop-shadow-[0_2px_8px_rgba(245,200,75,0.35)]">
                  {center}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold-soft">
                  {UNIT_LABEL[unit]}
                </span>
              </>
            ) : (
              <span className="font-serif text-[22px] leading-none tracking-[0.18em] text-gold-soft/90">
                WAITING FOR GPS…
              </span>
            )}
          </div>
          <div className="relative mt-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-200/90">
            <span className="grid h-1.5 w-1.5 place-items-center rounded-full bg-gold shadow-[0_0_8px_rgba(245,200,75,0.8)]" />
            {center != null ? "Center of green" : "Acquiring satellite lock"}
          </div>
          <div className="relative mt-2 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-white/70">
            <span>
              Hole <span className="text-gold">{hole}</span>
            </span>
            <span className="h-3 w-px bg-gold/30" />
            <span>
              Par <span className="text-gold">{par ?? "—"}</span>
            </span>
            {Number.isFinite(handicap) && (handicap as number) > 0 && (
              <>
                <span className="h-3 w-px bg-gold/30" />
                <span>
                  SI <span className="text-gold">{handicap}</span>
                </span>
              </>
            )}
          </div>

          {/* Front / Back chips */}
          {(front != null || back != null) && (
            <div className="relative mt-3 flex gap-1.5">
              <DistChip label="F" value={front} unit={unit} />
              <DistChip label="B" value={back} unit={unit} />
            </div>
          )}
        </div>
      </div>

      {/* ── TOP-RIGHT · Hole / mode / wind ─────────────────────────────── */}
      <div className="pointer-events-none absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => onNextHole?.()}
          disabled={!onNextHole}
          className="pointer-events-auto flex h-10 items-center gap-2 rounded-full border border-gold/40 bg-black/55 px-3.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold backdrop-blur-md transition-all active:scale-95 disabled:opacity-60"
          aria-label={`Hole ${hole} of ${totalHoles}`}
        >
          <span>
            H<span className="text-base">{hole}</span>
            <span className="text-gold/60">/{totalHoles}</span>
          </span>
        </button>

        <div className="pointer-events-auto flex items-center rounded-full border border-gold/35 bg-black/55 p-0.5 backdrop-blur-md">
          {(["premium", "satellite"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onSetMapView(mode)}
              aria-pressed={mapView === mode}
              className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all ${
                mapView === mode
                  ? "bg-gold text-black shadow-[0_0_14px_rgba(245,200,75,0.4)]"
                  : "text-gold-soft hover:text-gold"
              }`}
            >
              {mode === "premium" ? "Premium" : "Satellite"}
            </button>
          ))}
        </div>

        {wx && (
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-gold/30 bg-black/55 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200/90 backdrop-blur-md">
            <Wind className="h-3 w-3 text-gold" />
            <span>
              {Math.round(wx.windSpeedKmh)} <span className="text-gold/70">km/h</span> {wx.windDirectionLabel}
            </span>
            <span className="h-3 w-px bg-gold/30" />
            <span>{Math.round(wx.temperatureC)}°</span>
          </div>
        )}
      </div>

      {/* ── APPROACH DRAWER (carries / layups) ─────────────────────────── */}
      {approachOpen && (readout.carries.length > 0 || readout.layups.length > 0) && (
        <div className="pointer-events-auto absolute inset-x-3 bottom-[6.5rem] z-10 rounded-2xl border border-gold/35 bg-black/70 p-3 backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">
              Approach · {UNIT_LABEL[unit]}
            </span>
            <button
              type="button"
              onClick={() => setApproachOpen(false)}
              className="text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-gold"
            >
              Close
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {readout.layups.map((l) => (
              <Pill key={`l-${l.label}`} icon={<TargetIcon className="h-3 w-3" />}>
                {l.label} · {toDisplay(l.yards, unit)}
                {UNIT_SHORT[unit]}
              </Pill>
            ))}
            {readout.carries.map((c) => (
              <Pill key={`c-${c.label}`} icon={<Droplets className="h-3 w-3" />} tone="warn">
                Carry {c.label} · {toDisplay(c.carry, unit)}
                {UNIT_SHORT[unit]}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {/* ── BOTTOM · Premium dock ──────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 flex justify-center px-3">
        <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-1 rounded-[28px] border border-gold/35 bg-gradient-to-b from-black/75 to-emerald-950/80 px-2 py-2 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.85),0_0_0_1px_rgba(245,200,75,0.06)] backdrop-blur-2xl">
          <DockBtn icon={<Crosshair className="h-5 w-5" />} label="GPS" active onClick={onRecenter} />
          <DockBtn
            icon={<Flag className="h-5 w-5" />}
            label="Approach"
            onClick={() => {
              onFitHole();
              setApproachOpen((v) => !v);
            }}
            highlight={approachOpen}
          />
          <DockBtn
            icon={<Ruler className="h-5 w-5" />}
            label="Measure"
            active={measureActive}
            onClick={onToggleMeasure}
          />
          <DockBtn icon={<TargetIcon className="h-5 w-5" />} label="Score" onClick={onOpenScorecard} />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group flex h-14 w-14 flex-col items-center justify-center rounded-2xl text-gold-soft transition-all hover:text-gold active:scale-95"
                aria-label="More"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-gold/25 bg-black/30 transition-all group-hover:border-gold/50">
                  <MoreHorizontal className="h-5 w-5" />
                </span>
                <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]">More</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="end"
              className="w-56 border-gold/30 bg-black/90 p-2 text-gold-soft backdrop-blur-xl"
            >
              <MoreItem onClick={onOpenSettings} icon={<SettingsIcon className="h-3.5 w-3.5" />}>
                Settings
              </MoreItem>
              <MoreItem onClick={onFitHole} icon={<Eye className="h-3.5 w-3.5" />}>
                Fit hole
              </MoreItem>
              <MoreItem
                onClick={onFlyover}
                disabled={flyoverDisabled || flyoverRunning}
                icon={<Plane className="h-3.5 w-3.5" />}
              >
                {flyoverRunning ? "Flyover…" : "Flyover"}
              </MoreItem>
              <div className="my-1 h-px bg-gold/15" />
              <MoreItem onClick={onToggleOverlays} active={showOverlays} icon={<LayersIcon className="h-3.5 w-3.5" />}>
                Layers · {showOverlays ? "on" : "off"}
              </MoreItem>
              <MoreItem onClick={onToggleHazards} active={showHazards} icon={<Droplets className="h-3.5 w-3.5" />}>
                Hazards · {showHazards ? "on" : "off"}
              </MoreItem>
              <MoreItem onClick={onToggleLabels} active={showLabels} icon={<Mountain className="h-3.5 w-3.5" />}>
                Yardages · {showLabels ? "on" : "off"}
              </MoreItem>
              <div className="my-1 h-px bg-gold/15" />
              <MoreItem onClick={onRefreshMapping} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                Refresh mapping
              </MoreItem>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </>
  );
}

/** Distance chip — F/B mini chips on the distance card. */
function DistChip({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: "yards" | "meters";
}) {
  return (
    <div className="flex items-baseline gap-1 rounded-full border border-gold/25 bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/90">
      <span className="text-gold/80">{label}</span>
      <span className="text-sm tracking-normal text-gold">{value ?? "—"}</span>
      <span className="text-[9px] text-gold/60">{UNIT_SHORT[unit]}</span>
    </div>
  );
}

/** Premium dock button. */
function DockBtn({
  icon,
  label,
  active,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="group flex h-14 w-14 flex-col items-center justify-center rounded-2xl transition-all active:scale-95"
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-xl border transition-all ${
          active
            ? "border-gold bg-gold text-black shadow-[0_0_16px_rgba(245,200,75,0.45)]"
            : highlight
              ? "border-gold/60 bg-gold/15 text-gold"
              : "border-gold/25 bg-black/30 text-gold-soft group-hover:border-gold/50 group-hover:text-gold"
        }`}
      >
        {icon}
      </span>
      <span
        className={`mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${
          active ? "text-gold" : "text-gold-soft/90"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

/** Glass pill used in the approach drawer. */
function Pill({
  icon,
  children,
  tone,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: "warn";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
        tone === "warn"
          ? "border-amber-300/40 bg-amber-300/10 text-amber-200"
          : "border-gold/30 bg-black/40 text-gold"
      }`}
    >
      {icon}
      {children}
    </span>
  );
}

function MoreItem({
  onClick,
  disabled,
  active,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "text-gold" : ""
      }`}
    >
      {icon}
      <span className="flex-1">{children}</span>
    </button>
  );
}