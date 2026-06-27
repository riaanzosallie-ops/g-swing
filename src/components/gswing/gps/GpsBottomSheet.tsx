import { useState } from "react";
import { ChevronDown, Flag, Droplets, Sparkles, Ruler, Mountain, X as XIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { CarryTarget, Unit, YardageReadout } from "@/lib/yardage-engine";
import type { LatLng } from "@/lib/gps-utils";
import { measureBetween } from "@/lib/gswing-gps";

type SectionKey = "green" | "hazards" | "ace" | "measure" | "yardages";

const fmt = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : Math.round(v).toString();
const unitShort = (u: Unit) => (u === "meters" ? "m" : "yd");

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
}: GpsBottomSheetProps) {
  const [open, setOpen] = useState<SectionKey>("green");
  const u = unitShort(unit);

  const rawCenter = readout.center ?? fallbackCenterYards;
  const center = rawCenter != null && rawCenter > 0 ? rawCenter : null;
  const front = readout.front;
  const back = readout.back;

  const measurement =
    measureActive && measurePoint && playerPosition
      ? measureBetween(playerPosition, measurePoint, unit)
      : null;

  return (
    <div className="md:hidden">
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-b from-black/80 via-emerald-950/60 to-black/85 shadow-elegant backdrop-blur-xl">
        {/* GREEN */}
        <Section
          label="Green"
          icon={<Flag className="h-3.5 w-3.5" />}
          open={open === "green"}
          onToggle={() => setOpen(open === "green" ? ("" as SectionKey) : "green")}
        >
          {center == null ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <DistanceCell label="Front" value="—" muted />
              <DistanceCell label="Center" value="Mapping required" muted small />
              <DistanceCell label="Back" value="—" muted />
            </div>
          ) : (
            <div className="grid grid-cols-3 items-end gap-2 text-center">
              <DistanceCell label="Front" value={fmt(front)} unit={u} />
              <div className="flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-[0.25em] text-gold-soft">
                  Center
                </span>
                <span className="font-serif text-4xl leading-none font-bold text-gold tabular-nums">
                  {fmt(center)}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-gold-soft">
                  {u}
                </span>
              </div>
              <DistanceCell label="Back" value={fmt(back)} unit={u} />
            </div>
          )}
          {readout.pin != null && (
            <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-gold-soft">
              Pin <span className="font-serif text-sm text-gold">{fmt(readout.pin)}</span>{" "}
              {u}
            </p>
          )}
        </Section>

        {/* HAZARDS */}
        <Section
          label={`Hazards${readout.carries.length > 0 ? ` · ${readout.carries.length}` : ""}`}
          icon={<Droplets className="h-3.5 w-3.5" />}
          open={open === "hazards"}
          onToggle={() => setOpen(open === "hazards" ? ("" as SectionKey) : "hazards")}
        >
          {readout.carries.length === 0 ? (
            <p className="text-[11px] text-white/70">
              No mapped hazards in play from your current position.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {readout.carries.slice(0, 8).map((c) => (
                <HazardRow key={c.id} c={c} unit={u} />
              ))}
            </ul>
          )}
        </Section>

        {/* ACE */}
        <Section
          label="ACE Caddie"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          open={open === "ace"}
          onToggle={() => setOpen(open === "ace" ? ("" as SectionKey) : "ace")}
        >
          <p className="text-[12px] leading-snug text-foreground">{caddieInsight}</p>
        </Section>

        {/* MEASURE */}
        <Section
          label="Measure"
          icon={<Ruler className="h-3.5 w-3.5" />}
          open={open === "measure"}
          onToggle={() => setOpen(open === "measure" ? ("" as SectionKey) : "measure")}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMeasure}
              className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-[11px] font-semibold uppercase tracking-wider transition-all active:scale-95 ${
                measureActive
                  ? "border-gold bg-gold text-black shadow-[0_0_18px_rgba(245,200,75,0.35)]"
                  : "border-gold/35 bg-black/60 text-gold"
              }`}
            >
              <Ruler className="h-3.5 w-3.5" />
              {measureActive ? "Measuring" : "Start Measure"}
            </button>
            {measurement && (
              <button
                type="button"
                onClick={onClearMeasure}
                className="flex h-11 items-center justify-center rounded-xl border border-gold/40 bg-black/60 px-3 text-gold-soft hover:text-gold"
                aria-label="Clear measurement"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          {measureActive && !measurePoint && (
            <p className="mt-2 text-[10px] uppercase tracking-wider text-gold-soft">
              {playerPosition ? "Tap the map to mark a target" : "GPS required"}
            </p>
          )}
          {measurement && (
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-serif text-2xl text-gold tabular-nums">
                {measurement.distance}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-gold-soft">
                {measurement.unit}
              </span>
              <span className="ml-auto text-[10px] text-white/55">
                Bearing {Math.round(measurement.bearing)}°
              </span>
            </div>
          )}
        </Section>

        {/* SMART YARDAGES */}
        <Section
          label="Smart Yardages"
          icon={<Mountain className="h-3.5 w-3.5" />}
          open={open === "yardages"}
          onToggle={() => setOpen(open === "yardages" ? ("" as SectionKey) : "yardages")}
          last
        >
          {readout.layups.length === 0 && readout.doglegs.length === 0 ? (
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
                    {Math.round(l.yards)} {u}
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
                    {Math.round(d.yards)} {u}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  label,
  icon,
  open,
  onToggle,
  last,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={`flex w-full items-center gap-2 px-4 py-3 text-left ${
            last ? "" : "border-b border-gold/15"
          }`}
        >
          <span className="text-gold">{icon}</span>
          <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-soft">
            {label}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-gold-soft transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function DistanceCell({
  label,
  value,
  unit,
  muted,
  small,
}: {
  label: string;
  value: string;
  unit?: string;
  muted?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] uppercase tracking-widest text-white/55">{label}</span>
      <span
        className={`font-serif tabular-nums ${
          small ? "text-[11px]" : "text-xl"
        } ${muted ? "text-gold/60" : "text-gold"}`}
      >
        {value}
      </span>
      {unit && !muted && (
        <span className="text-[9px] uppercase tracking-wider text-gold-soft">{unit}</span>
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