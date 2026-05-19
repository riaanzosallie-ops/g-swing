import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Flag,
  Footprints,
  Locate,
  LocateOff,
  MapPin,
  Navigation,
  Play,
  Radio,
  Target,
} from "lucide-react";
import { useBag } from "@/lib/gswing-store";
import {
  endShot,
  fetchCourses,
  fetchHoleGps,
  fetchNearestCourse,
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

const DEMO_COURSE_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_POSITION: LatLng = { lat: 25.0936, lng: 55.1545 };

const DEMO_COURSES: GolfCourse[] = [
  {
    id: DEMO_COURSE_ID,
    name: "Emirates Golf Club - Majlis",
    city: "Dubai",
    country: "AE",
    lat: 25.0911,
    lng: 55.1572,
    holes_count: 18,
    par: 72,
    website: null,
    timezone: "Asia/Dubai",
    created_at: new Date().toISOString(),
  },
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

function initials(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
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
    x: 110 + ((point.lng - minLng) / lngRange) * 780,
    y: 72 + (1 - (point.lat - minLat) / latRange) * 416,
  });
}

function polygonPath(points: DisplayPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function CourseSketch({
  gps,
  playerPosition,
}: {
  gps: HoleGpsResponse | null;
  playerPosition: LatLng | null;
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
  const teePoint = tee ? project(tee) : { x: 500, y: 480 };
  const pinPoint = pin ? project(pin) : { x: 500, y: 150 };
  const playerPoint = playerPosition ? project(playerPosition) : null;

  const greenPolygon = green?.polygon?.coordinates?.[0]?.map(([lng, lat]) => project({ lat, lng })) ?? [];
  const frontPoint = front ? project(front) : null;
  const backPoint = back ? project(back) : null;

  const fairwayPath = `M ${teePoint.x} ${teePoint.y} C ${teePoint.x - 110} ${(teePoint.y + pinPoint.y) / 2}, ${
    pinPoint.x + 120
  } ${(teePoint.y + pinPoint.y) / 2}, ${pinPoint.x} ${pinPoint.y}`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-[radial-gradient(circle_at_50%_35%,hsl(150_45%_17%),hsl(150_40%_7%)_58%,hsl(150_42%_4%))] shadow-elegant">
      <svg viewBox="0 0 1000 560" className="block h-[42vh] min-h-[330px] w-full">
        <defs>
          <filter id="gpsGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="fairway" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0%" stopColor="hsl(153 45% 22%)" />
            <stop offset="100%" stopColor="hsl(139 45% 42%)" />
          </linearGradient>
        </defs>

        <rect width="1000" height="560" fill="hsl(150 36% 8%)" />
        <path d={fairwayPath} stroke="url(#fairway)" strokeWidth="120" strokeLinecap="round" fill="none" opacity="0.72" />
        <path d={fairwayPath} stroke="hsl(130 45% 42% / 0.55)" strokeWidth="72" strokeLinecap="round" fill="none" />

        {hazards.map((hazard, index) => {
          const location = hazard.lat && hazard.lng ? project({ lat: hazard.lat, lng: hazard.lng }) : null;
          if (!location) return null;
          const isWater = hazard.type === "water";
          return (
            <g key={`${hazard.type}-${hazard.label ?? index}`} opacity="0.95">
              <ellipse
                cx={location.x}
                cy={location.y}
                rx={isWater ? 82 : 46}
                ry={isWater ? 54 : 31}
                fill={isWater ? "hsl(205 72% 76% / 0.9)" : "hsl(42 55% 80% / 0.9)"}
                stroke={isWater ? "hsl(215 95% 92%)" : "hsl(42 65% 90%)"}
                strokeWidth="4"
              />
              <text x={location.x} y={location.y + 5} textAnchor="middle" fontSize="20" fill="hsl(150 30% 8%)">
                {hazard.type.toUpperCase()}
              </text>
            </g>
          );
        })}

        {greenPolygon.length >= 3 ? (
          <polygon
            points={polygonPath(greenPolygon)}
            fill="hsl(143 58% 70%)"
            stroke="hsl(151 62% 34%)"
            strokeWidth="7"
            filter="url(#gpsGlow)"
          />
        ) : (
          <ellipse
            cx={pinPoint.x}
            cy={pinPoint.y}
            rx="148"
            ry="88"
            fill="hsl(143 58% 70%)"
            stroke="hsl(151 62% 34%)"
            strokeWidth="7"
            filter="url(#gpsGlow)"
          />
        )}

        {backPoint && (
          <g>
            <rect x={backPoint.x - 31} y={backPoint.y - 54} width="62" height="34" rx="6" fill="hsl(45 35% 94%)" />
            <text x={backPoint.x} y={backPoint.y - 30} textAnchor="middle" fontSize="25" fill="hsl(150 35% 10%)">
              {gps?.distances?.to_back_of_green ?? ""}
            </text>
          </g>
        )}

        {frontPoint && (
          <g>
            <rect x={frontPoint.x - 31} y={frontPoint.y + 20} width="62" height="34" rx="6" fill="hsl(45 35% 94%)" />
            <text x={frontPoint.x} y={frontPoint.y + 45} textAnchor="middle" fontSize="25" fill="hsl(150 35% 10%)">
              {gps?.distances?.to_front_of_green ?? ""}
            </text>
          </g>
        )}

        <g transform={`translate(${teePoint.x},${teePoint.y})`}>
          <circle r="16" fill="hsl(45 80% 58%)" stroke="hsl(150 35% 8%)" strokeWidth="5" />
          <text y="38" textAnchor="middle" fontSize="18" fill="hsl(45 35% 92%)">TEE</text>
        </g>

        <g transform={`translate(${pinPoint.x},${pinPoint.y})`}>
          <line x1="0" y1="-58" x2="0" y2="0" stroke="hsl(150 35% 8%)" strokeWidth="5" />
          <path d="M0 -58 L42 -43 L0 -28 Z" fill="hsl(45 80% 58%)" stroke="hsl(150 35% 8%)" strokeWidth="3" />
          <circle r="16" fill="hsl(45 35% 94%)" stroke="hsl(150 35% 8%)" strokeWidth="5" />
          <path d="M-16 0H16M0 -16V16" stroke="hsl(150 35% 8%)" strokeWidth="3" />
        </g>

        {playerPoint && (
          <g transform={`translate(${playerPoint.x},${playerPoint.y})`}>
            <circle r="21" fill="hsl(150 70% 48%)" opacity="0.24" />
            <circle r="11" fill="hsl(45 35% 95%)" stroke="hsl(150 70% 42%)" strokeWidth="5" />
            <text y="39" textAnchor="middle" fontSize="18" fill="hsl(45 35% 92%)">YOU</text>
          </g>
        )}
      </svg>

      <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-background/80 px-3 py-1.5 text-xs backdrop-blur">
        <span className="font-semibold text-gold">Hole {gps?.hole_number ?? "-"}</span>
        <span className="text-muted-foreground"> · Par {gps?.par ?? "-"}</span>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-xl bg-background/80 px-3 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
        Backend GPS geometry
      </div>
    </div>
  );
}

export const GpsMap = () => {
  const [courses, setCourses] = useState<GolfCourse[]>(DEMO_COURSES);
  const [courseId, setCourseId] = useState(DEMO_COURSE_ID);
  const [hole, setHole] = useState(1);
  const [unit, setUnit] = useState<"yards" | "meters">("yards");
  const [playerPos, setPlayerPos] = useState<LatLng | null>(DEFAULT_POSITION);
  const [gps, setGps] = useState<HoleGpsResponse | null>(null);
  const [activeRound, setActiveRound] = useState<ActiveRound | null>(null);
  const [activeShot, setActiveShot] = useState<Shot | null>(null);
  const [lastShotYards, setLastShotYards] = useState<number | null>(null);
  const [liveTracking, setLiveTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [bag] = useBag();

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId) ?? courses[0] ?? DEMO_COURSES[0],
    [courseId, courses],
  );

  const displayUnit = unitLabel(unit);
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
      const data = await fetchHoleGps(courseId, hole, {
        unit,
        playerPos: playerPos ?? undefined,
      });
      setGps(data);
    } catch (error) {
      setGps(null);
      setGpsError(error instanceof Error ? error.message : "Could not load GPS hole data.");
    } finally {
      setLoading(false);
    }
  }, [courseId, hole, playerPos, unit]);

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      try {
        const data = await fetchCourses();
        if (cancelled || !data.length) return;
        setCourses(data);
        setCourseId((current) => (data.some((course) => course.id === current) ? current : data[0].id));
      } catch {
        if (!cancelled) setCourses(DEMO_COURSES);
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
      setGpsError(error instanceof Error ? error.message : "Could not start GPS round.");
    } finally {
      setSyncing(false);
    }
  };

  const pushPlayerLocation = async (position: LatLng) => {
    setPlayerPos(position);
    if (!activeRound) return;

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
        setPlayerPos(next);
        try {
          const nearest = await fetchNearestCourse(next);
          if (nearest.nearest && nearest.nearest.id !== courseId && nearest.distance_meters <= 5000) {
            setCourseId(nearest.nearest.id);
            toast.success(`Detected ${nearest.nearest.name}`);
          }
        } catch {
          // Course detection is helpful but not required for live distance updates.
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
    const bounded = Math.min(18, Math.max(1, nextHole));
    setHole(bounded);
    if (!activeRound) return;
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
      if (!activeShot) {
        const shot = await startShot(activeRound.id, playerPos, recommendedClub?.name);
        setActiveShot(shot);
        setLastShotYards(null);
        toast.success("Shot started");
      } else {
        const result = await endShot(activeRound.id, playerPos, activeShot.id);
        setActiveShot(null);
        setLastShotYards(result.distance_yards);
        toast.success(`Shot saved: ${result.distance_yards} yards`);
      }
    } catch (error) {
      setGpsError(error instanceof Error ? error.message : "Could not update shot tracking.");
    } finally {
      setSyncing(false);
    }
  };

  const courseCenter = { lat: selectedCourse.lat, lng: selectedCourse.lng };
  const fallbackDistance = playerPos ? toDisplayUnit(haversineYards(playerPos, courseCenter), unit) : null;

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
          }}
          className="min-w-0 flex-1 rounded-lg border border-gold/30 bg-background/60 p-2 text-sm text-foreground"
        >
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.country} · {course.name}
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
        <Card className="flex items-start gap-2 border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{gpsError}</span>
        </Card>
      )}

      <CourseSketch gps={gps} playerPosition={playerPos} />

      <div className="grid grid-cols-3 gap-2">
        <Card className="gradient-card border-gold/20 p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground">Front</p>
          <p className="mt-1 font-serif text-2xl text-foreground">
            {loading ? "..." : frontDistance ?? "-"}
            <span className="text-xs">{displayUnit}</span>
          </p>
        </Card>
        <Card className="gradient-card border-gold/40 p-3 text-center shadow-gold">
          <Flag className="mx-auto h-4 w-4 text-gold" />
          <p className="mt-1 font-serif text-3xl text-gradient-gold">
            {loading ? "..." : centerDistance ?? fallbackDistance ?? "-"}
            <span className="text-xs">{displayUnit}</span>
          </p>
          <p className="text-[10px] uppercase text-muted-foreground">Center green</p>
        </Card>
        <Card className="gradient-card border-gold/20 p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground">Back</p>
          <p className="mt-1 font-serif text-2xl text-foreground">
            {loading ? "..." : backDistance ?? "-"}
            <span className="text-xs">{displayUnit}</span>
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-2">
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
          <p className="text-xs text-muted-foreground">Par {gps?.par ?? "-"} · HCP {gps?.handicap ?? "-"}</p>
        </Card>
      </div>

      <Card className="gradient-card border-gold/20 p-3">
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
        <Button onClick={() => changeHole(hole + 1)} disabled={hole === 18} variant="outline" className="border-gold/40">
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {lastShotYards !== null && (
        <Card className="gradient-card border-gold/20 p-3 text-sm">
          Last shot: <span className="font-serif text-gold">{toDisplayUnit(lastShotYards, unit)}{displayUnit}</span>
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: selectedCourse.holes_count || 18 }, (_, index) => index + 1).map((holeNumber) => (
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
