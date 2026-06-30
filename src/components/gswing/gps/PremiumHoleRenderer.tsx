import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/gps-utils";
import type { HazardGeometry, MappedHole } from "@/types/gswing-course-map";
import {
  buildHoleBounds,
  calculateFeatureCentroid,
  calculateMeasurementFromTap,
  fitHoleToViewport,
  hasUsableHoleMapping,
  projectLatLngToHoleCanvas,
  unprojectHoleCanvasToLatLng,
  type FittedProjection,
} from "@/lib/gswing-hole-projection";
import {
  evaluatePremiumLayers,
  isPremiumReady,
  missingPremiumLayers,
  premiumProgress,
} from "@/lib/gswing-premium-readiness";

/**
 * G-Swing Premium Hole Renderer
 * ------------------------------
 * Polygon-driven illustrated aerial view. The renderer ONLY draws a
 * premium illustration when the hole is Premium Ready (every required
 * visual layer is either drawn or explicitly marked Not Applicable).
 * Otherwise a "Premium Mapping Required" gate is shown — never the old
 * glowing vector corridor.
 *
 * Tap-to-measure: a tap on the SVG is unprojected back into real lat/lng
 * and emitted to the parent so the bottom sheet shows a real haversine
 * distance from the live player GPS.
 */
export interface PremiumHoleRendererProps {
  mappedHole: MappedHole | null;
  playerPosition: LatLng | null;
  gpsAccuracy: number | null;
  selectedHoleNumber: number;
  unit: "yards" | "meters";
  isMeasuring: boolean;
  measurementTarget: LatLng | null;
  onMapTap: (latlng: LatLng) => void;
  onClearMeasurement?: () => void;
  /**
   * Owner-only enhancement: when true, the Premium Mapping Required gate
   * surfaces "Open Course Mapper" + "Mark layer not applicable" actions.
   * Hidden completely for non-owner users.
   */
  isOwner?: boolean;
  onOpenMapper?: () => void;
  onMarkLayerNa?: (layerKey: string) => void | Promise<void>;
  /**
   * Optional: when provided, the Premium Mapping Required gate shows a
   * "Continue with Satellite Only" button that toggles the parent's
   * map view. Wired by GpsMap so every user (not just owners) can fall
   * back to the satellite renderer with one tap.
   */
  onContinueSatellite?: () => void;
}

const PADDING = 44;

export function PremiumHoleRenderer({
  mappedHole,
  playerPosition,
  gpsAccuracy,
  selectedHoleNumber,
  unit,
  isMeasuring,
  measurementTarget,
  onMapTap,
  isOwner,
  onOpenMapper,
  onMarkLayerNa,
}: PremiumHoleRendererProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Stage [8] — verifies the renderer actually mounted.
  useEffect(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info("[GSWING][8] Premium Renderer Mounted", {
        selectedHoleNumber,
        mapped_hole_id: mappedHole?.id ?? null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stage [9] — first time real player coordinates arrive.
  const playerLoggedRef = useRef(false);
  useEffect(() => {
    if (!playerPosition || playerLoggedRef.current) return;
    playerLoggedRef.current = true;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info("[GSWING][9] Player Location Ready", playerPosition);
    }
  }, [playerPosition?.lat, playerPosition?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track wrapper size for responsive projection.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const usable = hasUsableHoleMapping(mappedHole);
  const premiumReady = useMemo(() => isPremiumReady(mappedHole), [mappedHole]);
  const missing = useMemo(() => missingPremiumLayers(mappedHole), [mappedHole]);
  const progress = useMemo(() => premiumProgress(mappedHole), [mappedHole]);
  const bounds = useMemo(
    () => buildHoleBounds(mappedHole, playerPosition),
    [mappedHole, playerPosition?.lat, playerPosition?.lng],
  );

  // Dev-only diagnostics so we can verify in console that Premium is
  // actually receiving saved mapping data and not silently falling back.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const bunkers = mappedHole?.hazards.filter((h) => h.type === "bunker").length ?? 0;
    const water = mappedHole?.hazards.filter(
      (h) => h.type === "water" || h.type === "penalty_area",
    ).length ?? 0;
    // eslint-disable-next-line no-console
    console.info("[gswing.premium-renderer] hole render", {
      selectedHoleNumber,
      mapped_hole_id: mappedHole?.id ?? null,
      hole_number: mappedHole?.holeNumber ?? null,
      tees: mappedHole?.tees.length ?? 0,
      green_center: !!mappedHole?.green.center,
      green_front: !!mappedHole?.green.front,
      green_back: !!mappedHole?.green.back,
      green_polygon_pts: mappedHole?.green.polygon?.length ?? 0,
      pin: !!mappedHole?.pin,
      hazards_total: mappedHole?.hazards.length ?? 0,
      bunkers,
      water_or_penalty: water,
      landing_zones: mappedHole?.landingZones.length ?? 0,
      layups: mappedHole?.layups.length ?? 0,
      doglegs: mappedHole?.doglegs.length ?? 0,
      hasUsableHoleMapping: usable,
      premiumReady,
      premiumProgress: progress,
      fairwayPolygon: !!mappedHole?.fairwayPolygon,
      teePolygon: !!mappedHole?.teePolygon,
      holeBoundary: !!mappedHole?.holeBoundary,
      naLayers: mappedHole?.naLayers ?? [],
    });
  }, [mappedHole, selectedHoleNumber, usable, premiumReady, progress]);

  const projection: FittedProjection | null = useMemo(() => {
    if (!bounds || size.w < 20 || size.h < 20) return null;
    return fitHoleToViewport(bounds, {
      width: size.w,
      height: size.h,
      paddingPx: PADDING,
    });
  }, [bounds, size.w, size.h]);

  // Stage [10] — first successful paint with all data required.
  const renderCompleteRef = useRef(false);
  useEffect(() => {
    if (renderCompleteRef.current) return;
    if (!premiumReady || !projection || !mappedHole) return;
    renderCompleteRef.current = true;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info("[GSWING][10] Render Complete", {
        hole_number: mappedHole.holeNumber,
        hazards: mappedHole.hazards.length,
        premiumReady,
      });
    }
  }, [premiumReady, projection, mappedHole]);

  const handleTap = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!isMeasuring || !projection || !svgRef.current || !premiumReady) return;
    const rect = svgRef.current.getBoundingClientRect();
    const t = "touches" in e ? e.changedTouches[0] : e;
    if (!t) return;
    const x = (t.clientX as number) - rect.left;
    const y = (t.clientY as number) - rect.top;
    const latlng = unprojectHoleCanvasToLatLng({ x, y }, projection);
    onMapTap(latlng);
  };

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 select-none"
      data-gswing-premium-renderer="true"
    >
      {/* Luxury terrain backdrop — deep emerald with painted vignette. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_40%,#16623f_0%,#0b4129_38%,#042214_72%,#01100a_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_70%_15%,rgba(245,200,75,0.10)_0%,transparent_70%)] mix-blend-screen" />
      <div className="absolute inset-0 bg-[radial-gradient(45%_30%_at_15%_90%,rgba(0,0,0,0.55)_0%,transparent_70%)]" />

      {!usable ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <div className="rounded-2xl border border-gold/30 bg-black/55 px-5 py-4 backdrop-blur-md">
            <p className="font-serif text-base text-gold">Hole {selectedHoleNumber}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-gold-soft">
              GPS mapping required
            </p>
            <p className="mt-2 max-w-[260px] text-[11px] leading-snug text-white/65">
              Open the Course Mapper to save tee, green front/center/back and pin for this hole.
            </p>
          </div>
        </div>
      ) : !premiumReady ? (
        <PremiumMappingRequired
          selectedHoleNumber={selectedHoleNumber}
          missing={missing}
          progress={progress}
          isOwner={!!isOwner}
          onOpenMapper={onOpenMapper}
          onMarkLayerNa={onMarkLayerNa}
        />
      ) : (
        <svg
          ref={svgRef}
          width={size.w || 1}
          height={size.h || 1}
          viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
          className={`absolute inset-0 h-full w-full ${
            isMeasuring ? "cursor-crosshair" : "cursor-default"
          }`}
          onClick={handleTap}
          onTouchEnd={handleTap}
        >
          <RendererDefs />
          {projection && mappedHole && (
            <HoleGeometryLayer
              hole={mappedHole}
              projection={projection}
            />
          )}
          {projection && playerPosition && (
            <PlayerMarker
              projection={projection}
              player={playerPosition}
              accuracy={gpsAccuracy}
            />
          )}
          {projection && playerPosition && measurementTarget && (
            <MeasurementLineLayer
              projection={projection}
              from={playerPosition}
              to={measurementTarget}
              unit={unit}
            />
          )}
        </svg>
      )}

      {/* Hint chip when measuring with no GPS / no target */}
      {isMeasuring && usable && premiumReady && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-gold/35 bg-black/65 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-gold backdrop-blur-md">
          {!playerPosition
            ? "GPS location required to measure"
            : measurementTarget
              ? "Tap to update target"
              : "Tap the hole to measure"}
        </div>
      )}
    </div>
  );
}

/**
 * Premium Mapping Required gate. Replaces the old glowing centreline.
 * Lists exactly which premium visual layers are still missing for this
 * hole and directs the user to either map them or use Satellite mode.
 */
function PremiumMappingRequired({
  selectedHoleNumber,
  missing,
  progress,
  isOwner,
  onOpenMapper,
  onMarkLayerNa,
}: {
  selectedHoleNumber: number;
  missing: ReturnType<typeof missingPremiumLayers>;
  progress: { done: number; total: number };
  isOwner: boolean;
  onOpenMapper?: () => void;
  onMarkLayerNa?: (layerKey: string) => void | Promise<void>;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
      <div className="max-w-sm rounded-2xl border border-gold/30 bg-black/65 px-5 py-5 backdrop-blur-md">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold-soft">G-Swing Premium</p>
        <h2 className="mt-1 font-serif text-xl text-gold">Hole {selectedHoleNumber}</h2>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-gold">
          Premium mapping required
        </p>
        <p className="mt-3 text-[12px] leading-snug text-white/75">
          The illustrated Premium view needs the visual polygons below before
          it can render this hole. GPS distances continue to work from saved
          tee / green / pin data.
        </p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3 text-left">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-gold-soft">
            <span>Missing visual layers</span>
            <span>{progress.done}/{progress.total}</span>
          </div>
          <ul className="mt-2 space-y-1 text-[12px] text-white/85">
            {missing.map((m) => (
              <li key={m.key} className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />
                {m.label}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-3 text-[11px] leading-snug text-white/55">
          Tip: switch to <span className="text-gold">Satellite</span> above to
          play this hole now, or open the Course Mapper to add the missing
          polygons (or mark them not applicable for this hole).
        </p>
        {isOwner && (
          <div className="mt-4 rounded-xl border border-gold/40 bg-gradient-to-br from-emerald-950/60 via-black/50 to-emerald-950/60 p-3 text-left">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full border border-gold/40 bg-black/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-gold">
                Owner tools
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-gold-soft/80">
                Unlimited
              </span>
            </div>
            <p className="mb-3 text-[11px] leading-snug text-white/70">
              Complete missing visual layers to enable Premium view for this hole.
            </p>
            <button
              type="button"
              onClick={() => onOpenMapper?.()}
              disabled={!onOpenMapper}
              className="block w-full rounded-xl bg-gold px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-black shadow-[0_0_18px_rgba(245,200,75,0.35)] transition-all active:scale-[0.98] disabled:opacity-50"
            >
              Open Course Mapper
            </button>
            {missing.length > 0 && onMarkLayerNa && (
              <div className="mt-2">
                <label className="text-[9px] uppercase tracking-[0.22em] text-gold-soft/80">
                  Mark layer not applicable
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    void onMarkLayerNa(v);
                    e.currentTarget.value = "";
                  }}
                  className="mt-1 w-full rounded-lg border border-gold/30 bg-black/60 px-2 py-2 text-[11px] text-white/90 focus:border-gold focus:outline-none"
                >
                  <option value="" disabled>
                    Choose a layer…
                  </option>
                  {missing.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Shared SVG defs: gradients, filters, sand/tree patterns. */
function RendererDefs() {
  return (
    <defs>
      {/* Soft drop shadow under every premium feature */}
      <filter id="gs-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" />
        <feOffset dy="2" result="off" />
        <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* Gentle inner highlight glow used by the green */}
      <filter id="gs-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* Fairway gradient — bright sunlit center */}
      <radialGradient id="gs-fairway" cx="50%" cy="40%" r="65%">
        <stop offset="0%" stopColor="#6ad389" />
        <stop offset="55%" stopColor="#3aa765" />
        <stop offset="100%" stopColor="#1e6b3f" />
      </radialGradient>
      <radialGradient id="gs-semirough" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#2f7e4d" />
        <stop offset="100%" stopColor="#16542f" />
      </radialGradient>
      <radialGradient id="gs-rough" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#1a4a2c" />
        <stop offset="100%" stopColor="#0a2c19" />
      </radialGradient>
      {/* Green gradient — bright manicured turf */}
      <radialGradient id="gs-green" cx="50%" cy="40%" r="65%">
        <stop offset="0%" stopColor="#9bf0b8" />
        <stop offset="55%" stopColor="#4ad17e" />
        <stop offset="100%" stopColor="#1c8048" />
      </radialGradient>
      {/* Water gradient — deep teal with highlight */}
      <linearGradient id="gs-water" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#5cc8e0" stopOpacity="0.95" />
        <stop offset="40%" stopColor="#1d6fb3" />
        <stop offset="100%" stopColor="#0b2c4f" />
      </linearGradient>
      {/* Bunker gradient — warm sand with rim */}
      <radialGradient id="gs-sand" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#fbeec3" />
        <stop offset="60%" stopColor="#e8d39a" />
        <stop offset="100%" stopColor="#b89a5f" />
      </radialGradient>
      {/* Sand stipple texture */}
      <pattern id="gs-sand-stipple" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="transparent" />
        <circle cx="1.5" cy="1.5" r="0.5" fill="#8a6f3a" opacity="0.45" />
        <circle cx="4.5" cy="3.5" r="0.4" fill="#8a6f3a" opacity="0.35" />
      </pattern>
      {/* Subtle green contour rings via mask */}
      <radialGradient id="gs-green-ring" cx="50%" cy="50%" r="50%">
        <stop offset="80%" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="92%" stopColor="#ffffff" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      {/* Tee gradient */}
      <linearGradient id="gs-tee" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2a1f00" />
        <stop offset="100%" stopColor="#120c00" />
      </linearGradient>
    </defs>
  );
}

function HoleGeometryLayer({
  hole,
  projection,
}: {
  hole: MappedHole;
  projection: FittedProjection;
}) {
  const project = (p: { lat: number; lng: number }) =>
    projectLatLngToHoleCanvas(p, projection);

  const tee = hole.tees[0]?.coordinate ?? null;
  const greenCenter = hole.green.center ?? hole.pin?.coordinate ?? null;
  const greenFront = hole.green.front ?? null;
  const greenBack = hole.green.back ?? null;
  const greenPolygon = hole.green.polygon ?? null;
  const pin = hole.pin?.coordinate ?? null;

  // Premium illustration is now ENTIRELY polygon-driven. Centreline
  // corridor fallback has been removed — gating in the parent ensures
  // we never reach this layer without real polygons.
  const projectRing = (ring: Array<[number, number]>) =>
    ring.map(([lng, lat]) => project({ lat, lng }));

  const holeBoundaryPts = hole.holeBoundary ? projectRing(hole.holeBoundary) : null;
  const fairwayPts = hole.fairwayPolygon ? projectRing(hole.fairwayPolygon) : null;
  const teePolyPts = hole.teePolygon ? projectRing(hole.teePolygon) : null;
  const roughPts = hole.roughPolygon ? projectRing(hole.roughPolygon) : null;
  const cartPathPts = hole.cartPath ? projectRing(hole.cartPath) : null;

  // Green radius fallback only for the legacy ring overlay; if no polygon
  // we still draw the front/back-derived footprint as a soft halo.
  let greenRadiusPx = 28;
  if (greenFront && greenBack) {
    const a = project(greenFront);
    const b = project(greenBack);
    greenRadiusPx = Math.max(18, Math.hypot(a.x - b.x, a.y - b.y) / 2);
  }

  return (
    <g>
      {/* Hole boundary — painted as the outer rough mass for depth. */}
      {holeBoundaryPts && holeBoundaryPts.length >= 3 && (
        <g filter="url(#gs-shadow)">
          <path
            d={ringPath(holeBoundaryPts)}
            fill="url(#gs-rough)"
            fillOpacity={0.95}
            stroke="#0a2c19"
            strokeOpacity={0.7}
            strokeWidth={1}
          />
        </g>
      )}

      {/* Explicit rough polygon overlay (if mapped separately). */}
      {roughPts && roughPts.length >= 3 && (
        <path
          d={ringPath(roughPts)}
          fill="url(#gs-semirough)"
          fillOpacity={0.85}
          stroke="#16542f"
          strokeOpacity={0.55}
          strokeWidth={0.8}
        />
      )}

      {/* Manicured fairway — organic polygon from mapping. */}
      {fairwayPts && fairwayPts.length >= 3 && (
        <g filter="url(#gs-shadow)">
          <path
            d={ringPath(fairwayPts)}
            fill="url(#gs-fairway)"
            stroke="#1e6b3f"
            strokeOpacity={0.6}
            strokeWidth={1}
          />
          {/* Subtle mowing highlight ribbon along centroid axis. */}
          <path
            d={ringPath(fairwayPts)}
            fill="none"
            stroke="#c8f5d6"
            strokeOpacity={0.18}
            strokeWidth={2}
          />
        </g>
      )}

      {/* Cart path */}
      {cartPathPts && cartPathPts.length >= 2 && (
        <path
          d={cartPathPts
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(" ")}
          fill="none"
          stroke="#d8c8a3"
          strokeOpacity={0.7}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1 0"
        />
      )}

      {/* Hazards (water under sand under trees) */}
      <g>
        {hole.hazards
          .slice()
          .sort((a, b) => layerOrder(a.type) - layerOrder(b.type))
          .map((h) => (
            <HazardShape key={h.id} hazard={h} projection={projection} />
          ))}
      </g>

      {/* Landing zones — premium dashed rings with label */}
      {hole.landingZones.map((z) => {
        const p = project(z.coordinate);
        const r = 22;
        return (
          <g key={z.id}>
            <circle cx={p.x} cy={p.y} r={r} fill="#F5C84B" fillOpacity={0.04} stroke="#F5C84B" strokeOpacity={0.45} strokeWidth={1} strokeDasharray="2 4" />
            <circle cx={p.x} cy={p.y} r={2} fill="#F5C84B" />
            <text x={p.x} y={p.y - r - 4} fill="#F5C84B" fontSize="9" textAnchor="middle" opacity={0.85} fontFamily="ui-serif, Georgia">
              {z.name || "Landing"}
            </text>
          </g>
        );
      })}

      {/* Layups */}
      {hole.layups.map((l) => {
        const p = project(l.coordinate);
        return (
          <g key={l.id}>
            <circle cx={p.x} cy={p.y} r={11} fill="#0b2a18" stroke="#F5C84B" strokeOpacity={0.85} strokeDasharray="3 3" />
            <text x={p.x} y={p.y + 3} fill="#F5C84B" fontSize="9" textAnchor="middle" fontFamily="ui-serif, Georgia" fontWeight={600}>L</text>
            <text x={p.x} y={p.y + 22} fill="#F5C84B" fontSize="9" textAnchor="middle" fontFamily="ui-serif, Georgia">
              {l.name}
            </text>
          </g>
        );
      })}

      {/* Green — uses mapped polygon when available, organic shape */}
      {greenPolygon && greenPolygon.length >= 3 ? (
        <GreenPolygon polygon={greenPolygon} project={project} />
      ) : (
        greenCenter && (
          <GreenFallback
            center={project(greenCenter)}
            radiusPx={greenRadiusPx}
          />
        )
      )}

      {/* Pin / flag */}
      {pin && (() => {
        const p = project(pin);
        return (
          <g filter="url(#gs-shadow)">
            <circle cx={p.x} cy={p.y + 1} r={4} fill="#000" opacity={0.35} />
            <line x1={p.x} y1={p.y} x2={p.x} y2={p.y - 26} stroke="#f7f3e5" strokeWidth={1.5} />
            <polygon
              points={`${p.x},${p.y - 26} ${p.x + 14},${p.y - 21} ${p.x},${p.y - 16}`}
              fill="#F5C84B"
              stroke="#8a6a18"
              strokeWidth={0.6}
            />
            <circle cx={p.x} cy={p.y} r={3} fill="#fff" stroke="#1a1a1a" strokeWidth={0.6} />
          </g>
        );
      })()}

      {/* Tee — prefer polygon, fall back to icon */}
      {teePolyPts && teePolyPts.length >= 3 ? (
        <g filter="url(#gs-shadow)">
          <path
            d={ringPath(teePolyPts)}
            fill="url(#gs-tee)"
            stroke="#F5C84B"
            strokeOpacity={0.85}
            strokeWidth={1.2}
          />
        </g>
      ) : tee && (() => {
        const t = project(tee);
        return (
          <g filter="url(#gs-shadow)">
            <rect x={t.x - 14} y={t.y - 9} width={28} height={18} rx={4} fill="url(#gs-tee)" stroke="#F5C84B" strokeWidth={1.4} />
            <circle cx={t.x - 7} cy={t.y} r={1.6} fill="#F5C84B" />
            <circle cx={t.x + 7} cy={t.y} r={1.6} fill="#F5C84B" />
            <text x={t.x} y={t.y + 22} fill="#F5C84B" fontSize="9" textAnchor="middle" fontFamily="ui-serif, Georgia" letterSpacing="2">TEE</text>
          </g>
        );
      })()}
    </g>
  );
}

function layerOrder(t: HazardGeometry["type"]): number {
  // Larger features painted first so smaller ones sit on top.
  switch (t) {
    case "trees":
    case "rough":
    case "out_of_bounds":
    case "waste_area":
      return 0;
    case "water":
      return 1;
    case "penalty_area":
      return 2;
    case "bunker":
      return 3;
    default:
      return 1;
  }
}

/** Mapped green polygon — smoothed organic shape with rim & highlight. */
function GreenPolygon({
  polygon,
  project,
}: {
  polygon: Array<[number, number]>;
  project: (p: { lat: number; lng: number }) => { x: number; y: number };
}) {
  const pts = polygon.map(([lng, lat]) => project({ lat, lng }));
  if (pts.length < 3) return null;
  // Centroid for ring highlight
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  // Approximate radius for ring overlay
  let rMax = 0;
  for (const p of pts) rMax = Math.max(rMax, Math.hypot(p.x - cx, p.y - cy));
  const path = `${pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ")} Z`;
  return (
    <g filter="url(#gs-shadow)">
      {/* fringe / collar */}
      <path d={path} fill="#0e3a25" stroke="#0e3a25" strokeWidth={10} strokeLinejoin="round" opacity={0.95} />
      {/* manicured green */}
      <path d={path} fill="url(#gs-green)" stroke="#a8efc6" strokeOpacity={0.4} strokeWidth={1} />
      {/* contour ring */}
      <circle cx={cx} cy={cy} r={Math.max(4, rMax * 0.6)} fill="url(#gs-green-ring)" />
    </g>
  );
}

function GreenFallback({
  center,
  radiusPx,
}: {
  center: { x: number; y: number };
  radiusPx: number;
}) {
  return (
    <g filter="url(#gs-shadow)">
      <circle cx={center.x} cy={center.y} r={radiusPx + 6} fill="#0e3a25" />
      <circle cx={center.x} cy={center.y} r={radiusPx} fill="url(#gs-green)" stroke="#a8efc6" strokeOpacity={0.4} strokeWidth={1} />
      <circle cx={center.x} cy={center.y} r={radiusPx * 0.55} fill="url(#gs-green-ring)" />
    </g>
  );
}

function HazardShape({
  hazard,
  projection,
}: {
  hazard: HazardGeometry;
  projection: FittedProjection;
}) {
  const project = (p: { lat: number; lng: number }) =>
    projectLatLngToHoleCanvas(p, projection);
  const c = project(calculateFeatureCentroid(hazard));
  const polyPts =
    hazard.polygon && hazard.polygon.length >= 3
      ? hazard.polygon.map(([lng, lat]) => project({ lat, lng }))
      : null;

  switch (hazard.type) {
    case "water":
    case "penalty_area":
      return <WaterFeature points={polyPts} center={c} />;
    case "bunker":
      return <BunkerFeature points={polyPts} center={c} />;
    case "trees":
      return <TreeFeature points={polyPts} center={c} />;
    case "rough":
      return <RoughFeature points={polyPts} center={c} />;
    case "out_of_bounds":
      return <OutOfBoundsFeature points={polyPts} center={c} />;
    case "waste_area":
      return <WasteFeature points={polyPts} center={c} />;
    default:
      return <BunkerFeature points={polyPts} center={c} />;
  }
}

function ringPath(pts: { x: number; y: number }[]): string {
  return `${pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ")} Z`;
}

function WaterFeature({ points, center }: { points: { x: number; y: number }[] | null; center: { x: number; y: number } }) {
  if (points) {
    return (
      <g filter="url(#gs-shadow)">
        <path d={ringPath(points)} fill="url(#gs-water)" stroke="#9adcff" strokeOpacity={0.55} strokeWidth={1} />
        <path d={ringPath(points)} fill="none" stroke="#cfeeff" strokeOpacity={0.35} strokeWidth={0.6} transform={`translate(0,-1)`} />
      </g>
    );
  }
  return (
    <g filter="url(#gs-shadow)">
      <ellipse cx={center.x} cy={center.y} rx={28} ry={18} fill="url(#gs-water)" stroke="#9adcff" strokeOpacity={0.55} strokeWidth={1} />
      <ellipse cx={center.x} cy={center.y - 4} rx={20} ry={4} fill="#cfeeff" opacity={0.25} />
    </g>
  );
}

function BunkerFeature({ points, center }: { points: { x: number; y: number }[] | null; center: { x: number; y: number } }) {
  if (points) {
    return (
      <g filter="url(#gs-shadow)">
        <path d={ringPath(points)} fill="url(#gs-sand)" stroke="#a87f3a" strokeOpacity={0.7} strokeWidth={1} />
        <path d={ringPath(points)} fill="url(#gs-sand-stipple)" opacity={0.55} />
      </g>
    );
  }
  // Cluster of ellipses simulates an organic sand shape
  return (
    <g filter="url(#gs-shadow)">
      <ellipse cx={center.x - 5} cy={center.y + 1} rx={16} ry={10} fill="url(#gs-sand)" stroke="#a87f3a" strokeOpacity={0.7} strokeWidth={1} />
      <ellipse cx={center.x + 7} cy={center.y - 3} rx={11} ry={7} fill="url(#gs-sand)" stroke="#a87f3a" strokeOpacity={0.6} strokeWidth={1} />
      <ellipse cx={center.x - 5} cy={center.y + 1} rx={16} ry={10} fill="url(#gs-sand-stipple)" opacity={0.5} />
    </g>
  );
}

function TreeFeature({ points, center }: { points: { x: number; y: number }[] | null; center: { x: number; y: number } }) {
  const cluster = points && points.length > 0 ? points.slice(0, 18) : seedCluster(center, 10);
  return (
    <g filter="url(#gs-shadow)">
      {cluster.map((p, i) => {
        const r = 6 + ((i * 53) % 5);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y + 2} r={r} fill="#04190e" opacity={0.55} />
            <circle cx={p.x} cy={p.y} r={r} fill="#0d3a22" />
            <circle cx={p.x - r * 0.3} cy={p.y - r * 0.35} r={r * 0.55} fill="#1b6a3c" opacity={0.85} />
          </g>
        );
      })}
    </g>
  );
}

function seedCluster(center: { x: number; y: number }, n: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let s = 1;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const ang = (s / 233280) * Math.PI * 2;
    const rad = 6 + (s % 26);
    out.push({ x: center.x + Math.cos(ang) * rad, y: center.y + Math.sin(ang) * rad * 0.8 });
  }
  return out;
}

function RoughFeature({ points, center }: { points: { x: number; y: number }[] | null; center: { x: number; y: number } }) {
  if (points) {
    return <path d={ringPath(points)} fill="url(#gs-rough)" fillOpacity={0.85} stroke="#1f5a36" strokeOpacity={0.55} strokeWidth={0.8} />;
  }
  return <ellipse cx={center.x} cy={center.y} rx={26} ry={16} fill="url(#gs-rough)" fillOpacity={0.85} stroke="#1f5a36" strokeOpacity={0.55} />;
}

function OutOfBoundsFeature({ points, center }: { points: { x: number; y: number }[] | null; center: { x: number; y: number } }) {
  if (points) {
    return <path d={ringPath(points)} fill="rgba(255,255,255,0.04)" stroke="#ffffff" strokeOpacity={0.75} strokeWidth={1} strokeDasharray="6 4" />;
  }
  return <ellipse cx={center.x} cy={center.y} rx={28} ry={18} fill="rgba(255,255,255,0.04)" stroke="#ffffff" strokeOpacity={0.7} strokeDasharray="6 4" />;
}

function WasteFeature({ points, center }: { points: { x: number; y: number }[] | null; center: { x: number; y: number } }) {
  if (points) {
    return (
      <g>
        <path d={ringPath(points)} fill="#9c8454" fillOpacity={0.75} stroke="#d8b974" strokeOpacity={0.55} strokeWidth={0.8} />
        <path d={ringPath(points)} fill="url(#gs-sand-stipple)" opacity={0.4} />
      </g>
    );
  }
  return <ellipse cx={center.x} cy={center.y} rx={24} ry={14} fill="#9c8454" fillOpacity={0.7} stroke="#d8b974" strokeOpacity={0.55} />;
}

function PlayerMarker({
  projection,
  player,
  accuracy,
}: {
  projection: FittedProjection;
  player: LatLng;
  accuracy: number | null;
}) {
  const p = projectLatLngToHoleCanvas(player, projection);
  // Approx accuracy ring: scale = pixels per degree of latitude;
  // 1 deg lat ≈ 111000m, so m→px = scale / 111000.
  const metersToPx = projection.scale / 111000;
  const ringPx =
    accuracy != null && accuracy > 0
      ? Math.max(8, Math.min(80, accuracy * metersToPx))
      : 0;
  return (
    <g>
      {ringPx > 0 && (
        <circle
          cx={p.x}
          cy={p.y}
          r={ringPx}
          fill="#F5C84B"
          fillOpacity={0.08}
          stroke="#F5C84B"
          strokeOpacity={0.4}
          strokeWidth={1}
        />
      )}
      <circle cx={p.x} cy={p.y} r={9} fill="#F5C84B" fillOpacity={0.25} />
      <circle cx={p.x} cy={p.y} r={5} fill="#fff" stroke="#F5C84B" strokeWidth={2} />
    </g>
  );
}

function MeasurementLineLayer({
  projection,
  from,
  to,
  unit,
}: {
  projection: FittedProjection;
  from: LatLng;
  to: LatLng;
  unit: "yards" | "meters";
}) {
  const a = projectLatLngToHoleCanvas(from, projection);
  const b = projectLatLngToHoleCanvas(to, projection);
  const m = calculateMeasurementFromTap(from, to, unit);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  return (
    <g>
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="#F5C84B"
        strokeWidth={2}
        strokeDasharray="6 4"
        opacity={0.95}
      />
      <circle cx={b.x} cy={b.y} r={14} fill="#F5C84B" fillOpacity={0.15} />
      <circle cx={b.x} cy={b.y} r={6} fill="#F5C84B" stroke="#1a1300" strokeWidth={1.5} />
      {m && (
        <g transform={`translate(${midX}, ${midY - 14})`}>
          <rect x={-30} y={-12} width={60} height={20} rx={10} fill="#1a1300" stroke="#F5C84B" strokeWidth={1} />
          <text x={0} y={2} textAnchor="middle" fill="#F5C84B" fontSize="11" fontFamily="ui-serif, Georgia">
            {m.distance}{m.unit}
          </text>
        </g>
      )}
    </g>
  );
}
