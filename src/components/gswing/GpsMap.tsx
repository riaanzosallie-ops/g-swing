import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Wind, Flag, Crosshair, Navigation } from "lucide-react";
import { useBag } from "@/lib/gswing-store";

const COURSES = [
  { id: "majlis", name: "Emirates Golf Club — Majlis", center: [25.0911, 55.1572] as [number, number], pin: [25.0928, 55.1554] as [number, number] },
  { id: "yas", name: "Yas Links Abu Dhabi", center: [24.4673, 54.6010] as [number, number], pin: [24.4682, 54.6021] as [number, number] },
  { id: "trump", name: "Trump International Dubai", center: [25.0353, 55.2272] as [number, number], pin: [25.0367, 55.2284] as [number, number] },
  { id: "jumeirah", name: "Jumeirah Golf Estates — Earth", center: [25.0259, 55.1856] as [number, number], pin: [25.0274, 55.1869] as [number, number] },
  { id: "saadiyat", name: "Saadiyat Beach Golf Club", center: [24.5547, 54.4282] as [number, number], pin: [24.5562, 54.4296] as [number, number] },
];

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
  const dLat = toRad(b[0] - a[0]); const dLon = toRad(b[1] - a[1]);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLon/2)**2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 17); }, [center, map]);
  return null;
}

export const GpsMap = () => {
  const [courseId, setCourseId] = useState("majlis");
  const [hole, setHole] = useState(7);
  const [bag] = useBag();
  const [unit, setUnit] = useState<"m" | "yd">("m");
  const course = useMemo(() => COURSES.find((c) => c.id === courseId)!, [courseId]);
  const [playerPos, setPlayerPos] = useState<[number, number]>([course.center[0] - 0.0008, course.center[1] - 0.0010]);

  useEffect(() => {
    setPlayerPos([course.center[0] - 0.0008, course.center[1] - 0.0010]);
  }, [courseId]);

  const distToPin = distMeters(playerPos, course.pin);
  const distToBunker = distToPin - 28;
  const distToFront = Math.max(0, distToPin - 12);
  const distToBack = distToPin + 14;
  const conv = (m: number) => unit === "m" ? m : Math.round(m * 1.0936);
  const u = unit === "m" ? "m" : "y";

  const recommended = bag
    .filter((c) => c.distance > 0)
    .reduce((best, c) => Math.abs(c.distance - distToPin) < Math.abs(best.distance - distToPin) ? c : best, bag.find(c => c.distance > 0)!);

  const tryLocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setPlayerPos([pos.coords.latitude, pos.coords.longitude]);
    }, () => {}, { enableHighAccuracy: true });
  };

  const simulateWalk = () => {
    setPlayerPos((p) => [
      p[0] + (course.pin[0] - p[0]) * 0.25,
      p[1] + (course.pin[1] - p[1]) * 0.25,
    ]);
  };

  return (
    <div className="space-y-3 pb-28">
      <Card className="gradient-card border-gold/20 p-3 flex items-center gap-2">
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}
          className="flex-1 rounded-lg border border-gold/30 bg-background/60 p-2 text-sm text-foreground">
          {COURSES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={() => setUnit(unit === "m" ? "yd" : "m")}
          className="rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold">
          {unit === "m" ? "M" : "YD"}
        </button>
      </Card>

      <div className="relative h-[42vh] overflow-hidden rounded-2xl border border-gold/30 shadow-elegant">
        <MapContainer center={course.center} zoom={17} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
          <Recenter center={course.center} />
          <TileLayer
            attribution='&copy; Esri Satellite'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <Marker position={course.pin} icon={pinIcon}><Popup>Pin · Hole {hole}</Popup></Marker>
          <Marker position={playerPos} icon={playerIcon}><Popup>You</Popup></Marker>
          <Circle center={playerPos} radius={5} pathOptions={{ color: "hsl(150 60% 45%)", weight: 1, fillOpacity: 0.2 }} />
        </MapContainer>

        <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-background/80 px-3 py-1.5 text-xs backdrop-blur">
          <span className="text-gold font-semibold">Hole {hole}</span> · Par 4 · 382m
        </div>
      </div>

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

      <Card className="gradient-card border-gold/40 p-4 shadow-gold">
        <p className="text-[10px] uppercase tracking-widest text-gold/80">ACE Recommends</p>
        <p className="font-serif text-2xl text-gradient-gold">{recommended?.name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">Based on your My Bag distances ({conv(recommended?.distance ?? 0)}{u} carry) at {conv(distToPin)}{u} to the pin.</p>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={tryLocate} variant="outline" className="border-gold/40"><Navigation className="mr-2 h-4 w-4" /> Use my GPS</Button>
        <Button onClick={simulateWalk} className="gradient-gold text-primary-foreground"><MapPin className="mr-2 h-4 w-4" /> Walk forward</Button>
      </div>

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