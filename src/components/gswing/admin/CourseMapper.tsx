// G-Swing admin Course Mapper.
// Mobile-first Mapbox tool to map real golf courses into gswing_* tables.
// Gated to users with role: owner | platform_owner | admin.
// Writes go directly through Supabase — RLS enforces the same gate server-side.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, Save, Trash2, MapPin, Flag, Crosshair, Pentagon, Layers, Check, X, Globe2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadMapboxToken } from "@/components/gswing/GpsMap";
import { useGswingAdmin } from "@/lib/use-gswing-admin";
import { ensureMappedLayers, setMappedHoleData } from "@/lib/mapbox-mapped-layers";
import { buildMappedHoleFromRows, loadMappedHole } from "@/lib/gswing-course-map-loader";
import { OsmScanPanel } from "@/components/gswing/admin/OsmScanPanel";
import type { OsmImportPreviewItem } from "@/lib/gswing-osm-overpass";
import { GolfCourseApiSyncPanel } from "@/components/gswing/admin/GolfCourseApiSyncPanel";
import {
  PREMIUM_LAYERS,
  evaluatePremiumLayers,
  premiumProgress,
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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const styleLoadedRef = useRef(false);

  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [polygonPoints, setPolygonPoints] = useState<Array<[number, number]>>([]);

  const [courseMapId, setCourseMapId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [centerLat, setCenterLat] = useState<number>(25.2048);
  const [centerLng, setCenterLng] = useState<number>(55.2708);

  const [holeNumber, setHoleNumber] = useState(1);
  const [par, setPar] = useState<number | null>(null);
  const [mappedHoleId, setMappedHoleId] = useState<string | null>(null);
  const [features, setFeatures] = useState<DraftFeature[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [loadingHole, setLoadingHole] = useState(false);

  // OSM (Overpass) assist — preview only, never auto-saved.
  const [osmOpen, setOsmOpen] = useState(false);
  // GolfCourseAPI sync (owner only, comparison + import).
  const [gcaOpen, setGcaOpen] = useState(false);

  // Token
  useEffect(() => {
    let cancelled = false;
    loadMapboxToken()
      .then((t) => { if (!cancelled) setToken(t); })
      .catch((e: unknown) => { if (!cancelled) setTokenError(e instanceof Error ? e.message : "Token unavailable"); });
    return () => { cancelled = true; };
  }, []);

  // Map init
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [centerLng, centerLat],
      zoom: 16.5,
      pitch: 0,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");
    mapRef.current = map;
    map.on("load", () => {
      styleLoadedRef.current = true;
      ensureMappedLayers(map);
    });
    return () => {
      styleLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
        drafts.push({
          id: h.id,
          persistedId: h.id,
          feature_type: type as FeatureType,
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
      setFeatures(drafts);
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

  const onSelectCourse = async (id: string) => {
    setCourseMapId(id);
    const { data } = await supabase
      .from("gswing_course_maps")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      setCourseName(data.course_name);
      setLocationLabel(data.location_label ?? "");
      setCenterLat(data.latitude);
      setCenterLng(data.longitude);
      mapRef.current?.flyTo({ center: [data.longitude, data.latitude], zoom: 16.5 });
      await loadHole(id, holeNumber);
    }
  };

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
    setHoleNumber(1);
    await onSelectCourse(data.id);
  }, []);

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

  // Snapshot of current draft for OSM comparison. Manual mapping wins, so we
  // measure against what is *currently* saved/drafted for this hole.
  const gswingSnapshot = useMemo(() => {
    const find = (t: FeatureType) => features.find((f) => f.feature_type === t);
    const tee = find("tee");
    const gc = find("green_center");
    const pin = find("pin");
    const bunkerCount = features.filter((f) => f.feature_type === "bunker").length;
    const waterCount = features.filter(
      (f) => f.feature_type === "water" || f.feature_type === "penalty",
    ).length;
    return {
      holeNumber,
      tee: tee?.center_lat != null && tee.center_lng != null ? { lat: tee.center_lat, lng: tee.center_lng } : null,
      greenCenter:
        gc?.center_lat != null && gc.center_lng != null ? { lat: gc.center_lat, lng: gc.center_lng } : null,
      pin: pin?.center_lat != null && pin.center_lng != null ? { lat: pin.center_lat, lng: pin.center_lng } : null,
      bunkerCount,
      waterCount,
    };
  }, [features, holeNumber]);

  // Map OSM types onto G-Swing FeatureType drafts. Skip course-level and
  // metadata-only types — those are not draft features.
  function osmTypeToDraft(type: OsmImportPreviewItem["type"]): FeatureType | null {
    switch (type) {
      case "tee": return "tee";
      case "green": return "green_center";
      case "pin": return "pin";
      case "bunker": return "bunker";
      case "water_hazard": return "water";
      default: return null; // hole, fairway, rough, golf_course → not imported as drafts
    }
  }

  function importOsmFeatures(items: OsmImportPreviewItem[]) {
    setFeatures((prev) => {
      const next = [...prev];
      let imported = 0;
      let skipped = 0;
      for (const it of items) {
        const ft = osmTypeToDraft(it.type);
        if (!ft || it.centerLat == null || it.centerLng == null) {
          skipped++;
          continue;
        }
        // Manual G-Swing mapping always wins: skip if a verified (non-OSM)
        // singleton feature of this type already exists for tee/green/pin.
        const singleton = ft === "tee" || ft === "green_center" || ft === "pin";
        if (singleton) {
          const existing = next.find((f) => f.feature_type === ft);
          if (existing && existing.source !== "osm_preview") {
            skipped++;
            continue;
          }
          if (existing && existing.source === "osm_preview") {
            // replace older OSM preview with the newer pick
            const idx = next.indexOf(existing);
            next.splice(idx, 1);
          }
        }
        next.push({
          id: uid(),
          feature_type: ft,
          name: `[OSM] ${it.label}`,
          side_label: null,
          center_lat: it.centerLat,
          center_lng: it.centerLng,
          polygon_json: it.polygon,
          notes: `Imported from OpenStreetMap (${it.osmId}). Unverified — review before saving.`,
          source: "osm_preview",
          verified: false,
          needs_review: true,
        });
        imported++;
      }
      if (skipped > 0) {
        toast.message(`Imported ${imported}, skipped ${skipped} (manual mapping wins).`);
      }
      return next;
    });
    setOsmOpen(false);
  }

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

      // 3. write all non-embedded features (hazards / layups / doglegs / landing / extra tees)
      const persistableTypes: FeatureType[] = ["bunker","water","penalty","ob","layup","dogleg","landing_zone"];
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
      <header className="flex items-center justify-between border-b border-gold/20 bg-emerald-950/60 px-3 py-2 backdrop-blur">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">G-Swing · Course Mapper</p>
          <h1 className="font-serif text-base text-gold">{courseName || "Untitled course"}</h1>
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
            onClick={() => setOsmOpen(true)}
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-gold/40 bg-black/40 px-2 text-[10px] uppercase tracking-wider text-gold hover:bg-black/60 hover:text-gold"
            title="Scan OpenStreetMap nearby (preview only)"
          >
            <Globe2 className="h-3 w-3" /> OSM
          </Button>
          <Button
            type="button"
            onClick={() => setGcaOpen(true)}
            size="sm"
            variant="outline"
            className="h-7 gap-1 border-gold/40 bg-black/40 px-2 text-[10px] uppercase tracking-wider text-gold hover:bg-black/60 hover:text-gold"
            title="Sync GolfCourseAPI (metadata only, owner-reviewed)"
          >
            Sync GolfCourseAPI
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

        {/* Left tool dock */}
        <div className="absolute left-2 top-2 flex max-h-[80%] flex-col gap-1 overflow-y-auto rounded-xl border border-gold/30 bg-black/70 p-1 backdrop-blur-md">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTool(t.id); setPolygonPoints([]); }}
              className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
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

        {/* Right inspector */}
        <aside className="absolute right-2 top-2 w-64 max-h-[88%] overflow-y-auto rounded-xl border border-gold/25 bg-black/80 p-3 backdrop-blur">
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
              Hole {holeNumber} completeness
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

      <OsmScanPanel
        isOpen={osmOpen}
        onClose={() => setOsmOpen(false)}
        centerLat={centerLat}
        centerLng={centerLng}
        holeNumber={holeNumber}
        gswingSnapshot={gswingSnapshot}
        onImport={importOsmFeatures}
      />
      <GolfCourseApiSyncPanel
        isOpen={gcaOpen}
        onClose={() => setGcaOpen(false)}
        courseMapId={courseMapId}
        courseName={courseName}
      />
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