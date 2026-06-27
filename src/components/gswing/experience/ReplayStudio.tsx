// G Swing — Replay Studio.
//
// Cinematic post-round replay. Consumes the Round Experience Model only —
// never recomputes scores, shots, or moments on its own. Reuses every
// existing Mapbox engine (course layers, camera engine, shot overlay,
// flyover) inside its own dedicated map instance so the live GPS map is
// left untouched and there are no duplicate layer adds on a shared map.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Film,
  FlagTriangleRight,
  Gauge,
  Globe2,
  Pause,
  Play,
  Plane,
  Target,
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { loadMapboxToken } from "@/components/gswing/GpsMap";
import {
  applyCourseGeometry,
  clearCourseGeometry,
  ensureCourseLayers,
  fitHole,
  runFlyover,
} from "@/lib/mapbox-course-layers";
import {
  ensureShotOverlayLayers,
  setShotReplay,
  clearShotReplay,
} from "@/lib/mapbox-shot-overlay";
import { applyMode as applyCameraMode, type CameraMode } from "@/lib/camera-engine";
import type {
  ReplaySegment,
  RoundExperienceModel,
} from "@/lib/experience/experience-engine";

type TokenState =
  | { status: "loading" }
  | { status: "ready"; token: string }
  | { status: "error"; message: string };

interface Props {
  open: boolean;
  onClose: () => void;
  model: RoundExperienceModel;
  /** Optional: jump straight to the first segment matching this shot id. */
  focusShotId?: string | null;
}

const SPEEDS: Array<{ id: number; label: string }> = [
  { id: 0.5, label: "0.5×" },
  { id: 1, label: "1×" },
  { id: 1.5, label: "1.5×" },
  { id: 2, label: "2×" },
];

const CAMERA_PRESETS: Array<{ id: CameraMode; label: string; icon: typeof Eye }> = [
  { id: "broadcast", label: "Broadcast", icon: Globe2 },
  { id: "playing", label: "Player", icon: Target },
  { id: "full", label: "Overview", icon: Eye },
];

export function ReplayStudio({ open, onClose, model, focusShotId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const ballRef = useRef<mapboxgl.Marker | null>(null);
  const ballAnimRef = useRef<number | null>(null);
  const segmentTimerRef = useRef<number | null>(null);
  const styleReadyRef = useRef(false);

  const [tokenState, setTokenState] = useState<TokenState>({ status: "loading" });
  const [segmentIdx, setSegmentIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [camera, setCamera] = useState<CameraMode>("broadcast");

  const segments = model.replay_timeline;
  const segment: ReplaySegment | null = segments[segmentIdx] ?? null;

  // Jump to focus shot when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setPlaying(true);
    if (focusShotId) {
      const idx = segments.findIndex((s) => s.shot?.id === focusShotId);
      setSegmentIdx(idx >= 0 ? idx : 0);
    } else {
      setSegmentIdx(0);
    }
  }, [open, focusShotId, segments]);

  // Load Mapbox token.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTokenState({ status: "loading" });
    loadMapboxToken()
      .then((token) => {
        if (!cancelled) setTokenState({ status: "ready", token });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setTokenState({
            status: "error",
            message: err instanceof Error ? err.message : "Mapbox token unavailable",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Create the dedicated Replay map once token + container are ready.
  useEffect(() => {
    if (!open) return;
    if (tokenState.status !== "ready") return;
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = tokenState.token;
    const first = model.holes[0];
    const initial = first?.geometry?.green
      ? [first.geometry.green.center_lng, first.geometry.green.center_lat]
      : first?.shots[0]?.start
        ? [first.shots[0].start.lng, first.shots[0].start.lat]
        : [55.4881, 25.3536];
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: initial as [number, number],
      zoom: 16.5,
      pitch: 60,
      bearing: 0,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      styleReadyRef.current = true;
      ensureCourseLayers(map);
      ensureShotOverlayLayers(map);
    });
    return () => {
      styleReadyRef.current = false;
      if (ballAnimRef.current) cancelAnimationFrame(ballAnimRef.current);
      if (segmentTimerRef.current) window.clearTimeout(segmentTimerRef.current);
      if (ballRef.current) {
        ballRef.current.remove();
        ballRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [open, tokenState.status, model.holes]);

  // Apply the current segment to the map.
  const runSegment = useCallback(
    async (idx: number) => {
      const map = mapRef.current;
      const seg = segments[idx];
      if (!map || !seg || !styleReadyRef.current) return;
      const hole = seg.hole_number ? model.holes.find((h) => h.hole_number === seg.hole_number) : null;
      const geometry = hole?.geometry ?? null;

      // Hole geometry + shot polyline for this hole.
      if (geometry) applyCourseGeometry(map, geometry);
      else clearCourseGeometry(map);
      if (hole) setShotReplay(map, hole.shots);
      else clearShotReplay(map);

      if (seg.kind === "course_flyover") {
        const center = model.holes
          .map((h) => h.geometry?.green ?? null)
          .find(Boolean);
        if (center) {
          map.easeTo({
            center: [center.center_lng, center.center_lat],
            zoom: 14.5,
            pitch: 50,
            bearing: 25,
            duration: Math.max(800, seg.duration_ms / speed),
          });
        }
        return;
      }
      if (seg.kind === "hole_flyover" && geometry) {
        await runFlyover(map, geometry);
        return;
      }
      if (seg.kind === "shot" && seg.shot && seg.shot.start && seg.shot.end) {
        // Camera follows shot ball.
        applyCameraMode(map, camera, {
          playerPos: seg.shot.start,
          tee: seg.shot.start,
          pin: seg.shot.end,
          courseCenter: geometry?.green
            ? { lat: geometry.green.center_lat, lng: geometry.green.center_lng }
            : null,
          heading: null,
          geometry,
        });
        animateBall(map, seg.shot.start, seg.shot.end, seg.duration_ms / speed);
        return;
      }
      if (seg.kind === "landing" && seg.shot?.end) {
        map.easeTo({
          center: [seg.shot.end.lng, seg.shot.end.lat],
          zoom: 19,
          pitch: 35,
          duration: 600,
        });
        return;
      }
      if (seg.kind === "score_update" && geometry) {
        fitHole(map, geometry);
        return;
      }
      if (seg.kind === "opening" || seg.kind === "round_summary" || seg.kind === "closing") {
        // Pull camera back for a wide ambient shot.
        const center = geometry?.green
          ? [geometry.green.center_lng, geometry.green.center_lat]
          : [map.getCenter().lng, map.getCenter().lat];
        map.easeTo({
          center: center as [number, number],
          zoom: 14,
          pitch: 35,
          bearing: 0,
          duration: 1200,
        });
      }
    },
    [segments, model.holes, camera, speed],
  );

  // Ball animation along the shot polyline.
  function animateBall(
    map: mapboxgl.Map,
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    durationMs: number,
  ) {
    if (ballAnimRef.current) cancelAnimationFrame(ballAnimRef.current);
    if (!ballRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 30% 30%, #fff, #d4d4d4 70%, #888);border:1px solid #fff;box-shadow:0 0 12px rgba(255,255,255,0.8), 0 0 22px rgba(245,200,75,0.6);pointer-events:none;";
      ballRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([start.lng, start.lat])
        .addTo(map);
    }
    const startAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startAt) / Math.max(400, durationMs));
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      // Add a small parabolic "arc" by lifting zoom subtly mid-flight.
      const lng = start.lng + (end.lng - start.lng) * eased;
      const lat = start.lat + (end.lat - start.lat) * eased;
      ballRef.current?.setLngLat([lng, lat]);
      if (t < 1) ballAnimRef.current = requestAnimationFrame(tick);
      else ballAnimRef.current = null;
    };
    ballAnimRef.current = requestAnimationFrame(tick);
  }

  // Drive the segment scheduler whenever idx/playing/speed change.
  useEffect(() => {
    if (!open) return;
    if (segmentTimerRef.current) window.clearTimeout(segmentTimerRef.current);
    if (!segment) return;
    runSegment(segmentIdx);
    if (!playing) return;
    const dur = Math.max(600, segment.duration_ms / speed);
    segmentTimerRef.current = window.setTimeout(() => {
      setSegmentIdx((i) => Math.min(segments.length - 1, i + 1));
    }, dur);
    return () => {
      if (segmentTimerRef.current) window.clearTimeout(segmentTimerRef.current);
    };
  }, [segmentIdx, playing, speed, segment, open, runSegment, segments.length]);

  // Camera change applies immediately if we're inside a shot/landing segment.
  useEffect(() => {
    runSegment(segmentIdx);
  }, [camera]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = segments.length ? (segmentIdx + 1) / segments.length : 0;

  const nextShot = useCallback(() => {
    const next = segments.findIndex((s, i) => i > segmentIdx && s.kind === "shot");
    setSegmentIdx(next >= 0 ? next : Math.min(segments.length - 1, segmentIdx + 1));
  }, [segments, segmentIdx]);
  const prevShot = useCallback(() => {
    let prev = -1;
    for (let i = segmentIdx - 1; i >= 0; i--) {
      if (segments[i].kind === "shot") { prev = i; break; }
    }
    setSegmentIdx(prev >= 0 ? prev : Math.max(0, segmentIdx - 1));
  }, [segments, segmentIdx]);
  const nextHole = useCallback(() => {
    const currentHole = segment?.hole_number ?? 0;
    const next = segments.findIndex(
      (s, i) => i > segmentIdx && s.kind === "hole_flyover" && (s.hole_number ?? 0) > currentHole,
    );
    setSegmentIdx(next >= 0 ? next : Math.min(segments.length - 1, segmentIdx + 1));
  }, [segments, segmentIdx, segment]);

  const summary = useMemo(() => {
    const total = model.holes.reduce((a, h) => a + h.strokes, 0);
    const lastProg = model.score_progression[model.score_progression.length - 1];
    const toPar = lastProg?.to_par;
    return { total, toPar };
  }, [model]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gradient-card max-h-[92vh] max-w-3xl overflow-hidden border-gold/30 p-0">
        <DialogHeader className="border-b border-gold/15 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 font-serif text-gold">
            <Film className="h-4 w-4" />
            G Swing Replay Studio
            <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
              {model.round.course_name ?? "Round"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {!model.has_sufficient_evidence ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Not enough data available. Track shots during a round to unlock Replay Studio.
          </div>
        ) : (
          <div className="relative">
            <div className="relative h-[58vh] min-h-[420px] w-full overflow-hidden bg-black">
              {tokenState.status === "loading" && (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Loading Mapbox…
                </div>
              )}
              {tokenState.status === "error" && (
                <div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
                  {tokenState.message}
                </div>
              )}
              <div
                ref={containerRef}
                className="absolute inset-0"
                style={{ visibility: tokenState.status === "ready" ? "visible" : "hidden" }}
              />

              {/* HUD */}
              <div className="pointer-events-none absolute left-3 top-3 max-w-[60%] rounded-md border border-gold/30 bg-black/60 px-3 py-1.5 backdrop-blur-md">
                <p className="text-[10px] uppercase tracking-wider text-gold-soft">
                  {segment?.kind.replace(/_/g, " ") ?? "—"}
                </p>
                <p className="font-serif text-sm text-gold">{segment?.caption ?? ""}</p>
                {segment?.detail && (
                  <p className="text-[11px] text-muted-foreground">{segment.detail}</p>
                )}
              </div>

              <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-gold/30 bg-black/60 px-3 py-1.5 text-right backdrop-blur-md">
                <p className="text-[10px] uppercase tracking-wider text-gold-soft">Round</p>
                <p className="font-serif text-base text-gold">
                  {summary.total}{" "}
                  {summary.toPar != null && (
                    <span className="text-xs text-muted-foreground">
                      ({summary.toPar >= 0 ? "+" : ""}
                      {summary.toPar})
                    </span>
                  )}
                </p>
              </div>

              {/* Camera selector */}
              <div className="absolute right-3 top-16 flex flex-col gap-1 rounded-md border border-gold/30 bg-black/55 p-1 backdrop-blur-md">
                {CAMERA_PRESETS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => setCamera(id)}
                    className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
                      camera === id ? "bg-gold/25 text-gold" : "text-white/65 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="border-t border-gold/15 px-4 py-3">
              <div className="mb-2 h-1 w-full overflow-hidden rounded bg-background/60">
                <div
                  className="h-full rounded bg-gradient-to-r from-gold to-emerald-300 transition-[width] duration-500"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="border-gold/30" onClick={prevShot}>
                  <ChevronLeft className="mr-1 h-3 w-3" /> Prev shot
                </Button>
                <Button
                  size="sm"
                  className="gradient-gold text-primary-foreground"
                  onClick={() => setPlaying((p) => !p)}
                >
                  {playing ? <Pause className="mr-1 h-3 w-3" /> : <Play className="mr-1 h-3 w-3" />}
                  {playing ? "Pause" : "Play"}
                </Button>
                <Button size="sm" variant="outline" className="border-gold/30" onClick={nextShot}>
                  Next shot <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="text-gold" onClick={nextHole}>
                  <FlagTriangleRight className="mr-1 h-3 w-3" /> Skip hole
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gold"
                  onClick={() => {
                    const map = mapRef.current;
                    const hole = segment?.hole_number
                      ? model.holes.find((h) => h.hole_number === segment.hole_number)
                      : null;
                    if (map && hole?.geometry) runFlyover(map, hole.geometry);
                  }}
                >
                  <Plane className="mr-1 h-3 w-3" /> Flyover
                </Button>
                <div className="ml-auto flex items-center gap-1 rounded border border-gold/20 bg-background/40 px-1.5 py-1 text-[10px]">
                  <Gauge className="h-3 w-3 text-gold" />
                  {SPEEDS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSpeed(s.id)}
                      className={`rounded px-1.5 py-0.5 ${
                        speed === s.id ? "bg-gold/25 text-gold" : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
