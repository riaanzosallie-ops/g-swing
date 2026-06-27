// Open-Meteo weather provider — no API key required.
// Docs: https://open-meteo.com/en/docs

export type WeatherCondition =
  | "clear"
  | "mainly_clear"
  | "partly_cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "rain_showers"
  | "snow_showers"
  | "thunderstorm"
  | "unknown";

export type GswingWeather = {
  temperatureC: number;
  feelsLikeC: number;
  humidity: number | null;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windDirectionLabel: string;
  weatherCode: number;
  condition: WeatherCondition;
  conditionLabel: string;
  rainProbability: number | null;
  uvIndex: number | null;
  updatedAt: string;
  latitude: number;
  longitude: number;
};

const CACHE_MS = 10 * 60 * 1000;
type CacheEntry = { at: number; data: GswingWeather };
const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lon: number) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export function getWindDirection(deg: number): string {
  if (!Number.isFinite(deg)) return "—";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const idx = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[idx];
}

export function getWeatherLabel(code: number): { condition: WeatherCondition; label: string } {
  if (code === 0) return { condition: "clear", label: "Clear sky" };
  if (code === 1) return { condition: "mainly_clear", label: "Mainly clear" };
  if (code === 2) return { condition: "partly_cloudy", label: "Partly cloudy" };
  if (code === 3) return { condition: "overcast", label: "Overcast" };
  if (code === 45 || code === 48) return { condition: "fog", label: "Fog" };
  if ([51, 53, 55, 56, 57].includes(code)) return { condition: "drizzle", label: "Drizzle" };
  if ([61, 63, 65, 66, 67].includes(code)) return { condition: "rain", label: "Rain" };
  if ([71, 73, 75, 77].includes(code)) return { condition: "snow", label: "Snow" };
  if ([80, 81, 82].includes(code)) return { condition: "rain_showers", label: "Rain showers" };
  if ([85, 86].includes(code)) return { condition: "snow_showers", label: "Snow showers" };
  if ([95, 96, 99].includes(code)) return { condition: "thunderstorm", label: "Thunderstorm" };
  return { condition: "unknown", label: "—" };
}

type OpenMeteoResponse = {
  latitude?: number;
  longitude?: number;
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
  hourly?: {
    time?: string[];
    precipitation_probability?: (number | null)[];
    uv_index?: (number | null)[];
  };
};

export function normalizeWeatherResponse(
  res: OpenMeteoResponse,
  fallback: { latitude: number; longitude: number },
): GswingWeather | null {
  const c = res.current;
  if (!c || c.temperature_2m == null) return null;
  // Pick the closest hourly index to current time for precip/UV
  let rainProb: number | null = null;
  let uv: number | null = null;
  const times = res.hourly?.time;
  if (times && times.length) {
    const now = Date.now();
    let bestIdx = 0;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let i = 0; i < times.length; i++) {
      const t = Date.parse(times[i]);
      if (!Number.isFinite(t)) continue;
      const d = Math.abs(t - now);
      if (d < bestDelta) { bestDelta = d; bestIdx = i; }
    }
    rainProb = res.hourly?.precipitation_probability?.[bestIdx] ?? null;
    uv = res.hourly?.uv_index?.[bestIdx] ?? null;
  }
  const code = c.weather_code ?? 0;
  const { condition, label } = getWeatherLabel(code);
  const dirDeg = c.wind_direction_10m ?? 0;
  return {
    temperatureC: Math.round(c.temperature_2m),
    feelsLikeC: Math.round(c.apparent_temperature ?? c.temperature_2m),
    humidity: c.relative_humidity_2m ?? null,
    windSpeedKmh: Math.round(c.wind_speed_10m ?? 0),
    windDirectionDeg: dirDeg,
    windDirectionLabel: getWindDirection(dirDeg),
    weatherCode: code,
    condition,
    conditionLabel: label,
    rainProbability: rainProb,
    uvIndex: uv,
    updatedAt: c.time ?? new Date().toISOString(),
    latitude: res.latitude ?? fallback.latitude,
    longitude: res.longitude ?? fallback.longitude,
  };
}

export async function fetchWeatherForCoordinates(
  latitude: number,
  longitude: number,
  options?: { signal?: AbortSignal },
): Promise<GswingWeather | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const key = cacheKey(latitude, longitude);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toFixed(4));
  url.searchParams.set("longitude", longitude.toFixed(4));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m",
  );
  url.searchParams.set("hourly", "precipitation_probability,uv_index");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("temperature_unit", "celsius");

  try {
    const res = await fetch(url.toString(), { signal: options?.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as OpenMeteoResponse;
    const normalized = normalizeWeatherResponse(json, { latitude, longitude });
    if (normalized) cache.set(key, { at: Date.now(), data: normalized });
    return normalized;
  } catch {
    return null;
  }
}

export function buildGolfWeatherInsight(w: GswingWeather): string {
  const wind = w.windSpeedKmh;
  if (w.condition === "thunderstorm") return "Thunderstorm risk — play is unsafe.";
  if (w.condition === "rain" || w.condition === "rain_showers")
    return "Wet conditions. Grip and ball flight will be affected.";
  if ((w.rainProbability ?? 0) >= 60) return "High rain chance. Pack a towel and rain gloves.";
  if (wind >= 30) return "Strong wind. Club up and play low ball flight.";
  if (wind >= 18) return "Breezy. Allow for wind on long irons.";
  if (w.temperatureC >= 34) return "Hot conditions. Stay hydrated and pace yourself.";
  if ((w.uvIndex ?? 0) >= 8) return "High UV. Hat, sunscreen and shade between holes.";
  if (w.condition === "fog") return "Fog reduces visibility — target spotters are critical.";
  if (w.condition === "overcast") return "Overcast and calm. Soft greens, fair scoring window.";
  if (wind <= 8) return "Light wind. Good scoring conditions.";
  return "Comfortable conditions for scoring.";
}