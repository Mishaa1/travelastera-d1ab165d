import { API_CONFIG, ESTIMATE_QUALITY, LIVE_QUALITY } from "@/api/config";
import { apiGet, withFallback } from "@/api/http";
import type { GeoPoint, StopWeather } from "@/lib/types";

interface OpenMeteoResponse {
  daily?: {
    temperature_2m_max?: number[];
    precipitation_probability_max?: number[];
    weathercode?: number[];
  };
}

const CODE_SUMMARY: Record<number, string> = {
  0: "Clear skies",
  1: "Mostly sunny",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Morning fog",
  51: "Light drizzle",
  61: "Light rain",
  63: "Rain showers",
  71: "Snow showers",
  80: "Passing showers",
  95: "Thunderstorms",
};

function seasonalEstimate(city: string, point: GeoPoint, date: string): StopWeather {
  const month = new Date(date).getMonth();
  const summerness = Math.cos(((month - 6) / 12) * Math.PI * 2);
  const latitudeDrag = (point.lat - 40) * 0.55;
  const tempC = Math.round(19 + summerness * 8 - latitudeDrag);
  const rainChance = Math.max(5, Math.min(80, Math.round(34 - summerness * 14 + latitudeDrag * 1.6)));
  return {
    city,
    tempC,
    rainChance,
    summary: rainChance > 45 ? "Changeable, pack a shell" : "Mostly settled",
    quality: ESTIMATE_QUALITY("Seasonal model"),
  };
}

/** Daily forecast for a stop. Falls back to a seasonal estimate offline. */
export async function getStopWeather(
  city: string,
  point: GeoPoint,
  date: string,
): Promise<StopWeather> {
  if (!API_CONFIG.weather.enabled) return seasonalEstimate(city, point, date);

  return withFallback(
    async () => {
      const data = await apiGet<OpenMeteoResponse>(`${API_CONFIG.weather.baseUrl}/forecast`, {
        query: {
          latitude: point.lat,
          longitude: point.lon,
          daily: "temperature_2m_max,precipitation_probability_max,weathercode",
          timezone: "auto",
          forecast_days: 7,
        },
      });
      const temps = data.daily?.temperature_2m_max ?? [];
      const rain = data.daily?.precipitation_probability_max ?? [];
      const codes = data.daily?.weathercode ?? [];
      if (!temps.length) throw new Error("empty forecast");

      const avg = (list: number[]) =>
        Math.round(list.reduce((total, value) => total + value, 0) / list.length);

      return {
        city,
        tempC: avg(temps),
        rainChance: rain.length ? avg(rain) : 20,
        summary: CODE_SUMMARY[codes[0] ?? 1] ?? "Mixed conditions",
        quality: LIVE_QUALITY(API_CONFIG.weather.provider),
      } satisfies StopWeather;
    },
    () => seasonalEstimate(city, point, date),
  );
}

export async function getWeatherForStops(
  stops: { city: string; point: GeoPoint }[],
  date: string,
): Promise<StopWeather[]> {
  return Promise.all(stops.map((stop) => getStopWeather(stop.city, stop.point, date)));
}
