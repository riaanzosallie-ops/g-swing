import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Wind, Flag, Crosshair, Navigation, Locate, LocateOff } from "lucide-react";
import { useBag } from "@/lib/gswing-store";

type Course = {
  id: string;
  name: string;
  country: "UAE" | "ZA";
  center: [number, number];
  pin: [number, number];
};

const COURSES: Course[] = [
  // UAE
  { id: "majlis",    name: "Emirates Golf Club — Majlis",   country: "UAE", center: [25.0911, 55.1572], pin: [25.0928, 55.1554] },
  { id: "yas",       name: "Yas Links Abu Dhabi",           country: "UAE", center: [24.4673, 54.6010], pin: [24.4682, 54.6021] },
  { id: "trump",     name: "Trump International Dubai",     country: "UAE", center: [25.0353, 55.2272], pin: [25.0367, 55.2284] },
  { id: "jumeirah",  name: "Jumeirah Golf Estates — Earth", country: "UAE", center: [25.0259, 55.1856], pin: [25.0274, 55.1869] },
  { id: "saadiyat",  name: "Saadiyat Beach Golf Club",      country: "UAE", center: [24.5547, 54.4282], pin: [24.5562, 54.4296] },
  { id: "almouj",    name: "Al Mouj Golf Muscat",           country: "UAE", center: [23.6105, 58.5920], pin: [23.6118, 58.5935] },
  // South Africa
  { id: "fancourt",  name: "Fancourt — The Links",         country: "ZA",  center: [-33.9785, 22.4602], pin: [-33.9771, 22.4618] },
  { id: "garyplayer",name: "Sun City — Gary Player CC",    country: "ZA",  center: [-25.3398, 27.0943], pin: [-25.3382, 27.0958] },
  { id: "royaljhb",  name: "Royal Johannesburg — East",    country: "ZA",  center: [-26.1573, 28.1402], pin: [-26.1559, 28.1417] },
  { id: "leopard",   name: "Leopard Creek CC",             country: "ZA",  center: [-25.0344, 31.5873], pin: [-25.0329, 31.5888] },
  { id: "pearlvalley",name: "Pearl Valley Golf Estates",   country: "ZA",  center: [-33.7312, 18.9654], pin: [-33.7297, 18.9669] },
  { id: "durban",    name: "Durban Country Club",          country: "ZA",  center: [-29.8652, 31.0201], pin: [-29.8637, 31.0216] },
  { id: "pinnacle",  name: "Pinnacle Point Golf Club",     country: "ZA",  center: [-34.0184, 22.1376], pin: [-34.0169, 22.1391] },
  { id: "arabella",  name: "Arabella Golf Club",           country: "ZA",  center: [-34.3121, 19.0538], pin: [-34.3106, 19.0553] },
];

// Radius within which we consider the player to be "at" a course (metres)
const COURSE_DETECT_RADIUS = 5000;

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:36px;display:flex;align-items:center;justify-content:center;"><div style="width:18px;height:18px;border-radius:50%;background:hsl(45 80% 55%);border:3px solid #1a1a1a;box-shadow:0 0 12px hsl(45 80% 55%);"></div></div>`,
  iconSize: [28, 36], iconAnchor: [14, 18],
});
const playerIcon = L.divIcon({
  className: "",
  html: `<div style="width:24px;height:24px;border-radius:50%;background:#fff;border:3px solid hsl(150 60% 45%);box-shadow:0 0 16px hsl(150 60% 45%);animation:pulse 2s infinite;"></div>`,
  iconSize: [24, 24], iconAnchor: [12, 12],
});

function distMeters(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

/** Returns the closest course to a GPS position, or null if beyond COURSE_DETECT_RADIUS */
function nearestCourse(pos: [number, number]): Course | null {
  let best: Course | null = null;
  let bestDist = Infinity;
  for (const c of COURSES) {
    const d = distMeters(pos, c.center);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best && bestDist <= COURSE_DETECT_RADIUS ? best : null;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 17); }, [center, map]);
  return null;
}

export const GpsMap = () => {
  const [courseId, setCourseId] = useState("majlis");
  const [countryFilter, setCountryFilter] = useState<"ALL" | "UAE" | "ZA">("ALL");
  const [hole, setHole] = useState(7);
  const [bag] = useBag();
  const [unit, setUnit] = useState<"m" | "yd">("m");
  const [liveTracking, setLiveTracking] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [nearCourse, setNearCourse] = useState<Course | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const course = useMemo(() => COURSES.find((c) => c.id === courseId)!, [courseId]);
  const [playerPos, setPlayerPos] = useState<[number, number]>([course.center[0] - 0.0008, course.center[1] - 0.0010]);

  const filteredCourses = useMemo(
    () => countryFilter === "ALL" ? COURSES : COURSES.filter((c) => c.country === countryFilter),
    [countryFilter]
  );

  // Reset player position when course changes manually
  useEffect(() => {
    setPlayerPos([course.center[0] - 0.0008, course.center[1] - 0.0010]);
  }, [courseId]);

  // Start / stop live GPS watchPosition
  const toggleLiveTracking = () => {
    if (liveTracking) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setLiveTracking(false);
      setNearCourse(null);
      return;
    }
    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported on this device.");
      return;
    }
    setGpsError(null);
    setLiveTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const latlng: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPlayerPos(latlng);
        const detected = nearestCourse(latlng);
        setNearCourse(detected);
        if (detected) setCourseId(detected.id);
      },
      (err) => {
        setGpsError(`GPS error: ${err.message}`);
        setLiveTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  };

  // Clean up watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const simulateWalk = () => {
    setPlayerPos((p) => [
      p[0] + (course.pin[0] - p[0]) * 0.25,
      p[1] + (course.pin[1] - p[1]) * 0.25,
    ]);
  };

  const distToPin = distMeters(playerPos, course.pin);
  const distToBunker = Math.max(0, distToPin - 28);
  const distToFront = Math.max(0, distToPin - 12);
  const distToBack = distToPin + 14;
  const conv = (m: number) => unit === "m" ? m : Math.round(m * 1.0936);
  const u = unit === "m" ? "m" : "y";

  const validBag = bag.filter((c) => c.distance > 0);
  const recommended = validBag.length
    ? validBag.reduce((best, c) => Math.abs(c.distance - distToPin) < Math.abs(best.distance - distToPin) ? c : best)
    : null;

  return (
    <div className="space-y-3 pb-28">
      {/* Country filter tabs */}
      <div className="flex gap-2">
        {(["ALL", "UAE", "ZA"] as const).map((f) => (
          <button key={f} onClick={() => setCountryFilter(f)}
            className={`rounded-xl border px-4 py-1.5 text-xs font-semibold transition-all ${countryFilter === f ? "border-gold bg-gold/20 text-gold" : "border-gold/20 text-muted-foreground"}`}>
            {f === "ZA" ? "South Africa" : f === "UAE" ? "UAE" : "All Courses"}
          </button>
        ))}
      </div>

      {/* Course selector + unit toggle */}
      <Card className="gradient-card border-gold/20 p-3 flex items-center gap-2">
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}
          className="flex-1 rounded-lg border border-gold/30 bg-background/60 p-2 text-sm text-foreground">
          {filteredCourses.map((c) => (
            <option key={c.id} value={c.id}>{c.country === "ZA" ? "🇿🇦" : "🇦🇪"} {c.name}</option>
          ))}
        </select>
        <button onClick={() => setUnit(unit === "m" ? "yd" : "m")}
          className="rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold">
          {unit === "m" ? "M" : "YD"}
        </button>
      </Card>

      {/* Live GPS detection banner */}
      {liveTracking && (
        <Card className={`border p-3 flex items-center gap-2 text-sm ${nearCourse ? "border-green-500/40 bg-green-500/10" : "border-gold/20 gradient-card"}`}>
          <Locate className={`h-4 w-4 shrink-0 ${nearCourse ? "text-green-400" : "text-gold"} animate-pulse`} />
          {nearCourse
            ? <span className="text-green-300">Detected: <strong>{nearCourse.name}</strong></span>
            : <span className="text-muted-foreground">Live GPS active — scanning for nearby courses…</span>}
        </Card>
      )}

      {/* GPS error */}
      {gpsError && (
        <Card className="border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400">{gpsError}</Card>
      )}

      {/* Map */}
      <div className="relative h-[42vh] overflow-hidden rounded-2xl border border-gold/30 shadow-elegant">
        <MapContainer center={course.center} zoom={17} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
          <Recenter center={course.center} />
          <TileLayer
            attribution="&copy; Esri Satellite"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <Marker position={course.pin} icon={pinIcon}><Popup>Pin · Hole {hole}</Popup></Marker>
          <Marker position={playerPos} icon={playerIcon}><Popup>You</Popup></Marker>
          <Circle center={playerPos} radius={5} pathOptions={{ color: "hsl(150 60% 45%)", weight: 1, fillOpacity: 0.2 }} />
        </MapContainer>

        <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-background/80 px-3 py-1.5 text-xs backdrop-blur">
          <span className="text-gold font-semibold">Hole {hole}</span> · Par 4 · 382m
        </div>
        {liveTracking && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-xl bg-green-900/70 px-2 py-1 text-[10px] text-green-300 backdrop-blur flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </div>
        )}
      </div>

      {/* Distances */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="gradient-card border-gold/20 p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground">Front</p>
          <p className="mt-1 font-serif text-lg text-foreground">{conv(distToFront)}<span className="text-xs">{u}</span></p>
        </Card>
        <Card className="gradient-card border-gold/40 p-3 text-center shadow-gold">
          <Flag className="mx-auto h-4 w-4 text-gold" />
          <p className="mt-1 font-serif text-2xl text-gradient-gold">{conv(distToPin)}<span className="text-xs">{u}</span></p>
          <p className="text-[10px] uppercase text-muted-foreground">Middle (pin)</p>
        </Card>
        <Card className="gradient-card border-gold/20 p-3 text-center">
          <p className="text-[10px] uppercase text-muted-foreground">Back</p>
          <p className="mt-1 font-serif text-lg text-foreground">{conv(distToBack)}<span className="text-xs">{u}</span></p>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="gradient-card border-gold/20 p-3 text-center">
          <Crosshair className="mx-auto h-4 w-4 text-gold" />
          <p className="mt-1 font-serif text-2xl text-foreground">{conv(distToBunker)}<span className="text-xs">{u}</span></p>
          <p className="text-[10px] uppercase text-muted-foreground">to bunker</p>
        </Card>
        <Card className="gradient-card border-gold/20 p-3 text-center">
          <Wind className="mx-auto h-4 w-4 text-gold" />
          <p className="mt-1 font-serif text-2xl text-foreground">12<span className="text-sm">km/h</span></p>
          <p className="text-[10px] uppercase text-muted-foreground">NE wind</p>
        </Card>
        <Card className="gradient-card border-gold/20 p-3 text-center">
          <MapPin className="mx-auto h-4 w-4 text-gold" />
          <p className="mt-1 font-serif text-2xl text-foreground">{conv(distToPin + 35)}<span className="text-xs">{u}</span></p>
          <p className="text-[10px] uppercase text-muted-foreground">to water</p>
        </Card>
      </div>

      {/* ACE recommendation */}
      <Card className="gradient-card border-gold/40 p-4 shadow-gold">
        <p className="text-[10px] uppercase tracking-widest text-gold/80">ACE Recommends</p>
        <p className="font-serif text-2xl text-gradient-gold">{recommended?.name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">
          {recommended
            ? `Based on your My Bag distances (${conv(recommended.distance)}${u} carry) at ${conv(distToPin)}${u} to the pin.`
            : "Add club distances in My Bag to get recommendations."}
        </p>
      </Card>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={toggleLiveTracking}
          variant={liveTracking ? "default" : "outline"}
          className={liveTracking ? "gradient-gold text-primary-foreground" : "border-gold/40"}>
          {liveTracking
            ? <><LocateOff className="mr-2 h-4 w-4" /> Stop GPS</>
            : <><Locate className="mr-2 h-4 w-4" /> Live GPS</>}
        </Button>
        <Button onClick={simulateWalk} variant="outline" className="border-gold/40">
          <Navigation className="mr-2 h-4 w-4" /> Walk forward
        </Button>
      </div>

      {/* Hole selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 18 }, (_, i) => i + 1).map((h) => (
          <button key={h} onClick={() => setHole(h)}
            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold ${hole === h ? "border-gold bg-gold/20 text-gold" : "border-gold/15 text-muted-foreground"}`}>
            H{h}
          </button>
        ))}
      </div>
    </div>
  );
};
