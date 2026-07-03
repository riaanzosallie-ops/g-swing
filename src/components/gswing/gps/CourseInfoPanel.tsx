import { useEffect, useState } from "react";
import { Info, X as XIcon, Database, Satellite, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface CourseInfoPanelProps {
  course: {
    id: string;
    name: string;
    city?: string;
    country?: string;
    lat: number | null;
    lng: number | null;
    holes_count?: number | null;
  };
  /** Number of tee boxes on the currently loaded hole (from GolfAPI.io). */
  teeBoxes: number;
  /** Renderer active for the current visual mode. */
  renderer: "Mapbox" | "Esri" | "Premium SVG";
}

interface DbMeta {
  external_provider: string | null;
  external_course_id: string | null;
  last_synced: string | null;
  updated_at: string | null;
}

/**
 * Small info button + slide-down card. Purely informational — surfaces
 * the data pipeline (GolfAPI.io -> Lovable Cloud cache -> Mapbox
 * renderer) so a golfer or investor can see the live source of truth
 * for the loaded course. Never triggers a GolfAPI call itself.
 */
export function CourseInfoPanel({ course, teeBoxes, renderer }: CourseInfoPanelProps) {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<DbMeta | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || meta) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("gswing_course_maps")
          .select("external_provider, external_course_id, last_synced, updated_at")
          .eq("id", course.id)
          .maybeSingle();
        if (!cancelled) setMeta((data ?? null) as DbMeta | null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, course.id, meta]);

  const coord =
    course.lat != null && course.lng != null
      ? `${course.lat.toFixed(5)}, ${course.lng.toFixed(5)}`
      : "—";
  const lastSynced = meta?.last_synced ?? meta?.updated_at ?? null;
  const lastSyncedLabel = lastSynced
    ? new Date(lastSynced).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="pointer-events-auto absolute left-3 top-16 z-30">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Course info"
          className="grid h-9 w-9 place-items-center rounded-full border border-gold/35 bg-black/70 text-gold-soft shadow-elegant backdrop-blur-md hover:text-gold"
        >
          <Info className="h-4 w-4" />
        </button>
      ) : (
        <div className="w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-gold/30 bg-black/85 p-3 text-white/90 shadow-elegant backdrop-blur-xl">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-soft">
                Course Information
              </p>
              <p className="mt-0.5 truncate font-serif text-sm text-gold">{course.name}</p>
              {(course.city || course.country) && (
                <p className="truncate text-[11px] text-white/60">
                  {[course.city, course.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="-mr-1 -mt-1 rounded-full p-1 text-white/55 hover:bg-white/10 hover:text-white"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <ul className="mt-3 space-y-1.5 text-[11px] leading-snug">
            <Row icon={<Database className="h-3 w-3" />} label="Source" value={meta?.external_provider ?? "GolfAPI.io"} />
            <Row icon={<Database className="h-3 w-3" />} label="Cache" value="Lovable Cloud" />
            <Row icon={<Satellite className="h-3 w-3" />} label="Renderer" value={renderer} />
            <Row
              icon={<MapPin className="h-3 w-3" />}
              label="Holes / Tees"
              value={`${course.holes_count ?? 18} · ${teeBoxes} tee${teeBoxes === 1 ? "" : "s"}`}
            />
            <Row icon={<MapPin className="h-3 w-3" />} label="Coordinates" value={coord} mono />
            <Row
              icon={loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
              label="Last synced"
              value={loading ? "Checking…" : lastSyncedLabel}
            />
          </ul>

          <p className="mt-3 text-[10px] leading-snug text-white/50">
            All hole data is served from the Lovable Cloud cache. GolfAPI.io is
            queried only when the cache is empty or manually refreshed.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="grid h-5 w-5 place-items-center rounded-full border border-gold/25 bg-black/40 text-gold-soft">
        {icon}
      </span>
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-[0.18em] text-white/55">
        {label}
      </span>
      <span className={`flex-1 truncate text-[11px] text-white/90 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </li>
  );
}