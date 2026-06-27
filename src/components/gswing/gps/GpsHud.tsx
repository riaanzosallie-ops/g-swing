import { useEffect, useMemo, useState } from "react";
import {
  Crosshair,
  Droplets,
  Flag,
  Layers as LayersIcon,
  Maximize2,
  Mountain,
  Plane,
  Ruler,
  Sparkles,
  Thermometer,
  Trophy,
  Wifi,
  WifiOff,
  Wind,
  X as XIcon,
} from "lucide-react";
import type { CarryTarget, Unit, YardageReadout } from "@/lib/yardage-engine";
import type { GswingWeather } from "@/lib/gswing-weather";
import type { LatLng } from "@/lib/gps-utils";
import { measureBetween, classifyAccuracy } from "@/lib/gswing-gps";

export type HudWeatherState =
  | { status: "ready"; data: GswingWeather }
  | { status: string };

export interface HudTournamentInfo {
  name: string;
  position?: number | null;
  behind?: number | null;
}

export interface GpsHudProps {
  // Header
  holeNumber: number;
  par: number | null;
  holeLengthYards: number | null;
  playerHandicap: number | null;
  courseName: string;
  holeName: string | null;
  liveTournament: HudTournamentInfo | null;

  // Distances
  unit: Unit;
  readout: YardageReadout;
  /** Fallback center yards when no geometry is available. */
  fallbackCenterYards: number | null;

  // Live state
  playerPosition: LatLng | null;
  playerAccuracy: number | null;
  weather: HudWeatherState;

  // ACE caddie text
  caddieInsight: string;

  // Measurement
  measureActive: boolean;
  onToggleMeasure: () => void;
  measurePoint: LatLng | null;
  onClearMeasure: () => void;

  // Layer toggles (already wired in parent)
  showHazards: boolean;
  onToggleHazards: () => void;
  showOverlays: boolean;
  onToggleOverlays: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;

  // Map ops
  onRecenter: () => void;
  onFitHole: () => void;
  onFlyover: () => void;
  flyoverDisabled: boolean;
  flyoverRunning: boolean;
}

const unitLabel = (u: Unit) => (u === "meters" ? "m" : "yd");
const fmt = (v: number | null) => (v == null ? "—" : Math.round(v).toString());

const hazardChip = (k: CarryTarget["kind"]) => {
  switch (k) {
    case "water":
      return { label: "Water", className: "text-sky-300 border-sky-300/40 bg-sky-500/10" };
    case "bunker":
      return { label: "Bunker", className: "text-amber-200 border-amber-200/40 bg-amber-400/10" };
    case "trees":
      return { label: "Trees", className: "text-emerald-300 border-emerald-300/40 bg-emerald-500/10" };
    case "waste":
      return { label: "Waste", className: "text-orange-200 border-orange-200/40 bg-orange-400/10" };
    case "ob":
      return { label: "OB", className: "text-red-300 border-red-300/40 bg-red-500/10" };
    default:
      return { label: "Hazard", className: "text-white/80 border-white/30 bg-white/5" };
  }
};

const hazardRisk = (carry: number): "Low" | "Medium" | "High" => {
  if (carry <= 130) return "Low";
  if (carry <= 200) return "Medium";
  return "High";
};

/** Animated count that eases into a new value. */
function useAnimatedNumber(value: number | null, ms = 380): number | null {
  const [shown, setShown] = useState<number | null>(value);
  useEffect(() => {
    if (value == null) {
      setShown(null);
      return;
    }
    const start = performance.now();
    const from = shown ?? value;
    const to = value;
    if (from === to) return;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ms]);
  return shown;
}

export function GpsHud(props: GpsHudProps) {
  const {
    holeNumber,
    par,
    holeLengthYards,
    playerHandicap,
    courseName,
    holeName,
    liveTournament,
    unit,
    readout,
    fallbackCenterYards,
    playerPosition,
    playerAccuracy,
    weather,
    caddieInsight,
    measureActive,
    onToggleMeasure,
    measurePoint,
    onClearMeasure,
    showHazards,
    onToggleHazards,
    showOverlays,
    onToggleOverlays,
    showLabels,
    onToggleLabels,
    onRecenter,
    onFitHole,
    onFlyover,
    flyoverDisabled,
    flyoverRunning,
  } = props;

  const u = unitLabel(unit);
  const center = readout.center ?? fallbackCenterYards;
  const animatedCenter = useAnimatedNumber(center);
  const front = readout.front;
  const back = readout.back;

  const measurement = useMemo(() => {
    if (!measureActive || !measurePoint || !playerPosition) return null;
    return measureBetween(playerPosition, measurePoint, unit);
  }, [measureActive, measurePoint, playerPosition, unit]);

  const accClass = playerPosition
    ? classifyAccuracy(playerAccuracy) === "low"
      ? "text-amber-300"
      : "text-emerald-300"
    : "text-amber-300";

  const wx = weather.status === "ready" && "data" in weather ? weather.data : null;

  return (
    <>
      {/* Premium overlays: emerald wash + corner vignette. Pure CSS, no perf cost. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_50%,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,28,18,0.30)_0%,rgba(4,28,18,0.0)_22%,rgba(4,28,18,0.0)_70%,rgba(4,28,18,0.55)_100%)]" />

      {/* TOP STRIP — hole/par/length + course name + GPS + weather */}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
        {/* Top-left: Hole / Par / Length / HCP */}
        <div className="pointer-events-auto rounded-xl border border-gold/35 bg-black/55 px-2.5 py-1.5 shadow-lg backdrop-blur-md">
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-2xl leading-none text-gold">{holeNumber}</span>
            <span className="text-[9px] uppercase tracking-widest text-gold-soft">Hole</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-white/75">
            <span>
              Par <span className="text-gold">{par ?? "—"}</span>
            </span>
            <span className="text-white/30">•</span>
            <span>{holeLengthYards != null ? `${Math.round(holeLengthYards)} yd` : "— yd"}</span>
            {playerHandicap != null && (
              <>
                <span className="text-white/30">•</span>
                <span>
                  HCP <span className="text-gold">{playerHandicap}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Top-center: course / hole name / tournament — hidden on very narrow */}
        <div className="pointer-events-none hidden flex-1 flex-col items-center pt-0.5 sm:flex">
          <div className="rounded-full border border-gold/30 bg-black/45 px-3 py-1 text-center backdrop-blur-md">
            <p className="font-serif text-[11px] leading-tight text-gold">{courseName}</p>
            {holeName && <p className="text-[9px] uppercase tracking-wider text-white/65">{holeName}</p>}
          </div>
          {liveTournament && (
            <div className="mt-1 flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-red-200 backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400" />
              </span>
              LIVE · {liveTournament.name}
            </div>
          )}
        </div>

        {/* Top-right: GPS + wind + temp */}
        <div className="pointer-events-auto flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-black/55 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider backdrop-blur-md">
            {playerPosition ? <Wifi className={`h-3 w-3 ${accClass}`} /> : <WifiOff className="h-3 w-3 text-amber-300" />}
            <span className="text-white/90">{playerPosition ? "GPS LIVE" : "GPS WAIT"}</span>
            {playerAccuracy != null && playerPosition && (
              <span className={accClass}>±{Math.round(playerAccuracy)}m</span>
            )}
          </div>
          {wx && (
            <div className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-black/55 px-2 py-1 text-[10px] backdrop-blur-md">
              <Wind className="h-3 w-3 text-emerald-300" />
              <span className="text-white/85">
                {Math.round(wx.windSpeedKmh)} <span className="text-white/55">km/h</span>{" "}
                <span className="text-gold-soft">{wx.windDirectionLabel}</span>
              </span>
              <span className="text-white/30">•</span>
              <Thermometer className="h-3 w-3 text-amber-200" />
              <span className="text-white/85">{Math.round(wx.temperatureC)}°</span>
            </div>
          )}
        </div>
      </div>

      {/* HERO DISTANCE CARD — horizontal Front · Center · Back pinned to
          the bottom safe zone, above the ACE caddie panel. Never sits
          across the map center, never collides with the right-edge. */}
      <div className="pointer-events-none absolute inset-x-2 bottom-[6.25rem]">
        <div className="pointer-events-auto mx-auto max-w-[420px] overflow-hidden rounded-2xl border border-gold/45 bg-gradient-to-br from-black/80 via-emerald-950/70 to-black/80 shadow-[0_10px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          {animatedCenter == null ? (
            <div className="flex flex-col items-center px-4 py-3 text-center">
              <span className="text-[9px] uppercase tracking-[0.25em] text-gold-soft">Yardages</span>
              <span className="mt-1 font-serif text-lg text-gold">Mapping required</span>
              <span className="mt-0.5 text-[10px] text-white/55">
                Professional course mapping needed for live distances.
              </span>
            </div>
          ) : (
            <div className="flex items-stretch">
              <div className="flex flex-1 flex-col items-center justify-center border-r border-gold/15 px-2 py-2">
                <span className="text-[8px] uppercase tracking-widest text-white/55">Front</span>
                <span className="font-serif text-xl text-gold tabular-nums">{fmt(front)}</span>
              </div>
              <div className="flex flex-[1.4] flex-col items-center justify-center px-3 py-2">
                <span className="text-[9px] uppercase tracking-[0.2em] text-gold-soft">Center · Green</span>
                <span className="font-serif text-[44px] leading-none font-bold text-gold tabular-nums">
                  {animatedCenter}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-gold-soft">{u}</span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center border-l border-gold/15 px-2 py-2">
                <span className="text-[8px] uppercase tracking-widest text-white/55">Back</span>
                <span className="font-serif text-xl text-gold tabular-nums">{fmt(back)}</span>
              </div>
            </div>
          )}
          {animatedCenter != null && readout.pin != null && (
            <div className="flex items-center justify-center gap-1 border-t border-gold/15 px-3 py-1 text-[9px] uppercase tracking-wider text-gold-soft">
              <Flag className="h-2.5 w-2.5" /> Pin
              <span className="font-serif text-sm text-gold tabular-nums">{fmt(readout.pin)}</span>
              <span>{u}</span>
            </div>
          )}
        </div>
      </div>

      {/* LEFT MAP CONTROL DOCK — slim semi-transparent icon column pinned
          mid-left so it never covers the hero card or the caddie panel. */}
      <div className="pointer-events-auto absolute top-1/2 left-1.5 flex -translate-y-1/2 flex-col gap-0.5 rounded-2xl border border-gold/20 bg-black/35 p-0.5 shadow-md backdrop-blur-md">
        <HudCtrl active={showOverlays} onClick={onToggleOverlays} label="Overlays">
          <LayersIcon className="h-3.5 w-3.5" />
        </HudCtrl>
        <HudCtrl active={showHazards} onClick={onToggleHazards} label="Hazards">
          <Droplets className="h-3.5 w-3.5" />
        </HudCtrl>
        <HudCtrl active={showLabels} onClick={onToggleLabels} label="Yardages">
          <Mountain className="h-3.5 w-3.5" />
        </HudCtrl>
        <HudCtrl onClick={onRecenter} label="Recenter">
          <Crosshair className="h-3.5 w-3.5" />
        </HudCtrl>
        <HudCtrl onClick={onFitHole} label="Fit hole">
          <Maximize2 className="h-3.5 w-3.5" />
        </HudCtrl>
        <HudCtrl
          onClick={onFlyover}
          disabled={flyoverDisabled || flyoverRunning}
          label={flyoverRunning ? "Flyover…" : "Flyover"}
        >
          <Plane className="h-3.5 w-3.5" />
        </HudCtrl>
      </div>

      {/* HAZARD TILES — only when we actually have evidence-backed carries */}
      {readout.carries.length > 0 && (
        <div className="pointer-events-auto absolute left-2 right-2 bottom-[12.5rem] flex gap-1.5 overflow-x-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {readout.carries.slice(0, 6).map((c) => {
            const chip = hazardChip(c.kind);
            const risk = hazardRisk(c.carry);
            return (
              <div
                key={c.id}
                className="min-w-[112px] shrink-0 rounded-xl border border-gold/25 bg-black/65 px-2.5 py-1.5 shadow-lg backdrop-blur-md animate-fade-in"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider ${chip.className}`}
                  >
                    {chip.label}
                  </span>
                  <span
                    className={`text-[8px] uppercase tracking-wider ${
                      risk === "High"
                        ? "text-red-300"
                        : risk === "Medium"
                          ? "text-amber-300"
                          : "text-emerald-300"
                    }`}
                  >
                    {risk}
                  </span>
                </div>
                <div className="mt-1 flex items-end justify-between text-gold">
                  <span className="text-[9px] uppercase tracking-wider text-gold-soft">Carry</span>
                  <span className="font-serif text-base leading-none tabular-nums">{fmt(c.carry)}</span>
                  <span className="text-[9px] text-gold-soft">{u}</span>
                </div>
                <div className="mt-0.5 flex items-end justify-between text-white/80">
                  <span className="text-[9px] uppercase tracking-wider text-white/55">Reach</span>
                  <span className="font-serif text-xs tabular-nums">{fmt(c.near)}</span>
                  <span className="text-[9px] text-white/55">{u}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ACE CADDIE — bottom floating panel */}
      <div className="pointer-events-auto absolute inset-x-2 bottom-11">
        <div className="overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-r from-black/85 via-emerald-950/75 to-black/85 shadow-[0_10px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className="flex items-start gap-2 px-3 py-2">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-gold-soft">
                  ACE · AI Caddie
                </p>
                {liveTournament && liveTournament.position != null && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-gold/30 bg-black/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-gold">
                    <Trophy className="h-2.5 w-2.5" />
                    P{liveTournament.position}
                    {liveTournament.behind != null && (
                      <span className="text-white/70">
                        {liveTournament.behind === 0 ? " · LEAD" : ` · ${liveTournament.behind}`}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-foreground">
                {caddieInsight}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTION DOCK — measure / clear */}
      <div className="pointer-events-auto absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={onToggleMeasure}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md transition-all active:scale-95 ${
            measureActive
              ? "border-gold bg-gold text-black shadow-[0_0_24px_rgba(245,200,75,0.35)]"
              : "border-gold/35 bg-black/60 text-gold"
          }`}
        >
          <Ruler className="h-3.5 w-3.5" /> Measure
        </button>
        {measurement && (
          <div className="flex items-center gap-1.5 rounded-full border border-gold/45 bg-black/80 px-3 py-1.5 backdrop-blur-md">
            <span className="font-serif text-sm text-gold tabular-nums">{measurement.distance}</span>
            <span className="text-[9px] uppercase tracking-wider text-gold-soft">{measurement.unit}</span>
            <span className="text-[9px] text-white/55">brg {Math.round(measurement.bearing)}°</span>
            <button
              type="button"
              onClick={onClearMeasure}
              className="ml-1 rounded-full p-0.5 text-white/65 hover:text-gold"
              aria-label="Clear measurement"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </div>
        )}
        {measureActive && !measurePoint && (
          <div className="rounded-full border border-gold/35 bg-black/60 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-gold-soft backdrop-blur-md">
            {playerPosition ? "Tap map to mark target" : "GPS required"}
          </div>
        )}
      </div>
    </>
  );
}

function HudCtrl({
  children,
  onClick,
  active,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95 ${
        disabled
          ? "cursor-not-allowed border-white/10 bg-black/30 text-white/30"
          : active
            ? "border-gold bg-gold/20 text-gold shadow-[0_0_16px_rgba(245,200,75,0.25)]"
            : "border-gold/20 bg-black/30 text-gold-soft hover:text-gold"
      }`}
    >
      {children}
    </button>
  );
}