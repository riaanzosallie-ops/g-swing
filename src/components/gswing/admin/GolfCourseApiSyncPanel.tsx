// Owner-only "Sync GolfCourseAPI" panel.
// Search a course, link it to the current G-Swing course map, show a
// hole-by-hole diff, and let the owner accept/reject/import per hole.
// Nothing is ever auto-written — every import is explicit.

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Search, CloudDownload, Link2, Check, AlertTriangle } from "lucide-react";
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

  useEffect(() => { setActiveCourseMapId(courseMapId); }, [courseMapId]);

  useEffect(() => { if (isOpen) setQuery(courseName || ""); }, [isOpen, courseName]);

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

  const loadAndLink = async (hit: NormalisedSearchHit) => {
    setLoadingId(hit.external_id);
    try {
      const c = await getCourse(hit.external_id);
      setCourse(c);
      const mapId = await ensureCourseMap(c);
      await linkCourseToProvider({
        courseMapId: mapId,
        provider: "GolfCourseAPI",
        externalId: hit.external_id,
      });
      // Pre-select every importable row so the user can hit Import immediately.
      const preselect = new Set<string>();
      for (const h of c.holes) {
        if (h.par !== null && h.par !== undefined) preselect.add(`${h.hole_number}:par`);
        if (h.yardage !== null && h.yardage !== undefined) preselect.add(`${h.hole_number}:yardage`);
      }
      setAccepted(preselect);
      if (c.holes.length === 0) {
        toast.success(`Linked ${c.club_name} — provider has no hole metadata; map manually.`);
      } else {
        toast.success(`Linked ${c.club_name} — ${c.holes.length} holes ready to import`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingId(null);
    }
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
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center">
      <Card className="relative h-[95dvh] w-full max-w-3xl overflow-hidden border-gold/30 bg-emerald-950/95 p-0 sm:h-[85dvh] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-gold/20 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gold/70">Sync · GolfCourseAPI</p>
            <h2 className="font-serif text-base text-gold">{courseName || "Course"}</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="text-gold/70 hover:text-gold">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex h-full flex-col overflow-y-auto px-4 pb-32 pt-3">
          {/* Search */}
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

          {/* Hits */}
          {hits.length > 0 && (
            <div className="mt-3 space-y-2">
              {hits.map((h) => (
                <div key={h.external_id} className="flex items-center justify-between rounded-md border border-gold/15 bg-black/40 px-3 py-2 text-xs">
                  <div>
                    <div className="font-medium text-foreground">{h.club_name}</div>
                    <div className="text-[10px] text-foreground/60">{h.course_name} · #{h.external_id}</div>
                    {h.address && <div className="text-[10px] text-foreground/40">{h.address}</div>}
                  </div>
                  <Button size="sm" variant="outline" disabled={loadingId === h.external_id} onClick={() => loadAndLink(h)} className="h-7 gap-1 border-gold/40 text-gold">
                    <Link2 className="h-3 w-3" /> {loadingId === h.external_id ? "…" : "Link"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Diff */}
          {course && course.holes.length > 0 && (
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

          {course && course.holes.length === 0 && (
            <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-100">
              <div className="mb-1 flex items-center gap-2 font-semibold text-amber-300">
                <AlertTriangle className="h-4 w-4" /> No hole metadata available
              </div>
              <p className="text-amber-100/80">
                This provider does not supply hole metadata for this course. The G-Swing course has been
                created — you can map it manually in the Course Mapper.
              </p>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={onClose} className="bg-gold text-black hover:bg-gold/85">
                  Continue to mapping
                </Button>
              </div>
            </div>
          )}

          {!course && hits.length === 0 && (
            <div className="mt-8 flex flex-col items-center gap-2 text-center text-xs text-foreground/60">
              <AlertTriangle className="h-5 w-5 text-gold/70" />
              <p>Search for a course above, or use the Sharjah shortcut.</p>
              <p className="text-foreground/40">GolfCourseAPI provides metadata (par, tees, ratings). Geometry (greens, hazards) still comes from G-Swing mapping.</p>
            </div>
          )}
        </div>

        {course && course.holes.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 border-t border-gold/20 bg-black/85 px-4 py-3 backdrop-blur">
            <div className="text-[10px] text-foreground/60">
              {accepted.size} change(s) staged · Nothing was modified automatically.
            </div>
            <Button onClick={importSelected} disabled={accepted.size === 0 || importing} size="sm" className="gap-1 bg-gold text-black hover:bg-gold/85">
              <CloudDownload className="h-3.5 w-3.5" /> {importing ? "Importing…" : "Import selected"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}