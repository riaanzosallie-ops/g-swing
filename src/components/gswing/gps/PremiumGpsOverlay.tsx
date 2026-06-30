/**
 * PremiumGpsOverlay — luxury "instrument cluster" HUD for G-Swing Premium GPS.
 *
 * Creative direction: think Apple Maps × Porsche dashboard × Garmin MARQ.
 * The hole is the hero — UI floats above it as glass. No opaque rectangles.
 * The distance numeral is the loudest element on screen; everything else
 * recedes into hairlines, micro-labels, and breathing glow.
 */

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Crosshair,
  Flag,
  Layers as LayersIcon,
  MoreHorizontal,
  Ruler,
  Settings as SettingsIcon,
  Target as TargetIcon,
  Eye,
  Mountain,
  Droplets,
  Plane,
  RefreshCw,
  Thermometer,
  Wifi,
  WifiOff,
  Navigation,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { GswingWeather } from "@/lib/gswing-weather";
import type { YardageReadout } from "@/lib/yardage-engine";

export interface PremiumGpsOverlayProps {
  hole: number;
  par: number | null;
  handicap: number | null;
  totalHoles: number;
  readout: YardageReadout;
  unit: "yards" | "meters";
  mapView: "premium" | "satellite";
  onSetMapView: (m: "premium" | "satellite") => void;
  measureActive: boolean;
  onToggleMeasure: () => void;
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
  weather: { status: string; data?: GswingWeather };
  onBack: () => void;
  onNextHole?: () => void;
  onOpenScorecard: () => void;
  onOpenSettings: () => void;
}

const UNIT_LABEL = { yards: "YARDS", meters: "METERS" } as const;
const UNIT_SHORT = { yards: "y", meters: "m" } as const;

/** yards → display unit (integer). NaN/undefined → null (never reaches DOM). */
function toDisplay(yards: number | null, unit: "yards" | "meters"): number | null {
  if (yards == null || !Number.isFinite(yards)) return null;
  const v = unit === "meters" ? yards * 0.9144 : yards;
  return Number.isFinite(v) ? Math.round(v) : null;
}

/** Smooth eased counter — distances *count*, never snap. */
function useEasedNumber(value: number | null, ms = 420): number | null {
  const [shown, setShown] = useState<number | null>(value);
  const fromRef = useRef<number | null>(value);
  useEffect(() => {
    if (value == null) {
      setShown(null);
      fromRef.current = null;
      return;
    }
    const from = fromRef.current ?? value;
    if (from === value) {
      setShown(value);
      fromRef.current = value;
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** Cardinal → degrees for the wind arrow rotation. */
const DIR_DEG: Record<string, number> = {
  N: 0, NNE: 22, NE: 45, ENE: 67, E: 90, ESE: 112,
  SE: 135, SSE: 157, S: 180, SSW: 202, SW: 225, WSW: 247,
  W: 270, WNW: 292, NW: 315, NNW: 337,
};
const bearing = (label?: string): number =>
  label ? DIR_DEG[label.toUpperCase()] ?? 0 : 0;

export function PremiumGpsOverlay(props: PremiumGpsOverlayProps): JSX.Element {
  const {
    hole, par, handicap, totalHoles,
    readout, unit,
    mapView, onSetMapView,
    measureActive, onToggleMeasure,
    showOverlays, onToggleOverlays,
    showHazards, onToggleHazards,
    showLabels, onToggleLabels,
    onRecenter, onFitHole,
    onFlyover, flyoverDisabled, flyoverRunning,
    onRefreshMapping, weather,
    onBack, onNextHole, onOpenScorecard, onOpenSettings,
  } = props;

  const [approachOpen, setApproachOpen] = useState(false);

  const center = toDisplay(readout.center, unit);
  const front = toDisplay(readout.front, unit);
  const back = toDisplay(readout.back, unit);
  const animatedCenter = useEasedNumber(center);
  const wx = weather.status === "ready" && weather.data ? weather.data : null;

  return (
    <>
      {/* Subtle ambient vignette — preserves map while lifting glass HUD. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_90%_at_50%_50%,transparent_58%,rgba(0,0,0,0.55)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/65 to-transparent" />

      {/* ───────────────────── TOP STATUS RAIL ───────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-[max(0.6rem,env(safe-area-inset-top))] z-10 flex items-center justify-between gap-2 px-3 animate-hud-rise">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full border border-gold/30 bg-black/45 text-gold-soft backdrop-blur-xl transition-all hover:text-gold active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onNextHole?.()}
            disabled={!onNextHole}
            className="flex h-9 items-center gap-2 rounded-full border border-gold/30 bg-black/45 px-3 font-hud text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-soft backdrop-blur-xl transition-all hover:text-gold active:scale-95 disabled:opacity-50"
            aria-label={`Hole ${hole} of ${totalHoles}`}
          >
            <span className="text-gold">H{hole}</span>
            <span className="text-gold/45">/ {totalHoles}</span>
            {par != null && (
              <>
                <span className="h-3 w-px bg-gold/25" />
                <span className="text-gold-soft">Par {par}</span>
              </>
            )}
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="relative flex items-center rounded-full border border-gold/30 bg-black/45 p-0.5 backdrop-blur-xl">
            {(["premium", "satellite"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onSetMapView(mode)}
                aria-pressed={mapView === mode}
                className={`relative z-10 rounded-full px-2.5 py-1 font-hud text-[10px] font-semibold uppercase tracking-[0.2em] transition-all ${
                  mapView === mode
                    ? "bg-[linear-gradient(180deg,#f5cf5b,#b3892c)] text-black shadow-[0_0_16px_rgba(245,200,75,0.5)]"
                    : "text-gold-soft/80 hover:text-gold"
                }`}
              >
                {mode === "premium" ? "Premium" : "Sat"}
              </button>
            ))}
          </div>

          <div className="flex h-8 items-center gap-1.5 rounded-full border border-gold/25 bg-black/45 px-2.5 font-hud text-[9px] font-semibold uppercase tracking-[0.2em] backdrop-blur-xl">
            {wx ? (
              <Wifi className="h-3 w-3 text-emerald-300" />
            ) : (
              <WifiOff className="h-3 w-3 text-amber-300" />
            )}
            <span className="text-emerald-100/90">GPS</span>
          </div>

          {wx && (
            <div className="flex h-8 items-center gap-1.5 rounded-full border border-gold/25 bg-black/45 px-2.5 font-hud text-[10px] backdrop-blur-xl">
              <span
                className="grid h-4 w-4 place-items-center transition-transform duration-700"
                style={{ transform: `rotate(${bearing(wx.windDirectionLabel)}deg)` }}
              >
                <Navigation className="h-3 w-3 text-gold" />
              </span>
              <span className="text-emerald-100/90 tabular-nums">
                {Math.round(wx.windSpeedKmh)}
              </span>
              <span className="text-gold-soft/70">km/h</span>
              <span className="h-3 w-px bg-gold/25" />
              <Thermometer className="h-3 w-3 text-amber-200" />
              <span className="tabular-nums text-emerald-100/90">
                {Math.round(wx.temperatureC)}°
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ───────────────────── HERO DISTANCE HUD (top-left) ───────────────────── */}
      <div className="pointer-events-none absolute left-3 top-[max(3.6rem,calc(env(safe-area-inset-top)+3rem))] z-10 animate-hud-rise">
        <div className="pointer-events-auto relative overflow-hidden rounded-[26px] border border-gold/35 bg-[linear-gradient(155deg,rgba(6,40,28,0.78),rgba(0,0,0,0.62)_55%,rgba(6,40,28,0.78))] px-5 py-4 shadow-[0_22px_60px_-22px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(245,200,75,0.18)] backdrop-blur-2xl">
          {/* Gold corner aurora */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold/20 blur-3xl" />
          {/* Light sweep */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(110deg,transparent_40%,rgba(245,200,75,0.18)_50%,transparent_60%)] animate-hud-sheen" />

          {/* Status row — breathing pin + caption */}
          <div className="relative flex items-center gap-2">
            <span className="relative grid h-2.5 w-2.5 place-items-center">
              <span className="absolute inset-0 rounded-full bg-gold/70 animate-hud-breathe" />
              <span className="absolute inset-0 rounded-full border border-gold/70 animate-hud-ring" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_10px_rgba(245,200,75,0.9)]" />
            </span>
            <span className="font-hud text-[9px] font-semibold uppercase tracking-[0.32em] text-gold-soft">
              {center != null ? "Center · Green" : "Acquiring satellite"}
            </span>
          </div>

          {/* The hero numeral */}
          <div className="relative mt-1 flex items-end gap-2">
            {animatedCenter != null ? (
              <>
                <span className="font-display text-[78px] font-extrabold leading-[0.86] tracking-[-0.04em] tabular-nums text-transparent bg-clip-text bg-[linear-gradient(180deg,#fff6d0_0%,#f5cf5b_55%,#b3892c_100%)] drop-shadow-[0_4px_18px_rgba(245,200,75,0.45)]">
                  {animatedCenter}
                </span>
                <span className="pb-3 font-hud text-[10px] font-semibold uppercase tracking-[0.32em] text-gold-soft">
                  {UNIT_LABEL[unit]}
                </span>
              </>
            ) : (
              <span className="font-display text-[26px] tracking-[0.12em] text-gold-soft/80">
                — — —
              </span>
            )}
          </div>

          {/* Gold hairline divider */}
          <div className="relative mt-3 h-px w-full bg-[linear-gradient(90deg,transparent,rgba(245,200,75,0.55),transparent)]" />

          {/* Front / Back / SI micro readouts */}
          <div className="relative mt-3 flex items-stretch gap-4">
            <FBStat label="Front" value={front} unit={UNIT_SHORT[unit]} />
            <span className="w-px self-stretch bg-gold/15" />
            <FBStat label="Back" value={back} unit={UNIT_SHORT[unit]} />
            {Number.isFinite(handicap) && (handicap as number) > 0 && (
              <>
                <span className="w-px self-stretch bg-gold/15" />
                <FBStat label="SI" value={handicap as number} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ───────────────────── APPROACH DRAWER ───────────────────── */}
      {approachOpen && (readout.carries.length > 0 || readout.layups.length > 0) && (
        <div className="pointer-events-auto absolute inset-x-3 bottom-[6.5rem] z-10 animate-hud-rise rounded-[22px] border border-gold/35 bg-[linear-gradient(155deg,rgba(0,0,0,0.78),rgba(6,40,28,0.7))] p-3 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-hud text-[10px] font-semibold uppercase tracking-[0.28em] text-gold">
              Approach · {UNIT_LABEL[unit]}
            </span>
            <button
              type="button"
              onClick={() => setApproachOpen(false)}
              className="font-hud text-[10px] uppercase tracking-[0.2em] text-gold-soft hover:text-gold"
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

      {/* ───────────────────── PREMIUM FLOATING DOCK ───────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.9rem,env(safe-area-inset-bottom))] z-10 flex justify-center px-3 animate-hud-rise">
        <div className="pointer-events-auto relative flex w-full max-w-md items-center justify-between gap-1 overflow-hidden rounded-[30px] border border-gold/40 bg-[linear-gradient(180deg,rgba(0,0,0,0.72),rgba(6,40,28,0.82))] px-2.5 py-2 shadow-[0_24px_60px_-22px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(245,200,75,0.22)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(245,200,75,0.55),transparent)]" />
          <div className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-[linear-gradient(110deg,transparent_40%,rgba(245,200,75,0.18)_50%,transparent_60%)] animate-hud-sheen" />
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
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-gold/25 bg-black/40 transition-all group-hover:border-gold/55 group-hover:bg-black/55">
                  <MoreHorizontal className="h-5 w-5" />
                </span>
                <span className="mt-0.5 font-hud text-[9px] font-semibold uppercase tracking-[0.18em]">
                  More
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="end"
              className="w-56 rounded-2xl border-gold/35 bg-[linear-gradient(155deg,rgba(0,0,0,0.88),rgba(6,40,28,0.85))] p-2 text-gold-soft shadow-[0_18px_44px_-18px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
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

/** Front/Back/SI micro-readout inside the hero distance card. */
function FBStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit?: string;
}) {
  return (
    <div className="flex min-w-[44px] flex-col items-start">
      <span className="font-hud text-[9px] font-semibold uppercase tracking-[0.22em] text-gold-soft/85">
        {label}
      </span>
      <span className="mt-0.5 font-display text-[20px] font-bold leading-none tabular-nums text-gold">
        {value ?? "—"}
        {unit && value != null && (
          <span className="ml-0.5 font-hud text-[9px] font-semibold text-gold-soft/70">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

/** Premium dock button — gold gradient when active, neon underline accent. */
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
      className="group relative flex h-14 w-14 flex-col items-center justify-center rounded-2xl transition-all active:scale-90"
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-xl border transition-all duration-300 ${
          active
            ? "border-gold bg-[linear-gradient(180deg,#f5cf5b,#b3892c)] text-black shadow-[0_0_22px_rgba(245,200,75,0.55),inset_0_1px_0_rgba(255,255,255,0.55)]"
            : highlight
              ? "border-gold/60 bg-gold/15 text-gold shadow-[0_0_14px_rgba(245,200,75,0.25)]"
              : "border-gold/25 bg-black/40 text-gold-soft group-hover:border-gold/55 group-hover:bg-black/55 group-hover:text-gold"
        }`}
      >
        {icon}
      </span>
      <span
        className={`mt-0.5 font-hud text-[9px] font-semibold uppercase tracking-[0.18em] ${
          active ? "text-gold" : "text-gold-soft/85"
        }`}
      >
        {label}
      </span>
      {active && (
        <span className="absolute -bottom-0.5 h-0.5 w-6 rounded-full bg-gold shadow-[0_0_10px_rgba(245,200,75,0.85)]" />
      )}
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
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-hud text-[10px] font-semibold uppercase tracking-[0.16em] ${
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
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-hud text-xs font-medium uppercase tracking-[0.16em] transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "text-gold" : ""
      }`}
    >
      {icon}
      <span className="flex-1">{children}</span>
    </button>
  );
}