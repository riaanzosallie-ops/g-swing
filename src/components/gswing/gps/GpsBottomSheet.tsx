import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  Crosshair,
  Droplets,
  Ruler,
  Sparkles,
  Mountain,
  Target as TargetIcon,
  X as XIcon,
} from "lucide-react";
import type { CarryTarget, Unit, YardageReadout } from "@/lib/yardage-engine";
import type { LatLng } from "@/lib/gps-utils";
import { measureBetween } from "@/lib/gswing-gps";
import type { ClubSuggestion } from "@/lib/club-recommender";
import { ShotPlanPanel, type ShotPlanPanelProps } from "@/components/gswing/gps/ShotPlanPanel";

type SectionKey = "hazards" | "ace" | "yardages";

const fmt = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : Math.round(v).toString();
const unitShort = (u: Unit) => (u === "meters" ? "m" : "yd");

export interface MeasureTarget {
  id: string;
  label: string;
  latlng: LatLng;
  kind: "pin" | "front" | "center" | "back" | "layup" | "hazard";
}

export interface GpsBottomSheetProps {
  unit: Unit;
  readout: YardageReadout;
  fallbackCenterYards: number | null;
  caddieInsight: string;
  measureActive: boolean;
  onToggleMeasure: () => void;
  measurePoint: LatLng | null;
  onClearMeasure: () => void;
  playerPosition: LatLng | null;
  /** Quick-tap targets (Pin, Green front/center/back, Layup, Hazard). */
  targets?: MeasureTarget[];
  /** Called when the user picks a quick target chip. */
  onPickTarget?: (t: MeasureTarget) => void;
  /** Recommended club for the current measurement, from My Bag. */
  clubSuggestion?: ClubSuggestion | null;
  /** When provided, replaces the inline measurement UI with the full
   *  Shot Planning panel (Round Engine save/recall included). */
  shotPlan?: ShotPlanPanelProps | null;
}

/**
 * Mobile-only GPS bottom sheet. Houses everything that used to clutter
 * the live map on small screens: front/center/back distances, hazards,
 * ACE caddie insight, measure controls and smart yardages. Single
 * section open at a time, defaulting to Green so the most important
 * data is always visible first.
 */
export function GpsBottomSheet({
  unit,
  readout,
  fallbackCenterYards,
  caddieInsight,
  measureActive,
  onToggleMeasure,
  measurePoint,
  onClearMeasure,
  playerPosition,
  targets = [],
  onPickTarget,
  clubSuggestion = null,
  shotPlan = null,
}: GpsBottomSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(true);
  const [open, setOpen] = useState<SectionKey>("hazards");
  const u = unitShort(unit);

  const rawCenter = readout.center ?? fallbackCenterYards;
  const center = rawCenter != null && rawCenter > 0 ? rawCenter : null;
  const front = readout.front;
  const back = readout.back;

  const measurement =
    measureActive && measurePoint && playerPosition
      ? measureBetween(playerPosition, measurePoint, unit)
      : null;

  // Minimized — single floating pill, frees the hole. Tap to restore.
  if (minimized) {
    return (
      <div className="pointer-events-auto absolute inset-x-0 bottom-3 z-30 flex justify-center px-3">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex items-center gap-3 rounded-full border border-gold/35 bg-black/75 px-4 py-2 text-[11px] backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
        >
          <span className="text-[9px] uppercase tracking-[0.22em] text-gold-soft">Green</span>
          <span className="font-serif text-lg tabular-nums text-gold">
            {center != null ? fmt(center) : "—"}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-gold-soft">{u}</span>
          <ChevronUp className="h-3.5 w-3.5 text-gold" />
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-2 z-30">
      <div className="rounded-2xl border border-gold/30 bg-black/80 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        {/* Grab handle + minimize */}
        <div className="flex items-center justify-between px-3 pt-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="flex h-3 flex-1 items-center justify-center"
          >
            <span className="block h-1 w-10 rounded-full bg-gold/40" />
          </button>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimize"
            className="grid h-6 w-6 place-items-center rounded-full text-gold-soft hover:text-gold"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* GREEN — always visible, reference layout */}
        <div className="px-3 pb-2.5 pt-0.5">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-gold/40 text-gold">
              <Crosshair className="h-3 w-3" />
            </span>
            <span className="flex-1 font-serif text-sm text-gold">Green</span>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="grid h-6 w-6 place-items-center rounded-full text-gold-soft transition-transform hover:text-gold"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              <ChevronUp
                className={`h-4 w-4 transition-transform ${
                  expanded ? "rotate-0" : "rotate-180"
                }`}
              />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <DistanceCell label="Front" value={center != null ? fmt(front) : "—"} unit={center != null && front != null ? u : undefined} />
            <DistanceCell label="Center" value={center != null ? fmt(center) : "—"} unit={center != null ? u : undefined} large />
            <DistanceCell label="Back" value={center != null ? fmt(back) : "—"} unit={center != null && back != null ? u : undefined} />
          </div>

          {center == null && (
            <p className="mt-2 text-center text-[11px] font-medium tracking-wide text-gold-soft">
              Mapping required
            </p>
          )}
          {center != null && readout.pin != null && (
            <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-gold-soft">
              Pin <span className="font-serif text-sm text-gold">{fmt(readout.pin)}</span> {u}
            </p>
          )}

          {expanded && <div className="my-2 h-px w-full bg-gold/15" />}

          {expanded && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onToggleMeasure}
              className={`flex h-9 items-center gap-2 rounded-full border px-5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all active:scale-95 ${
                measureActive
                  ? "border-gold bg-gold text-black shadow-[0_0_18px_rgba(245,200,75,0.35)]"
                  : "border-gold/45 bg-transparent text-gold hover:bg-gold/10"
              }`}
            >
              <Ruler className="h-3.5 w-3.5" />
              {measureActive ? "Measuring" : "Measure"}
            </button>
          </div>
          )}

          {measureActive && shotPlan && (
            <div className="mt-2">
              <ShotPlanPanel {...shotPlan} variant="roomy" />
            </div>
          )}

          {measureActive && !shotPlan && (
            <div className="mt-1.5 text-center">
              {!measurePoint && (
                <p className="text-[10px] uppercase tracking-wider text-gold-soft">
                  {playerPosition ? "Tap the map to mark a target" : "GPS required"}
                </p>
              )}
              {measurement && (
                <div className="mt-1 inline-flex items-baseline gap-2">
                  <span className="font-serif text-xl text-gold tabular-nums">
                    {measurement.distance}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-gold-soft">
                    {measurement.unit}
                  </span>
                  <button
                    type="button"
                    onClick={onClearMeasure}
                    className="ml-2 grid h-5 w-5 place-items-center rounded-full border border-gold/35 text-gold-soft hover:text-gold"
                    aria-label="Clear measurement"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              )}
              {measurement && clubSuggestion && (
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/70">
                  <span className="text-gold">{clubSuggestion.club.name}</span>
                  <span className="mx-1 text-white/40">·</span>
                  <span className="text-white/60">{clubSuggestion.note}</span>
                </p>
              )}
            </div>
          )}

          {measureActive && targets.length > 0 && onPickTarget && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              <span className="mr-0.5 text-[9px] uppercase tracking-[0.22em] text-gold-soft/80">
                <TargetIcon className="mr-1 inline h-2.5 w-2.5" />
                Targets
              </span>
              {targets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onPickTarget(t)}
                  className="rounded-full border border-gold/35 bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-soft hover:border-gold hover:text-gold"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expandable sections — only when user opens the sheet */}
        {expanded && (
          <div className="border-t border-gold/15">
            <SectionTabs
              tabs={[
                { id: "hazards", label: `Hazards${readout.carries.length ? ` · ${readout.carries.length}` : ""}`, icon: <Droplets className="h-3.5 w-3.5" /> },
                { id: "ace", label: "ACE", icon: <Sparkles className="h-3.5 w-3.5" /> },
                { id: "yardages", label: "Yardages", icon: <Mountain className="h-3.5 w-3.5" /> },
              ]}
              active={open}
              onChange={(id) => setOpen(id as SectionKey)}
            />
            <div className="max-h-[28vh] overflow-y-auto px-4 pb-3">
              {open === "hazards" && (
                readout.carries.length === 0 ? (
            <p className="text-[11px] text-white/70">
              No mapped hazards in play from your current position.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {readout.carries.slice(0, 8).map((c) => (
                <HazardRow key={c.id} c={c} unit={u} />
              ))}
            </ul>
                )
              )}
              {open === "ace" && (
                <p className="text-[12px] leading-snug text-foreground">{caddieInsight}</p>
              )}
              {open === "yardages" && (
                readout.layups.length === 0 && readout.doglegs.length === 0 ? (
            <p className="text-[11px] text-white/70">
              Layup and dogleg distances appear here once the hole has been mapped.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-1.5">
              {readout.layups.map((l) => (
                <li
                  key={`l-${l.label}`}
                  className="flex items-center justify-between rounded-lg border border-gold/20 bg-black/40 px-2 py-1.5"
                >
                  <span className="text-[10px] uppercase tracking-wider text-gold-soft">
                    {l.label}
                  </span>
                  <span className="font-serif text-sm text-gold tabular-nums">
                    {Number.isFinite(l.yards) ? `${Math.round(l.yards)} ${u}` : "—"}
                  </span>
                </li>
              ))}
              {readout.doglegs.map((d) => (
                <li
                  key={`d-${d.label}`}
                  className="flex items-center justify-between rounded-lg border border-gold/20 bg-black/40 px-2 py-1.5"
                >
                  <span className="text-[10px] uppercase tracking-wider text-gold-soft">
                    {d.label}
                  </span>
                  <span className="font-serif text-sm text-gold tabular-nums">
                    {Number.isFinite(d.yards) ? `${Math.round(d.yards)} ${u}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon: React.ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 px-3 pt-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all ${
            active === t.id
              ? "bg-gold/15 text-gold"
              : "text-gold-soft/70 hover:text-gold"
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

function DistanceCell({
  label,
  value,
  unit,
  large,
}: {
  label: string;
  value: string;
  unit?: string;
  large?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] uppercase tracking-[0.2em] text-white/65">{label}</span>
      <span
        className={`mt-1 font-serif tabular-nums leading-none ${
          large ? "text-2xl text-gold" : "text-lg text-gold"
        }`}
      >
        {value === "—" ? <span className="text-gold/55">—</span> : value}
      </span>
      {unit && (
        <span className="mt-0.5 text-[9px] uppercase tracking-wider text-gold-soft">{unit}</span>
      )}
    </div>
  );
}

function HazardRow({ c, unit }: { c: CarryTarget; unit: string }) {
  const labelMap: Record<CarryTarget["kind"], string> = {
    water: "Water",
    bunker: "Bunker",
    trees: "Trees",
    waste: "Waste",
    ob: "OB",
    other: "Hazard",
  };
  return (
    <li className="flex items-center justify-between rounded-lg border border-gold/20 bg-black/40 px-2 py-1.5">
      <div className="min-w-0 flex-1 truncate">
        <span className="text-[10px] uppercase tracking-wider text-gold-soft">
          {labelMap[c.kind] ?? "Hazard"}
        </span>
        {c.label && (
          <span className="ml-1.5 truncate text-[10px] text-white/65">{c.label}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-wider text-white/55">Carry</span>
        <span className="font-serif text-sm text-gold tabular-nums">
          {Math.round(c.carry)} {unit}
        </span>
      </div>
    </li>
  );
}