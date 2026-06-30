// Owner-only "Sync GolfCourseAPI" panel.
// Search a course, link it to the current G-Swing course map, show a
// hole-by-hole diff, and let the owner accept/reject/import per hole.
// Nothing is ever auto-written — every import is explicit.

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Search, CloudDownload, Check, AlertTriangle, ArrowLeft, MapPin, Flag, Compass, Building2, Globe2, Hash, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  searchCourses,
  getCourse,
  findSharjah,
  buildDiff,
  linkCourseToProvider,
  recordSyncHistory,
  type SyncDiffRow,
  type GswingHoleSnapshot,
} from "@/lib/golfcourse-api";
import type { NormalisedCourse, NormalisedSearchHit } from "@/lib/course-providers/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  courseMapId: string | null;
  courseName: string;
  centerLat?: number;
  centerLng?: number;
  onCourseMapCreated?: (courseMapId: string, courseName: string) => void;
}

const statusColor: Record<SyncDiffRow["status"], string> = {
  identical: "text-emerald-400",
  minor: "text-amber-400",
  major: "text-red-400",
  "missing-gswing": "text-sky-400",
  "missing-provider": "text-foreground/40",
};

export function GolfCourseApiSyncPanel({ isOpen, onClose, courseMapId, courseName, centerLat, centerLng, onCourseMapCreated }: Props) {
  const [query, setQuery] = useState(courseName || "");
  const [hits, setHits] = useState<NormalisedSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [course, setCourse] = useState<NormalisedCourse | null>(null);
  const [gswingHoles, setGswingHoles] = useState<GswingHoleSnapshot[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [activeCourseMapId, setActiveCourseMapId] = useState<string | null>(courseMapId);
  const [importing, setImporting] = useState(false);
  // Stage: search → details preview (loaded but not linked) → linked (post Add/Import)
  const [stage, setStage] = useState<"search" | "details" | "linked">("search");
  const [existingMapId, setExistingMapId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => { setActiveCourseMapId(courseMapId); }, [courseMapId]);

  useEffect(() => {
    if (isOpen) {
      setQuery(courseName || "");
      setStage("search");
      setCourse(null);
      setExistingMapId(null);
      setAccepted(new Set());
    }
  }, [isOpen, courseName]);

  // Pull current G-Swing hole snapshot for diffing.
  useEffect(() => {
    if (!isOpen || !activeCourseMapId) { setGswingHoles([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("gswing_mapped_holes")
        .select("hole_number, par, length_yards")
        .eq("course_map_id", activeCourseMapId)
        .order("hole_number");
      if (cancelled) return;
      setGswingHoles((data ?? []).map((r) => ({
        hole_number: r.hole_number,
        par: r.par ?? null,
        length_yards: r.length_yards ?? null,
        handicap: null,
      })));
    })();
    return () => { cancelled = true; };
  }, [isOpen, activeCourseMapId]);

  const diff = useMemo<SyncDiffRow[]>(
    () => (course ? buildDiff(gswingHoles, course.holes) : []),
    [course, gswingHoles],
  );

  if (!isOpen) return null;

  const runSearch = async (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setSearching(true);
    try {
      const r = await searchCourses(term);
      setHits(r);
      if (r.length === 0) toast.info("No matches from GolfCourseAPI");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const ensureCourseMap = async (c: NormalisedCourse): Promise<string> => {
    if (activeCourseMapId) return activeCourseMapId;
    const lat = c.latitude ?? centerLat ?? 25.2048;
    const lng = c.longitude ?? centerLng ?? 55.2708;
    const name = (c.club_name || c.course_name || courseName || "Untitled course").trim();
    const { data, error } = await supabase
      .from("gswing_course_maps")
      .insert({
        course_name: name,
        location_label: [c.city, c.country].filter(Boolean).join(", ") || null,
        latitude: lat,
        longitude: lng,
        external_provider: "GolfCourseAPI",
        external_course_id: c.external_id,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Failed to create G-Swing course");
    setActiveCourseMapId(data.id);
    onCourseMapCreated?.(data.id, name);
    return data.id;
  };

  // Open details preview for a hit (no DB write yet).
  const openDetails = async (hit: NormalisedSearchHit) => {
    setLoadingId(hit.external_id);
    try {
      const c = await getCourse(hit.external_id);
      setCourse(c);
      // Check if a G-Swing course already exists for this provider id
      const { data: existing } = await supabase
        .from("gswing_course_maps")
        .select("id")
        .eq("external_provider", "GolfCourseAPI")
        .eq("external_course_id", c.external_id)
        .maybeSingle();
      setExistingMapId(existing?.id ?? null);
      setStage("details");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingId(null);
    }
  };

  // Add course only — no hole metadata import. After success the panel
  // closes and the parent jumps straight to Hole 1 in Course Mapper.
  const addCourseOnly = async () => {
    if (!course) return;
    setAdding(true);
    try {
      const mapId = existingMapId ?? (await ensureCourseMap(course));
      await linkCourseToProvider({
        courseMapId: mapId,
        provider: "GolfCourseAPI",
        externalId: course.external_id,
      });
      setActiveCourseMapId(mapId);
      setExistingMapId(mapId);
      const name = course.club_name || course.course_name;
      toast.success(`Added ${name} — opening Course Mapper`);
      // Single-click handoff: parent receives the id and pivots the
      // workspace onto the new course at Hole 1.
      onCourseMapCreated?.(mapId, name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
      setAdding(false);
    }
  };

  // Add + immediately import all available hole metadata, then jump to
  // the mapper. Skips the intermediate "linked" stage.
  const addAndImport = async () => {
    if (!course) return;
    setAdding(true);
    try {
      const mapId = existingMapId ?? (await ensureCourseMap(course));
      await linkCourseToProvider({
        courseMapId: mapId,
        provider: "GolfCourseAPI",
        externalId: course.external_id,
      });
      setActiveCourseMapId(mapId);
      setExistingMapId(mapId);
      // Pre-select every available par / yardage row and import in one shot.
      const preselect = new Set<string>();
      for (const h of course.holes) {
        if (h.par !== null && h.par !== undefined) preselect.add(`${h.hole_number}:par`);
        if (h.yardage !== null && h.yardage !== undefined) preselect.add(`${h.hole_number}:yardage`);
      }
      setAccepted(preselect);
      // Import inline (doesn't depend on staged React state).
      const acceptedRows = buildDiff(gswingHoles, course.holes).filter((d) =>
        preselect.has(`${d.hole_number}:${d.field}`),
      );
      const byHole = new Map<number, Partial<{ par: number | null; length_yards: number | null }>>();
      for (const row of acceptedRows) {
        if (row.field === "handicap") continue;
        const patch = byHole.get(row.hole_number) ?? {};
        if (row.field === "par") patch.par = row.provider;
        if (row.field === "yardage") patch.length_yards = row.provider;
        byHole.set(row.hole_number, patch);
      }
      const rows = Array.from(byHole.entries()).map(([hole_number, patch]) => ({
        course_map_id: mapId,
        hole_number,
        ...patch,
      }));
      if (rows.length > 0) {
        await supabase
          .from("gswing_mapped_holes")
          .upsert(rows, { onConflict: "course_map_id,hole_number" });
      }
      const name = course.club_name || course.course_name;
      toast.success(`Imported ${name} — opening Course Mapper`);
      onCourseMapCreated?.(mapId, name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
      setAdding(false);
    }
  };

  const openExistingInMapper = () => {
    if (!existingMapId || !course) return;
    setActiveCourseMapId(existingMapId);
    onCourseMapCreated?.(existingMapId, course.club_name || course.course_name);
  };

  const toggle = (key: string) => {
    setAccepted((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const importSelected = async () => {
    if (!course) return;
    const mapId = activeCourseMapId ?? (await ensureCourseMap(course).catch(() => null));
    if (!mapId) { toast.error("No G-Swing course to import into"); return; }
    const acceptedRows = diff.filter((d) => accepted.has(`${d.hole_number}:${d.field}`));
    if (acceptedRows.length === 0) { toast.info("Nothing selected"); return; }
    setImporting(true);
    // Apply per-hole, only par & length_yards (handicap not stored on mapped holes).
    const byHole = new Map<number, Partial<{ par: number | null; length_yards: number | null }>>();
    for (const row of acceptedRows) {
      if (row.field === "handicap") continue;
      const patch = byHole.get(row.hole_number) ?? {};
      if (row.field === "par") patch.par = row.provider;
      if (row.field === "yardage") patch.length_yards = row.provider;
      byHole.set(row.hole_number, patch);
    }
    try {
      // Upsert so missing holes are created with metadata (geometry can be
      // mapped later — the row needs to exist to attach distances to).
      const rows = Array.from(byHole.entries()).map(([hole_number, patch]) => ({
        course_map_id: mapId,
        hole_number,
        ...patch,
      }));
      if (rows.length > 0) {
        const { error: upErr } = await supabase
          .from("gswing_mapped_holes")
          .upsert(rows, { onConflict: "course_map_id,hole_number" });
        if (upErr) throw upErr;
      }
      await recordSyncHistory({
        courseMapId: mapId,
        provider: "GolfCourseAPI",
        externalId: course.external_id,
        changes: diff,
        accepted: acceptedRows,
        rejected: diff.filter((d) => !accepted.has(`${d.hole_number}:${d.field}`)),
      });
      toast.success(`Imported ${byHole.size} hole(s) successfully`);
      setAccepted(new Set());
      // Don't close — let user continue to mapper from the "linked" confirmation.
      setStage("linked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const continueToMapper = () => {
    if (activeCourseMapId && course) {
      onCourseMapCreated?.(activeCourseMapId, course.club_name || course.course_name);
    }
    onClose();
  };

  // Capability badge for a fetched course
  const capability = course
    ? course.holes.length > 0
      ? { tone: "emerald", label: "Premium Data", note: `${course.holes.length} hole(s) with par / yardage` }
      : { tone: "amber", label: "Basic Course Data", note: "Name & location only — manual mapping required" }
    : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center">
      <Card className="relative h-[95dvh] w-full max-w-3xl overflow-hidden border-gold/30 bg-emerald-950/95 p-0 sm:h-[85dvh] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-gold/20 px-4 py-3">
          <div className="flex items-center gap-2">
            {stage !== "search" && (
              <Button size="icon" variant="ghost" onClick={() => { setStage("search"); setCourse(null); }} className="h-7 w-7 text-gold/70 hover:text-gold">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold/70">
                {stage === "search" ? "Search · GolfCourseAPI" : stage === "details" ? "Course details" : "Linked"}
              </p>
              <h2 className="font-serif text-base text-gold">{course?.club_name || courseName || "GolfCourseAPI"}</h2>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="text-gold/70 hover:text-gold">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex h-full flex-col overflow-y-auto px-4 pb-32 pt-3">
          {/* ----------- SEARCH STAGE ----------- */}
          {stage === "search" && (<>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search GolfCourseAPI (club or course name)"
              className="h-9 border-gold/30 bg-black/40 text-sm"
            />
            <Button onClick={() => runSearch()} disabled={searching} size="sm" className="gap-1 bg-gold text-black hover:bg-gold/85">
              <Search className="h-3.5 w-3.5" /> {searching ? "…" : "Search"}
            </Button>
            <Button onClick={async () => { setSearching(true); try { setHits(await findSharjah()); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setSearching(false); } }} size="sm" variant="outline" className="border-gold/40 text-gold">
              Sharjah
            </Button>
          </div>

          {hits.length > 0 && (
            <div className="mt-3 space-y-2">
              {hits.map((h) => (
                <button
                  key={h.external_id}
                  type="button"
                  onClick={() => openDetails(h)}
                  disabled={loadingId === h.external_id}
                  className="flex w-full items-center justify-between rounded-md border border-gold/15 bg-black/40 px-3 py-2 text-left text-xs transition-colors hover:border-gold/40 hover:bg-black/60 disabled:opacity-60"
                >
                  <div>
                    <div className="font-medium text-foreground">{h.club_name}</div>
                    <div className="text-[10px] text-foreground/60">{h.course_name} · #{h.external_id}</div>
                    {h.address && <div className="text-[10px] text-foreground/40">{h.address}</div>}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-gold/80">
                    {loadingId === h.external_id ? "Loading…" : "View →"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {hits.length === 0 && (
            <div className="mt-8 flex flex-col items-center gap-2 text-center text-xs text-foreground/60">
              <AlertTriangle className="h-5 w-5 text-gold/70" />
              <p>Search for a course above, or use the Sharjah shortcut.</p>
              <p className="text-foreground/40">GolfCourseAPI provides metadata (par, tees, ratings). Geometry (greens, hazards) still comes from G-Swing mapping.</p>
            </div>
          )}
          </>)}

          {/* ----------- DETAILS STAGE ----------- */}
          {stage === "details" && course && capability && (
            <div className="space-y-4">
              {/* Capability badge */}
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                capability.tone === "emerald"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-200"
              }`}>
                <span className="text-base leading-none">{capability.tone === "emerald" ? "🟢" : "🟡"}</span>
                <div>
                  <div className="font-semibold">{capability.label}</div>
                  <div className="text-[10px] opacity-80">{capability.note}</div>
                </div>
                {existingMapId && (
                  <span className="ml-auto rounded-full border border-gold/40 bg-black/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-gold">
                    Already added
                  </span>
                )}
              </div>

              {/* Course information grid */}
              <div className="rounded-lg border border-gold/20 bg-black/40 p-3">
                <h3 className="font-serif text-sm text-gold">{course.club_name || "—"}</h3>
                <p className="text-[11px] text-foreground/70">{course.course_name || "—"}</p>
                <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-2">
                  <DetailRow icon={<Building2 className="h-3 w-3" />} label="Address" value={course.address} />
                  <DetailRow icon={<MapPin className="h-3 w-3" />} label="City" value={course.city} />
                  <DetailRow icon={<Globe2 className="h-3 w-3" />} label="Country" value={course.country} />
                  <DetailRow
                    icon={<Compass className="h-3 w-3" />}
                    label="GPS"
                    value={course.latitude != null && course.longitude != null
                      ? `${course.latitude.toFixed(5)}, ${course.longitude.toFixed(5)}`
                      : null}
                  />
                  <DetailRow icon={<Flag className="h-3 w-3" />} label="Holes" value={course.holes.length || null} />
                  <DetailRow icon={<Hash className="h-3 w-3" />} label="Provider ID" value={course.external_id} />
                </div>
              </div>

              {/* Tees */}
              {course.tees.length > 0 && (
                <div className="rounded-lg border border-gold/20 bg-black/40 p-3">
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-gold/70">Tee sets ({course.tees.length})</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead className="text-[9px] uppercase tracking-wider text-foreground/50">
                        <tr><th className="px-2 py-1 text-left">Tee</th><th className="px-2 py-1 text-right">Par</th><th className="px-2 py-1 text-right">Yds</th><th className="px-2 py-1 text-right">Rating</th><th className="px-2 py-1 text-right">Slope</th></tr>
                      </thead>
                      <tbody>
                        {course.tees.map((t, i) => (
                          <tr key={i} className="border-t border-gold/10">
                            <td className="px-2 py-1">{t.tee_name} <span className="text-foreground/40">({t.gender})</span></td>
                            <td className="px-2 py-1 text-right">{t.par_total ?? "—"}</td>
                            <td className="px-2 py-1 text-right">{t.total_yards ?? "—"}</td>
                            <td className="px-2 py-1 text-right">{t.course_rating ?? "—"}</td>
                            <td className="px-2 py-1 text-right">{t.slope_rating ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {course.tees.length === 0 && (
                <p className="text-[11px] italic text-foreground/40">Tee sets: not supplied by provider</p>
              )}

              {/* Holes preview when available */}
              {course.holes.length > 0 && (
                <div className="rounded-lg border border-gold/20 bg-black/40 p-3">
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-gold/70">Holes ({course.holes.length})</p>
                  <div className="grid grid-cols-9 gap-1 text-[10px]">
                    {course.holes.map((h) => (
                      <div key={h.hole_number} className="rounded border border-white/10 bg-black/40 p-1 text-center">
                        <div className="text-foreground/50">#{h.hole_number}</div>
                        <div className="text-gold">P{h.par ?? "—"}</div>
                        <div className="text-foreground/70">{h.yardage ?? "—"}y</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ----------- LINKED STAGE ----------- */}
          {stage === "linked" && course && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-100">
                <div className="flex items-center gap-2 font-semibold">
                  <Check className="h-4 w-4" /> Course added to G-Swing
                </div>
                <p className="mt-1 text-emerald-100/80">
                  {course.club_name} is now linked to GolfCourseAPI. You can continue mapping to unlock Premium GPS.
                </p>
              </div>

              {course.holes.length > 0 ? (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-gold/70">Hole metadata available — optional import</p>
                  <DiffTable diff={diff} accepted={accepted} toggle={toggle} />
                </>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-amber-300">
                    <AlertTriangle className="h-4 w-4" /> Provider has no hole-by-hole data
                  </div>
                  <p className="text-amber-100/80">
                    Continue mapping the course manually in Course Mapper to unlock Premium GPS.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Legacy unused branch removed */}
          {false && course && course.holes.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-[11px] uppercase tracking-wider text-gold/80">G-Swing vs GolfCourseAPI</Label>
                <span className="text-[10px] text-foreground/60">Provider: {course.club_name}</span>
              </div>
              <div className="overflow-x-auto rounded-md border border-gold/15">
                <table className="w-full min-w-[480px] text-xs">
                  <thead className="bg-black/40 text-[10px] uppercase tracking-wider text-foreground/60">
                    <tr>
                      <th className="px-2 py-1 text-left">Hole</th>
                      <th className="px-2 py-1 text-left">Field</th>
                      <th className="px-2 py-1 text-right">G-Swing</th>
                      <th className="px-2 py-1 text-right">Provider</th>
                      <th className="px-2 py-1 text-left">Status</th>
                      <th className="px-2 py-1 text-right">Accept</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.map((row) => {
                      const key = `${row.hole_number}:${row.field}`;
                      const isOn = accepted.has(key);
                      const canImport = row.field !== "handicap" && row.provider !== null && row.status !== "identical";
                      return (
                        <tr key={key} className="border-t border-gold/10">
                          <td className="px-2 py-1">{row.hole_number}</td>
                          <td className="px-2 py-1 uppercase tracking-wider text-[10px] text-foreground/70">{row.field}</td>
                          <td className="px-2 py-1 text-right">{row.gswing ?? "—"}</td>
                          <td className="px-2 py-1 text-right">{row.provider ?? "—"}</td>
                          <td className={`px-2 py-1 ${statusColor[row.status]}`}>{row.status}</td>
                          <td className="px-2 py-1 text-right">
                            {canImport ? (
                              <button
                                type="button"
                                onClick={() => toggle(key)}
                                className={`inline-flex h-5 w-5 items-center justify-center rounded border ${isOn ? "border-gold bg-gold text-black" : "border-gold/30 text-gold/40"}`}
                                aria-label="Accept"
                              >
                                {isOn ? <Check className="h-3 w-3" /> : null}
                              </button>
                            ) : (
                              <span className="text-[10px] text-foreground/30">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ----------- ACTION BAR ----------- */}
        {stage === "details" && course && (
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-gold/20 bg-black/85 px-4 py-3 backdrop-blur">
            {existingMapId ? (
              <Button onClick={openExistingInMapper} size="sm" className="gap-1 bg-gold text-black hover:bg-gold/85">
                Open Course
              </Button>
            ) : course.holes.length > 0 ? (
              <>
                <Button onClick={addCourseOnly} disabled={adding} size="sm" variant="outline" className="border-gold/40 text-gold">
                  {adding ? "Adding…" : "Add Course Only"}
                </Button>
                <Button onClick={addAndImport} disabled={adding || importing} size="sm" className="gap-1 bg-gold text-black hover:bg-gold/85">
                  <CloudDownload className="h-3.5 w-3.5" /> {adding || importing ? "Importing…" : "Import Course"}
                </Button>
              </>
            ) : (
              <Button onClick={addCourseOnly} disabled={adding} size="sm" className="gap-1 bg-gold text-black hover:bg-gold/85">
                {adding ? "Adding…" : "Add Course"}
              </Button>
            )}
          </div>
        )}

        {stage === "linked" && course && (
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-gold/20 bg-black/85 px-4 py-3 backdrop-blur">
            <div className="text-[10px] text-foreground/60">
              {course.holes.length > 0
                ? `${accepted.size} change(s) staged`
                : "Provider supplied basic data only"}
            </div>
            <div className="flex gap-2">
              {course.holes.length > 0 && (
                <Button onClick={importSelected} disabled={accepted.size === 0 || importing} size="sm" variant="outline" className="gap-1 border-gold/40 text-gold">
                  <CloudDownload className="h-3.5 w-3.5" /> {importing ? "Importing…" : "Import selected"}
                </Button>
              )}
              <Button onClick={continueToMapper} size="sm" className="bg-gold text-black hover:bg-gold/85">
                Open Course Mapper
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number | null | undefined }) {
  const supplied = value !== null && value !== undefined && value !== "";
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-gold/70">{icon}</span>
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wider text-foreground/50">{label}</div>
        <div className={supplied ? "text-foreground" : "italic text-foreground/40"}>
          {supplied ? String(value) : "Not supplied by provider"}
        </div>
      </div>
    </div>
  );
}

function DiffTable({ diff, accepted, toggle }: { diff: SyncDiffRow[]; accepted: Set<string>; toggle: (k: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-md border border-gold/15">
      <table className="w-full min-w-[480px] text-xs">
        <thead className="bg-black/40 text-[10px] uppercase tracking-wider text-foreground/60">
          <tr>
            <th className="px-2 py-1 text-left">Hole</th>
            <th className="px-2 py-1 text-left">Field</th>
            <th className="px-2 py-1 text-right">G-Swing</th>
            <th className="px-2 py-1 text-right">Provider</th>
            <th className="px-2 py-1 text-left">Status</th>
            <th className="px-2 py-1 text-right">Accept</th>
          </tr>
        </thead>
        <tbody>
          {diff.map((row) => {
            const key = `${row.hole_number}:${row.field}`;
            const isOn = accepted.has(key);
            const canImport = row.field !== "handicap" && row.provider !== null && row.status !== "identical";
            return (
              <tr key={key} className="border-t border-gold/10">
                <td className="px-2 py-1">{row.hole_number}</td>
                <td className="px-2 py-1 uppercase tracking-wider text-[10px] text-foreground/70">{row.field}</td>
                <td className="px-2 py-1 text-right">{row.gswing ?? "—"}</td>
                <td className="px-2 py-1 text-right">{row.provider ?? "—"}</td>
                <td className={`px-2 py-1 ${statusColor[row.status]}`}>{row.status}</td>
                <td className="px-2 py-1 text-right">
                  {canImport ? (
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className={`inline-flex h-5 w-5 items-center justify-center rounded border ${isOn ? "border-gold bg-gold text-black" : "border-gold/30 text-gold/40"}`}
                      aria-label="Accept"
                    >
                      {isOn ? <Check className="h-3 w-3" /> : null}
                    </button>
                  ) : (
                    <span className="text-[10px] text-foreground/30">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}