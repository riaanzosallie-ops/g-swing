// G-Swing → Settings → Golf API
// Owner / admin only. Single control panel for the sole course-data
// provider (GolfAPI.io). All requests go through the `golf-api` Edge
// Function; the API key never touches the browser.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity, CheckCircle2, CloudDownload, Database, Loader2, RefreshCw,
  Search, ShieldAlert, Trash2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useGswingAdmin } from "@/lib/use-gswing-admin";
import {
  deleteCachedCourse, getCoordinates, getCourse, listCachedCourses, ping,
  recentLogs, searchClubs, stats, type CachedCourseSummary,
  type GolfApiClubHit, type LogRow,
} from "@/lib/golfapi/client";

type Status = "unknown" | "ok" | "error" | "checking";

export default function GolfApiSettingsPage() {
  const admin = useGswingAdmin();

  const [health, setHealth] = useState<Status>("unknown");
  const [apiLeft, setApiLeft] = useState<string | null>(null);
  const [healthMsg, setHealthMsg] = useState<string | null>(null);

  const [cacheStats, setCacheStats] = useState<{ clubs: number; courses: number; coordinates: number } | null>(null);
  const [cached, setCached] = useState<CachedCourseSummary[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadingCache, setLoadingCache] = useState(false);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GolfApiClubHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [rawResponse, setRawResponse] = useState<unknown>(null);

  const refreshAll = useCallback(async () => {
    setLoadingCache(true);
    try {
      const [s, list, l] = await Promise.all([stats(), listCachedCourses(), recentLogs()]);
      setCacheStats(s);
      setCached(list);
      setLogs(l);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load cache");
    } finally {
      setLoadingCache(false);
    }
  }, []);

  useEffect(() => {
    if (admin.status === "admin") void refreshAll();
  }, [admin.status, refreshAll]);

  const runHealth = async () => {
    setHealth("checking");
    setHealthMsg(null);
    try {
      const r = await ping();
      if (r.ok) {
        setHealth("ok");
        setApiLeft(r.apiRequestsLeft);
      } else {
        setHealth("error");
        setHealthMsg(r.error ?? `HTTP ${r.status}`);
      }
    } catch (e) {
      setHealth("error");
      setHealthMsg(e instanceof Error ? e.message : "Unknown error");
    }
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const r = await searchClubs({ name: q });
      setApiLeft(r.apiRequestsLeft);
      setSearchResults(r.clubs);
      setRawResponse(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const syncCourse = async (courseId: string, force = true) => {
    try {
      const c = await getCourse(courseId, { force });
      // Also pull GPS coordinates if the course has them.
      if (c.hasGPS) {
        try { await getCoordinates(courseId, { force: true }); } catch { /* soft */ }
      }
      toast.success(`Synced ${c.courseName}`);
      setRawResponse(c.raw);
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    }
  };

  const syncAll = async () => {
    if (!cached.length) return;
    toast.info(`Refreshing ${cached.length} cached courses…`);
    for (const c of cached) {
      try { await getCourse(c.courseID, { force: true }); } catch { /* keep going */ }
    }
    toast.success("Cache refresh complete");
    await refreshAll();
  };

  const deleteOne = async (courseId: string) => {
    if (!window.confirm("Delete this cached course? It will be re-fetched next time it is loaded.")) return;
    try {
      await deleteCachedCourse(courseId);
      toast.success("Deleted from cache");
      await refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const lastSync = useMemo(() => {
    const times = cached.map((c) => c.cachedAt).filter(Boolean) as string[];
    if (!times.length) return null;
    return times.sort().reverse()[0];
  }, [cached]);

  if (admin.status === "loading") {
    return <div className="p-6 text-sm text-foreground/70">Loading…</div>;
  }
  if (admin.status !== "admin") {
    return (
      <div className="mx-auto max-w-md p-4">
        <Card className="border-red-500/30 bg-red-950/30 p-6 text-sm text-red-100">
          <div className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" /> Owner / admin only</div>
          <p className="mt-1 text-red-200/80">Golf API settings are restricted.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-24 text-white">
      <header className="rounded-2xl border border-gold/25 bg-emerald-950/40 p-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold/80">Settings · G-Swing Ops</p>
        <h1 className="font-serif text-2xl text-gold">Golf API</h1>
        <p className="mt-1 text-xs text-foreground/70">
          GolfAPI.io is the sole course-data provider. Requests are proxied
          through the <code className="rounded bg-black/40 px-1">golf-api</code> Edge Function.
          The API key is stored in Supabase Secrets and is never exposed to the browser.
        </p>
      </header>

      {/* Connection status */}
      <Card className="border-gold/20 bg-black/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {health === "ok" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
            {health === "error" && <XCircle className="h-5 w-5 text-red-400" />}
            {health === "checking" && <Loader2 className="h-5 w-5 animate-spin text-gold" />}
            {health === "unknown" && <Activity className="h-5 w-5 text-foreground/60" />}
            <div>
              <p className="font-semibold text-gold">
                {health === "ok" ? "Connected" : health === "error" ? "Not connected" : health === "checking" ? "Checking…" : "Unknown"}
              </p>
              <p className="text-[11px] text-foreground/60">
                {apiLeft !== null ? `${apiLeft} API requests remaining` : "Test connection to see credit balance."}
                {healthMsg ? ` · ${healthMsg}` : ""}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={runHealth} className="bg-gold text-black hover:bg-gold/85">Test connection</Button>
        </div>
        {lastSync && (
          <p className="mt-2 text-[11px] text-foreground/60">Last cache write: {new Date(lastSync).toLocaleString()}</p>
        )}
      </Card>

      {/* Cache stats */}
      <Card className="border-gold/20 bg-black/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-gold">Cache</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={refreshAll} disabled={loadingCache} className="gap-1 border-gold/40 text-gold">
              <RefreshCw className={`h-3.5 w-3.5 ${loadingCache ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={syncAll} disabled={!cached.length} className="gap-1 bg-gold text-black hover:bg-gold/85">
              <CloudDownload className="h-3.5 w-3.5" /> Sync all
            </Button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Clubs" value={cacheStats?.clubs ?? "—"} />
          <Stat label="Courses" value={cacheStats?.courses ?? "—"} />
          <Stat label="Coordinates" value={cacheStats?.coordinates ?? "—"} />
        </div>
      </Card>

      {/* Search */}
      <Card className="border-gold/20 bg-black/40 p-4">
        <h2 className="mb-2 font-serif text-lg text-gold">Search course</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Pebble Beach, Dubai Creek…"
              onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }}
              className="h-10 border-gold/30 bg-black/60 pl-8 text-sm"
            />
          </div>
          <Button onClick={runSearch} disabled={searching} className="bg-gold text-black hover:bg-gold/85">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>
        {searchResults && (
          <div className="mt-3 space-y-2">
            {searchResults.length === 0 && <p className="text-xs text-foreground/60">No clubs found.</p>}
            {searchResults.map((club) => (
              <div key={club.clubID} className="rounded-lg border border-gold/15 bg-emerald-950/30 p-3">
                <p className="font-semibold text-gold">{club.clubName}</p>
                <p className="text-[11px] text-foreground/60">
                  {[club.city, club.state, club.country].filter(Boolean).join(", ") || "Location unknown"}
                </p>
                <div className="mt-2 space-y-1">
                  {club.courses.map((c) => (
                    <div key={c.courseID} className="flex items-center justify-between gap-2 rounded bg-black/40 px-2 py-1.5 text-xs">
                      <div>
                        <p className="text-foreground">{c.courseName}</p>
                        <p className="text-[10px] text-foreground/50">
                          {c.numHoles} holes · {c.hasGPS ? "GPS available" : "No GPS"} · #{c.courseID}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => void syncCourse(c.courseID)} className="h-7 bg-gold text-black hover:bg-gold/85">
                        Sync
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Cached courses */}
      <Card className="border-gold/20 bg-black/40 p-4">
        <h2 className="mb-2 flex items-center gap-2 font-serif text-lg text-gold">
          <Database className="h-4 w-4" /> Cached courses ({cached.length})
        </h2>
        {cached.length === 0 && <p className="text-xs text-foreground/60">Nothing cached yet. Search above to sync a course.</p>}
        <div className="space-y-1.5">
          {cached.map((c) => (
            <div key={c.courseID} className="flex items-center justify-between gap-2 rounded border border-gold/10 bg-emerald-950/30 px-3 py-2 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gold">{c.courseName}</p>
                <p className="truncate text-[10px] text-foreground/60">
                  {c.clubName || "—"} · {[c.city, c.country].filter(Boolean).join(", ") || "—"} · {c.numHoles} holes
                  {c.hasCoordinates ? " · GPS ✓" : c.hasGPS ? " · GPS pending" : ""}
                  {c.cachedAt ? ` · cached ${new Date(c.cachedAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void syncCourse(c.courseID)} className="h-7 border-gold/40 text-gold">
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void deleteOne(c.courseID)} className="h-7 text-red-300 hover:bg-red-500/10">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Raw response viewer */}
      {rawResponse != null && (
        <Card className="border-gold/20 bg-black/60 p-4">
          <h2 className="mb-2 font-serif text-lg text-gold">Last API response</h2>
          <pre className="max-h-72 overflow-auto rounded bg-black/60 p-2 text-[10px] leading-relaxed text-emerald-200">
{JSON.stringify(rawResponse, null, 2)}
          </pre>
        </Card>
      )}

      {/* Logs */}
      <Card className="border-gold/20 bg-black/40 p-4">
        <h2 className="mb-2 font-serif text-lg text-gold">Recent requests</h2>
        <div className="space-y-1 text-[11px]">
          {logs.length === 0 && <p className="text-foreground/60">No requests yet.</p>}
          {logs.map((l) => (
            <div key={l.id} className="flex items-center gap-2 rounded border border-white/5 bg-black/40 px-2 py-1">
              <span className={l.error ? "text-red-400" : "text-emerald-300"}>{l.status || "ERR"}</span>
              <span className="text-foreground/80">{l.endpoint}</span>
              <span className="ml-auto text-foreground/50">{l.latency_ms}ms</span>
              <span className="text-foreground/40">{new Date(l.created_at).toLocaleTimeString()}</span>
              {l.error && <span className="w-full pl-6 text-red-300/80">{l.error}</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-gold/10 bg-black/30 p-2">
      <p className="text-lg font-semibold text-gold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-foreground/60">{label}</p>
    </div>
  );
}