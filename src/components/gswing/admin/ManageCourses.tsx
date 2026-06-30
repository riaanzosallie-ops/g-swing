// Central Course Management dashboard.
// One screen to see every G-Swing course, its mapping progress, provider
// status, and to jump straight into Course Mapper, Live GPS, re-sync, or
// delete. Owner / admin only.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, MapPin, Flag, RefreshCw, Trash2, Map as MapIcon, Edit3, Plus,
  CloudDownload, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useGswingAdmin } from "@/lib/use-gswing-admin";
import {
  listCoursesWithStatus,
  deleteCourse,
  toneClasses,
  type CourseSummary,
  type CourseStatus,
} from "@/lib/gswing-course-status";

const FILTERS: Array<{ id: CourseStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "premium_ready", label: "Premium" },
  { id: "fully_mapped", label: "Mapped" },
  { id: "partially_mapped", label: "In-progress" },
  { id: "added", label: "Not mapped" },
];

export default function ManageCourses({ go }: { go?: (view: string) => void }) {
  const admin = useGswingAdmin();
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CourseStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await listCoursesWithStatus();
      setCourses(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load courses");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!courses) return [];
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (filter !== "all" && c.statusInfo.status !== filter) return false;
      if (!q) return true;
      return (
        c.course_name.toLowerCase().includes(q) ||
        (c.location_label ?? "").toLowerCase().includes(q) ||
        (c.external_provider ?? "").toLowerCase().includes(q)
      );
    });
  }, [courses, query, filter]);

  const openMapper = (id: string, hole = 1) => {
    const url = `/gswing-course-mapper?courseMapId=${encodeURIComponent(id)}&hole=${hole}`;
    window.location.href = url;
  };
  const openMapperNew = () => {
    window.location.href = "/gswing-course-mapper";
  };
  const openGps = () => {
    if (go) go("gps");
    else window.location.href = "/?view=gps";
  };

  const onDelete = async (c: CourseSummary) => {
    if (!window.confirm(`Delete "${c.course_name}"? This removes all mapped holes and features.`)) return;
    try {
      await deleteCourse(c.id);
      toast.success("Course deleted");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (admin.status === "loading") {
    return <div className="p-6 text-sm text-foreground/70">Loading…</div>;
  }
  if (admin.status !== "admin") {
    return (
      <Card className="m-4 border-red-500/30 bg-red-950/30 p-6 text-sm text-red-100">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="h-4 w-4" /> Owner / admin only
        </div>
        <p className="mt-1 text-red-200/80">
          Manage Courses is restricted to the G-Swing operations team.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      <header className="rounded-2xl border border-gold/25 bg-emerald-950/40 p-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">G-Swing · Course Operations</p>
        <h1 className="font-serif text-xl text-gold">Manage Courses</h1>
        <p className="mt-1 text-xs text-foreground/70">
          Central hub for every mapped course. Track progress, re-sync providers,
          and jump straight into mapping or Live GPS.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={openMapperNew} className="gap-1 bg-gold text-black hover:bg-gold/85">
            <Plus className="h-3.5 w-3.5" /> New course
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={refreshing} className="gap-1 border-gold/40 text-gold">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={openGps} className="gap-1 border-gold/40 text-gold">
            <MapPin className="h-3.5 w-3.5" /> Live GPS
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by course, location or provider"
            className="h-9 border-gold/25 bg-black/40 pl-7 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                filter === f.id
                  ? "border-gold bg-gold text-black"
                  : "border-gold/25 text-gold/80 hover:bg-gold/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-950/30 p-3 text-xs text-red-100">{error}</Card>
      )}

      {courses === null && (
        <div className="py-8 text-center text-xs text-foreground/60">Loading courses…</div>
      )}

      {courses && filtered.length === 0 && (
        <Card className="border-gold/20 bg-black/40 p-6 text-center text-xs text-foreground/70">
          {courses.length === 0
            ? "No courses yet. Add one via the GolfCourseAPI search inside Course Mapper, or start a manual map."
            : "No courses match this filter."}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-2">
        {filtered.map((c) => {
          const s = c.statusInfo;
          const lastSyncLabel = c.last_synced
            ? new Date(c.last_synced).toLocaleDateString()
            : "Never";
          const lastUpdateLabel = new Date(c.updated_at).toLocaleDateString();
          return (
            <Card key={c.id} className="border-gold/15 bg-emerald-950/30 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-serif text-base text-gold">{c.course_name}</h3>
                  <p className="truncate text-[11px] text-foreground/70">
                    {c.location_label || "Location not supplied"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider ${toneClasses(s.tone)}`}>
                      {s.label}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-foreground/70">
                      <Flag className="mr-1 inline h-3 w-3" />{s.progressLabel}
                    </span>
                    {c.external_provider && (
                      <span className="rounded-full border border-gold/30 bg-black/40 px-2 py-0.5 text-gold/80">
                        {c.external_provider}{c.external_course_id ? ` · #${c.external_course_id}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-foreground/60">
                <span><span className="text-gold/70">Premium</span> {s.premiumHoles}/{s.holesTotal}</span>
                <span><span className="text-gold/70">Updated</span> {lastUpdateLabel}</span>
                <span><span className="text-gold/70">Synced</span> {lastSyncLabel}</span>
                <span><span className="text-gold/70">Coords</span> {c.latitude.toFixed(3)}, {c.longitude.toFixed(3)}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button size="sm" onClick={() => openMapper(c.id, 1)} className="h-7 gap-1 bg-gold text-black hover:bg-gold/85">
                  <Edit3 className="h-3 w-3" />
                  {s.status === "added" ? "Begin Mapping" : "Continue Mapping"}
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={openGps}
                  className="h-7 gap-1 border-gold/40 text-gold"
                >
                  <MapIcon className="h-3 w-3" /> Live GPS
                </Button>
                {c.external_provider === "GolfCourseAPI" && (
                  <Button
                    size="sm" variant="outline"
                    onClick={() => openMapper(c.id, 1)}
                    className="h-7 gap-1 border-gold/40 text-gold/90"
                    title="Re-sync inside Course Mapper"
                  >
                    <CloudDownload className="h-3 w-3" /> Re-sync
                  </Button>
                )}
                <Button
                  size="sm" variant="ghost"
                  onClick={() => onDelete(c)}
                  className="h-7 gap-1 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}