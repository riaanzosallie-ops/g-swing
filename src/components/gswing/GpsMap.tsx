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
  Home,
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
const DEMO_PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 4, 5, 4, 3, 4, 4];

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
  const greenPolygon = green?.polygon?.coordinates?.[0]?.map(([lng, lat]) => project({ lat, lng })) ?? [];
  const unitText = displayUnit === "m" ? "Meters" : "Yards";

  const fairwayPath = `M ${teePoint.x} ${teePoint.y} C ${teePoint.x - 120} ${(teePoint.y + pinPoint.y) / 2}, ${
    pinPoint.x + 180
  } ${(teePoint.y + pinPoint.y) / 2}, ${pinPoint.x} ${pinPoint.y}`;

  return (
    <div className="relative overflow-hidden rounded-lg border-[10px] border-black bg-black shadow-elegant">
      <div className="relative overflow-hidden rounded-sm border border-zinc-700">
        <svg viewBox="0 0 1000 560" className="block h-[58vh] min-h-[395px] w-full">
          <defs>
            <filter id="gpsGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="cartSoftFocus">
              <feGaussianBlur stdDeviation="0.75" />
            </filter>
            <linearGradient id="fairway" x1="0" x2="1" y1="1" y2="0">
              <stop offset="0%" stopColor="hsl(153 38% 20%)" />
              <stop offset="100%" stopColor="hsl(139 44% 45%)" />
            </linearGradient>
            <radialGradient id="cartGround" cx="48%" cy="34%" r="78%">
              <stop offset="0%" stopColor="hsl(93 25% 64%)" />
              <stop offset="44%" stopColor="hsl(99 24% 36%)" />
              <stop offset="100%" stopColor="hsl(116 26% 12%)" />
            </radialGradient>
            <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="1" fill="hsl(0 0% 100% / 0.08)" />
            </pattern>
          </defs>

          <rect width="1000" height="560" fill="url(#cartGround)" />
          <path d="M0 104 C178 15 295 36 405 90 C530 152 668 55 796 18 C900 -13 973 5 1000 34 L1000 0 L0 0Z" fill="hsl(40 30% 76% / 0.28)" filter="url(#cartSoftFocus)" />
          <path d="M-78 350 C52 248 167 250 251 306 C336 362 355 448 270 523 C176 607 22 548 -86 504Z" fill="hsl(213 76% 84% / 0.92)" stroke="hsl(218 90% 94% / 0.9)" strokeWidth="9" />
          <path d="M765 332 C875 244 973 275 1036 365 C1095 449 1070 558 972 592 C855 633 750 546 718 460 C700 412 720 371 765 332Z" fill="hsl(219 74% 86% / 0.92)" stroke="hsl(218 90% 95% / 0.95)" strokeWidth="9" />

          <path d={fairwayPath} stroke="hsl(143 33% 22% / 0.86)" strokeWidth="160" strokeLinecap="round" fill="none" opacity="0.88" />
          <path d={fairwayPath} stroke="url(#fairway)" strokeWidth="110" strokeLinecap="round" fill="none" opacity="0.76" />
          <path d={fairwayPath} stroke="hsl(130 45% 49% / 0.42)" strokeWidth="82" strokeLinecap="round" fill="none" />

          {hazards.map((hazard, index) => {
            const location = hazard.lat && hazard.lng ? project({ lat: hazard.lat, lng: hazard.lng }) : null;
            if (!location) return null;
            const isWater = hazard.type === "water";
            return (
              <ellipse
                key={`${hazard.type}-${hazard.label ?? index}`}
                cx={location.x}
                cy={location.y}
                rx={isWater ? 82 : 48}
                ry={isWater ? 54 : 31}
                fill={isWater ? "hsl(211 72% 84% / 0.9)" : "hsl(43 44% 78% / 0.9)"}
                stroke={isWater ? "hsl(215 95% 94%)" : "hsl(42 65% 90%)"}
                strokeWidth="4"
              />
            );
          })}

          {greenPolygon.length >= 3 ? (
            <polygon
              points={polygonPath(greenPolygon)}
              fill="hsl(143 52% 70%)"
              stroke="hsl(151 52% 30%)"
              strokeWidth="10"
              filter="url(#gpsGlow)"
            />
          ) : (
            <ellipse
              cx={pinPoint.x}
              cy={pinPoint.y}
              rx="178"
              ry="108"
              fill="hsl(143 52% 70%)"
              stroke="hsl(151 52% 30%)"
              strokeWidth="10"
              filter="url(#gpsGlow)"
            />
          )}

          {backPoint && (
            <g>
              <rect x={backPoint.x - 42} y={backPoint.y - 70} width="84" height="43" rx="7" fill="hsl(45 35% 94%)" stroke="hsl(224 18% 20%)" strokeWidth="2" />
              <text x={backPoint.x} y={backPoint.y - 39} textAnchor="middle" fontSize="34" fill="hsl(150 35% 10%)">
                {formatDistance(backDistance)}
              </text>
            </g>
          )}

          {frontPoint && (
            <g>
              <path d={`M${frontPoint.x - 13} ${frontPoint.y + 10} L${frontPoint.x} ${frontPoint.y - 4} L${frontPoint.x + 13} ${frontPoint.y + 10}Z`} fill="hsl(224 18% 20%)" />
              <rect x={frontPoint.x - 42} y={frontPoint.y + 10} width="84" height="43" rx="7" fill="hsl(45 35% 94%)" stroke="hsl(224 18% 20%)" strokeWidth="2" />
              <text x={frontPoint.x} y={frontPoint.y + 41} textAnchor="middle" fontSize="34" fill="hsl(150 35% 10%)">
                {formatDistance(frontDistance)}
              </text>
            </g>
          )}

          <g transform={`translate(${teePoint.x},${teePoint.y})`}>
            <circle r="13" fill="hsl(45 80% 58%)" stroke="hsl(150 35% 8%)" strokeWidth="4" />
          </g>

          <g transform={`translate(${pinPoint.x},${pinPoint.y})`}>
            <circle r="17" fill="hsl(45 35% 94%)" stroke="hsl(150 35% 8%)" strokeWidth="5" />
            <path d="M-17 0H17M0 -17V17" stroke="hsl(150 35% 8%)" strokeWidth="3" />
            <path d="M-17 -17 A17 17 0 0 1 0 -17 L0 0 L-17 0Z" fill="hsl(248 24% 35%)" />
            <path d="M0 0 L17 0 A17 17 0 0 1 0 17Z" fill="hsl(248 24% 35%)" />
          </g>

          {playerPoint && (
            <g transform={`translate(${playerPoint.x},${playerPoint.y})`}>
              <circle r="24" fill="hsl(150 70% 48%)" opacity="0.2" />
              <circle r="10" fill="hsl(45 35% 95%)" stroke="hsl(150 70% 42%)" strokeWidth="5" />
            </g>
          )}

          <rect width="1000" height="560" fill="url(#scanlines)" opacity="0.34" />
          <rect width="1000" height="560" fill="hsl(45 100% 88% / 0.1)" />
        </svg>

        <div className="pointer-events-none absolute right-4 top-4 w-[178px] overflow-hidden rounded-xl border border-white/70 bg-gradient-to-br from-white/85 to-yellow-100/75 text-yellow-700 shadow-xl backdrop-blur-sm sm:w-[218px]">
          <div className="grid grid-cols-[54px_1fr] sm:grid-cols-[68px_1fr]">
            <div className="flex flex-col items-center justify-center border-r border-white/60 bg-lime-300/65 p-2 text-[10px] leading-tight text-emerald-900">
              <div className="relative mb-1 h-10 w-10 rounded-full border-4 border-lime-500 bg-lime-200 shadow-inner">
                <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-emerald-800/50" />
                <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-emerald-800/50" />
                <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(hsl(248_24%_35%)_0_25%,transparent_25%_50%,hsl(248_24%_35%)_50%_75%,transparent_75%)]" />
              </div>
              <span>Center</span>
              <span>of</span>
              <span>Green</span>
            </div>
            <div className="p-2 text-right">
              <div className="font-serif text-5xl font-bold leading-none tracking-normal sm:text-6xl">
                {formatDistance(centerDistance)}
              </div>
              <div className="text-2xl font-semibold leading-none sm:text-3xl">{unitText}</div>
              <div className="mt-3 text-center text-[10px] text-yellow-800/70">
                Hole {gps?.hole_number ?? "-"}
                <br />
                Par {gps?.par ?? "-"}, Handicap {gps?.handicap ?? "-"}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-8 right-5 hidden w-[210px] rounded-sm border border-white/30 bg-zinc-950/58 p-3 text-center text-white/85 shadow-xl backdrop-blur-sm sm:block">
          <div className="mx-auto mb-2 flex h-14 w-20 items-center justify-center rounded-md bg-gradient-to-b from-slate-200/85 to-blue-300/70 shadow-inner">
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
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  );
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
      setGps(createFallbackHoleGps(selectedCourse, hole, unit, playerPos));
      setGpsError("Using offline GPS view until the live course service connects.");
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
  const displayCenterDistance = centerDistance ?? fallbackDistance;

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

      <CartGpsView
        gps={gps}
        playerPosition={playerPos}
        displayUnit={displayUnit}
        centerDistance={loading ? null : displayCenterDistance}
        frontDistance={loading ? null : frontDistance}
        backDistance={loading ? null : backDistance}
        currentTime={currentTime}
      />

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
          <p className="text-xs text-muted-foreground">Par {gps?.par ?? "-"} - HCP {gps?.handicap ?? "-"}</p>
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
