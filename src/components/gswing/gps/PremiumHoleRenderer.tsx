import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/gps-utils";
import type { HazardGeometry, MappedHole } from "@/types/gswing-course-map";
import {
  buildHoleBounds,
  buildSmoothPath,
  calculateFeatureCentroid,
  calculateMeasurementFromTap,
  fitHoleToViewport,
  hasUsableHoleMapping,
  projectLatLngToHoleCanvas,
  unprojectHoleCanvasToLatLng,
  type FittedProjection,
} from "@/lib/gswing-hole-projection";

/**
 * G-Swing Premium Hole Renderer
 * ------------------------------
 * Custom illustrated top-down hole view built from saved G-Swing mapped
 * geometry only (gswing_course_maps / gswing_mapped_holes /
 * gswing_hole_features). Never satellite imagery. Never fabricated.
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
}

const PADDING = 36;

export function PremiumHoleRenderer({
  mappedHole,
  playerPosition,
  gpsAccuracy,
  selectedHoleNumber,
  unit,
  isMeasuring,
  measurementTarget,
  onMapTap,
}: PremiumHoleRendererProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

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
  const bounds = useMemo(
    () => buildHoleBounds(mappedHole, playerPosition),
    [mappedHole, playerPosition?.lat, playerPosition?.lng],
  );

  const projection: FittedProjection | null = useMemo(() => {
    if (!bounds || size.w < 20 || size.h < 20) return null;
    return fitHoleToViewport(bounds, {
      width: size.w,
      height: size.h,
      paddingPx: PADDING,
    });
  }, [bounds, size.w, size.h]);

  const handleTap = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!isMeasuring || !projection || !svgRef.current) return;
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
      {/* Emerald illustrated background — distinct from satellite. */}
      <div className="absolute inset-0 bg-[radial-gradient(140%_120%_at_50%_55%,#0d4b30_0%,#062a1b_55%,#01100a_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_30%,rgba(245,200,75,0.06)_0%,transparent_70%)]" />
      {/* Subtle topo lines for luxury feel */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]" aria-hidden>
        <defs>
          <pattern id="gs-topo" width="56" height="56" patternUnits="userSpaceOnUse">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#9bd6b2" strokeWidth="0.6" />
            <circle cx="28" cy="28" r="12" fill="none" stroke="#9bd6b2" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gs-topo)" />
      </svg>

      {!usable ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <div className="rounded-2xl border border-gold/30 bg-black/55 px-5 py-4 backdrop-blur-md">
            <p className="font-serif text-base text-gold">Hole {selectedHoleNumber}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-gold-soft">
              Mapping required
            </p>
            <p className="mt-2 max-w-[260px] text-[11px] leading-snug text-white/65">
              Open the Course Mapper to save tee, green and hazards for this hole.
            </p>
          </div>
        </div>
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
      {isMeasuring && usable && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-gold/35 bg-black/65 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-gold backdrop-blur-md">
          {!playerPosition
            ? "GPS location required to measure"
            : measurementTarget
              ? "Tap to update target"
              : "Tap the hole to measure"}
        </div>
      )}
      {!mappedHole && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-200 backdrop-blur-md">
          Mapping required for precise measurement
        </div>
      )}
    </div>
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
  const pin = hole.pin?.coordinate ?? null;

  // Fairway corridor: tee → doglegs → landing zones → green
  const corridor: { lat: number; lng: number }[] = [];
  if (tee) corridor.push(tee);
  for (const d of hole.doglegs) corridor.push(d.coordinate);
  for (const z of hole.landingZones) corridor.push(z.coordinate);
  if (greenFront ?? greenCenter) corridor.push((greenFront ?? greenCenter) as { lat: number; lng: number });

  const corridorPts = corridor.map(project);
  const corridorPath = buildSmoothPath(corridorPts);

  // Approximate green radius from front/back spread.
  let greenRadiusPx = 28;
  if (greenFront && greenBack) {
    const a = project(greenFront);
    const b = project(greenBack);
    greenRadiusPx = Math.max(18, Math.hypot(a.x - b.x, a.y - b.y) / 2);
  }

  return (
    <g>
      {/* Fairway corridor */}
      {corridorPts.length >= 2 && (
        <>
          <path
            d={corridorPath}
            fill="none"
            stroke="#1f7a4a"
            strokeOpacity={0.55}
            strokeWidth={Math.max(34, greenRadiusPx * 1.6)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={corridorPath}
            fill="none"
            stroke="#37a86b"
            strokeOpacity={0.85}
            strokeWidth={Math.max(22, greenRadiusPx * 1.05)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* Hazards */}
      {hole.hazards.map((h) => (
        <HazardShape key={h.id} hazard={h} projection={projection} />
      ))}

      {/* Layups */}
      {hole.layups.map((l) => {
        const p = project(l.coordinate);
        return (
          <g key={l.id}>
            <circle cx={p.x} cy={p.y} r={10} fill="none" stroke="#F5C84B" strokeOpacity={0.7} strokeDasharray="3 3" />
            <text x={p.x} y={p.y + 22} fill="#F5C84B" fontSize="9" textAnchor="middle" fontFamily="ui-serif, Georgia">
              {l.name}
            </text>
          </g>
        );
      })}

      {/* Green */}
      {greenCenter && (
        <g>
          <circle
            cx={project(greenCenter).x}
            cy={project(greenCenter).y}
            r={greenRadiusPx + 4}
            fill="#0e3a25"
            stroke="#7be0a4"
            strokeOpacity={0.5}
            strokeWidth={1}
          />
          <circle
            cx={project(greenCenter).x}
            cy={project(greenCenter).y}
            r={greenRadiusPx}
            fill="#3fb874"
            opacity={0.92}
          />
          <circle
            cx={project(greenCenter).x}
            cy={project(greenCenter).y}
            r={greenRadiusPx - 6}
            fill="none"
            stroke="#a8efc6"
            strokeOpacity={0.35}
            strokeWidth={1}
          />
        </g>
      )}

      {/* Pin / flag */}
      {pin && (() => {
        const p = project(pin);
        return (
          <g>
            <line x1={p.x} y1={p.y} x2={p.x} y2={p.y - 22} stroke="#fff" strokeWidth={1.5} />
            <polygon
              points={`${p.x},${p.y - 22} ${p.x + 12},${p.y - 18} ${p.x},${p.y - 14}`}
              fill="#F5C84B"
              stroke="#8a6a18"
              strokeWidth={0.6}
            />
            <circle cx={p.x} cy={p.y} r={2.5} fill="#fff" />
          </g>
        );
      })()}

      {/* Tee */}
      {tee && (() => {
        const t = project(tee);
        return (
          <g>
            <rect x={t.x - 9} y={t.y - 6} width={18} height={12} rx={3} fill="#1a1300" stroke="#F5C84B" strokeWidth={1.5} />
            <text x={t.x} y={t.y + 3} fill="#F5C84B" fontSize="8" textAnchor="middle" fontFamily="ui-serif, Georgia">T</text>
          </g>
        );
      })()}
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

  const style = hazardStyle(hazard.type);

  if (hazard.polygon && hazard.polygon.length >= 3) {
    const ring = hazard.polygon
      .map(([lng, lat]) => project({ lat, lng }))
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
    return (
      <polygon
        points={ring}
        fill={style.fill}
        fillOpacity={style.fillOpacity}
        stroke={style.stroke}
        strokeOpacity={0.6}
        strokeWidth={1}
      />
    );
  }
  const c = project(calculateFeatureCentroid(hazard));
  return (
    <g>
      <ellipse
        cx={c.x}
        cy={c.y}
        rx={style.rx}
        ry={style.ry}
        fill={style.fill}
        fillOpacity={style.fillOpacity}
        stroke={style.stroke}
        strokeOpacity={0.6}
        strokeWidth={1}
      />
    </g>
  );
}

function hazardStyle(t: HazardGeometry["type"]): {
  fill: string;
  stroke: string;
  fillOpacity: number;
  rx: number;
  ry: number;
} {
  switch (t) {
    case "water":
      return { fill: "#1d6fb3", stroke: "#7cc1ff", fillOpacity: 0.85, rx: 22, ry: 14 };
    case "bunker":
      return { fill: "#e9d9a8", stroke: "#bfa766", fillOpacity: 0.92, rx: 14, ry: 9 };
    case "trees":
      return { fill: "#0c3b22", stroke: "#1e6a3d", fillOpacity: 0.9, rx: 18, ry: 18 };
    case "penalty_area":
      return { fill: "#a23a3a", stroke: "#ff7676", fillOpacity: 0.7, rx: 18, ry: 12 };
    case "out_of_bounds":
      return { fill: "#000", stroke: "#fff", fillOpacity: 0.0, rx: 22, ry: 14 };
    case "waste_area":
      return { fill: "#9c8454", stroke: "#d8b974", fillOpacity: 0.7, rx: 18, ry: 12 };
    case "rough":
      return { fill: "#1f5a36", stroke: "#3a8a59", fillOpacity: 0.7, rx: 22, ry: 14 };
    default:
      return { fill: "#444", stroke: "#888", fillOpacity: 0.6, rx: 14, ry: 10 };
  }
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
