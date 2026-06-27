// Owner/admin-only OpenStreetMap (Overpass) scan panel.
// Shows preview-only results — never auto-writes to G-Swing tables.
// Importing is performed by the caller via onImport(selected) and must
// persist with source = "osm_preview", verified = false, needs_review = true.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Crosshair,
  Globe2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  buildOsmImportPreview,
  compareOsmToGswingMapping,
  fetchOsmGolfFeaturesNear,
  OSM_MAX_RADIUS_METERS,
  type GswingHoleSnapshot,
  type OsmGolfBundle,
  type OsmGolfFeature,
  type OsmGolfFeatureType,
  type OsmImportPreviewItem,
} from "@/lib/gswing-osm-overpass";

const GROUP_LABEL: Record<OsmGolfFeatureType, string> = {
  golf_course: "Course",
  hole: "Holes",
  green: "Greens",
  tee: "Tees",
  bunker: "Bunkers",
  fairway: "Fairways",
  water_hazard: "Water",
  rough: "Rough",
  pin: "Pins",
};

const GROUP_ORDER: OsmGolfFeatureType[] = [
  "golf_course",
  "hole",
  "green",
  "tee",
  "pin",
  "bunker",
  "water_hazard",
  "fairway",
  "rough",
];

// Session-only cache (cleared on page reload). Prevents hammering Overpass.
const sessionCache = new Map<string, OsmGolfBundle>();

function cacheKey(lat: number, lng: number, radius: number, holeNumber: number) {
  return `${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}_h${holeNumber}`;
}

export function OsmScanPanel({
  isOpen,
  onClose,
  centerLat,
  centerLng,
  holeNumber,
  gswingSnapshot,
  onImport,
}: {
  isOpen: boolean;
  onClose: () => void;
  centerLat: number;
  centerLng: number;
  holeNumber: number;
  gswingSnapshot: GswingHoleSnapshot;
  onImport: (items: OsmImportPreviewItem[]) => void;
}) {
  const [bundle, setBundle] = useState<OsmGolfBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState<number>(1200);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);

  async function runScan() {
    setLoading(true);
    setError(null);
    setBundle(null);
    setSelectedIds(new Set());
    let lat = centerLat;
    let lng = centerLng;
    // Prefer real GPS when available — falls back to map center silently.
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!("geolocation" in navigator)) {
          reject(new Error("no-geo"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 30000,
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      /* fallback to map center */
    }
    setOrigin({ lat, lng });
    const key = cacheKey(lat, lng, radius, holeNumber);
    const cached = sessionCache.get(key);
    if (cached) {
      setBundle(cached);
      setLoading(false);
      return;
    }
    try {
      const result = await fetchOsmGolfFeaturesNear(lat, lng, radius);
      sessionCache.set(key, result);
      setBundle(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "scan failed");
    } finally {
      setLoading(false);
    }
  }

  const comparison = useMemo(
    () => (bundle ? compareOsmToGswingMapping(bundle, gswingSnapshot) : []),
    [bundle, gswingSnapshot],
  );

  const allSelectable = useMemo(
    () => (bundle ? bundle.features.filter((f) => f.centerLat !== null) : []),
    [bundle],
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleImport() {
    if (!bundle || selectedIds.size === 0) {
      toast.error("Select at least one OSM feature to import.");
      return;
    }
    const picked = bundle.features.filter((f) => selectedIds.has(f.osmId));
    const items = buildOsmImportPreview(picked);
    if (items.length === 0) {
      toast.error("Selected features have no usable coordinates.");
      return;
    }
    onImport(items);
    toast.success(`Imported ${items.length} OSM preview features. Marked unverified.`);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <div className="flex h-[88dvh] w-full max-w-md flex-col rounded-t-2xl border border-gold/30 bg-emerald-950/95 text-foreground shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-gold/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-gold" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-soft">OpenStreetMap</p>
              <h2 className="font-serif text-sm text-gold">Nearby scan · Hole {holeNumber}</h2>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-foreground/70 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex items-center gap-2 border-b border-white/10 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          OpenStreetMap data is community-mapped and must be reviewed before use.
        </div>

        <div className="flex items-center gap-2 px-3 py-2">
          <label className="text-[10px] uppercase tracking-widest text-foreground/70">Radius</label>
          <input
            type="range"
            min={300}
            max={OSM_MAX_RADIUS_METERS}
            step={100}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="flex-1 accent-[hsl(var(--gold))]"
          />
          <span className="w-14 text-right text-[11px] text-gold-soft tabular-nums">{radius}m</span>
          <Button
            size="sm"
            onClick={runScan}
            disabled={loading}
            className="h-7 gap-1 bg-gold text-black hover:bg-gold/85"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
            Scan
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {loading && (
            <div className="flex items-center gap-2 rounded border border-white/10 bg-black/40 p-3 text-[12px] text-foreground/80">
              <Loader2 className="h-4 w-4 animate-spin text-gold" />
              Querying Overpass API…
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2 rounded border border-red-400/30 bg-red-500/10 p-3 text-[12px] text-red-200">
              <ShieldAlert className="mt-0.5 h-4 w-4" />
              <div>
                <p>OpenStreetMap scan unavailable. Try again later.</p>
                <button
                  onClick={runScan}
                  className="mt-2 inline-flex items-center gap-1 text-red-100 underline"
                >
                  <RefreshCw className="h-3 w-3" /> Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && !bundle && (
            <div className="rounded border border-dashed border-gold/20 bg-black/30 p-3 text-[12px] text-foreground/70">
              Tap <span className="text-gold">Scan</span> to query nearby golf features within {radius}m of your current GPS.
            </div>
          )}

          {bundle && !loading && (
            <div className="space-y-3">
              <div className="rounded border border-gold/20 bg-black/40 p-2 text-[11px] text-foreground/80">
                <p>
                  Origin {origin ? `${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}` : "—"} · {bundle.features.length} features ·{" "}
                  Course: <span className="text-gold-soft">{bundle.course?.name ?? "not detected"}</span>
                </p>
              </div>

              <ComparisonPanel rows={comparison} />

              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-gold-soft">Found features</p>
                <div className="mt-1 space-y-2">
                  {GROUP_ORDER.map((g) => {
                    const items = bundle.groups[g];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={g} className="rounded border border-white/10 bg-black/30 p-2">
                        <p className="text-[11px] font-semibold text-foreground/85">
                          {GROUP_LABEL[g]} <span className="text-foreground/55">({items.length})</span>
                        </p>
                        <ul className="mt-1 space-y-1">
                          {items.map((f) => (
                            <FeatureRow
                              key={f.osmId}
                              feature={f}
                              selected={selectedIds.has(f.osmId)}
                              onToggle={() => toggle(f.osmId)}
                            />
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {bundle && !loading && allSelectable.length > 0 && (
          <footer className="flex items-center justify-between gap-2 border-t border-gold/20 px-3 py-2">
            <p className="text-[10px] text-foreground/70">
              {selectedIds.size} selected · imported as <span className="text-gold-soft">osm_preview</span> · unverified
            </p>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={selectedIds.size === 0}
              className="h-7 bg-gold text-black hover:bg-gold/85"
            >
              Import selected
            </Button>
          </footer>
        )}
      </div>
    </div>
  );
}

function FeatureRow({
  feature,
  selected,
  onToggle,
}: {
  feature: OsmGolfFeature;
  selected: boolean;
  onToggle: () => void;
}) {
  const tone =
    feature.confidence === "high"
      ? "text-emerald-300 border-emerald-400/40 bg-emerald-400/10"
      : feature.confidence === "medium"
        ? "text-amber-200 border-amber-400/40 bg-amber-400/10"
        : "text-foreground/60 border-white/15 bg-white/5";
  const canSelect = feature.centerLat !== null && feature.centerLng !== null;
  return (
    <li className="flex items-center justify-between gap-2 rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px]">
      <label className="flex flex-1 items-center gap-2">
        <input
          type="checkbox"
          disabled={!canSelect}
          checked={selected}
          onChange={onToggle}
          className="accent-[hsl(var(--gold))] disabled:opacity-30"
        />
        <span className="flex-1 truncate text-foreground/85">
          {feature.name ?? feature.osmId}
          {feature.holeNumber !== null && (
            <span className="text-foreground/55"> · hole {feature.holeNumber}</span>
          )}
          {feature.par !== null && <span className="text-foreground/55"> · par {feature.par}</span>}
        </span>
      </label>
      <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-widest ${tone}`}>
        {feature.confidence}
      </span>
    </li>
  );
}

function ComparisonPanel({ rows }: { rows: ReturnType<typeof compareOsmToGswingMapping> }) {
  return (
    <div className="rounded border border-gold/20 bg-black/40 p-2">
      <p className="text-[10px] uppercase tracking-[0.25em] text-gold-soft">OSM vs G-Swing</p>
      <table className="mt-1 w-full table-fixed text-[11px]">
        <thead>
          <tr className="text-left text-foreground/55">
            <th className="w-1/3 font-normal">Feature</th>
            <th className="w-1/3 font-normal">G-Swing</th>
            <th className="w-1/3 font-normal">OSM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-white/5">
              <td className="py-1 text-foreground/80">{r.label}</td>
              <td className="py-1 text-foreground/85">{r.gswing}</td>
              <td className="py-1 text-foreground/85">{r.osm}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-foreground/55">
        Manual G-Swing mapping is the source of truth. OSM is reference only.
      </p>
    </div>
  );
}