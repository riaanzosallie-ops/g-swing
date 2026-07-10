import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Props {
  center: [number, number]; // [lng, lat]
  markers?: { lng: number; lat: number; label?: string; color?: string }[];
  zoom?: number;
  className?: string;
}

// Esri World Imagery — no API key required.
const ESRI_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Imagery © Esri",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

export function HoleSatelliteMap({ center, markers = [], zoom = 17, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: ESRI_STYLE,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    for (const m of markers) {
      new maplibregl.Marker({ color: m.color ?? "#c8a24a" })
        .setLngLat([m.lng, m.lat])
        .setPopup(m.label ? new maplibregl.Popup({ offset: 12 }).setText(m.label) : undefined)
        .addTo(map);
    }
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  return <div ref={ref} className={className ?? "h-[360px] w-full rounded-xl overflow-hidden"} />;
}