// Owner-only debug/status panel. Collapsed by default so it never gets
// in the way of normal play. Surfaces the technical state the owner
// needs to trust the platform (course source, quality, cache status,
// round state, GPS accuracy, last save).

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Terminal } from "lucide-react";
import type { RoundState } from "@/lib/round-engine";

export interface OwnerDebugPanelProps {
  courseName: string;
  courseId: string;
  source: string;             // "GolfAPI.io Auto" | "Manual Enhanced" | "Mixed"
  qualityScore: number;
  qualityLabel: string;
  cached: boolean;
  round: RoundState;
  gpsAccuracyMeters: number | null;
  mapView: "premium" | "satellite";
}

export function OwnerDebugPanel(props: OwnerDebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const lastMeasurement = props.round.measurements[0]?.savedAt ?? null;
  const roundStatus =
    props.round.endedAt != null
      ? "Ended"
      : props.round.measurements.length > 0 || props.round.holeVisits.length > 0
      ? "In progress"
      : "Idle";

  return (
    <div className="pointer-events-auto absolute right-3 bottom-24 z-30 max-w-[280px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/80 backdrop-blur-md"
      >
        <Terminal className="h-3 w-3" />
        Owner debug
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 rounded-xl border border-white/15 bg-black/85 px-3 py-2 text-[10px] leading-relaxed text-white/80 backdrop-blur-md">
          <Row label="Course" value={props.courseName} />
          <Row label="Course ID" value={props.courseId} mono />
          <Row label="Source" value={props.source} />
          <Row label="Quality" value={`${props.qualityScore}% · ${props.qualityLabel}`} />
          <Row label="Cache" value={props.cached ? "Ready" : "Not cached"} />
          <Row label="Network" value={online ? "Online" : "Offline"} tone={online ? undefined : "amber"} />
          <Row label="Map view" value={props.mapView} />
          <Row
            label="GPS accuracy"
            value={
              props.gpsAccuracyMeters != null
                ? `±${Math.round(props.gpsAccuracyMeters)} m`
                : "—"
            }
          />
          <Row label="Round" value={roundStatus} />
          <Row label="Holes visited" value={String(new Set(props.round.holeVisits.map((v) => v.holeNumber)).size)} />
          <Row label="Measurements" value={String(props.round.measurements.length)} />
          <Row label="Breadcrumbs" value={String(props.round.path.length)} />
          <Row
            label="Last save"
            value={lastMeasurement ? relTime(lastMeasurement) : "—"}
          />
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "amber";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="uppercase tracking-[0.2em] text-white/50">{label}</span>
      <span
        className={`min-w-0 flex-1 truncate text-right ${mono ? "font-mono text-[9px]" : ""} ${
          tone === "amber" ? "text-amber-200" : "text-white/90"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}