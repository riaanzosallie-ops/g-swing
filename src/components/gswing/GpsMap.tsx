import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Droplets,
  Flag,
  Footprints,
  Home,
  Layers as LayersIcon,
  Locate,
  LocateOff,
  Maximize2,
  MapPin,
  MoreHorizontal,
  Mountain,
  Navigation,
  Plane,
  Play,
  Radio,
  Target,
  Type as TypeIcon,
} from "lucide-react";
import { useBag } from "@/lib/gswing-store";
import {
  detectCourseArrival,
  endShot,
  fetchCourses,
  fetchHoleGps,
  getOrCreateSessionId,
  setCurrentHole,
  startRound,
  startShot,
  updatePlayerLocation,
  type ActiveRound,
  type GolfCourse,
  type HoleGpsResponse,
  type Shot,
  type TeeBox,
} from "@/lib/golf-gps-api";
import { haversineYards, toDisplayUnit, unitLabel, type LatLng } from "@/lib/gps-utils";
import { toast } from "sonner";
import courseBg from "@/assets/course-bg.jpg";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchHoleGeometry, geometryToHoleGpsResponse } from "@/lib/course-geometry";
import type { HoleGeometryPayload } from "@/lib/course-geometry";
import { YardagePanel } from "@/components/gswing/YardagePanel";
import { supabase } from "@/integrations/supabase/client";
import {
  applyCourseGeometry,
  clearCourseGeometry,
  ensureCourseLayers,
  fitHole,
  runFlyover,
  setLayerGroupVisibility,
  updateYardageLabels,
  updatePlayerTrail,
} from "@/lib/mapbox-course-layers";
import {
  ensureShotOverlayLayers,
  setShotReplay,
  clearShotReplay,
} from "@/lib/mapbox-shot-overlay";
import {
  fetchRoundShots,
  persistShot,
  shotsForHole,
  computeRoundStats,
  updateShotTags,
  type StoredShot,
  type RoundStats,
  type ShotTagInput,
} from "@/lib/shot-tracker";
import { RoundIntelligence } from "@/components/gswing/RoundIntelligence";
import { ShotTagPrompt } from "@/components/gswing/ShotTagPrompt";
import { RoundShotReview } from "@/components/gswing/RoundShotReview";
import { BookOpen, Film, Sparkles } from "lucide-react";
import { PostRoundExperience } from "@/components/gswing/experience/PostRoundExperience";
import { buildRoundExperience, type RoundMeta } from "@/lib/experience/experience-engine";
import { usePlayer } from "@/lib/gswing-store";
import {
  applyMode as applyCameraMode,
  followPlayer,
  CAMERA_MODES,
  type CameraMode,
} from "@/lib/camera-engine";
import {
  buildGpsCaddieInsight,
  classifyAccuracy,
  measureBetween,
  midpoint,
} from "@/lib/gswing-gps";
import { computeYardages } from "@/lib/yardage-engine";
import { useGswingWeather } from "@/lib/use-gswing-weather";
import { Ruler, X as XIcon, Wifi, WifiOff, Wind } from "lucide-react";
import { GpsHud } from "@/components/gswing/gps/GpsHud";
import type { YardageReadout } from "@/lib/yardage-engine";
import {
  ensureMappedLayers,
  setMappedHoleData,
  clearMappedHoleData,
} from "@/lib/mapbox-mapped-layers";
import {
  findNearestCourseMap,
  loadMappedHole,
} from "@/lib/gswing-course-map-loader";
import { buildGolfGpsSnapshot } from "@/lib/gswing-course-mapping";
import type { MappedHole } from "@/types/gswing-course-map";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGswingAdmin } from "@/lib/use-gswing-admin";
import { GpsBottomSheet } from "@/components/gswing/gps/GpsBottomSheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { GswingWeather } from "@/lib/gswing-weather";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MEASURE_SRC = "gs-measure-src";
const MEASURE_LINE = "gs-measure-line";
const MEASURE_END = "gs-measure-end";
const MEASURE_PULSE = "gs-measure-pulse";
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function ensureMeasureLayers(map: mapboxgl.Map) {
  if (!map.getSource(MEASURE_SRC)) {
    map.addSource(MEASURE_SRC, { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getLayer(MEASURE_PULSE)) {
    map.addLayer({
      id: MEASURE_PULSE,
      type: "circle",
      source: MEASURE_SRC,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 18,
        "circle-color": "#F5C84B",
        "circle-opacity": 0.18,
        "circle-blur": 0.4,
      },
    });
  }
  if (!map.getLayer(MEASURE_LINE)) {
    map.addLayer({
      id: MEASURE_LINE,
      type: "line",
      source: MEASURE_SRC,
      filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#F5C84B",
        "line-width": 3,
        "line-opacity": 0.95,
        "line-dasharray": [1.5, 1.2],
      },
    });
  }
  if (!map.getLayer(MEASURE_END)) {
    map.addLayer({
      id: MEASURE_END,
      type: "circle",
      source: MEASURE_SRC,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 6,
        "circle-color": "#F5C84B",
        "circle-stroke-color": "#1a1300",
        "circle-stroke-width": 2,
      },
    });
  }
}

function setMeasureGeo(
  map: mapboxgl.Map,
  player: LatLng | null,
  target: LatLng | null,
) {
  const src = map.getSource(MEASURE_SRC) as mapboxgl.GeoJSONSource | undefined;
  if (!src) return;
  if (!player || !target) {
    src.setData(EMPTY_FC);
    return;
  }
  src.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [player.lng, player.lat],
            [target.lng, target.lat],
          ],
        },
      },
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [target.lng, target.lat] },
      },
    ],
  });
}

// Public Mapbox token (publishable pk.*) is loaded at runtime from the
// `mapbox-token` edge function — never hardcoded, never baked into the bundle.
type TokenState =
  | { status: "loading" }
  | { status: "ready"; token: string }
  | { status: "error"; message: string };

let cachedTokenPromise: Promise<string> | null = null;
export function loadMapboxToken(): Promise<string> {
  if (!cachedTokenPromise) {
    cachedTokenPromise = (async () => {
      const { data, error } = await supabase.functions.invoke<{ token?: string; error?: string }>(
        "mapbox-token",
      );
      if (error) throw new Error(error.message || "Failed to load Mapbox token");
      if (!data?.token) throw new Error(data?.error || "Mapbox token unavailable");
      return data.token;
    })().catch((err) => {
      cachedTokenPromise = null; // allow retry on next mount
      throw err;
    });
  }
  return cachedTokenPromise;
}

function MapboxCourseView({
  gps,
  playerPosition,
  playerHeading,
  playerAccuracy,
  selectedCourse,
  hole,
  centerDistance,
  displayUnit,
  geometry,
  holeShots,
  holeLengthYards,
  playerHandicap,
  yardageReadout,
  caddieInsight,
  unit,
  fallbackCenterYards,
}: {
  gps: HoleGpsResponse | null;
  playerPosition: LatLng | null;
  playerHeading: number | null;
  playerAccuracy: number | null;
  selectedCourse: GolfCourse;
  hole: number;
  centerDistance: number | null;
  displayUnit: "y" | "m";
  geometry: HoleGeometryPayload | null;
  holeShots: StoredShot[];
  holeLengthYards: number | null;
  playerHandicap: number | null;
  yardageReadout: YardageReadout;
  caddieInsight: string;
  unit: "yards" | "meters";
  fallbackCenterYards: number | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const playerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const playerElRef = useRef<HTMLDivElement | null>(null);
  const trailRef = useRef<LatLng[]>([]);
  const teeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pinMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const styleLoadedRef = useRef(false);
  const labelTimerRef = useRef<number | null>(null);

  const [showOverlays, setShowOverlays] = useState(true);
  const [showHazards, setShowHazards] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [flyoverRunning, setFlyoverRunning] = useState(false);
  const [tokenState, setTokenState] = useState<TokenState>({ status: "loading" });
  const [cameraMode, setCameraMode] = useState<CameraMode>("playing");
  const [measureActive, setMeasureActive] = useState(false);
  const [measurePoint, setMeasurePoint] = useState<LatLng | null>(null);
  const [mapView, setMapView] = useState<"premium" | "satellite">("premium");

  // Premium Course Mapping Engine — mapped hole data sourced from
  // gswing_course_maps / gswing_mapped_holes / gswing_hole_features.
  // Drives both the Mapbox overlay layers and the HUD distances/insight.
  const [mappedHole, setMappedHole] = useState<MappedHole | null>(null);
  const [mappedCourseId, setMappedCourseId] = useState<string | null>(null);
  const [mappingStatus, setMappingStatus] = useState<
    "idle" | "loading" | "mapped" | "missing"
  >("idle");
  const [mappingRefreshTick, setMappingRefreshTick] = useState(0);
  // Tracks whether the nearest-course lookup actually found a mapped
  // course near the player. Used by the honest GPS lock banner to
  // distinguish "no mapped course nearby" from "course found but the
  // current hole has no surveyed geometry yet".
  const [nearestCourseFound, setNearestCourseFound] = useState<boolean | null>(null);

  // Live weather for the in-map HUD (real Open-Meteo via existing hook).
  const hudWeather = useGswingWeather(
    playerPosition
      ? { latitude: playerPosition.lat, longitude: playerPosition.lng }
      : { latitude: selectedCourse.lat ?? null, longitude: selectedCourse.lng ?? null },
  );

  // Fetch the public Mapbox token from the edge function once per mount.
  useEffect(() => {
    let cancelled = false;
    setTokenState({ status: "loading" });
    loadMapboxToken()
      .then((token) => {
        if (!cancelled) setTokenState({ status: "ready", token });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Mapbox token unavailable";
          setTokenState({ status: "error", message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve geometry from the live gps payload only. We never substitute
  // fabricated tee/pin coordinates in Premium mode — when geometry is
  // missing the HUD honestly shows the "professional mapping required"
  // state instead of drawing a fake hole.
  const primaryTee = getPrimaryTee(gps?.tee_boxes ?? []);
  const teeFromGps = teeToPoint(primaryTee);
  const pinFromGps = pointFromLatLng(gps?.green?.pin) ?? pointFromLatLng(gps?.green?.center);

  const tee: LatLng | null = teeFromGps;
  const pin: LatLng | null = pinFromGps;
  const focus: LatLng =
    playerPosition ??
    tee ??
    pin ??
    { lat: selectedCourse.lat, lng: selectedCourse.lng };

  const cameraCtx = useMemo(
    () => ({
      playerPos: playerPosition,
      tee,
      pin,
      courseCenter: { lat: selectedCourse.lat, lng: selectedCourse.lng },
      heading: playerHeading,
      geometry,
    }),
    [playerPosition, tee, pin, selectedCourse.lat, selectedCourse.lng, playerHeading, geometry],
  );

  // Initialise map once token is ready.
  useEffect(() => {
    if (tokenState.status !== "ready") return;
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = tokenState.token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [focus.lng, focus.lat],
      zoom: 17.5,
      pitch: 55,
      bearing: 0,
      attributionControl: false,
    });
    // Premium GPS owns the controls. The default Mapbox compass /
    // geolocate widgets get hidden via `.gswing-map` CSS; we keep a
    // compact zoom group in the bottom-right safe zone.
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }),
      "bottom-right",
    );
    mapRef.current = map;
    return () => {
      styleLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
      playerMarkerRef.current = null;
      teeMarkerRef.current = null;
      pinMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenState.status]);

  // After map style is ready: install layers, hide POI/road labels for
  // Premium GPS view, darken raw satellite, push current data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onLoad = () => {
      styleLoadedRef.current = true;
      applyPremiumMapStyle(map, mapView);
      ensureCourseLayers(map);
      if (geometry) applyCourseGeometry(map, geometry);
      updateYardageLabels(
        map,
        playerPosition,
        geometry,
        displayUnit === "m" ? "meters" : "yards",
      );
      setLayerGroupVisibility(map, "overlays", showOverlays);
      setLayerGroupVisibility(map, "hazards", showHazards);
      setLayerGroupVisibility(map, "labels", showLabels);
      ensureMeasureLayers(map);
      ensureMappedLayers(map);
      if (mappedHole) setMappedHoleData(map, mappedHole);
    };
    if (map.isStyleLoaded()) onLoad();
    else map.on("load", onLoad);
    return () => {
      map.off("load", onLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live toggle between Premium GPS view and raw Satellite.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    applyPremiumMapStyle(map, mapView);
    // Mapbox loads symbol/icon layers asynchronously, so reapply the
    // premium scrub whenever the style emits new data. Cheap & safe —
    // sets only the layers that already exist.
    const reapply = () => applyPremiumMapStyle(map, mapView);
    map.on("styledata", reapply);
    map.on("idle", reapply);
    return () => {
      map.off("styledata", reapply);
      map.off("idle", reapply);
    };
  }, [mapView]);

  // Load mapped course/hole geometry from Supabase whenever the
  // course, hole, first GPS fix, or manual refresh changes. Never
  // fabricates — when no mapping exists we render the honest
  // "Professional mapping required" state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMappingStatus("loading");
      try {
        // Prefer the nearest mapped course to the player's real GPS
        // location; fall back to the selected course centre so the
        // mapper still works pre-fix.
        const anchor =
          playerPosition ?? { lat: selectedCourse.lat, lng: selectedCourse.lng };
        const courseMap = await findNearestCourseMap(anchor);
        if (cancelled) return;
        if (!courseMap) {
          setMappedCourseId(null);
          setMappedHole(null);
          setMappingStatus("missing");
          setNearestCourseFound(false);
          return;
        }
        setMappedCourseId(courseMap.id);
        setNearestCourseFound(true);
        const hp = await loadMappedHole(courseMap.id, hole);
        if (cancelled) return;
        setMappedHole(hp);
        setMappingStatus(hp ? "mapped" : "missing");
      } catch {
        if (!cancelled) {
          setMappedHole(null);
          setMappingStatus("missing");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    selectedCourse.id,
    selectedCourse.lat,
    selectedCourse.lng,
    hole,
    // Only the *presence* of a fix should retrigger, not every metre.
    playerPosition != null,
    mappingRefreshTick,
  ]);

  // Push mapped hole into the Mapbox sources/layers. Additive — never
  // touches Slice A/B/C layers. Hidden in Satellite mode by toggling
  // opacity off so the raw imagery can dominate.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    ensureMappedLayers(map);
    if (mappedHole) setMappedHoleData(map, mappedHole);
    else clearMappedHoleData(map);
  }, [mappedHole]);

  // Visibility of mapped overlays follows the Premium / Satellite toggle
  // and the hazards toggle, so the user can declutter without losing the
  // mapped greens / pin / layups.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    const hazardLayers = [
      "gsm-water-fill",
      "gsm-water-line",
      "gsm-bunker-fill",
      "gsm-bunker-line",
      "gsm-penalty-fill",
      "gsm-penalty-line",
      "gsm-ob-dash",
    ];
    const greenLayers = [
      "gsm-green-front",
      "gsm-green-center",
      "gsm-green-back",
      "gsm-green-labels",
      "gsm-pin-flag",
      "gsm-layup-rings",
      "gsm-layup-labels",
      "gsm-dogleg",
      "gsm-dogleg-labels",
      "gsm-landing-fill",
    ];
    const hazardVis = mapView === "satellite" || !showHazards ? "none" : "visible";
    const greenVis = mapView === "satellite" ? "none" : "visible";
    for (const id of hazardLayers) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", hazardVis);
    }
    for (const id of greenLayers) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", greenVis);
    }
  }, [mapView, showHazards, mappedHole]);

  // Course geometry — re-apply when the hole/payload changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    if (geometry) applyCourseGeometry(map, geometry);
    else clearCourseGeometry(map);
  }, [geometry]);

  // Shot replay overlay — additive layers, no impact on Slice A/B/C.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    ensureShotOverlayLayers(map);
    if (holeShots.length) setShotReplay(map, holeShots);
    else clearShotReplay(map);
  }, [holeShots]);

  // Throttled live yardage label refresh (player movement / unit changes).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    if (labelTimerRef.current) window.clearTimeout(labelTimerRef.current);
    labelTimerRef.current = window.setTimeout(() => {
      updateYardageLabels(
        map,
        playerPosition,
        geometry,
        displayUnit === "m" ? "meters" : "yards",
      );
    }, 220);
    return () => {
      if (labelTimerRef.current) {
        window.clearTimeout(labelTimerRef.current);
        labelTimerRef.current = null;
      }
    };
  }, [playerPosition?.lat, playerPosition?.lng, geometry, displayUnit]);

  // Tap-to-measure: install click handler while measure mode is active.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    if (!measureActive) return;
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      setMeasurePoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    };
    map.getCanvas().style.cursor = "crosshair";
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
    };
  }, [measureActive]);

  // Tap-to-measure: sync the GeoJSON source whenever endpoints change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    ensureMeasureLayers(map);
    setMeasureGeo(map, playerPosition, measurePoint);
  }, [playerPosition?.lat, playerPosition?.lng, measurePoint?.lat, measurePoint?.lng]);

  // Visibility toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    setLayerGroupVisibility(map, "overlays", showOverlays);
  }, [showOverlays]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    setLayerGroupVisibility(map, "hazards", showHazards);
  }, [showHazards]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    setLayerGroupVisibility(map, "labels", showLabels);
  }, [showLabels]);

  // Recenter on hole / course change — only when not in a follow mode
  // (Playing/Broadcast handle their own tracking below).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (cameraMode === "playing" || cameraMode === "broadcast") return;
    map.easeTo({ center: [focus.lng, focus.lat], zoom: 17.5, duration: 700 });
  }, [focus.lat, focus.lng, cameraMode]);

  // Apply camera mode whenever the mode itself changes (instant switch).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    applyCameraMode(map, cameraMode, cameraCtx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMode]);

  // Tee marker — placeholder fallback only. When real DB geometry exists,
  // the gold tee circle is rendered by the Mapbox symbol layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (geometry || !tee) {
      if (teeMarkerRef.current) {
        teeMarkerRef.current.remove();
        teeMarkerRef.current = null;
      }
      return;
    }
    if (!teeMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:14px;height:14px;border-radius:50%;background:#F5C84B;border:2px solid #1a1300;box-shadow:0 0 6px rgba(245,200,75,0.7);";
      teeMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([tee.lng, tee.lat]).addTo(map);
    } else {
      teeMarkerRef.current.setLngLat([tee.lng, tee.lat]);
    }
  }, [tee?.lat, tee?.lng, geometry]);

  // Pin marker — placeholder fallback only (real pin comes from the
  // gs-pin Mapbox layer when DB geometry is present).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (geometry || !pin) {
      if (pinMarkerRef.current) {
        pinMarkerRef.current.remove();
        pinMarkerRef.current = null;
      }
      return;
    }
    if (!pinMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:18px;height:18px;border-radius:50%;background:#fff;border:3px solid #0a0a0a;box-shadow:0 0 8px rgba(255,255,255,0.6);";
      pinMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map);
    } else {
      pinMarkerRef.current.setLngLat([pin.lng, pin.lat]);
    }
  }, [pin?.lat, pin?.lng, geometry]);

  // Premium animated player marker — golfer dot with heading arrow,
  // breathing pulse and (best-effort) accuracy ring. Trail line is
  // managed by the dedicated gs-player-trail Mapbox source.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !playerPosition) return;

    if (!playerMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "gs-player-marker";
      el.style.cssText =
        "position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;pointer-events:none;";
      el.innerHTML = `
        <div class="gs-player-accuracy" style="position:absolute;border-radius:50%;border:1px solid rgba(245,200,75,0.55);background:rgba(245,200,75,0.08);width:34px;height:34px;box-shadow:inset 0 0 12px rgba(245,200,75,0.18);"></div>
        <div class="gs-player-pulse" style="position:absolute;width:34px;height:34px;border-radius:50%;background:rgba(245,200,75,0.35);animation:gs-pulse 1.8s ease-out infinite;"></div>
        <div class="gs-player-dot" style="position:relative;width:14px;height:14px;border-radius:50%;background:#ffffff;border:3px solid #F5C84B;box-shadow:0 0 0 2px rgba(0,0,0,0.45),0 0 12px rgba(245,200,75,0.85);"></div>
        <div class="gs-player-heading" style="position:absolute;top:-6px;left:50%;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid #F5C84B;transform-origin:50% 22px;transform:translateX(-50%) rotate(0deg);transition:transform 220ms ease-out;filter:drop-shadow(0 0 4px rgba(245,200,75,0.7));"></div>
      `;
      playerElRef.current = el;
      playerMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([playerPosition.lng, playerPosition.lat])
        .addTo(map);
    } else {
      playerMarkerRef.current.setLngLat([playerPosition.lng, playerPosition.lat]);
    }

    // Update heading arrow rotation.
    const el = playerElRef.current;
    if (el) {
      const arrow = el.querySelector<HTMLElement>(".gs-player-heading");
      if (arrow && typeof playerHeading === "number" && Number.isFinite(playerHeading)) {
        arrow.style.transform = `translateX(-50%) rotate(${playerHeading}deg)`;
        arrow.style.opacity = "1";
      } else if (arrow) {
        arrow.style.opacity = "0.35";
      }
      // Approximate the accuracy ring size in pixels at the current zoom.
      const ring = el.querySelector<HTMLElement>(".gs-player-accuracy");
      if (ring && typeof playerAccuracy === "number" && playerAccuracy > 0) {
        const metersPerPx =
          (40075016.686 * Math.cos((playerPosition.lat * Math.PI) / 180)) /
          Math.pow(2, map.getZoom() + 8);
        const px = Math.min(120, Math.max(18, playerAccuracy / Math.max(metersPerPx, 0.0001)));
        ring.style.width = `${px}px`;
        ring.style.height = `${px}px`;
      }
    }

    // Maintain a short trail of recent positions (last 60).
    const trail = trailRef.current;
    const last = trail[trail.length - 1];
    if (!last || last.lat !== playerPosition.lat || last.lng !== playerPosition.lng) {
      trail.push({ lat: playerPosition.lat, lng: playerPosition.lng });
      if (trail.length > 60) trail.splice(0, trail.length - 60);
      if (styleLoadedRef.current) updatePlayerTrail(map, trail);
    }

    // In follow modes, glide the camera to the new position.
    if (cameraMode === "playing" || cameraMode === "broadcast") {
      followPlayer(map, cameraMode, cameraCtx);
    }
  }, [playerPosition?.lat, playerPosition?.lng, playerHeading, playerAccuracy, cameraMode, cameraCtx]);

  // Control handlers.
  const onRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = playerPosition ?? tee ?? pin ?? focus;
    map.easeTo({ center: [target.lng, target.lat], zoom: 18, duration: 700 });
  }, [playerPosition?.lat, playerPosition?.lng, tee?.lat, tee?.lng, pin?.lat, pin?.lng, focus.lat, focus.lng]);

  const onFitHole = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (fitHole(map, geometry)) return;
    const pts = [tee, pin, playerPosition].filter(Boolean) as LatLng[];
    if (pts.length >= 2) {
      const bounds = new mapboxgl.LngLatBounds(
        [pts[0].lng, pts[0].lat],
        [pts[0].lng, pts[0].lat],
      );
      for (const p of pts) bounds.extend([p.lng, p.lat]);
      map.fitBounds(bounds, { padding: 60, duration: 700, maxZoom: 19 });
    }
  }, [geometry, tee, pin, playerPosition]);

  const onFlyover = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    if (!geometry) {
      toast.info("Flyover unavailable until course geometry is mapped.");
      return;
    }
    setFlyoverRunning(true);
    try {
      const ok = await runFlyover(map, geometry);
      if (!ok) toast.info("Flyover unavailable until course geometry is mapped.");
    } finally {
      setFlyoverRunning(false);
    }
  }, [geometry]);

  // Derive an honest readout + insight from mapped data. We only
  // override the parent-supplied yardageReadout/caddieInsight when the
  // mapped hole actually contains supporting geometry — otherwise the
  // existing fallback (computeYardages from raw DB geometry) wins.
  const mappedOverride = useMemo(() => {
    if (!mappedHole) return null;
    const snap = buildGolfGpsSnapshot(playerPosition, mappedHole, unit);
    if (!snap.hasMapping) return null;
    const hazardKind = (
      t: string,
    ): "water" | "bunker" | "trees" | "waste" | "ob" | "other" => {
      switch (t) {
        case "water":
          return "water";
        case "bunker":
          return "bunker";
        case "trees":
          return "trees";
        case "waste_area":
          return "waste";
        case "out_of_bounds":
          return "ob";
        default:
          return "other";
      }
    };
    const carries = snap.hazards
      .filter((h) => h.carry != null)
      .map((h) => ({
        id: h.id,
        kind: hazardKind(h.type),
        label: h.name,
        carry: h.carry as number,
        near: h.reach ?? (h.carry as number),
      }));
    const layups = snap.layups
      .filter((l) => l.distance != null)
      .map((l) => ({ label: l.name, yards: l.distance as number }));
    const doglegs =
      snap.dogleg != null ? [{ label: "Dogleg", yards: snap.dogleg }] : [];
    const readout: YardageReadout = {
      pin: snap.pin,
      front: snap.green.front,
      center: snap.green.center,
      back: snap.green.back,
      carries,
      layups,
      doglegs,
      fromLastShot: yardageReadout.fromLastShot,
      inGreenMode:
        snap.pin != null
          ? snap.pin <= (unit === "meters" ? 55 : 60)
          : snap.green.center != null
            ? snap.green.center <= (unit === "meters" ? 55 : 60)
            : false,
      dailyPin: yardageReadout.dailyPin,
      missSide: null,
      missReason: null,
    };
    // Evidence-only caddie insight, never invents wind/club/slope.
    const parts: string[] = [];
    if (snap.green.center != null) {
      parts.push(`Center is ${snap.green.center}${unit === "meters" ? "m" : "y"}.`);
    }
    if (snap.pin != null) {
      parts.push(`Pin ${snap.pin}${unit === "meters" ? "m" : "y"}.`);
    } else {
      parts.push("Pin not set. Playing to center green.");
    }
    const nearest = snap.hazards
      .filter((h) => h.reach != null)
      .sort((a, b) => (a.reach as number) - (b.reach as number))[0];
    if (nearest) {
      const side = nearest.side ? ` ${nearest.side}` : "";
      const carry =
        nearest.carry != null
          ? ` Carry ${nearest.carry}${unit === "meters" ? "m" : "y"}.`
          : "";
      parts.push(
        `${nearest.name} reach ${nearest.reach}${unit === "meters" ? "m" : "y"}${side}.${carry}`,
      );
    }
    return { readout, insight: parts.join(" ") };
  }, [mappedHole, playerPosition, unit, yardageReadout.fromLastShot, yardageReadout.dailyPin]);

  const effectiveReadout: YardageReadout = mappedOverride?.readout ?? yardageReadout;
  const effectiveInsight: string =
    mappingStatus === "missing"
      ? "Professional mapping required for this hole."
      : (mappedOverride?.insight ?? caddieInsight);
  const effectiveFallbackCenter =
    mappedOverride ? null : fallbackCenterYards;

  const onRefreshMapping = useCallback(() => {
    setMappingRefreshTick((t) => t + 1);
    toast.info("Refreshing course mapping…");
  }, []);

  if (tokenState.status === "loading") {
    return (
      <Card className="gradient-card flex h-[58vh] min-h-[410px] items-center justify-center border-gold/30 p-4 text-xs text-muted-foreground">
        <div className="text-center">
          <p className="mb-1 font-serif text-base text-gold">Loading Mapbox…</p>
          <p>Fetching secure satellite token.</p>
        </div>
      </Card>
    );
  }

  if (tokenState.status === "error") {
    return (
      <Card className="gradient-card border-gold/30 p-4 text-xs text-muted-foreground">
        <p className="mb-1 font-serif text-base text-gold">Mapbox token unavailable</p>
        {tokenState.message}
      </Card>
    );
  }

  const toggleMeasure = () =>
    setMeasureActive((v) => {
      const next = !v;
      if (!next) setMeasurePoint(null);
      return next;
    });

  return (
    <div
      className={`gswing-map relative overflow-hidden rounded-[28px] border border-gold/25 bg-black shadow-elegant ${
        mapView === "satellite" ? "is-satellite" : "is-premium"
      }`}
    >
      <div
        ref={containerRef}
        className="h-[80vh] min-h-[560px] w-full md:h-[78vh] md:min-h-[600px]"
      />

      {/* Premium ambience — soft vignette + emerald wash; no clutter. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_50%,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
      {mapView === "premium" && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(160%_120%_at_50%_60%,rgba(8,52,32,0.18)_0%,rgba(2,16,10,0.55)_100%)]" />
      )}

      <PremiumGpsChrome
        hole={gps?.hole_number ?? hole}
        par={gps?.par ?? null}
        handicap={gps?.handicap ?? null}
        totalHoles={18}
        mapView={mapView}
        onSetMapView={setMapView}
        measureActive={measureActive}
        onToggleMeasure={toggleMeasure}
        showOverlays={showOverlays}
        onToggleOverlays={() => setShowOverlays((v) => !v)}
        showHazards={showHazards}
        onToggleHazards={() => setShowHazards((v) => !v)}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        onRecenter={onRecenter}
        onFitHole={onFitHole}
        onFlyover={onFlyover}
        flyoverDisabled={!geometry}
        flyoverRunning={flyoverRunning}
        cameraMode={cameraMode}
        onSetCameraMode={setCameraMode}
        onRefreshMapping={onRefreshMapping}
        mappingStatus={mappingStatus}
        playerPosition={playerPosition}
        playerAccuracy={playerAccuracy}
        weather={hudWeather}
        caddieInsight={effectiveInsight}
      />

      <GpsBottomSheet
        unit={unit}
        readout={effectiveReadout}
        fallbackCenterYards={effectiveFallbackCenter}
        caddieInsight={effectiveInsight}
        measureActive={measureActive}
        onToggleMeasure={toggleMeasure}
        measurePoint={measurePoint}
        onClearMeasure={() => setMeasurePoint(null)}
        playerPosition={playerPosition}
      />
    </div>
  );
}

/**
 * PremiumGpsChrome — minimal, luxury HUD that overlays the live GPS map.
 * Matches the G-Swing Live GPS Premium reference: clean top bar with
 * hole/par/hcp pill + hole counter, Premium/Satellite pill, elegant
 * left rail of 4 round buttons, and a flag focus button. Every
 * existing capability remains reachable via the More menu.
 */
function PremiumGpsChrome(props: {
  hole: number;
  par: number | null;
  handicap: number | null;
  totalHoles: number;
  mapView: "premium" | "satellite";
  onSetMapView: (m: "premium" | "satellite") => void;
  measureActive: boolean;
  onToggleMeasure: () => void;
  showOverlays: boolean;
  onToggleOverlays: () => void;
  showHazards: boolean;
  onToggleHazards: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  onRecenter: () => void;
  onFitHole: () => void;
  onFlyover: () => void;
  flyoverDisabled: boolean;
  flyoverRunning: boolean;
  cameraMode: CameraMode;
  onSetCameraMode: (m: CameraMode) => void;
  onRefreshMapping: () => void;
  mappingStatus: "idle" | "loading" | "mapped" | "missing";
  playerPosition: LatLng | null;
  playerAccuracy: number | null;
  weather: { status: string; data?: GswingWeather };
  caddieInsight: string;
}): JSX.Element {
  const {
    hole,
    par,
    handicap,
    totalHoles,
    mapView,
    onSetMapView,
    measureActive,
    onToggleMeasure,
    showOverlays,
    onToggleOverlays,
    showHazards,
    onToggleHazards,
    showLabels,
    onToggleLabels,
    onRecenter,
    onFitHole,
    onFlyover,
    flyoverDisabled,
    flyoverRunning,
    cameraMode,
    onSetCameraMode,
    onRefreshMapping,
    mappingStatus,
    playerPosition,
    playerAccuracy,
    weather,
  } = props;

  const wx = weather.status === "ready" && weather.data ? weather.data : null;
  const accClass = playerPosition
    ? classifyAccuracy(playerAccuracy) === "low"
      ? "text-amber-300"
      : "text-emerald-300"
    : "text-amber-300";

  return (
    <>
      {/* TOP BAR — minimal: back · hole/par/hcp · hole counter */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("gswing-exit-gps"))}
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-full border border-gold/35 bg-black/55 text-gold-soft backdrop-blur-md transition-colors hover:text-gold active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex h-10 items-center gap-2 rounded-full border border-gold/35 bg-black/55 pl-2 pr-3 backdrop-blur-md">
            <span className="font-serif text-2xl leading-none text-gold">{hole}</span>
            <div className="flex flex-col text-[9px] uppercase tracking-[0.18em] leading-tight text-white/70">
              <span>
                Par <span className="text-gold">{par ?? "—"}</span>
              </span>
              {handicap != null && (
                <span>
                  HCP <span className="text-gold">{handicap}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto">
          <div className="grid h-10 min-w-[3.25rem] place-items-center rounded-full border border-gold/35 bg-black/55 px-2 text-[10px] font-semibold uppercase tracking-wider text-gold backdrop-blur-md">
            H{hole}/{totalHoles}
          </div>
        </div>
      </div>

      {/* PREMIUM / SATELLITE PILL — sits just under the top bar, right side */}
      <div className="pointer-events-auto absolute right-3 top-[3.65rem]">
        <div className="flex items-center rounded-full border border-gold/35 bg-black/55 p-0.5 backdrop-blur-md">
          {(["premium", "satellite"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onSetMapView(mode)}
              aria-pressed={mapView === mode}
              className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-all ${
                mapView === mode
                  ? "bg-gold text-black shadow-[0_0_14px_rgba(245,200,75,0.35)]"
                  : "text-gold-soft hover:text-gold"
              }`}
            >
              {mode === "premium" ? "Premium" : "Satellite"}
            </button>
          ))}
        </div>
      </div>

      {/* LEFT RAIL — 4 elegant round buttons (Locate · Measure · Layers · More) */}
      <div className="pointer-events-auto absolute left-3 top-1/2 flex -translate-y-1/2 flex-col gap-2.5">
        <ChromeBtn label="Locate" onClick={onRecenter}>
          <Crosshair className="h-4 w-4" />
        </ChromeBtn>
        <ChromeBtn label="Measure" active={measureActive} onClick={onToggleMeasure}>
          <Ruler className="h-4 w-4" />
        </ChromeBtn>
        <ChromeBtn
          label="Layers"
          active={showOverlays}
          onClick={onToggleOverlays}
        >
          <LayersIcon className="h-4 w-4" />
        </ChromeBtn>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="More"
              className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 bg-black/55 text-gold-soft backdrop-blur-md transition-all hover:text-gold active:scale-95"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="center"
            className="w-56 border-gold/30 bg-black/90 p-2 text-gold-soft backdrop-blur-xl"
          >
            <MoreItem onClick={onFitHole} icon={<Maximize2 className="h-3.5 w-3.5" />}>
              Fit hole
            </MoreItem>
            <MoreItem
              onClick={onFlyover}
              disabled={flyoverDisabled || flyoverRunning}
              icon={<Plane className="h-3.5 w-3.5" />}
            >
              {flyoverRunning ? "Flyover…" : "Flyover"}
            </MoreItem>
            <MoreItem
              onClick={onToggleHazards}
              active={showHazards}
              icon={<Droplets className="h-3.5 w-3.5" />}
            >
              Hazards · {showHazards ? "on" : "off"}
            </MoreItem>
            <MoreItem
              onClick={onToggleLabels}
              active={showLabels}
              icon={<Mountain className="h-3.5 w-3.5" />}
            >
              Yardages · {showLabels ? "on" : "off"}
            </MoreItem>
            <div className="my-1 h-px bg-gold/15" />
            <div className="px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-gold-soft/70">
              Camera
            </div>
            {CAMERA_MODES.map((m) => (
              <MoreItem
                key={m.id}
                onClick={() => onSetCameraMode(m.id)}
                active={cameraMode === m.id}
              >
                {m.label}
              </MoreItem>
            ))}
            <div className="my-1 h-px bg-gold/15" />
            <MoreItem onClick={onRefreshMapping} icon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh mapping
            </MoreItem>
            <div className="px-2 py-1.5 text-[10px] leading-snug text-white/70">
              <div className="flex items-center gap-1.5">
                {playerPosition ? (
                  <Wifi className={`h-3 w-3 ${accClass}`} />
                ) : (
                  <WifiOff className="h-3 w-3 text-amber-300" />
                )}
                <span>
                  {playerPosition ? "GPS live" : "GPS waiting"}
                  {playerAccuracy != null && playerPosition && (
                    <span className={`${accClass} ml-1`}>±{Math.round(playerAccuracy)}m</span>
                  )}
                </span>
              </div>
              {wx && (
                <div className="mt-1 flex items-center gap-1.5">
                  <Wind className="h-3 w-3 text-emerald-300" />
                  <span>
                    {Math.round(wx.windSpeedKmh)} km/h {wx.windDirectionLabel} · {Math.round(wx.temperatureC)}°
                  </span>
                </div>
              )}
              <div className="mt-1 text-[9px] uppercase tracking-wider text-gold-soft/70">
                Mapping ·{" "}
                {mappingStatus === "mapped"
                  ? "ready"
                  : mappingStatus === "loading"
                    ? "loading…"
                    : "required"}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* FLAG focus button — bottom-right, above bottom sheet */}
      <div className="pointer-events-auto absolute bottom-[16rem] right-3 md:bottom-[14rem]">
        <button
          type="button"
          onClick={onFitHole}
          aria-label="Focus on green"
          className="grid h-11 w-11 place-items-center rounded-full border border-gold/35 bg-black/55 text-gold backdrop-blur-md transition-all hover:bg-black/70 active:scale-95"
        >
          <Flag className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

function ChromeBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-full border backdrop-blur-md transition-all active:scale-95 ${
        active
          ? "border-gold bg-gold text-black shadow-[0_0_16px_rgba(245,200,75,0.4)]"
          : "border-gold/30 bg-black/55 text-gold-soft hover:text-gold"
      }`}
    >
      {children}
    </button>
  );
}

function MoreItem({
  onClick,
  disabled,
  active,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "text-gold" : ""
      }`}
    >
      {icon}
      <span className="flex-1">{children}</span>
    </button>
  );
}

/**
 * Premium Golf GPS treatment of the Mapbox satellite-streets style.
 * - Hides every symbol (label/POI) layer when in `premium` mode so the
 *   map stops looking like Google Earth.
 * - Darkens the raw satellite raster and tints it emerald.
 * - In `satellite` mode, restores label visibility and full brightness.
 */
function applyPremiumMapStyle(map: mapboxgl.Map, mode: "premium" | "satellite"): void {
  try {
    const style = map.getStyle();
    const layers = style?.layers ?? [];
    for (const layer of layers) {
      const id = layer.id;
      // Never touch G-Swing custom layers (gs-*, gsm-*) — those are
      // our mapped course features and stylized overlays.
      if (id.startsWith("gs-") || id.startsWith("gsm-")) continue;

      // Hide ALL Mapbox labels / icons / POIs in premium so no
      // "Golf & Shooting Club Sharjah" text leaks through.
      if (layer.type === "symbol") {
        try {
          map.setLayoutProperty(id, "visibility", mode === "premium" ? "none" : "visible");
        } catch { /* ignore */ }
        continue;
      }

      // Hide ALL Mapbox line layers in premium (roads, paths, admin
      // boundaries, etc). They reappear cleanly in Satellite mode.
      if (layer.type === "line") {
        try {
          map.setLayoutProperty(id, "visibility", mode === "premium" ? "none" : "visible");
        } catch { /* ignore */ }
        continue;
      }

      // Hide fill / fill-extrusion clutter (parks, buildings, etc.)
      // in premium so only our golf overlays show.
      if (layer.type === "fill" || layer.type === "fill-extrusion") {
        try {
          map.setLayoutProperty(id, "visibility", mode === "premium" ? "none" : "visible");
        } catch { /* ignore */ }
        continue;
      }

      // Satellite raster — fully invisible in premium mode so the
      // emerald CSS background becomes the map base. Restored at full
      // brightness in Satellite mode.
      if (layer.type === "raster") {
        try {
          map.setPaintProperty(id, "raster-opacity", mode === "premium" ? 0 : 1);
          map.setPaintProperty(id, "raster-brightness-max", 1);
          map.setPaintProperty(id, "raster-brightness-min", 0);
          map.setPaintProperty(id, "raster-saturation", 0);
          map.setPaintProperty(id, "raster-contrast", 0);
        } catch { /* ignore */ }
      }
    }
  } catch {
    /* style not fully loaded yet — caller will re-apply on next load */
  }
}

function MapCtrlBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const tone =
    active === false
      ? "text-white/45 hover:text-white/80"
      : "text-gold hover:bg-gold/15";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${tone} ${
        disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent" : ""
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Premium honest empty-mapping experience. Shown only when no real
 * surveyed geometry exists for the active course/hole AND the user is
 * in Premium mode. Contains NO fabricated golf data — no fairway, no
 * green, no hazards, no distances. Just an elegant glass card that
 * tells the truth and offers safe next actions. Player GPS, measure
 * mode, weather, and accuracy continue to function on the map below.
 */
function PremiumEmptyMappingCard({
  courseName,
  onRefresh,
  onSwitchToSatellite,
}: {
  courseName: string;
  onRefresh: () => void;
  onSwitchToSatellite: () => void;
}): JSX.Element {
  const navigate = useNavigate();
  const admin = useGswingAdmin();
  const isAdmin = admin.status === "admin";
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center px-4">
      <div
        className="pointer-events-auto w-full max-w-[22rem] rounded-2xl border border-gold/35 bg-black/70 p-4 text-center shadow-elegant backdrop-blur-xl"
        role="status"
        aria-live="polite"
      >
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-black/55 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-gold">
          <MapPin className="h-3 w-3" />
          Mapping required
        </div>
        <h3 className="font-serif text-lg leading-tight text-gold">
          Professional Mapping Required
        </h3>
        <p className="mx-auto mt-1 max-w-[18rem] text-[11px] leading-snug text-white/75">
          <span className="text-white/90">{courseName}</span> has not yet been
          professionally mapped for advanced GPS features. Live player
          position, measure tool and weather remain active.
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          <Button
            type="button"
            size="sm"
            onClick={onRefresh}
            className="h-8 rounded-full bg-gradient-to-r from-gold to-amber-400 text-[11px] font-semibold uppercase tracking-wider text-black hover:from-gold hover:to-gold"
          >
            <RefreshCw className="mr-1.5 h-3 w-3" />
            Refresh Mapping
          </Button>
          {isAdmin && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate("/gswing/course-mapper")}
              className="h-8 rounded-full border-gold/40 bg-black/40 text-[11px] font-semibold uppercase tracking-wider text-gold hover:bg-black/60 hover:text-gold"
            >
              Open Course Mapper
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onSwitchToSatellite}
            className="h-8 rounded-full text-[11px] font-semibold uppercase tracking-wider text-white/75 hover:bg-white/5 hover:text-white"
          >
            Continue with Satellite
          </Button>
        </div>
      </div>
    </div>
  );
}

const MAIN_COURSE_ID = "00000000-0000-0000-0000-000000000101";

/**
 * Honest GPS lock banner. Never claims a course is "locked" until the
 * player has a real GPS fix AND a mapped course was actually detected
 * nearby. Surfaces the exact honest message the field tester needs:
 * permission missing, low accuracy, or no nearby mapped course.
 */
function GpsLockBanner({
  playerPosition,
  playerAccuracy,
  nearestCourseFound,
  mappingStatus,
  courseName,
}: {
  playerPosition: LatLng | null;
  playerAccuracy: number | null;
  nearestCourseFound: boolean | null;
  mappingStatus: "idle" | "loading" | "mapped" | "missing";
  courseName: string;
}): JSX.Element | null {
  let tone: "warn" | "ok" | "info" = "info";
  let label = "";

  if (!playerPosition) {
    tone = "warn";
    label = "Enable GPS to detect nearby courses.";
  } else if (typeof playerAccuracy === "number" && playerAccuracy > 35) {
    tone = "warn";
    label = "Low accuracy — move outdoors for better course lock.";
  } else if (nearestCourseFound === false) {
    tone = "warn";
    label = "No mapped course detected nearby.";
  } else if (nearestCourseFound === true) {
    tone = "ok";
    label =
      mappingStatus === "mapped"
        ? `GPS LIVE · ${courseName}`
        : `GPS LIVE · ${courseName} · mapping pending`;
  } else {
    return null;
  }

  const toneClasses =
    tone === "ok"
      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
      : tone === "warn"
        ? "border-gold/40 bg-black/65 text-gold-soft"
        : "border-white/15 bg-black/55 text-white/75";

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[7.4rem] z-[6] -translate-x-1/2 px-3"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto max-w-[92vw] truncate rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-wider shadow-lg backdrop-blur-md ${toneClasses}`}
      >
        {label}
        {tone === "ok" && typeof playerAccuracy === "number" && (
          <span className="ml-2 text-emerald-200/80">±{Math.round(playerAccuracy)}m</span>
        )}
      </div>
    </div>
  );
}

const DEFAULT_POSITION: LatLng = { lat: 25.3536, lng: 55.4881 };
const DEMO_PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 4, 5, 4, 3, 4, 4];

// All previous Sharjah Hole 1 placeholder geometry has been removed.
// Real surveyed geometry is loaded from the gswing_* mapping tables.

function makeCourse(
  id: string,
  name: string,
  city: string,
  lat: number,
  lng: number,
  holesCount = 18,
  par = 72,
): GolfCourse {
  return {
    id,
    name,
    city,
    country: "AE",
    lat,
    lng,
    holes_count: holesCount,
    par,
    website: null,
    timezone: "Asia/Dubai",
    created_at: new Date().toISOString(),
  };
}

const UAE_COURSES: GolfCourse[] = [
  makeCourse(MAIN_COURSE_ID, "Sharjah Golf and Shooting Club", "Sharjah", 25.3536, 55.4881, 9, 36),
  makeCourse("00000000-0000-0000-0000-000000000001", "Emirates Golf Club - Majlis", "Dubai", 25.0911, 55.1572),
  makeCourse("00000000-0000-0000-0000-000000000102", "Emirates Golf Club - Faldo", "Dubai", 25.0915, 55.1585),
  makeCourse("00000000-0000-0000-0000-000000000103", "Dubai Creek Golf and Yacht Club", "Dubai", 25.2420, 55.3330, 18, 71),
  makeCourse("00000000-0000-0000-0000-000000000104", "Jumeirah Golf Estates - Earth", "Dubai", 25.0259, 55.1856),
  makeCourse("00000000-0000-0000-0000-000000000105", "Jumeirah Golf Estates - Fire", "Dubai", 25.0268, 55.1840),
  makeCourse("00000000-0000-0000-0000-000000000106", "Trump International Golf Club Dubai", "Dubai", 25.0353, 55.2272),
  makeCourse("00000000-0000-0000-0000-000000000107", "Dubai Hills Golf Club", "Dubai", 25.1176, 55.2535),
  makeCourse("00000000-0000-0000-0000-000000000108", "The Els Club Dubai", "Dubai", 25.0344, 55.2207, 18, 72),
  makeCourse("00000000-0000-0000-0000-000000000109", "Arabian Ranches Golf Club", "Dubai", 25.0533, 55.2708, 18, 72),
  makeCourse("00000000-0000-0000-0000-000000000110", "The Montgomerie Golf Club Dubai", "Dubai", 25.0709, 55.1514, 18, 72),
  makeCourse("00000000-0000-0000-0000-000000000111", "JA The Resort Golf Course", "Dubai", 24.9884, 55.0270, 9, 36),
  makeCourse("00000000-0000-0000-0000-000000000112", "The Track Meydan Golf", "Dubai", 25.1586, 55.3004, 9, 36),
  makeCourse("00000000-0000-0000-0000-000000000113", "Yas Links Abu Dhabi", "Abu Dhabi", 24.4673, 54.6010),
  makeCourse("00000000-0000-0000-0000-000000000114", "Saadiyat Beach Golf Club", "Abu Dhabi", 24.5547, 54.4282),
  makeCourse("00000000-0000-0000-0000-000000000115", "Abu Dhabi Golf Club", "Abu Dhabi", 24.4277, 54.5682, 27, 72),
  makeCourse("00000000-0000-0000-0000-000000000116", "Abu Dhabi City Golf Club", "Abu Dhabi", 24.4399, 54.3863, 9, 35),
  makeCourse("00000000-0000-0000-0000-000000000117", "Al Ghazal Golf Club", "Abu Dhabi", 24.4287, 54.6451, 18, 71),
  makeCourse("00000000-0000-0000-0000-000000000118", "Al Ain Equestrian Shooting and Golf Club", "Al Ain", 24.1844, 55.7608, 18, 71),
  makeCourse("00000000-0000-0000-0000-000000000119", "Al Dhannah Golf Club", "Al Dhannah", 24.1928, 52.6267, 9, 36),
  makeCourse("00000000-0000-0000-0000-000000000120", "Al Zorah Golf Club", "Ajman", 25.4149, 55.4689, 18, 72),
  makeCourse("00000000-0000-0000-0000-000000000121", "Al Hamra Golf Club", "Ras Al Khaimah", 25.6842, 55.7792, 18, 72),
  makeCourse("00000000-0000-0000-0000-000000000122", "Tower Links Golf Club", "Ras Al Khaimah", 25.7776, 55.9650, 18, 72),
];

type DisplayPoint = { x: number; y: number };

function pointFromLatLng(latLng: LatLng | null | undefined): LatLng | null {
  return latLng ? { lat: latLng.lat, lng: latLng.lng } : null;
}

function teeToPoint(tee: TeeBox | undefined): LatLng | null {
  return tee ? { lat: tee.lat, lng: tee.lng } : null;
}

function sanitizeHazardKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPrimaryTee(tees: TeeBox[]): TeeBox | undefined {
  return [...tees].sort((a, b) => b.yardage - a.yardage)[0] ?? tees[0];
}

function buildProjector(points: LatLng[]) {
  const fallback = points.length ? points : [DEFAULT_POSITION];
  const lats = fallback.map((point) => point.lat);
  const lngs = fallback.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(maxLat - minLat, 0.0012);
  const lngRange = Math.max(maxLng - minLng, 0.0012);

  return (point: LatLng): DisplayPoint => ({
    x: 100 + ((point.lng - minLng) / lngRange) * 680,
    y: 86 + (1 - (point.lat - minLat) / latRange) * 385,
  });
}

function polygonPath(points: DisplayPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function formatDistance(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : String(value);
}

function offsetPoint(origin: LatLng, northMeters: number, eastMeters: number): LatLng {
  return {
    lat: origin.lat + northMeters / 111_320,
    lng: origin.lng + eastMeters / (111_320 * Math.cos((origin.lat * Math.PI) / 180)),
  };
}

function createFallbackHoleGps(
  course: GolfCourse,
  holeNumber: number,
  unit: "yards" | "meters",
  playerPosition: LatLng | null,
): HoleGpsResponse {
  const par = DEMO_PARS[holeNumber - 1] ?? 4;
  const base = { lat: course.lat + (holeNumber - 1) * 0.00005, lng: course.lng + (holeNumber - 1) * 0.00004 };
  const greenCenter = offsetPoint(base, 170 + holeNumber * 7, -70 + holeNumber * 4);
  const greenFront = offsetPoint(greenCenter, -24, -8);
  const greenBack = offsetPoint(greenCenter, 25, 9);
  const pin = offsetPoint(greenCenter, 0, 0);
  const tee = offsetPoint(greenCenter, -260 - par * 35, -85);
  const water = offsetPoint(greenCenter, -20, 150);
  const bunker = offsetPoint(greenCenter, 28, -170);
  const displayDistance = (target: LatLng) => {
    const yards = playerPosition ? haversineYards(playerPosition, target) : 0;
    return unit === "meters" ? Math.round(yards * 0.9144) : yards;
  };

  const greenPolygon = [
    [greenCenter.lng - 0.0007, greenCenter.lat + 0.00033],
    [greenCenter.lng + 0.00055, greenCenter.lat + 0.0003],
    [greenCenter.lng + 0.00082, greenCenter.lat - 0.0001],
    [greenCenter.lng + 0.00015, greenCenter.lat - 0.00048],
    [greenCenter.lng - 0.00065, greenCenter.lat - 0.00034],
    [greenCenter.lng - 0.0007, greenCenter.lat + 0.00033],
  ] as [number, number][];

  return {
    course_id: course.id,
    hole_number: holeNumber,
    par,
    handicap: ((holeNumber * 5) % 18) + 1,
    notes: "Offline demo GPS geometry",
    unit,
    status: "ok",
    tee_boxes: [
      {
        color: "championship",
        yardage: par === 3 ? 173 : par === 5 ? 522 : 386,
        lat: tee.lat,
        lng: tee.lng,
      },
    ],
    green: {
      center: greenCenter,
      front: greenFront,
      back: greenBack,
      pin,
      polygon: { type: "Polygon", coordinates: [greenPolygon] },
      depth_yards: 31,
      width_yards: 42,
    },
    hazards: [
      {
        type: "water",
        label: "Water right",
        lat: water.lat,
        lng: water.lng,
        geometry: null,
        carry_yards_from_tee: null,
      },
      {
        type: "bunker",
        label: "Left bunker",
        lat: bunker.lat,
        lng: bunker.lng,
        geometry: null,
        carry_yards_from_tee: null,
      },
    ],
    player_position: playerPosition,
    distances: playerPosition
      ? {
          to_center_of_green: displayDistance(greenCenter),
          to_front_of_green: displayDistance(greenFront),
          to_back_of_green: displayDistance(greenBack),
          to_pin: displayDistance(pin),
          to_tee_box: displayDistance(tee),
          hazards: {
            water_right: displayDistance(water),
            left_bunker: displayDistance(bunker),
          },
        }
      : null,
    recommended_target: par === 3 ? "Center of green" : "Fairway to green approach",
  };
}

function nearestLocalCourse(position: LatLng, courses: GolfCourse[]): GolfCourse | null {
  if (!courses.length) return null;
  return courses.reduce((best, course) => {
    const bestDistance = haversineYards(position, { lat: best.lat, lng: best.lng });
    const courseDistance = haversineYards(position, { lat: course.lat, lng: course.lng });
    return courseDistance < bestDistance ? course : best;
  });
}

function CartGpsView({
  gps,
  playerPosition,
  displayUnit,
  centerDistance,
  frontDistance,
  backDistance,
  currentTime,
}: {
  gps: HoleGpsResponse | null;
  playerPosition: LatLng | null;
  displayUnit: "y" | "m";
  centerDistance: number | null;
  frontDistance: number | null;
  backDistance: number | null;
  currentTime: string;
}) {
  const primaryTee = getPrimaryTee(gps?.tee_boxes ?? []);
  const green = gps?.green;
  const pin = pointFromLatLng(green?.pin) ?? pointFromLatLng(green?.center);
  const front = pointFromLatLng(green?.front);
  const back = pointFromLatLng(green?.back);
  const tee = teeToPoint(primaryTee);
  const hazards = gps?.hazards ?? [];

  const geometryPoints = [
    tee,
    pin,
    front,
    back,
    playerPosition,
    ...hazards.map((hazard) => (hazard.lat && hazard.lng ? { lat: hazard.lat, lng: hazard.lng } : null)),
  ].filter(Boolean) as LatLng[];

  const project = buildProjector(geometryPoints);
  const teePoint = tee ? project(tee) : { x: 475, y: 472 };
  const pinPoint = pin ? project(pin) : { x: 450, y: 210 };
  const playerPoint = playerPosition ? project(playerPosition) : null;
  const frontPoint = front ? project(front) : null;
  const backPoint = back ? project(back) : null;
  const unitText = displayUnit === "m" ? "Meters" : "Yards";
  const toCssPoint = (point: DisplayPoint) => ({
    left: `${Math.max(2, Math.min(98, (point.x / 1000) * 100))}%`,
    top: `${Math.max(2, Math.min(98, (point.y / 560) * 100))}%`,
  });

  return (
    <div className="relative overflow-hidden rounded-lg border border-gold/25 bg-black shadow-elegant">
      <div
        className="relative h-[58vh] min-h-[410px] overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: `url(${courseBg})` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_46%_42%,transparent_0%,hsl(150_35%_5%/0.14)_42%,hsl(150_35%_3%/0.52)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(45_60%_92%/0.06),transparent_20%,hsl(150_50%_4%/0.18)_100%)]" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:repeating-linear-gradient(0deg,transparent_0px,transparent_3px,hsl(0_0%_100%/0.18)_4px)]" />

        <div className="absolute left-4 top-4 rounded-md border border-black/30 bg-black/55 px-3 py-1.5 text-sm backdrop-blur-sm">
          <span className="font-semibold text-gold">Hole {gps?.hole_number ?? "-"}</span>
          <span className="text-white/75"> - Par {gps?.par ?? "-"}</span>
        </div>

        {hazards.map((hazard, index) => {
          const location = hazard.lat && hazard.lng ? project({ lat: hazard.lat, lng: hazard.lng }) : null;
          if (!location) return null;
          const isWater = hazard.type === "water";
          return (
            <div
              key={`${hazard.type}-${hazard.label ?? index}`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-[50%] border backdrop-blur-[1px] ${
                isWater
                  ? "h-24 w-36 border-sky-100/50 bg-sky-200/35 shadow-[inset_0_0_24px_hsl(210_70%_92%/0.28)]"
                  : "h-16 w-24 border-stone-100/55 bg-stone-200/45 shadow-[inset_0_0_16px_hsl(45_45%_88%/0.3)]"
              }`}
              style={toCssPoint(location)}
            />
          );
        })}

        <div
          className="absolute h-28 w-44 -translate-x-1/2 -translate-y-1/2 rounded-[46%_54%_48%_52%] border border-emerald-100/45 bg-emerald-300/34 shadow-[0_0_26px_hsl(150_80%_72%/0.22),inset_0_0_24px_hsl(142_60%_82%/0.26)] backdrop-blur-[1px]"
          style={toCssPoint(pinPoint)}
        />

        {backPoint && (
          <div
            className="absolute -translate-x-1/2 -translate-y-[145%] rounded border border-zinc-800 bg-white/90 px-2 py-0.5 font-serif text-xl leading-none text-zinc-900 shadow"
            style={toCssPoint(backPoint)}
          >
            {formatDistance(backDistance)}
          </div>
        )}

        {frontPoint && (
          <div
            className="absolute -translate-x-1/2 translate-y-[35%] rounded border border-zinc-800 bg-white/90 px-2 py-0.5 font-serif text-xl leading-none text-zinc-900 shadow"
            style={toCssPoint(frontPoint)}
          >
            {formatDistance(frontDistance)}
          </div>
        )}

        <div
          className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-black/70 bg-gold shadow"
          style={toCssPoint(teePoint)}
        />

        <div
          className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-[4px] border-black/80 bg-white shadow"
          style={toCssPoint(pinPoint)}
        >
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/80" />
          <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/80" />
          <span className="absolute inset-0 rounded-full bg-[conic-gradient(hsl(248_20%_35%)_0_25%,transparent_25%_50%,hsl(248_20%_35%)_50%_75%,transparent_75%)]" />
        </div>

        {playerPoint && (
          <div
            className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-emerald-300 bg-white shadow-[0_0_18px_hsl(150_70%_55%/0.45)]"
            style={toCssPoint(playerPoint)}
          />
        )}

        <div className="pointer-events-none absolute right-4 top-4 w-[178px] overflow-hidden rounded-lg border border-gold/40 bg-background/88 text-gold shadow-xl backdrop-blur-md sm:w-[218px]">
          <div className="grid grid-cols-[54px_1fr] sm:grid-cols-[68px_1fr]">
            <div className="flex flex-col items-center justify-center border-r border-gold/25 bg-emerald/45 p-2 text-[10px] leading-tight text-gold-soft">
              <div className="relative mb-1 h-10 w-10 rounded-full border-4 border-gold/70 bg-emerald shadow-inner">
                <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/50" />
                <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/50" />
                <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(hsl(248_24%_35%)_0_25%,transparent_25%_50%,hsl(248_24%_35%)_50%_75%,transparent_75%)]" />
              </div>
              <span>Center</span>
              <span>of</span>
              <span>Green</span>
            </div>
            <div className="p-2 text-right">
              <div className="font-serif text-5xl font-bold leading-none tracking-normal text-gold sm:text-6xl">
                {formatDistance(centerDistance)}
              </div>
              <div className="text-2xl font-semibold leading-none text-gold-soft sm:text-3xl">{unitText}</div>
              <div className="mt-3 text-center text-[10px] text-muted-foreground">
                Hole {gps?.hole_number ?? "-"}
                <br />
                Par {gps?.par ?? "-"}, Handicap {gps?.handicap ?? "-"}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-8 right-5 hidden w-[210px] rounded-md border border-gold/20 bg-black/58 p-3 text-center text-white/85 shadow-xl backdrop-blur-sm sm:block">
          <div className="mx-auto mb-2 flex h-14 w-20 items-center justify-center rounded-md bg-gradient-to-b from-slate-200/75 to-blue-300/55 shadow-inner">
            <Home className="h-8 w-8 text-white drop-shadow" />
          </div>
          <div className="text-[10px] text-white/70">Main Menu</div>
          <div className="mt-6 font-serif text-4xl tracking-normal text-white/85">{currentTime}</div>
        </div>
      </div>
    </div>
  );
}

export const GpsMap = () => {
  const [courses, setCourses] = useState<GolfCourse[]>(UAE_COURSES);
  const [courseId, setCourseId] = useState(MAIN_COURSE_ID);
  const [hole, setHole] = useState(1);
  const [unit, setUnit] = useState<"yards" | "meters">("yards");
  const [playerPos, setPlayerPos] = useState<LatLng | null>(DEFAULT_POSITION);
  const [playerHeading, setPlayerHeading] = useState<number | null>(null);
  const [playerAccuracy, setPlayerAccuracy] = useState<number | null>(null);
  const lastPosRef = useRef<LatLng | null>(null);
  const [gps, setGps] = useState<HoleGpsResponse | null>(null);
  const [geometryPayload, setGeometryPayload] = useState<HoleGeometryPayload | null>(null);
  const [activeRound, setActiveRound] = useState<ActiveRound | null>(null);
  const [activeShot, setActiveShot] = useState<Shot | null>(null);
  const [lastShotYards, setLastShotYards] = useState<number | null>(null);
  const [lastShotEnd, setLastShotEnd] = useState<LatLng | null>(null);
  const [roundShots, setRoundShots] = useState<StoredShot[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [pendingTagShot, setPendingTagShot] = useState<StoredShot | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [replayAll, setReplayAll] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [liveTracking, setLiveTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  );
  const watchIdRef = useRef<number | null>(null);
  const [bag] = useBag();
  const [player] = usePlayer();
  const [experienceOpen, setExperienceOpen] = useState(false);

  // Lazy-load the publishable Mapbox token at the parent level too —
  // used for static shot preview images in the Round Shot Review.
  useEffect(() => {
    let cancelled = false;
    loadMapboxToken()
      .then((t) => {
        if (!cancelled) setMapboxToken(t);
      })
      .catch(() => {
        if (!cancelled) setMapboxToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId) ?? courses[0] ?? UAE_COURSES[0],
    [courseId, courses],
  );
  const selectableHoleCount = selectedCourse.holes_count >= 18 ? 18 : selectedCourse.holes_count || 18;

  const displayUnit = unitLabel(unit);
  // Weather (real, no fabrication) for the GPS Caddie insight panel.
  const weatherState = useGswingWeather(
    playerPos
      ? { latitude: playerPos.lat, longitude: playerPos.lng }
      : { latitude: selectedCourse?.lat ?? null, longitude: selectedCourse?.lng ?? null },
  );
  const caddieReadout = useMemo(
    () => computeYardages(playerPos, geometryPayload, lastShotEnd),
    [playerPos?.lat, playerPos?.lng, geometryPayload, lastShotEnd?.lat, lastShotEnd?.lng], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const caddieInsight = useMemo(
    () =>
      buildGpsCaddieInsight({
        readout: caddieReadout,
        weather: weatherState.status === "ready" ? weatherState.data : null,
        unit,
      }),
    [caddieReadout, weatherState, unit],
  );
  const centerDistance = gps?.distances?.to_center_of_green ?? null;
  const frontDistance = gps?.distances?.to_front_of_green ?? null;
  const backDistance = gps?.distances?.to_back_of_green ?? null;
  const pinDistance = gps?.distances?.to_pin ?? centerDistance;

  const recommendedClub = useMemo(() => {
    if (!pinDistance) return null;
    const yards = unit === "meters" ? Math.round(pinDistance * 1.09361) : pinDistance;
    const validBag = bag.filter((club) => club.distance > 0);
    if (!validBag.length) return null;
    return validBag.reduce((best, club) =>
      Math.abs(club.distance - yards) < Math.abs(best.distance - yards) ? club : best,
    );
  }, [bag, pinDistance, unit]);

  const loadHole = useCallback(async () => {
    setLoading(true);
    setGpsError(null);
    try {
      // 1. Prefer production geometry from the PostGIS-backed tables.
      try {
        const geom = await fetchHoleGeometry(courseId, hole);
        if (geom) {
          setGeometryPayload(geom);
          setGps(geometryToHoleGpsResponse(courseId, geom, unit, playerPos));
          return;
        }
        setGeometryPayload(null);
      } catch {
        // DB lookup failed — fall through to the edge function.
        setGeometryPayload(null);
      }

      // 2. Edge-function backed geometry (legacy path).
      const data = await fetchHoleGps(courseId, hole, {
        unit,
        playerPos: playerPos ?? undefined,
      });
      setGps(data);
    } catch (error) {
      // 3. Last-resort offline demo geometry so the map still renders.
      setGeometryPayload(null);
      setGps(createFallbackHoleGps(selectedCourse, hole, unit, playerPos));
      setGpsError(null);
    } finally {
      setLoading(false);
    }
  }, [courseId, hole, playerPos, selectedCourse, unit]);

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      try {
        const data = await fetchCourses();
        if (cancelled || !data.length) return;
        const byId = new Map([...UAE_COURSES, ...data.filter((course) => course.country === "AE")].map((course) => [course.id, course]));
        const merged = Array.from(byId.values()).sort((a, b) => {
          if (a.id === MAIN_COURSE_ID) return -1;
          if (b.id === MAIN_COURSE_ID) return 1;
          return `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`);
        });
        setCourses(merged);
        setCourseId((current) => (merged.some((course) => course.id === current) ? current : MAIN_COURSE_ID));
      } catch {
        if (!cancelled) setCourses(UAE_COURSES);
      }
    }

    loadCourses();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadHole();
  }, [loadHole]);

  // Load all stored shots for the active round (for replay + stats).
  const refreshRoundShots = useCallback(async () => {
    if (!activeRound) {
      setRoundShots([]);
      return;
    }
    if (activeRound.id.startsWith("offline-")) return; // offline shots stay local
    setStatsLoading(true);
    try {
      const rows = await fetchRoundShots(activeRound.id);
      setRoundShots(rows);
    } finally {
      setStatsLoading(false);
    }
  }, [activeRound?.id]);

  useEffect(() => {
    refreshRoundShots();
  }, [refreshRoundShots]);

  // Per-hole geometry cache for round-intelligence computation.
  const [holeGeomCache, setHoleGeomCache] = useState<Record<number, HoleGeometryPayload | null>>({});
  useEffect(() => {
    if (!geometryPayload) return;
    setHoleGeomCache((prev) => (prev[hole] === geometryPayload ? prev : { ...prev, [hole]: geometryPayload }));
  }, [geometryPayload, hole]);

  const roundStats: RoundStats | null = useMemo(() => {
    if (!roundShots.length) return null;
    const holePars: Record<number, number> = {};
    if (gps?.hole_number && gps?.par) holePars[gps.hole_number] = gps.par;
    return computeRoundStats(roundShots, { holePars, holeGeometries: holeGeomCache });
  }, [roundShots, holeGeomCache, gps?.hole_number, gps?.par]);

  // Round Experience Model — the single source of truth consumed by
  // Replay Studio, Signature Moments, Timeline, and (in later slices)
  // Golf Story, AI Coach, Memory Book, Broadcast.
  const experienceModel = useMemo(() => {
    const meta: RoundMeta = {
      id: activeRound?.id ?? `session-${selectedCourse.id}`,
      course_id: selectedCourse.id,
      course_name: selectedCourse.name,
      started_at: activeRound?.started_at ?? null,
      player_name: player?.name ?? null,
      unit,
    };
    const holePars: Record<number, number> = {};
    if (gps?.hole_number && gps?.par) holePars[gps.hole_number] = gps.par;
    return buildRoundExperience({
      round: meta,
      shots: roundShots,
      hole_geometries: holeGeomCache,
      hole_pars: holePars,
    });
  }, [
    activeRound?.id,
    activeRound?.started_at,
    selectedCourse.id,
    selectedCourse.name,
    player?.name,
    unit,
    roundShots,
    holeGeomCache,
    gps?.hole_number,
    gps?.par,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const startPlayMode = async () => {
    setSyncing(true);
    setGpsError(null);
    try {
      const round = await startRound({
        courseId,
        sessionId: getOrCreateSessionId(),
        unit,
      });
      setActiveRound(round);
      setHole(round.current_hole);
      toast.success("GPS round started");
    } catch (error) {
      const now = new Date().toISOString();
      setActiveRound({
        id: `offline-${Date.now()}`,
        course_id: courseId,
        session_id: getOrCreateSessionId(),
        current_hole: hole,
        player_lat: playerPos?.lat ?? null,
        player_lng: playerPos?.lng ?? null,
        unit,
        started_at: now,
        updated_at: now,
        completed_at: null,
      });
      setGpsError(null);
      toast.success("Offline GPS round started");
    } finally {
      setSyncing(false);
    }
  };

  const pushPlayerLocation = async (position: LatLng) => {
    setPlayerPos(position);
    if (!activeRound) return;
    if (activeRound.id.startsWith("offline-")) {
      setActiveRound({
        ...activeRound,
        player_lat: position.lat,
        player_lng: position.lng,
        updated_at: new Date().toISOString(),
      });
      return;
    }

    try {
      const result = await updatePlayerLocation(activeRound.id, position);
      setActiveRound(result.round);
      if (result.nearest_hole && result.nearest_hole !== hole) {
        setHole(result.nearest_hole);
        toast.success(`Auto-switched to Hole ${result.nearest_hole}`);
      }
    } catch (error) {
      setGpsError(error instanceof Error ? error.message : "Could not sync live GPS.");
    }
  };

  const toggleLiveTracking = () => {
    if (liveTracking) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setLiveTracking(false);
      return;
    }

    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported on this device.");
      return;
    }

    setLiveTracking(true);
    setGpsError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        // Heading: prefer device-reported, else derive from last delta.
        let heading: number | null =
          position.coords.heading != null && !Number.isNaN(position.coords.heading)
            ? position.coords.heading
            : null;
        if (heading == null && lastPosRef.current) {
          const dLat = next.lat - lastPosRef.current.lat;
          const dLng = next.lng - lastPosRef.current.lng;
          if (Math.abs(dLat) + Math.abs(dLng) > 1e-6) {
            heading = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
          }
        }
        if (heading != null) setPlayerHeading(heading);
        if (typeof position.coords.accuracy === "number") setPlayerAccuracy(position.coords.accuracy);
        lastPosRef.current = next;
        setPlayerPos(next);
        try {
          const detection = await detectCourseArrival(next, { country: "AE", radiusMeters: 1200 });
          if (detection.arrived && detection.nearest && detection.nearest.id !== courseId) {
            setCourseId(detection.nearest.id);
            setHole(1);
            toast.success(`Arrived at ${detection.nearest.name}`);
            await pushPlayerLocation(next);
            return;
          }
        } catch {
          // Course detection is helpful but not required for live distance updates.
        }
        const localNearest = nearestLocalCourse(next, courses);
        if (localNearest && localNearest.id !== courseId) {
          const distanceYards = haversineYards(next, { lat: localNearest.lat, lng: localNearest.lng });
          if (distanceYards <= 1400) {
            setCourseId(localNearest.id);
            setHole(1);
            toast.success(`Arrived at ${localNearest.name}`);
          }
        }
        await pushPlayerLocation(next);
      },
      (error) => {
        setGpsError(`GPS error: ${error.message}`);
        setLiveTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
  };

  const changeHole = async (nextHole: number) => {
    const bounded = Math.min(selectableHoleCount, Math.max(1, nextHole));
    setHole(bounded);
    if (!activeRound) return;
    if (activeRound.id.startsWith("offline-")) {
      setActiveRound({ ...activeRound, current_hole: bounded, updated_at: new Date().toISOString() });
      return;
    }
    try {
      const result = await setCurrentHole(activeRound.id, bounded);
      setActiveRound(result.round);
    } catch (error) {
      setGpsError(error instanceof Error ? error.message : "Could not update current hole.");
    }
  };

  const simulateWalk = () => {
    const target = gps?.green?.pin ?? gps?.green?.center ?? { lat: selectedCourse.lat, lng: selectedCourse.lng };
    const current = playerPos ?? { lat: selectedCourse.lat, lng: selectedCourse.lng };
    pushPlayerLocation({
      lat: current.lat + (target.lat - current.lat) * 0.25,
      lng: current.lng + (target.lng - current.lng) * 0.25,
    });
  };

  const trackShot = async () => {
    if (!activeRound) {
      toast.error("Start a GPS round first");
      return;
    }
    if (!playerPos) {
      toast.error("GPS position needed for shot tracking");
      return;
    }

    setSyncing(true);
    try {
      if (activeRound.id.startsWith("offline-")) {
        if (!activeShot) {
          setActiveShot({
            id: `offline-shot-${Date.now()}`,
            round_id: activeRound.id,
            hole_number: hole,
            shot_number: 1,
            start_lat: playerPos.lat,
            start_lng: playerPos.lng,
            end_lat: null,
            end_lng: null,
            distance_yards: null,
            club_used: recommendedClub?.name ?? null,
            started_at: new Date().toISOString(),
            ended_at: null,
          });
          setLastShotYards(null);
          toast.success("Shot started");
          return;
        }
        const yards = haversineYards({ lat: activeShot.start_lat, lng: activeShot.start_lng }, playerPos);
        const offlineStart: LatLng = { lat: activeShot.start_lat, lng: activeShot.start_lng };
        const offlineEnd: LatLng = { lat: playerPos.lat, lng: playerPos.lng };
        setActiveShot(null);
        setLastShotYards(yards);
        setLastShotEnd(offlineEnd);
        toast.success(`Shot saved: ${yards} yards`);
        // Persist offline shots too — round_id is a text column, so an
        // offline session id is a valid value. This lets the stats panel
        // and replay overlay work even without an authenticated round.
        const saved = await persistShot({
          roundId: activeRound.id,
          courseId: activeRound.course_id ?? courseId,
          holeNumber: activeShot.hole_number ?? hole,
          shotNumber: roundShots.filter(
            (s) => s.hole_number === (activeShot.hole_number ?? hole),
          ).length + 1,
          club: activeShot.club_used ?? recommendedClub?.name ?? null,
          start: offlineStart,
          end: offlineEnd,
          distanceYards: yards,
        });
        if (saved) setRoundShots((prev) => [...prev, saved]);
        if (saved) setPendingTagShot(saved);
        return;
      }
      if (!activeShot) {
        const shot = await startShot(activeRound.id, playerPos, recommendedClub?.name);
        setActiveShot(shot);
        setLastShotYards(null);
        toast.success("Shot started");
      } else {
        const result = await endShot(activeRound.id, playerPos, activeShot.id);
        setActiveShot(null);
        setLastShotYards(result.distance_yards);
        setLastShotEnd({ lat: playerPos.lat, lng: playerPos.lng });
        toast.success(`Shot saved: ${result.distance_yards} yards`);
        // Persist to the golf_shots table so hole replay + round
        // intelligence stats reflect real shot data only.
        const start: LatLng = { lat: activeShot.start_lat, lng: activeShot.start_lng };
        const saved = await persistShot({
          roundId: activeRound.id,
          courseId: activeRound.course_id ?? courseId,
          holeNumber: activeShot.hole_number ?? hole,
          shotNumber: activeShot.shot_number ?? roundShots.filter(
            (s) => s.hole_number === (activeShot.hole_number ?? hole),
          ).length + 1,
          club: activeShot.club_used ?? recommendedClub?.name ?? null,
          start,
          end: { lat: playerPos.lat, lng: playerPos.lng },
          distanceYards: result.distance_yards,
        });
        await refreshRoundShots();
        if (saved) setPendingTagShot(saved);
      }
    } catch (error) {
      setGpsError(error instanceof Error ? error.message : "Could not update shot tracking.");
    } finally {
      setSyncing(false);
    }
  };

  const courseCenter = { lat: selectedCourse.lat, lng: selectedCourse.lng };
  const fallbackDistance = playerPos ? toDisplayUnit(haversineYards(playerPos, courseCenter), unit) : null;
  const displayCenterDistance = centerDistance ?? fallbackDistance;

  const savePendingTags = async (tags: ShotTagInput) => {
    if (!pendingTagShot) return;
    const updated = await updateShotTags(pendingTagShot.id, tags);
    if (updated) {
      setRoundShots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success("Shot tagged");
    } else {
      toast.error("Could not save tags");
    }
    setPendingTagShot(null);
  };

  const tagSummary = pendingTagShot
    ? `Hole ${pendingTagShot.hole_number ?? "?"} · #${pendingTagShot.shot_number ?? "?"}${
        pendingTagShot.club ? ` · ${pendingTagShot.club}` : ""
      }${
        pendingTagShot.distance_yards != null
          ? ` · ${Math.round(pendingTagShot.distance_yards)}y`
          : ""
      }`
    : undefined;

  return (
    <div className="space-y-3 pb-28">
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-gold" />
        <div className="min-w-0">
          <h2 className="font-serif text-2xl text-gradient-gold">Live GPS</h2>
          <p className="truncate text-xs text-muted-foreground">{selectedCourse.name}</p>
        </div>
        <div className="ml-auto rounded-full border border-gold/30 px-3 py-1 text-xs text-gold">
          H{hole}/18
        </div>
      </div>

      <Card className="gradient-card flex items-center gap-2 border-gold/20 p-3">
        <select
          value={courseId}
          onChange={(event) => {
            setCourseId(event.target.value);
            setHole(1);
            setActiveRound(null);
            setActiveShot(null);
            const nextCourse = courses.find((course) => course.id === event.target.value);
            if (nextCourse) setPlayerPos({ lat: nextCourse.lat, lng: nextCourse.lng });
          }}
          className="min-w-0 flex-1 rounded-lg border border-gold/30 bg-background/60 p-2 text-sm text-foreground"
        >
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.country} - {course.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setUnit((current) => (current === "yards" ? "meters" : "yards"))}
          className="rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold"
        >
          {unit === "yards" ? "YD" : "M"}
        </button>
      </Card>

      {gpsError && (
        <Card className="flex items-start gap-2 border-gold/30 bg-gold/10 p-3 text-xs text-gold">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{gpsError}</span>
        </Card>
      )}

      <MapboxCourseView
        gps={gps}
        playerPosition={playerPos}
        playerHeading={playerHeading}
        playerAccuracy={playerAccuracy}
        selectedCourse={selectedCourse}
        hole={hole}
        centerDistance={loading ? null : displayCenterDistance}
        displayUnit={displayUnit}
        geometry={geometryPayload}
        holeShots={replayAll ? roundShots : shotsForHole(roundShots, hole)}
        holeLengthYards={getPrimaryTee(gps?.tee_boxes ?? [])?.yardage ?? null}
        playerHandicap={typeof player?.handicap === "number" ? player.handicap : null}
        yardageReadout={caddieReadout}
        caddieInsight={caddieInsight}
        unit={unit}
        fallbackCenterYards={loading ? null : displayCenterDistance}
      />

      <div className="hidden md:block">
      <YardagePanel
        geometry={geometryPayload}
        playerPosition={playerPos}
        lastShotEnd={lastShotEnd}
        unit={unit}
        fallbackCenterYards={loading ? null : displayCenterDistance}
      />
      </div>

      <Card className="gradient-card hidden md:block border-gold/25 p-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-gold-soft">ACE Caddie Insight</p>
            <p className="mt-0.5 text-sm text-foreground">{caddieInsight}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              {weatherState.status === "ready" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-gold/20 bg-black/30 px-2 py-0.5">
                  <Wind className="h-3 w-3 text-emerald-300" />
                  {Math.round(weatherState.data.windSpeedKmh)} km/h {weatherState.data.windDirectionLabel}
                  <span className="text-white/60">· {Math.round(weatherState.data.temperatureC)}°C</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Weather unavailable.</span>
              )}
              {!caddieReadout.front || !caddieReadout.back ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-gold/20 bg-black/30 px-2 py-0.5 text-gold-soft">
                  Mapping required for {!caddieReadout.front ? "front" : null}
                  {!caddieReadout.front && !caddieReadout.back ? " & " : null}
                  {!caddieReadout.back ? "back" : null}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <div className="hidden md:grid grid-cols-2 gap-2">
        <Card className="gradient-card border-gold/20 p-3">
          <div className="flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-gold" />
            <p className="text-[10px] uppercase text-muted-foreground">Target</p>
          </div>
          <p className="mt-1 font-serif text-lg text-foreground">{gps?.recommended_target ?? "Green center"}</p>
          <p className="text-xs text-muted-foreground">
            {recommendedClub ? `${recommendedClub.name} from My Bag` : "Add bag distances for club picks"}
          </p>
        </Card>
        <Card className="gradient-card border-gold/20 p-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gold" />
            <p className="text-[10px] uppercase text-muted-foreground">Pin</p>
          </div>
          <p className="mt-1 font-serif text-lg text-foreground">
            {pinDistance ?? "-"}
            <span className="text-xs">{displayUnit}</span>
          </p>
          <p className="text-xs text-muted-foreground">Par {gps?.par ?? "-"} - HCP {gps?.handicap ?? "-"}</p>
        </Card>
      </div>

      <Card className="gradient-card hidden md:block border-gold/20 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-gold" />
            <p className="font-serif text-sm">Hazards & Layups</p>
          </div>
          {gps?.status === "no_data" && <span className="text-[10px] text-muted-foreground">No geometry yet</span>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(gps?.distances?.hazards ?? {}).slice(0, 4).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-border p-2">
              <p className="truncate text-[10px] text-muted-foreground">{sanitizeHazardKey(key)}</p>
              <p className="font-serif text-xl text-gold">
                {value}
                <span className="text-xs">{displayUnit}</span>
              </p>
            </div>
          ))}
          {!Object.keys(gps?.distances?.hazards ?? {}).length && (
            <div className="col-span-2 rounded-lg border border-border p-3 text-xs text-muted-foreground">
              Hazard distances appear here when this hole has geometry and player GPS is available.
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={activeRound ? toggleLiveTracking : startPlayMode}
          disabled={syncing}
          className={activeRound ? (liveTracking ? "gradient-gold text-primary-foreground" : "") : "gradient-gold text-primary-foreground"}
          variant={activeRound && !liveTracking ? "outline" : "default"}
        >
          {!activeRound ? (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Round
            </>
          ) : liveTracking ? (
            <>
              <LocateOff className="mr-2 h-4 w-4" />
              Stop GPS
            </>
          ) : (
            <>
              <Locate className="mr-2 h-4 w-4" />
              Live GPS
            </>
          )}
        </Button>
        <Button onClick={trackShot} disabled={syncing || !activeRound} variant="outline" className="border-gold/40">
          <Radio className="mr-2 h-4 w-4 text-gold" />
          {activeShot ? "End Shot" : "Start Shot"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button onClick={() => changeHole(hole - 1)} disabled={hole === 1} variant="outline" className="border-gold/40">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Prev
        </Button>
        <Button onClick={simulateWalk} variant="outline" className="border-gold/40">
          <Footprints className="mr-1 h-4 w-4" />
          Walk
        </Button>
        <Button onClick={() => changeHole(hole + 1)} disabled={hole === selectableHoleCount} variant="outline" className="border-gold/40">
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {lastShotYards !== null && (
        <Card className="gradient-card border-gold/20 p-3 text-sm">
          Last shot: <span className="font-serif text-gold">{toDisplayUnit(lastShotYards, unit)}{displayUnit}</span>
        </Card>
      )}

      <RoundIntelligence stats={roundStats} loading={statsLoading} />

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="border-gold/40"
          onClick={() => setReviewOpen(true)}
        >
          <BookOpen className="mr-2 h-4 w-4 text-gold" />
          View Round Shots
        </Button>
        <Button
          variant={replayAll ? "default" : "outline"}
          className={replayAll ? "gradient-gold text-primary-foreground" : "border-gold/40"}
          onClick={() => setReplayAll((v) => !v)}
          disabled={roundShots.length === 0}
        >
          <Film className="mr-2 h-4 w-4" />
          {replayAll ? "Replay: All Holes" : "Full Round Replay"}
        </Button>
      </div>

      <Button
        className="w-full gradient-gold text-primary-foreground shadow-elegant"
        onClick={() => setExperienceOpen(true)}
        disabled={roundShots.length === 0}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Open Round Experience
      </Button>

      <ShotTagPrompt
        open={!!pendingTagShot}
        shotSummary={tagSummary}
        onClose={() => setPendingTagShot(null)}
        onSave={savePendingTags}
      />

      <RoundShotReview
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        shots={roundShots}
        mapboxToken={mapboxToken}
      />

      <PostRoundExperience
        open={experienceOpen}
        onClose={() => setExperienceOpen(false)}
        model={experienceModel}
      />

      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: selectableHoleCount }, (_, index) => index + 1).map((holeNumber) => (
          <button
            key={holeNumber}
            onClick={() => changeHole(holeNumber)}
            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold ${
              hole === holeNumber ? "border-gold bg-gold/20 text-gold" : "border-gold/15 text-muted-foreground"
            }`}
          >
            H{holeNumber}
          </button>
        ))}
      </div>
    </div>
  );
};
