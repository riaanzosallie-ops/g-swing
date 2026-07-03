// G-Swing admin Course Mapper.
// Mobile-first Mapbox tool to map real golf courses into gswing_* tables.
// Gated to users with role: owner | platform_owner | admin.
// Writes go directly through Supabase — RLS enforces the same gate server-side.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, Save, Trash2, MapPin, Flag, Crosshair, Pentagon, Layers, Check, X, ChevronDown, ChevronUp, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadMapboxToken } from "@/components/gswing/GpsMap";
import { useGswingAdmin } from "@/lib/use-gswing-admin";
import { ensureMappedLayers, setMappedHoleData } from "@/lib/mapbox-mapped-layers";
import { buildMappedHoleFromRows, loadMappedHole } from "@/lib/gswing-course-map-loader";
import {
  evaluatePremiumLayers,
  type PremiumLayerKey,
} from "@/lib/gswing-premium-readiness";

// Sharjah Golf and Shooting Club — seeded with the verified front-9 par
// layout. Used by the Sharjah quick-select to jump straight into mapping
// without hunting through the course list.
const SHARJAH_QUICK = {
  name: "Sharjah Golf and Shooting Club",
  pars: { 1: 4, 2: 4, 3: 3, 4: 5, 5: 4, 6: 5, 7: 4, 8: 3, 9: 4 } as Record<number, number>,
};

type Tool =
  | "select"
  | "tee"
  | "green_front"
  | "green_center"
  | "green_back"
  | "pin"
  | "bunker"
  | "water"
  | "penalty"
  | "ob"
  | "layup"
  | "dogleg"
  | "landing_zone"
  // Premium visual mapping polygons
  | "fairway_polygon"
  | "green_polygon"
  | "tee_polygon"
  | "hole_boundary"
  | "rough_polygon"
  | "trees"
  | "waste"
  | "cart_path"
  | "delete";

const TOOLS: Array<{ id: Tool; label: string; group: "points" | "polygons" | "ops" }> = [
  { id: "select", label: "Select", group: "ops" },
  { id: "tee", label: "Tee", group: "points" },
  { id: "green_front", label: "G·Front", group: "points" },
  { id: "green_center", label: "G·Center", group: "points" },
  { id: "green_back", label: "G·Back", group: "points" },
  { id: "pin", label: "Pin", group: "points" },
  { id: "layup", label: "Layup", group: "points" },
  { id: "dogleg", label: "Dogleg", group: "points" },
  { id: "landing_zone", label: "Landing", group: "points" },
  { id: "hole_boundary", label: "Boundary", group: "polygons" },
  { id: "fairway_polygon", label: "Fairway", group: "polygons" },
  { id: "green_polygon", label: "Green Poly", group: "polygons" },
  { id: "tee_polygon", label: "Tee Poly", group: "polygons" },
  { id: "rough_polygon", label: "Rough", group: "polygons" },
  { id: "bunker", label: "Bunker", group: "polygons" },
  { id: "water", label: "Water", group: "polygons" },
  { id: "penalty", label: "Penalty", group: "polygons" },
  { id: "ob", label: "OB", group: "polygons" },
  { id: "trees", label: "Trees", group: "polygons" },
  { id: "waste", label: "Waste", group: "polygons" },
  { id: "cart_path", label: "Cart Path", group: "polygons" },
  { id: "delete", label: "Delete", group: "ops" },
];

type FeatureType =
  | "tee" | "green_front" | "green_center" | "green_back" | "pin"
  | "bunker" | "water" | "penalty" | "ob"
  | "layup" | "dogleg" | "landing_zone"
  | "fairway_polygon" | "green_polygon" | "tee_polygon" | "hole_boundary"
  | "rough_polygon" | "trees" | "waste" | "cart_path"
  | "na_marker";

interface DraftFeature {
  id: string; // local uuid until persisted
  persistedId?: string;
  feature_type: FeatureType;
  name: string;
  side_label: string | null;
  center_lat: number | null;
  center_lng: number | null;
  polygon_json: Array<[number, number]> | null;
  notes: string | null;
  // Provenance — present only for OSM-derived preview features so the UI
  // can show "needs review" and the save path can flag them.
  source?: "osm_preview";
  verified?: boolean;
  needs_review?: boolean;
}

function uid() {
  return `local-${Math.random().toString(36).slice(2, 10)}`;
}

function isPolygonTool(t: Tool): boolean {
  return (
    t === "bunker" ||
    t === "water" ||
    t === "penalty" ||
    t === "ob" ||
    t === "fairway_polygon" ||
    t === "green_polygon" ||
    t === "tee_polygon" ||
    t === "hole_boundary" ||
    t === "rough_polygon" ||
    t === "trees" ||
    t === "waste" ||
    t === "cart_path"
  );
}
function isPointTool(t: Tool): boolean {
  return ["tee","green_front","green_center","green_back","pin","layup","dogleg","landing_zone"].includes(t);
}

export default function CourseMapper() {
  const admin = useGswingAdmin();
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const styleLoadedRef = useRef(false);

  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<
    "satellite" | "streets" | "fallback-satellite" | "fallback-streets"
  >("satellite");
  const [tileError, setTileError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [polygonPoints, setPolygonPoints] = useState<Array<[number, number]>>([]);

  const [courseMapId, setCourseMapId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [centerLat, setCenterLat] = useState<number>(25.2048);
  const [centerLng, setCenterLng] = useState<number>(55.2708);
  const [externalProvider, setExternalProvider] = useState<string | null>(null);
  const [externalCourseId, setExternalCourseId] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [holeHandicap, setHoleHandicap] = useState<number | null>(null);

  const [holeNumber, setHoleNumber] = useState(1);
  const [par, setPar] = useState<number | null>(null);
  const [mappedHoleId, setMappedHoleId] = useState<string | null>(null);
  const [features, setFeatures] = useState<DraftFeature[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [loadingHole, setLoadingHole] = useState(false);

  // Golf API admin (owner only) — opens the GolfAPI.io console.
  // Mobile UI — collapsible tool dock + inspector. Defaults closed on
  // narrow viewports so the map stays usable; auto-open on >=md.
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  // Token
  useEffect(() => {
    let cancelled = false;
    loadMapboxToken()
      .then((t) => { if (!cancelled) setToken(t); })
      .catch((e: unknown) => {
        if (cancelled) return;
        setTokenError(e instanceof Error ? e.message : "Token unavailable");
        // No Mapbox token → fall back to free Esri imagery so the canvas
        // is never blank.
        setMapStyle((s) => (s === "satellite" || s === "streets" ? "fallback-satellite" : s));
      });
    return () => { cancelled = true; };
  }, []);

  // Map init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const usingFallback = mapStyle === "fallback-satellite" || mapStyle === "fallback-streets";
    // Wait for token only when using a Mapbox-hosted style.
    if (!usingFallback && !token) return;
    if (token) mapboxgl.accessToken = token;
    const FALLBACK_SAT_STYLE = {
      version: 8 as const,
      sources: {
        "fallback-sat": {
          type: "raster" as const,
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Imagery © Esri",
        },
      },
      layers: [{ id: "fallback-sat-layer", type: "raster" as const, source: "fallback-sat" }],
    };
    const FALLBACK_OPEN_TILE_STYLE = {
      version: 8 as const,
      sources: {
        "fallback-open-tile": {
          type: "raster" as const,
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [{ id: "fallback-open-tile-layer", type: "raster" as const, source: "fallback-open-tile" }],
    };
    const styleSpec: string | typeof FALLBACK_SAT_STYLE | typeof FALLBACK_OPEN_TILE_STYLE =
      mapStyle === "satellite"
        ? "mapbox://styles/mapbox/satellite-streets-v12"
        : mapStyle === "streets"
          ? "mapbox://styles/mapbox/dark-v11"
          : mapStyle === "fallback-satellite"
            ? FALLBACK_SAT_STYLE
            : FALLBACK_OPEN_TILE_STYLE;
    // eslint-disable-next-line no-console
    console.log("[CourseMapper] map init", {
      style: typeof styleSpec === "string" ? styleSpec : mapStyle,
      center: [centerLng, centerLat],
    });
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleSpec as unknown as mapboxgl.Style,
      center: [centerLng, centerLat],
      zoom: 16.5,
      pitch: 0,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");
    mapRef.current = map;
    map.on("load", () => {
      styleLoadedRef.current = true;
      ensureMappedLayers(map);
      // eslint-disable-next-line no-console
      console.log("[CourseMapper] map loaded");
    });
    map.on("error", (e: { error?: { status?: number; message?: string } }) => {
      const status = e?.error?.status;
      const msg = e?.error?.message ?? "Map tile error";
      // eslint-disable-next-line no-console
      console.warn("[CourseMapper] map error", status, msg, e?.error);
      if (status === 401 || status === 403) {
        setTileError(
          `Mapbox token rejected this domain (${status}). Loaded a free Esri/OSM basemap so you can keep mapping. ` +
            `Add this domain to the Mapbox token's URL allowlist for native imagery.`,
        );
        // Hop to a non-Mapbox basemap so the canvas is never black.
        if (mapStyle === "satellite") {
          setMapStyle("fallback-satellite");
        } else if (mapStyle === "streets") {
          setMapStyle("fallback-streets");
        }
      }
    });
    return () => {
      styleLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, mapStyle]);

  // Render features → mapped layers preview
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    const preview = buildMappedHoleFromRows(
      {
        id: mappedHoleId ?? "preview",
        course_map_id: courseMapId ?? "preview",
        hole_number: holeNumber,
        par,
        length_yards: null,
        length_meters: null,
        tee_lat: null, tee_lng: null,
        green_front_lat: null, green_front_lng: null,
        green_center_lat: null, green_center_lng: null,
        green_back_lat: null, green_back_lng: null,
        pin_lat: null, pin_lng: null,
      },
      features.map((f) => ({
        id: f.id,
        mapped_hole_id: mappedHoleId ?? "preview",
        feature_type: f.feature_type,
        name: f.name,
        side_label: f.side_label,
        front_lat: null, front_lng: null,
        center_lat: f.center_lat,
        center_lng: f.center_lng,
        carry_lat: null, carry_lng: null,
        polygon_json: f.polygon_json,
        notes: f.notes,
      })),
    );
    setMappedHoleData(map, preview);
  }, [features, mappedHoleId, courseMapId, holeNumber, par]);

  // Map click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      if (tool === "select" || tool === "delete") return;
      if (isPointTool(tool)) {
        const draft: DraftFeature = {
          id: uid(),
          feature_type: tool as FeatureType,
          name: tool.replace(/_/g, " "),
          side_label: null,
          center_lat: lat,
          center_lng: lng,
          polygon_json: null,
          notes: null,
        };
        setFeatures((prev) => [...prev, draft]);
        setSelectedId(draft.id);
        return;
      }
      if (isPolygonTool(tool)) {
        setPolygonPoints((prev) => [...prev, [lng, lat]]);
      }
    };
    map.getCanvas().style.cursor = tool === "select" ? "" : "crosshair";
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
    };
  }, [tool]);

  const finishPolygon = () => {
    if (!isPolygonTool(tool) || polygonPoints.length < 3) {
      toast.error("A polygon needs at least 3 points.");
      return;
    }
    const ring = [...polygonPoints, polygonPoints[0]];
    const sumLat = ring.reduce((a, p) => a + p[1], 0) / ring.length;
    const sumLng = ring.reduce((a, p) => a + p[0], 0) / ring.length;
    const draft: DraftFeature = {
      id: uid(),
      feature_type: tool as FeatureType,
      name: tool,
      side_label: null,
      center_lat: sumLat,
      center_lng: sumLng,
      polygon_json: ring,
      notes: null,
    };
    setFeatures((prev) => [...prev, draft]);
    setSelectedId(draft.id);
    setPolygonPoints([]);
  };

  const cancelPolygon = () => setPolygonPoints([]);

  const deleteFeature = (id: string) => {
    setFeatures((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const selected = useMemo(() => features.find((f) => f.id === selectedId) ?? null, [features, selectedId]);

  const loadHole = useCallback(async (mapId: string, hole: number) => {
    setLoadingHole(true);
    try {
      const m = await loadMappedHole(mapId, hole);
      if (!m) {
        setMappedHoleId(null);
        setFeatures([]);
        setPar(null);
        return;
      }
      setMappedHoleId(m.id);
      setPar(m.par);
      const drafts: DraftFeature[] = [];
      // Embedded green/pin/tee from the mapped_holes row
      if (m.green.front) drafts.push(asDraft("green_front", m.green.front));
      if (m.green.center) drafts.push(asDraft("green_center", m.green.center));
      if (m.green.back) drafts.push(asDraft("green_back", m.green.back));
      if (m.pin) drafts.push(asDraft("pin", m.pin.coordinate));
      for (const t of m.tees) drafts.push(asDraft("tee", t.coordinate, t.name, t.id));
      for (const h of m.hazards) {
        const type = h.type === "penalty_area" ? "penalty" : h.type === "out_of_bounds" ? "ob" : h.type;
        const ft: FeatureType =
          type === "waste_area" ? "waste" : (type as FeatureType);
        drafts.push({
          id: h.id,
          persistedId: h.id,
          feature_type: ft,
          name: h.name,
          side_label: h.side ?? null,
          center_lat: h.center.lat,
          center_lng: h.center.lng,
          polygon_json: h.polygon,
          notes: h.notes ?? null,
        });
      }
      for (const l of m.layups) drafts.push(asDraft("layup", l.coordinate, l.name, l.id));
      for (const d of m.doglegs) drafts.push(asDraft("dogleg", d.coordinate, "Dogleg", d.id));
      for (const z of m.landingZones) drafts.push(asDraft("landing_zone", z.coordinate, z.name, z.id));
      // Premium visual polygons (no per-row id on MappedHole — synth ids).
      const addPoly = (ft: FeatureType, poly: Array<[number, number]> | null | undefined, label: string) => {
        if (!poly || poly.length < 3) return;
        let lat = 0, lng = 0;
        for (const [x, y] of poly) { lng += x; lat += y; }
        drafts.push({
          id: uid(),
          feature_type: ft,
          name: label,
          side_label: null,
          center_lat: lat / poly.length,
          center_lng: lng / poly.length,
          polygon_json: poly,
          notes: null,
        });
      };
      addPoly("fairway_polygon", m.fairwayPolygon, "Fairway");
      addPoly("green_polygon", m.green.polygon, "Green");
      addPoly("tee_polygon", m.teePolygon, "Tee box");
      addPoly("hole_boundary", m.holeBoundary, "Boundary");
      addPoly("rough_polygon", m.roughPolygon, "Rough");
      addPoly("cart_path", m.cartPath, "Cart path");
      // N/A markers
      for (const k of m.naLayers ?? []) {
        drafts.push({
          id: uid(),
          feature_type: "na_marker",
          name: k,
          side_label: null,
          center_lat: null,
          center_lng: null,
          polygon_json: null,
          notes: null,
        });
      }
      setFeatures(drafts);
      // eslint-disable-next-line no-console
      console.log("[CourseMapper] hole loaded", { courseMapId: mapId, hole, featureCount: drafts.length });
      // Auto-fit map to saved geometry
      const pts: Array<[number, number]> = [];
      for (const d of drafts) {
        if (Number.isFinite(d.center_lat) && Number.isFinite(d.center_lng)) {
          pts.push([d.center_lng as number, d.center_lat as number]);
        }
        if (d.polygon_json) for (const p of d.polygon_json) pts.push([p[0], p[1]]);
      }
      const map = mapRef.current;
      if (map && pts.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [x, y] of pts) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        // eslint-disable-next-line no-console
        console.log("[CourseMapper] fitBounds", { minX, minY, maxX, maxY });
        try {
          map.fitBounds(
            [[minX, minY], [maxX, maxY]],
            { padding: 80, maxZoom: 18, duration: 600 },
          );
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[CourseMapper] fitBounds failed", err);
        }
      }
    } finally {
      setLoadingHole(false);
    }
  }, []);

  function asDraft(
    type: FeatureType,
    c: { lat: number; lng: number },
    name?: string,
    persistedId?: string,
  ): DraftFeature {
    return {
      id: persistedId ?? uid(),
      persistedId,
      feature_type: type,
      name: name ?? type,
      side_label: null,
      center_lat: c.lat,
      center_lng: c.lng,
      polygon_json: null,
      notes: null,
    };
  }

  // Single source of truth: switching a course must wipe every trace of
  // the previous workspace (features, drawings, selection, hole metadata)
  // before loading the new one. Otherwise the header updates but the map
  // still shows the prior course's drawings.
  const onSelectCourse = useCallback(
    async (id: string, targetHole?: number) => {
      if (!id) return;
      // 1. Reset all per-course state IMMEDIATELY so stale data never leaks.
      setCourseMapId(id);
      setFeatures([]);
      setSelectedId(null);
      setPolygonPoints([]);
      setMappedHoleId(null);
      setPar(null);
      setHoleHandicap(null);
      setCourseName("");
      setLocationLabel("");
      setExternalProvider(null);
      setExternalCourseId(null);
      setLastSynced(null);
      // Clear any drawn layers immediately on the map.
      const map = mapRef.current;
      if (map && styleLoadedRef.current) {
        setMappedHoleData(map, null);
      }
      // 2. Fetch the course record.
      const { data, error } = await supabase
        .from("gswing_course_maps")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        toast.error(error?.message || "Course not found");
        return;
      }
      setCourseName(data.course_name);
      setLocationLabel(data.location_label ?? "");
      setCenterLat(data.latitude);
      setCenterLng(data.longitude);
      setExternalProvider(data.external_provider ?? null);
      setExternalCourseId(data.external_course_id ?? null);
      setLastSynced(data.last_synced ?? null);
      // 3. Centre the map on the selected course right away.
      mapRef.current?.flyTo({
        center: [data.longitude, data.latitude],
        zoom: 16.5,
        essential: true,
      });
      // 4. Load hole geometry (defaults to Hole 1 for a clean entry).
      const hole = targetHole ?? 1;
      setHoleNumber(hole);
      await loadHole(id, hole);
    },
    [loadHole],
  );

  // Auto-load hole when number changes
  useEffect(() => {
    if (courseMapId) loadHole(courseMapId, holeNumber);
  }, [holeNumber, courseMapId, loadHole]);

  const [courseList, setCourseList] = useState<Array<{ id: string; course_name: string }>>([]);
  useEffect(() => {
    supabase.from("gswing_course_maps").select("id, course_name").order("course_name").then(({ data }) => {
      if (data) setCourseList(data as Array<{ id: string; course_name: string }>);
    });
  }, [saving]);

  // Owner-only enhancement: deep-link directly into a specific course +
  // hole via `?course=<name>&hole=<n>`. Used by the GPS "Premium Mapping
  // Required" gate to take the owner straight to the missing layer for
  // the hole they were just trying to play.
  // Reactive deep-link: re-apply whenever the URL params change so
  // selecting a different course (or arriving via Add Course) always
  // loads the right workspace — not just on first mount.
  const [searchParams] = useSearchParams();
  const appliedKeyRef = useRef<string>("");
  useEffect(() => {
    const courseParam = searchParams.get("course");
    const courseMapIdParam = searchParams.get("courseMapId");
    const holeParam = searchParams.get("hole");
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const key = `${courseMapIdParam ?? ""}|${courseParam ?? ""}|${holeParam ?? ""}|${latParam ?? ""}|${lngParam ?? ""}`;
    if (!courseParam && !courseMapIdParam && !holeParam && !latParam && !lngParam) return;
    if (key === appliedKeyRef.current) return;
    appliedKeyRef.current = key;
    const holeNum = holeParam ? Number(holeParam) : NaN;
    const targetHole = Number.isFinite(holeNum) && holeNum >= 1 && holeNum <= 18 ? holeNum : undefined;
    const latNum = latParam ? Number(latParam) : NaN;
    const lngNum = lngParam ? Number(lngParam) : NaN;
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      setCenterLat(latNum);
      setCenterLng(lngNum);
      mapRef.current?.flyTo({ center: [lngNum, latNum], zoom: 17.5 });
    }
    if (courseMapIdParam) {
      void onSelectCourse(courseMapIdParam, targetHole);
      return;
    }
    if (!courseParam) {
      if (targetHole) setHoleNumber(targetHole);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("gswing_course_maps")
        .select("id, course_name")
        .ilike("course_name", courseParam)
        .maybeSingle();
      if (data?.id) {
        await onSelectCourse(data.id, targetHole);
      } else {
        toast.info(
          `"${courseParam}" is not mapped yet — pick or create a course to begin.`,
        );
      }
    })();
  }, [searchParams, onSelectCourse]);

  // Sharjah quick-select — finds the seeded course and jumps straight to
  // hole 1. Falls back to a toast if the seed migration was not applied.
  const openSharjah = useCallback(async () => {
    const { data } = await supabase
      .from("gswing_course_maps")
      .select("id")
      .eq("course_name", SHARJAH_QUICK.name)
      .maybeSingle();
    if (!data?.id) {
      toast.error("Sharjah course not seeded yet.");
      return;
    }
    await onSelectCourse(data.id, 1);
  }, [onSelectCourse]);

  // Honest per-hole completeness checklist. Reads the current draft
  // features — does not invent missing data.
  const checklist = useMemo(() => {
    const has = (t: FeatureType) => features.some((f) => f.feature_type === t);
    return [
      { key: "tee", label: "Tee", done: has("tee") },
      { key: "green_front", label: "Green front", done: has("green_front") },
      { key: "green_center", label: "Green center", done: has("green_center") },
      { key: "green_back", label: "Green back", done: has("green_back") },
      { key: "pin", label: "Pin", done: has("pin") },
      {
        key: "hazards",
        label: "Hazards",
        done: features.some((f) => ["bunker","water","penalty","ob"].includes(f.feature_type)),
      },
      {
        key: "layups",
        label: "Layups",
        done: features.some((f) => ["layup","dogleg","landing_zone"].includes(f.feature_type)),
      },
    ];
  }, [features]);

  // Synthesise a MappedHole-shaped snapshot from current drafts so we can
  // run the Premium readiness evaluator (single source of truth shared
  // with the renderer). Manual mapping wins — same data path as save.
  const premiumStatuses = useMemo(() => {
    const getPoly = (t: FeatureType) =>
      features.find((f) => f.feature_type === t)?.polygon_json ?? null;
    const naLayers = features
      .filter((f) => f.feature_type === "na_marker" && f.name)
      .map((f) => f.name);
    const synth = {
      id: mappedHoleId ?? "preview",
      holeNumber,
      par,
      lengthYards: null,
      lengthMeters: null,
      tees: [],
      green: {
        front: null,
        center: null,
        back: null,
        polygon: getPoly("green_polygon"),
        slopeNote: null,
      },
      pin: null,
      hazards: features
        .filter((f) =>
          ["bunker","water","penalty","ob","trees","waste","rough_polygon"].includes(f.feature_type),
        )
        .map((f) => ({
          id: f.id,
          name: f.name,
          type:
            f.feature_type === "penalty"
              ? ("penalty_area" as const)
              : f.feature_type === "ob"
                ? ("out_of_bounds" as const)
                : f.feature_type === "waste"
                  ? ("waste_area" as const)
                  : f.feature_type === "rough_polygon"
                    ? ("rough" as const)
                    : (f.feature_type as "bunker" | "water" | "trees"),
          side: null,
          polygon: f.polygon_json,
          front: null,
          carry: null,
          center: { lat: f.center_lat ?? 0, lng: f.center_lng ?? 0 },
          notes: f.notes,
        })),
      layups: [],
      doglegs: [],
      landingZones: [],
      fairwayPolygon: getPoly("fairway_polygon"),
      teePolygon: getPoly("tee_polygon"),
      holeBoundary: getPoly("hole_boundary"),
      roughPolygon: getPoly("rough_polygon"),
      cartPath: getPoly("cart_path"),
      naLayers,
    };
    return evaluatePremiumLayers(synth);
  }, [features, mappedHoleId, holeNumber, par]);

  const premiumProgressInfo = useMemo(() => {
    const req = premiumStatuses.filter((s) => !s.optional);
    return { done: req.filter((s) => s.satisfied).length, total: req.length };
  }, [premiumStatuses]);

  const togglePremiumNa = useCallback((layerKey: PremiumLayerKey) => {
    setFeatures((prev) => {
      const existing = prev.find(
        (f) => f.feature_type === "na_marker" && f.name === layerKey,
      );
      if (existing) return prev.filter((f) => f.id !== existing.id);
      return [
        ...prev,
        {
          id: uid(),
          feature_type: "na_marker",
          name: layerKey,
          side_label: null,
          center_lat: null,
          center_lng: null,
          polygon_json: null,
          notes: null,
        },
      ];
    });
  }, []);

  const save = async () => {
    if (admin.status !== "admin") {
      toast.error("Admin role required to save.");
      return;
    }
    if (!courseName.trim()) {
      toast.error("Enter a course name first.");
      return;
    }
    setSaving(true);
    try {
      // 1. upsert course map
      let mapId = courseMapId;
      if (!mapId) {
        const { data, error } = await supabase
          .from("gswing_course_maps")
          .insert({
            course_name: courseName.trim(),
            location_label: locationLabel.trim() || null,
            latitude: centerLat,
            longitude: centerLng,
          })
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message || "Course map insert failed");
        mapId = data.id;
        setCourseMapId(mapId);
      } else {
        const { error } = await supabase
          .from("gswing_course_maps")
          .update({
            course_name: courseName.trim(),
            location_label: locationLabel.trim() || null,
            latitude: centerLat,
            longitude: centerLng,
          })
          .eq("id", mapId);
        if (error) throw new Error(error.message);
      }

      // 2. derive embedded fields for mapped_holes from features
      const find = (t: FeatureType) => features.find((f) => f.feature_type === t);
      const tee = find("tee");
      const gf = find("green_front");
      const gc = find("green_center");
      const gb = find("green_back");
      const pin = find("pin");

      let holeId = mappedHoleId;
      const holePayload = {
        course_map_id: mapId,
        hole_number: holeNumber,
        par,
        length_yards: null,
        length_meters: null,
        tee_lat: tee?.center_lat ?? null,
        tee_lng: tee?.center_lng ?? null,
        green_front_lat: gf?.center_lat ?? null,
        green_front_lng: gf?.center_lng ?? null,
        green_center_lat: gc?.center_lat ?? null,
        green_center_lng: gc?.center_lng ?? null,
        green_back_lat: gb?.center_lat ?? null,
        green_back_lng: gb?.center_lng ?? null,
        pin_lat: pin?.center_lat ?? null,
        pin_lng: pin?.center_lng ?? null,
      };
      if (!holeId) {
        const { data, error } = await supabase
          .from("gswing_mapped_holes")
          .insert(holePayload)
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message || "Mapped hole insert failed");
        holeId = data.id;
        setMappedHoleId(holeId);
      } else {
        const { error } = await supabase
          .from("gswing_mapped_holes")
          .update(holePayload)
          .eq("id", holeId);
        if (error) throw new Error(error.message);
      }

      // 3. write all non-embedded features (hazards / layups / premium polygons / NA markers)
      const persistableTypes: FeatureType[] = [
        "bunker","water","penalty","ob","layup","dogleg","landing_zone",
        "fairway_polygon","green_polygon","tee_polygon","hole_boundary",
        "rough_polygon","trees","waste","cart_path","na_marker",
      ];
      const rows = features
        .filter((f) => persistableTypes.includes(f.feature_type))
        .map((f) => ({
          mapped_hole_id: holeId!,
          feature_type: f.feature_type,
          name: f.name,
          side_label: f.side_label,
          front_lat: null,
          front_lng: null,
          center_lat: f.center_lat,
          center_lng: f.center_lng,
          carry_lat: null,
          carry_lng: null,
          polygon_json: f.polygon_json,
          notes: f.notes,
        }));

      // Replace strategy: delete existing non-embedded features for this hole, then re-insert.
      const { error: delErr } = await supabase
        .from("gswing_hole_features")
        .delete()
        .eq("mapped_hole_id", holeId)
        .in("feature_type", persistableTypes);
      if (delErr) throw new Error(delErr.message);

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("gswing_hole_features").insert(rows);
        if (insErr) throw new Error(insErr.message);
      }

      // Validation warnings
      const warnings: string[] = [];
      if (!tee) warnings.push("Tee missing");
      if (!gc) warnings.push("Green center missing");
      if (!gf || !gb) warnings.push("Front/back missing");
      if (!features.some((f) => ["bunker","water","penalty","ob"].includes(f.feature_type))) {
        warnings.push("No hazards mapped");
      }
      toast.success(
        warnings.length === 0
          ? "Saved · mapping complete"
          : `Saved · incomplete mapping: ${warnings.join(", ")}`,
      );

      // Reload to get persisted IDs
      await loadHole(mapId, holeNumber);

      // Integrated workflow: when launched from Live GPS, hop straight
      // back to it with a refresh hint so the Premium renderer repaints
      // this hole instantly — no manual re-selection, no app restart.
      const returnTo = searchParams.get("returnTo");
      if (returnTo === "gps") {
        navigate(`/?view=gps&refreshMap=1&hole=${holeNumber}`, { replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (admin.status === "loading") {
    return <FullScreenMessage title="Checking access" body="Validating your account…" />;
  }
  if (admin.status === "anon") {
    return (
      <FullScreenMessage
        title="Sign in required"
        body="Course Mapper is restricted to G-Swing owners and admins. Please sign in."
        icon={<ShieldAlert className="h-8 w-8 text-gold" />}
      />
    );
  }
  if (admin.status === "denied") {
    return (
      <FullScreenMessage
        title="Access denied"
        body="This tool is restricted to Owner, Platform Owner, or Admin roles."
        icon={<ShieldAlert className="h-8 w-8 text-red-400" />}
      />
    );
  }
  if (tokenError) {
    return <FullScreenMessage title="Map unavailable" body={tokenError} />;
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-black text-foreground">
      {/* Top bar */}
      <header className="flex flex-wrap items-center justify-between gap-y-2 border-b border-gold/20 bg-emerald-950/60 px-3 py-2 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">G-Swing · Course Mapper</p>
          <h1 className="truncate font-serif text-base text-gold">{courseName || "Untitled course"}</h1>
          {(locationLabel || externalProvider) && (
            <p className="truncate text-[10px] text-foreground/60">
              {locationLabel || "—"}
              {externalProvider && (
                <span className="ml-2 rounded-full border border-gold/30 bg-black/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-gold/80">
                  {externalProvider}{externalCourseId ? ` · #${externalCourseId}` : ""}
                </span>
              )}
            </p>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-foreground/70">
            <span><span className="text-gold/70">Hole</span> {holeNumber} of 18</span>
            <span><span className="text-gold/70">Par</span> {par ?? "—"}</span>
            <span><span className="text-gold/70">HCP</span> {holeHandicap ?? "—"}</span>
            {lastSynced && (
              <span><span className="text-gold/70">Synced</span> {new Date(lastSynced).toLocaleDateString()}</span>
            )}
            <span className={features.length > 0 ? "text-emerald-300" : "text-amber-300"}>
              {features.length > 0 ? `${features.length} feature(s)` : "Not mapped"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={openSharjah}
            size="sm"
            variant="outline"
            className="h-7 border-gold/40 bg-black/40 px-2 text-[10px] uppercase tracking-wider text-gold hover:bg-black/60 hover:text-gold"
          >
            Sharjah
          </Button>
          <Button
            type="button"
            onClick={() => { window.location.href = "/gswing/golf-api"; }}
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-gold/40 bg-black/40 px-2 text-[10px] uppercase tracking-wider text-gold hover:bg-black/60 hover:text-gold"
            title="Open Golf API admin (search & sync courses via GolfAPI.io)"
          >
            Golf API
          </Button>
          <select
            value={courseMapId ?? ""}
            onChange={(e) => (e.target.value ? onSelectCourse(e.target.value) : setCourseMapId(null))}
            className="rounded-md border border-gold/30 bg-black/60 px-2 py-1 text-xs text-foreground"
          >
            <option value="">+ New course</option>
            {courseList.map((c) => (
              <option key={c.id} value={c.id}>{c.course_name}</option>
            ))}
          </select>
          <Button onClick={save} disabled={saving} size="sm" className="gap-1 bg-gold text-black hover:bg-gold/85">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      {/* Body: map + drawer */}
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Tile error banner — visible feedback if Mapbox tiles fail */}
        {tileError && (
          <div className="pointer-events-auto absolute left-1/2 top-2 z-20 -translate-x-1/2 max-w-[min(92%,640px)] rounded-lg border border-red-400/40 bg-red-950/85 px-3 py-2 text-xs text-red-100 backdrop-blur">
            <div className="flex items-start gap-2">
              <span className="font-semibold">Map tiles failed.</span>
              <span className="opacity-90">{tileError}</span>
              <button
                type="button"
                onClick={() => setTileError(null)}
                className="ml-auto text-red-200/80 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1 flex gap-2 text-[10px] uppercase tracking-wider">
              <button
                type="button"
                onClick={() => { setTileError(null); setMapStyle("fallback-satellite"); }}
                className={`rounded px-2 py-1 ${mapStyle === "fallback-satellite" ? "bg-gold text-black" : "bg-white/10 hover:bg-white/20"}`}
              >
                Esri satellite
              </button>
              <button
                type="button"
                onClick={() => { setTileError(null); setMapStyle("fallback-streets"); }}
                className={`rounded px-2 py-1 ${mapStyle === "fallback-streets" ? "bg-gold text-black" : "bg-white/10 hover:bg-white/20"}`}
              >
                OSM streets
              </button>
              <button
                type="button"
                onClick={() => { setTileError(null); setMapStyle("satellite"); }}
                className={`rounded px-2 py-1 ${mapStyle === "satellite" ? "bg-gold text-black" : "bg-white/10 hover:bg-white/20"}`}
              >
                Retry Mapbox
              </button>
            </div>
          </div>
        )}

        {/* Token missing — explicit message instead of a silent black canvas */}
        {!token && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-center text-xs text-foreground/80">
            <div className="max-w-sm space-y-2 p-4">
              <p className="text-sm font-semibold text-gold">
                {tokenError ? "Mapbox token unavailable" : "Loading map…"}
              </p>
              {tokenError && <p className="opacity-80">{tokenError}</p>}
            </div>
          </div>
        )}

        {/* Mobile toggles — open Tools / Inspector as bottom sheets on small screens */}
        <div className="absolute left-2 top-2 z-20 flex gap-1 md:hidden">
          <button
            type="button"
            onClick={() => { setMobileToolsOpen((v) => !v); setMobileInspectorOpen(false); }}
            className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-black/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gold backdrop-blur"
          >
            <Wrench className="h-3 w-3" /> Tools
          </button>
        </div>
        <div className="absolute right-2 top-2 z-20 flex gap-1 md:hidden">
          <button
            type="button"
            onClick={() => { setMobileInspectorOpen((v) => !v); setMobileToolsOpen(false); }}
            className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-black/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gold backdrop-blur"
          >
            <Layers className="h-3 w-3" /> Hole {holeNumber}
            {mobileInspectorOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
        </div>

        {/* Left tool dock — desktop fixed dock, mobile slide-down sheet */}
        <div
          className={`absolute left-2 z-10 flex flex-col gap-1 overflow-y-auto rounded-xl border border-gold/30 bg-black/80 p-1 backdrop-blur-md transition-all
            md:top-2 md:max-h-[80%] md:w-auto md:flex
            ${mobileToolsOpen ? "top-14 max-h-[60vh] w-[min(70vw,260px)] grid grid-cols-2 gap-1" : "top-14 hidden"}
            md:!flex md:!max-h-[80%] md:!w-auto md:!grid-cols-none`}
        >
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTool(t.id); setPolygonPoints([]); setMobileToolsOpen(false); }}
              className={`rounded px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                tool === t.id ? "bg-gold text-black" : "text-foreground/80 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Polygon control bar */}
        {isPolygonTool(tool) && polygonPoints.length > 0 && (
          <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-gold/30 bg-black/80 px-3 py-1.5 text-xs text-foreground backdrop-blur">
            <span className="text-gold-soft">{polygonPoints.length} pts</span>
            <button onClick={finishPolygon} className="ml-3 inline-flex items-center gap-1 text-emerald-300">
              <Check className="h-3.5 w-3.5" /> Finish
            </button>
            <button onClick={cancelPolygon} className="ml-3 inline-flex items-center gap-1 text-red-300">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        )}

        {/* Right inspector — desktop fixed panel, mobile bottom sheet */}
        <aside
          className={`absolute z-10 overflow-y-auto rounded-xl border border-gold/25 bg-black/85 p-3 backdrop-blur transition-all
            md:right-2 md:top-2 md:w-64 md:max-h-[88%] md:block
            ${mobileInspectorOpen
              ? "inset-x-2 bottom-14 max-h-[65vh]"
              : "hidden"}
            md:!block md:!inset-auto md:!bottom-auto md:!max-h-[88%]`}
        >
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold-soft">Course</p>
          <div className="mt-1 space-y-2">
            <div>
              <Label className="text-[10px] text-foreground/70">Course name</Label>
              <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] text-foreground/70">Location label</Label>
              <Input value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-foreground/70">Hole #</Label>
                <select
                  value={holeNumber}
                  onChange={(e) => setHoleNumber(Number(e.target.value))}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Hole {n}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[10px] text-foreground/70">Par</Label>
                <select
                  value={par ?? ""}
                  onChange={(e) => setPar(e.target.value ? Number(e.target.value) : null)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">—</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
            </div>
          </div>

          <p className="mt-4 text-[10px] uppercase tracking-[0.25em] text-gold-soft">Features ({features.length})</p>
          <div className="mt-2 rounded-lg border border-white/10 bg-black/40 p-2">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gold-soft">
              Hole {holeNumber} · GPS ready
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px]">
              {checklist.map((c) => (
                <li key={c.key} className="flex items-center justify-between">
                  <span className="text-foreground/80">{c.label}</span>
                  <span
                    className={
                      c.done
                        ? "inline-flex items-center gap-1 text-emerald-300"
                        : "inline-flex items-center gap-1 text-amber-300"
                    }
                  >
                    {c.done ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {c.done ? "saved" : "missing"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-2 rounded-lg border border-gold/25 bg-black/40 p-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.25em] text-gold-soft">
                Premium visual mapping
              </p>
              <span className="text-[10px] text-gold/85">
                {premiumProgressInfo.done}/{premiumProgressInfo.total}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-foreground/55">
              Required polygons for the illustrated Premium view. Mark a layer
              N/A when it does not apply to this hole.
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px]">
              {premiumStatuses.map((s) => {
                const state = s.drawn
                  ? "drawn"
                  : s.markedNa
                    ? "n/a"
                    : "missing";
                const tone = s.drawn
                  ? "text-emerald-300"
                  : s.markedNa
                    ? "text-foreground/55"
                    : s.optional
                      ? "text-foreground/60"
                      : "text-amber-300";
                return (
                  <li key={s.key} className="flex items-center justify-between gap-2">
                    <span className="text-foreground/80">
                      {s.label}
                      {s.optional && <span className="ml-1 text-foreground/40">(opt)</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 ${tone}`}>
                        {s.drawn ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {state}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePremiumNa(s.key)}
                        disabled={s.drawn}
                        className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider transition-colors ${
                          s.markedNa
                            ? "border-gold/40 bg-gold/20 text-gold"
                            : "border-white/15 text-foreground/60 hover:bg-white/10 disabled:opacity-30"
                        }`}
                        title={s.drawn ? "Drawn — cannot mark N/A" : "Toggle Not Applicable"}
                      >
                        N/A
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {loadingHole && <p className="mt-1 text-[11px] text-foreground/60">Loading hole…</p>}
          <ul className="mt-1 space-y-1">
            {features.map((f) => (
              <li
                key={f.id}
                className={`flex items-center justify-between rounded border px-2 py-1 text-[11px] ${
                  selectedId === f.id ? "border-gold bg-gold/10" : "border-white/10 bg-white/5"
                }`}
              >
                <button onClick={() => setSelectedId(f.id)} className="flex-1 text-left">
                  {f.feature_type} <span className="text-foreground/55">· {f.name}</span>
                </button>
                <button onClick={() => deleteFeature(f.id)} aria-label="Delete">
                  <Trash2 className="h-3 w-3 text-red-300" />
                </button>
              </li>
            ))}
            {features.length === 0 && (
              <li className="rounded border border-dashed border-white/15 p-2 text-[11px] text-foreground/55">
                Pick a tool and tap the map.
              </li>
            )}
          </ul>

          {selected && (
            <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-gold-soft">Inspector</p>
              <Input
                value={selected.name}
                onChange={(e) =>
                  setFeatures((prev) => prev.map((f) => (f.id === selected.id ? { ...f, name: e.target.value } : f)))
                }
                placeholder="Name"
                className="h-8 text-xs"
              />
              <select
                value={selected.side_label ?? ""}
                onChange={(e) =>
                  setFeatures((prev) =>
                    prev.map((f) =>
                      f.id === selected.id ? { ...f, side_label: e.target.value || null } : f,
                    ),
                  )
                }
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">side —</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="center">Center</option>
                <option value="short">Short</option>
                <option value="long">Long</option>
              </select>
              <Textarea
                value={selected.notes ?? ""}
                onChange={(e) =>
                  setFeatures((prev) =>
                    prev.map((f) => (f.id === selected.id ? { ...f, notes: e.target.value } : f)),
                  )
                }
                placeholder="Notes"
                className="min-h-[60px] text-xs"
              />
            </div>
          )}
        </aside>

        {/* Bottom save bar */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-gold/20 bg-black/85 px-3 py-2 backdrop-blur">
          <div className="text-[10px] text-foreground/70">
            Tool · <span className="text-gold">{tool}</span>
            {isPolygonTool(tool) && polygonPoints.length > 0 && (
              <span> · {polygonPoints.length} polygon points</span>
            )}
          </div>
          <Button onClick={save} disabled={saving} size="sm" className="gap-1 bg-gold text-black hover:bg-gold/85">
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save mapping"}
          </Button>
        </div>
      </div>

    </div>
  );
}

function FullScreenMessage({ title, body, icon }: { title: string; body: string; icon?: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black p-6">
      <Card className="max-w-sm border-gold/25 bg-black/70 p-6 text-center">
        <div className="mb-3 flex justify-center">{icon ?? <Layers className="h-8 w-8 text-gold" />}</div>
        <h2 className="font-serif text-xl text-gold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </Card>
    </div>
  );
}