import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Flag, Target, Waves, MountainSnow, Trees, AlertTriangle, ArrowDownToLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { HoleGeometryPayload } from "@/lib/course-geometry";
import { asUnit, computeYardages, type Unit } from "@/lib/yardage-engine";
import type { LatLng } from "@/lib/gps-utils";

function fmt(value: number | null, unit: Unit): string {
  const v = asUnit(value, unit);
  return v == null ? "—" : String(v);
}

function HazardIcon({ kind }: { kind: string }) {
  if (kind === "water") return <Waves className="h-3.5 w-3.5 text-sky-300" />;
  if (kind === "bunker" || kind === "waste") return <MountainSnow className="h-3.5 w-3.5 text-amber-300" />;
  if (kind === "trees") return <Trees className="h-3.5 w-3.5 text-emerald-300" />;
  if (kind === "ob") return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />;
  return <Target className="h-3.5 w-3.5 text-gold" />;
}

export interface YardagePanelProps {
  geometry: HoleGeometryPayload | null;
  playerPosition: LatLng | null;
  lastShotEnd: LatLng | null;
  unit: Unit;
  /** Fallback yards-to-pin / center used when full geometry isn't loaded. */
  fallbackCenterYards: number | null;
}

/**
 * Premium collapsible yardage panel. Renders the smart yardage engine output
 * — never fabricates values. When geometry is missing it still shows the
 * fallback Center pill so the user always sees *something* useful.
 */
export function YardagePanel({
  geometry,
  playerPosition,
  lastShotEnd,
  unit,
  fallbackCenterYards,
}: YardagePanelProps) {
  const [open, setOpen] = useState(true);

  const readout = useMemo(
    () => computeYardages(playerPosition, geometry, lastShotEnd),
    [playerPosition?.lat, playerPosition?.lng, geometry, lastShotEnd?.lat, lastShotEnd?.lng], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const u = unit === "meters" ? "m" : "y";
  const hasAny =
    readout.front != null || readout.center != null || readout.back != null || readout.pin != null;

  return (
    <Card className="gradient-card overflow-hidden border-gold/25 p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-gold" />
          <span className="font-serif text-sm text-gold">Smart Yardages</span>
          {readout.inGreenMode && (
            <span className="rounded-full border border-emerald-300/50 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
              Green Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!hasAny && fallbackCenterYards != null && (
            <span className="text-xs text-gold-soft">
              CENTER <span className="font-serif text-base text-gold">{fallbackCenterYards}</span>
              {u}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-gold/80" /> : <ChevronDown className="h-4 w-4 text-gold/80" />}
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-gold/15 p-3">
          {/* Primary F / C / B / Pin tiles — only show tiles backed by real data. */}
          {hasAny ? (
            <div className="grid grid-cols-4 gap-2">
              <YardTile label="Front" value={fmt(readout.front, unit)} unit={u} tone="emerald" />
              <YardTile label="Center" value={fmt(readout.center, unit)} unit={u} tone="gold" highlight />
              <YardTile label="Back" value={fmt(readout.back, unit)} unit={u} tone="red" />
              <YardTile label="Pin" value={fmt(readout.pin, unit)} unit={u} tone="white" />
            </div>
          ) : (
            <div className="rounded-md border border-border/60 p-3 text-xs text-muted-foreground">
              Front / Center / Back yardages appear here once this hole has surveyed geometry. Showing
              fallback CENTER {fallbackCenterYards ?? "—"}{u} above.
            </div>
          )}

          {/* Green Intelligence chips — only when within 60y of pin. */}
          {readout.inGreenMode && hasAny && (
            <div className="rounded-lg border border-emerald-300/30 bg-emerald-400/8 p-2">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-emerald-200/80">
                Green Intelligence
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <GreenChip label="F" value={fmt(readout.front, unit)} unit={u} dot="#34d399" />
                <GreenChip label="M" value={fmt(readout.center, unit)} unit={u} dot="#F5C84B" />
                <GreenChip label="B" value={fmt(readout.back, unit)} unit={u} dot="#ef4444" />
                {readout.dailyPin && (
                  <GreenChip
                    label={`Pin · ${readout.dailyPin.label}`}
                    value={fmt(readout.pin, unit)}
                    unit={u}
                    dot={readout.dailyPin.color}
                  />
                )}
              </div>
              {readout.missSide && readout.missReason && (
                <p className="mt-2 text-[11px] text-emerald-100/80">
                  <span className="font-semibold uppercase tracking-wide text-emerald-200">
                    Miss {readout.missSide}
                  </span>{" "}
                  — {readout.missReason}
                </p>
              )}
            </div>
          )}

          {/* Carry distances over hazards in the line. */}
          {readout.carries.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Carry</p>
              <div className="grid grid-cols-2 gap-2">
                {readout.carries.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-md border border-border/70 bg-background/40 px-2 py-1.5"
                  >
                    <HazardIcon kind={c.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] text-muted-foreground">{c.label}</p>
                      <p className="font-serif text-sm text-gold">
                        {fmt(c.carry, unit)}
                        <span className="text-[10px] text-muted-foreground">{u}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Layups + Doglegs */}
          {(readout.layups.length > 0 || readout.doglegs.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {readout.layups.map((p) => (
                <span
                  key={`lu-${p.label}`}
                  className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] text-gold"
                >
                  Layup · {p.label} {fmt(p.yards, unit)}{u}
                </span>
              ))}
              {readout.doglegs.map((p) => (
                <span
                  key={`dg-${p.label}`}
                  className="rounded-full border border-white/30 bg-white/5 px-2.5 py-1 text-[11px] text-white/80"
                >
                  Dogleg · {p.label} {fmt(p.yards, unit)}{u}
                </span>
              ))}
            </div>
          )}

          {readout.fromLastShot != null && (
            <div className="flex items-center gap-2 rounded-md border border-gold/20 bg-black/30 px-2.5 py-1.5 text-[11px]">
              <ArrowDownToLine className="h-3.5 w-3.5 text-gold" />
              <span className="text-muted-foreground">From last shot</span>
              <span className="ml-auto font-serif text-sm text-gold">
                {fmt(readout.fromLastShot, unit)}
                <span className="text-[10px] text-muted-foreground">{u}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function YardTile({
  label,
  value,
  unit,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  tone: "emerald" | "gold" | "red" | "white";
  highlight?: boolean;
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: "border-emerald-300/40 text-emerald-200",
    gold: "border-gold/50 text-gold",
    red: "border-red-400/40 text-red-300",
    white: "border-white/40 text-white",
  };
  return (
    <div
      className={`rounded-md border bg-background/40 px-2 py-1.5 text-center ${toneClasses[tone]} ${
        highlight ? "shadow-[0_0_18px_hsl(45_85%_55%/0.18)]" : ""
      }`}
    >
      <div className="text-[9px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="font-serif text-lg leading-none">
        {value}
        <span className="ml-0.5 text-[10px] opacity-70">{unit}</span>
      </div>
    </div>
  );
}

function GreenChip({
  label,
  value,
  unit,
  dot,
}: {
  label: string;
  value: string;
  unit: string;
  dot: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1">
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
      <span className="text-[10px] uppercase tracking-wide text-white/70">{label}</span>
      <span className="font-serif text-sm text-white">
        {value}
        <span className="text-[10px] text-white/60">{unit}</span>
      </span>
    </span>
  );
}