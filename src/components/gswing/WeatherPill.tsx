import { CloudSun, Wind, CloudRain, CloudFog, Sun, Cloud, CloudSnow, Zap } from "lucide-react";
import type { GswingWeather } from "@/lib/gswing-weather";

export const conditionIcon = (c: GswingWeather["condition"]) => {
  switch (c) {
    case "clear": return Sun;
    case "mainly_clear":
    case "partly_cloudy": return CloudSun;
    case "overcast": return Cloud;
    case "fog": return CloudFog;
    case "drizzle":
    case "rain":
    case "rain_showers": return CloudRain;
    case "snow":
    case "snow_showers": return CloudSnow;
    case "thunderstorm": return Zap;
    default: return CloudSun;
  }
};

export const WeatherPill = ({ w }: { w: GswingWeather }) => {
  const Icon = conditionIcon(w.condition);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-background/40 px-2 py-0.5 text-[10px] text-foreground/90">
      <Icon className="h-3 w-3 text-gold" />
      <span className="font-mono">{w.temperatureC}°C</span>
      <span className="text-muted-foreground">·</span>
      <Wind className="h-3 w-3 text-gold/70" />
      <span className="font-mono">{w.windSpeedKmh}</span>
      <span className="text-muted-foreground">{w.windDirectionLabel}</span>
    </span>
  );
};