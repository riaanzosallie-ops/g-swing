import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { giClient, readCachedCourse, type GiCourseRow } from "@/lib/golfintel/client";
import { HoleSatelliteMap } from "@/components/gi/HoleSatelliteMap";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Database, Wifi, Loader2 } from "lucide-react";

type BadgeSource = "cache" | "live" | null;

function SourceBadge({ source }: { source: BadgeSource }) {
  if (!source) return null;
  const cached = source === "cache";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider " +
        (cached ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground")
      }
    >
      {cached ? <Database className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
      {cached ? "Cached" : "Live"}
    </span>
  );
}

export default function CourseDetail() {
  const { giCourseId = "" } = useParams();
  const [course, setCourse] = useState<GiCourseRow | null>(null);
  const [source, setSource] = useState<BadgeSource>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHole, setSelectedHole] = useState<number>(1);
  const [holeAsset, setHoleAsset] = useState<{ url: string | null; source: BadgeSource }>({
    url: null,
    source: null,
  });
  const [holeLoading, setHoleLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const cached = await readCachedCourse(giCourseId);
        if (cached && !cancelled) {
          setCourse(cached);
          setSource("cache");
        }
        // Always confirm live if no cache; otherwise skip credit spend.
        if (!cached) {
          const res = await giClient.courseDetail(giCourseId);
          if (cancelled) return;
          setCourse(res.course);
          setSource(res.source);
        }
      } catch (e: any) {
        toast({ title: "Could not load course", description: e?.message ?? "", variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [giCourseId]);

  const holes: any[] = Array.isArray(course?.gps)
    ? (course!.gps as any[])
    : Array.isArray((course?.gps as any)?.holes)
    ? (course!.gps as any).holes
    : [];

  const hole = holes.find((h) => (h.number ?? h.hole ?? h.holeNumber) === selectedHole) ?? holes[selectedHole - 1];

  const holeCenter: [number, number] | null = (() => {
    if (hole) {
      const lat = hole.green?.center?.lat ?? hole.green?.lat ?? hole.centerLat ?? hole.lat;
      const lng = hole.green?.center?.lng ?? hole.green?.lng ?? hole.centerLng ?? hole.lng;
      if (typeof lat === "number" && typeof lng === "number") return [lng, lat];
    }
    if (course?.latitude != null && course?.longitude != null) {
      return [course.longitude, course.latitude];
    }
    return null;
  })();

  async function loadHoleAsset(kind: "green_slope" | "elevation") {
    setHoleLoading(true);
    try {
      const res = await giClient.holeAsset(giCourseId, selectedHole, kind);
      setHoleAsset({ url: res.url, source: res.source });
    } catch (e: any) {
      toast({ title: "Asset unavailable", description: e?.message ?? "", variant: "destructive" });
    } finally {
      setHoleLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link to="/courses" className="text-sm text-gold/70">← Courses</Link>
        <p className="mt-4 text-muted-foreground">Course not found.</p>
      </div>
    );
  }

  const holeCount = holes.length || (course.detail as any)?.holeCount || 18;

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 pb-24">
      <Link to="/courses" className="text-sm text-gold/70 hover:text-gold">← Courses</Link>

      <header className="mt-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl text-gradient-gold">{course.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[course.city, course.state, course.country].filter(Boolean).join(", ")}
          </p>
        </div>
        <SourceBadge source={source} />
      </header>

      <section className="mt-5 rounded-xl border border-gold/15 bg-background/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Holes</h2>
          <span className="text-xs text-muted-foreground">{holeCount} total</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: holeCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => {
                setSelectedHole(n);
                setHoleAsset({ url: null, source: null });
              }}
              className={
                "h-9 w-9 rounded-lg text-sm font-medium transition-colors " +
                (selectedHole === n
                  ? "bg-gold text-background"
                  : "bg-muted/40 text-foreground hover:bg-muted")
              }
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg">Hole {selectedHole}</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={holeLoading} onClick={() => loadHoleAsset("green_slope")}>
              Green slope
            </Button>
            <Button size="sm" variant="outline" disabled={holeLoading} onClick={() => loadHoleAsset("elevation")}>
              Elevation
            </Button>
          </div>
        </div>

        {holeCenter ? (
          <HoleSatelliteMap center={holeCenter} zoom={17} />
        ) : (
          <div className="rounded-xl border border-gold/15 bg-background/40 p-6 text-sm text-muted-foreground">
            No coordinates available for this hole yet.
          </div>
        )}

        {holeAsset.url && (
          <div className="overflow-hidden rounded-xl border border-gold/15 bg-background/60">
            <div className="flex items-center justify-between border-b border-gold/10 px-3 py-2 text-xs text-muted-foreground">
              <span>Rendered asset</span>
              <SourceBadge source={holeAsset.source} />
            </div>
            <img src={holeAsset.url} alt={`Hole ${selectedHole} asset`} className="w-full" />
          </div>
        )}
      </section>

      {course.scorecard != null && (
        <section className="mt-6 rounded-xl border border-gold/15 bg-background/60 p-4">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">Scorecard</h2>
          <pre className="max-h-64 overflow-auto rounded-lg bg-background/40 p-3 text-[11px]">
{JSON.stringify(course.scorecard, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}