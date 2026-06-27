import { useEffect, useState } from "react";
import { fetchWeatherForCoordinates, type GswingWeather } from "./gswing-weather";

export type WeatherState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: GswingWeather }
  | { status: "no_location" }
  | { status: "unavailable" };

export function useGswingWeather(coords: { latitude: number | null; longitude: number | null } | null): WeatherState {
  const [state, setState] = useState<WeatherState>({ status: "idle" });
  const lat = coords?.latitude ?? null;
  const lon = coords?.longitude ?? null;

  useEffect(() => {
    if (lat == null || lon == null) {
      setState({ status: "no_location" });
      return;
    }
    const ctrl = new AbortController();
    setState({ status: "loading" });
    fetchWeatherForCoordinates(lat, lon, { signal: ctrl.signal })
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setState(data ? { status: "ready", data } : { status: "unavailable" });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ status: "unavailable" });
      });
    return () => ctrl.abort();
  }, [lat, lon]);

  return state;
}

/** Hook for browser geolocation. Never blocks; returns null if unavailable/denied. */
export function useBrowserCoords(): { latitude: number | null; longitude: number | null } {
  const [coords, setCoords] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  });
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => { /* user denied / unavailable — silent */ },
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 8000 },
    );
    return () => { cancelled = true; };
  }, []);
  return coords;
}