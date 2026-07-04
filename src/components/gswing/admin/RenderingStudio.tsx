// G-Swing Rendering Studio (V1)
// -----------------------------
// Owner/admin-only foundation for the future course authoring workflow.
// V1 is intentionally minimal: course + hole selector, a live preview
// of the owned-geometry model (adapted from the existing MappedHole),
// and stubbed action buttons for the authoring surface. Real authoring
// arrives in v2. Guarded by useGswingAdmin at the page level.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Import, Layers, Radar, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadAllMappedHoles,
  loadCourseMaps,
} from "@/lib/gswing-course-map-loader";
import type { CourseMap, MappedHole } from "@/types/gswing-course-map";
import { fromMappedHole, type GswingHoleDefinition } from "@/lib/rendering/course-geometry-model";
import { computeHoleCorridor, computePremiumBounds, premiumPaddingPx } from "@/lib/rendering/premium-framing";
import { PREMIUM_LAYER_ORDER, PREMIUM_LAYER_STYLES } from "@/lib/rendering/premium-layers";
import { fitHoleToViewport, projectLatLngToHoleCanvas, type FittedProjection } from "@/lib/gswing-hole-projection";
import { isRenderableGswingHoleDefinition } from "@/lib/rendering/course-renderability";

const CANVAS_W = 720;
const CANVAS_H = 900;

function ringPath(ring: [number, number][], proj: FittedProjection): string {
  if (ring.length === 0) return "";
  const pts = ring.map(([lng, lat]) => projectLatLngToHoleCanvas({ lat, lng }, proj));
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
}

function StudioPreview({ def }: { def: GswingHoleDefinition | null }) {
  const projection = useMemo(() => {
    if (!def) return null;
    const bounds = computePremiumBounds(def, null);
    if (!bounds) return null;
    return fitHoleToViewport(bounds, {
      width: CANVAS_W,
      height: CANVAS_H,
      paddingPx: premiumPaddingPx(def.par),
      paddingBottomPx: premiumPaddingPx(def.par),
    });
  }, [def]);

  if (!def || !projection) {
    return (
      <div className="grid h-full w-full place-items-center rounded-xl border border-white/10 bg-black/60 text-sm text-white/60">
        Select a hole to preview
      </div>
    );
  }

  const s = PREMIUM_LAYER_STYLES;

  return (
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      className="h-full w-full rounded-xl bg-[radial-gradient(120%_100%_at_50%_40%,#16623f_0%,#0b4129_38%,#042214_72%,#01100a_100%)]"
      preserveAspectRatio="xMidYMid meet"
    >
      {PREMIUM_LAYER_ORDER.map((key) => {
        switch (key) {
          case "rough":
            return def.rough.map((r) => (
              <path key={`rough-${r.id}`} d={ringPath(r.ring, projection)} fill={s.rough.fill} opacity={s.rough.opacity} />
            ));
          case "waste":
            return def.waste.map((w) => (
              <path key={`waste-${w.id}`} d={ringPath(w.ring, projection)} fill={s.waste.fill} opacity={s.waste.opacity} />
            ));
          case "water":
            return [
              ...def.water.map((w) => (
                <path key={`water-${w.id}`} d={ringPath(w.ring, projection)} fill={s.water.fill} stroke={s.water.stroke} strokeWidth={s.water.strokeWidth} opacity={s.water.opacity} />
              )),
              ...def.penaltyAreas.map((w) => (
                <path key={`pen-${w.id}`} d={ringPath(w.ring, projection)} fill={s.water.fill} opacity={0.7} />
              )),
            ];
          case "fairway":
            return def.fairwayPolygons.map((f) => (
              <path key={`fw-${f.id}`} d={ringPath(f.ring, projection)} fill={s.fairway.fill} opacity={s.fairway.opacity} />
            ));
          case "bunkers":
            return def.bunkers.map((b) => (
              <path key={`bu-${b.id}`} d={ringPath(b.ring, projection)} fill={s.bunkers.fill} stroke={s.bunkers.stroke} strokeWidth={s.bunkers.strokeWidth} opacity={s.bunkers.opacity} />
            ));
          case "cart-paths":
            return def.cartPaths.map((c) => {
              const pts = c.path.map(([lng, lat]) => projectLatLngToHoleCanvas({ lat, lng }, projection));
              const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
              return <path key={`cp-${c.id}`} d={d} fill="none" stroke={s["cart-paths"].stroke} strokeWidth={s["cart-paths"].strokeWidth} opacity={s["cart-paths"].opacity} />;
            });
          case "green":
            return def.greenPolygon ? (
              <path key="green" d={ringPath(def.greenPolygon.ring, projection)} fill={s.green.fill} stroke={s.green.stroke} strokeWidth={s.green.strokeWidth} opacity={s.green.opacity} />
            ) : null;
          case "trees":
            return [
              ...def.trees.clusters.map((t) => (
                <path key={`tc-${t.id}`} d={ringPath(t.ring, projection)} fill={s.trees.fill} opacity={s.trees.opacity} />
              )),
              ...def.trees.points.map((t) => {
                const p = projectLatLngToHoleCanvas(t.coordinate, projection);
                return <circle key={`tp-${t.id}`} cx={p.x} cy={p.y} r={4} fill={s.trees.fill} opacity={0.8} />;
              }),
            ];
          case "tee":
            return def.tees.flatMap((t) =>
              t.markers.map((m, i) => {
                const p = projectLatLngToHoleCanvas(m, projection);
                return <circle key={`tee-${t.id}-${i}`} cx={p.x} cy={p.y} r={5} fill={s.tee.fill} stroke={s.tee.stroke} strokeWidth={s.tee.strokeWidth} />;
              }),
            );
          case "pin":
            return def.pin ? (() => {
              const p = projectLatLngToHoleCanvas(def.pin!.coordinate, projection);
              return <g key="pin"><circle cx={p.x} cy={p.y} r={4} fill={s.pin.fill} stroke={s.pin.stroke} strokeWidth={s.pin.strokeWidth} /><line x1={p.x} y1={p.y} x2={p.x} y2={p.y - 18} stroke={s.pin.stroke} strokeWidth={1} /></g>;
            })() : null;
          case "markers":
          case "labels":
          case "player":
          default:
            return null;
        }
      })}
    </svg>
  );
}

export function RenderingStudio() {
  const [courses, setCourses] = useState<CourseMap[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [holes, setHoles] = useState<MappedHole[]>([]);
  const [selectedHoleNumber, setSelectedHoleNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCourseMaps().then((maps) => {
      setCourses(maps);
      if (!selectedCourseId && maps[0]) setSelectedCourseId(maps[0].id);
    }).catch(() => setCourses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    setLoading(true);
    loadAllMappedHoles(selectedCourseId)
      .then((h) => {
        setHoles(h);
        setSelectedHoleNumber(h[0]?.holeNumber ?? null);
      })
      .catch(() => setHoles([]))
      .finally(() => setLoading(false));
  }, [selectedCourseId]);

  const legacyHole = useMemo(
    () => holes.find((h) => h.holeNumber === selectedHoleNumber) ?? null,
    [holes, selectedHoleNumber],
  );
  const definition = useMemo(
    () => (legacyHole ? fromMappedHole(legacyHole) : null),
    [legacyHole],
  );
  const renderable = isRenderableGswingHoleDefinition(definition);
  const corridor = definition ? computeHoleCorridor(definition) : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-black to-black text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-white/60 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="font-serif text-lg sm:text-xl text-amber-200">Rendering Studio</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/60">Owner · V1 foundation</p>
          </div>
        </div>
        <Link to="/gswing/course-mapper" className="text-xs text-white/60 hover:text-white">Course Mapper →</Link>
      </header>

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[220px_1fr_260px]">
        {/* Sidebar — courses + holes */}
        <aside className="space-y-4">
          <section>
            <h2 className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/50">Courses</h2>
            <ul className="space-y-1">
              {courses.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedCourseId(c.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      selectedCourseId === c.id ? "bg-emerald-500/20 text-emerald-100" : "text-white/70 hover:bg-white/5"
                    }`}
                  >
                    {c.courseName}
                  </button>
                </li>
              ))}
              {courses.length === 0 && <li className="text-xs text-white/40">No courses loaded.</li>}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/50">Holes</h2>
            <div className="grid grid-cols-3 gap-1">
              {holes.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedHoleNumber(h.holeNumber)}
                  className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                    selectedHoleNumber === h.holeNumber
                      ? "bg-amber-400/20 text-amber-100"
                      : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  {h.holeNumber}
                </button>
              ))}
              {holes.length === 0 && !loading && <span className="col-span-3 text-xs text-white/40">No holes.</span>}
              {loading && <span className="col-span-3 text-xs text-white/40">Loading…</span>}
            </div>
          </section>
        </aside>

        {/* Preview */}
        <section className="relative aspect-[4/5] min-h-[420px] overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <StudioPreview def={definition} />
          <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/15 bg-black/60 px-2 py-1 text-[10px] uppercase tracking-widest text-white/70">
            {renderable ? "GSWING definition · renderable" : "Definition · not renderable"}
          </div>
        </section>

        {/* Right panel — authoring stubs */}
        <aside className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <h3 className="text-xs uppercase tracking-[0.3em] text-white/50">Hole meta</h3>
            {definition ? (
              <dl className="mt-2 space-y-1 text-xs text-white/80">
                <div className="flex justify-between"><dt className="text-white/50">Hole</dt><dd>{definition.holeNumber}</dd></div>
                <div className="flex justify-between"><dt className="text-white/50">Par</dt><dd>{definition.par ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-white/50">Fairways</dt><dd>{definition.fairwayPolygons.length}</dd></div>
                <div className="flex justify-between"><dt className="text-white/50">Bunkers</dt><dd>{definition.bunkers.length}</dd></div>
                <div className="flex justify-between"><dt className="text-white/50">Water</dt><dd>{definition.water.length + definition.penaltyAreas.length}</dd></div>
                <div className="flex justify-between"><dt className="text-white/50">Trees</dt><dd>{definition.trees.clusters.length + definition.trees.points.length}</dd></div>
                <div className="flex justify-between"><dt className="text-white/50">Corridor pts</dt><dd>{corridor.length}</dd></div>
              </dl>
            ) : <p className="mt-2 text-xs text-white/40">No hole selected.</p>}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
            <h3 className="text-xs uppercase tracking-[0.3em] text-white/50">Actions</h3>
            <Button variant="secondary" size="sm" className="w-full justify-start gap-2" disabled title="Coming in v2">
              <Import className="h-4 w-4" /> Import geometry
            </Button>
            <Button variant="secondary" size="sm" className="w-full justify-start gap-2" disabled title="Coming in v2">
              <Layers className="h-4 w-4" /> Edit layers
            </Button>
            <Button variant="secondary" size="sm" className="w-full justify-start gap-2" disabled title="Coming in v2">
              <Radar className="h-4 w-4" /> Validate framing
            </Button>
            <Button variant="secondary" size="sm" className="w-full justify-start gap-2" disabled title="Coming in v2">
              <UploadCloud className="h-4 w-4" /> Publish revision
            </Button>
            <p className="pt-1 text-[10px] leading-relaxed text-white/40">
              Authoring tools ship in v2. This preview is driven by the owned-geometry model adapted from your mapped data.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default RenderingStudio;
