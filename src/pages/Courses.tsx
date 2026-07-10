import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Database, Wifi } from "lucide-react";
import { giClient, readCachedCourseIds, type GiSearchResult } from "@/lib/golfintel/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export default function Courses() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState<Set<string>>(new Set());
  const timer = useRef<number | null>(null);

  useEffect(() => {
    void readCachedCourseIds().then(setCached);
  }, []);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const { results } = await giClient.search(query.trim());
        setResults(results);
      } catch (e: any) {
        toast({ title: "Search failed", description: e?.message ?? "Try again", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [query]);

  const sorted = useMemo(
    () =>
      [...results].sort((a, b) => Number(cached.has(b.giCourseId)) - Number(cached.has(a.giCourseId))),
    [results, cached],
  );

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6">
      <header className="mb-6">
        <Link to="/" className="text-sm text-gold/70 hover:text-gold">← Home</Link>
        <h1 className="mt-2 font-serif text-3xl text-gradient-gold">Courses</h1>
        <p className="text-sm text-muted-foreground">
          Powered by GolfIntelligence · cached lookups are free
        </p>
      </header>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search course name, city, or country"
          className="pl-9"
        />
      </div>

      {loading && <div className="py-8 text-center text-sm text-muted-foreground">Searching…</div>}

      {!loading && query.length >= 2 && sorted.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">No matches</div>
      )}

      <ul className="space-y-2">
        {sorted.map((r) => {
          const isCached = cached.has(r.giCourseId);
          return (
            <li key={r.giCourseId}>
              <Link
                to={`/courses/${encodeURIComponent(r.giCourseId)}`}
                className="flex items-center justify-between rounded-xl border border-gold/15 bg-background/60 p-4 transition-colors hover:border-gold/40"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {[r.city, r.state, r.country].filter(Boolean).join(", ") || "Location unknown"}
                    {r.holes ? ` · ${r.holes} holes` : ""}
                  </div>
                </div>
                <span
                  className={
                    "ml-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider " +
                    (isCached
                      ? "bg-gold/15 text-gold"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {isCached ? <Database className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
                  {isCached ? "Cached" : "Live"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {results.length === 0 && !loading && query.length < 2 && (
        <div className="rounded-xl border border-gold/15 bg-background/40 p-6 text-sm text-muted-foreground">
          Type at least 2 characters to search. Results already loaded on this device show a{" "}
          <span className="text-gold">Cached</span> badge and open without spending credits.
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button asChild variant="ghost" size="sm">
          <Link to="/courses/credits">View credit usage</Link>
        </Button>
      </div>
    </div>
  );
}