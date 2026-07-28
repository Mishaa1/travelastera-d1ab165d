import { API_CONFIG, ESTIMATE_QUALITY, LIVE_QUALITY } from "@/api/config";
import { apiGet, withFallback } from "@/api/http";
import { ORIGIN_COORDS } from "@/data/cities";
import type { DataQuality, GeoPoint } from "@/lib/types";

export interface GeocodeResult extends GeoPoint {
  name: string;
  country: string;
  quality: DataQuality;
}

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  address?: { country?: string };
}

const cache = new Map<string, GeocodeResult>();

function localGuess(query: string): GeocodeResult {
  const key = query.trim().toLowerCase();
  const known = ORIGIN_COORDS[key];
  return {
    name: query.trim() || "Unknown",
    country: "",
    lat: known?.lat ?? 48.5,
    lon: known?.lon ?? 9.5,
    quality: ESTIMATE_QUALITY("Offline gazetteer"),
  };
}

/** Forward geocode a free-text city name via Nominatim, cached in-memory. */
export async function geocodeCity(query: string): Promise<GeocodeResult> {
  const key = query.trim().toLowerCase();
  if (!key) return localGuess(query);
  const cached = cache.get(key);
  if (cached) return cached;

  const result = await withFallback(
    async () => {
      const items = await apiGet<NominatimItem[]>(`${API_CONFIG.geocode.baseUrl}/search`, {
        query: { q: query, format: "json", limit: 1, addressdetails: 1 },
        headers: { "Accept-Language": "en" },
      });
      const first = items[0];
      if (!first) throw new Error("no match");
      return {
        name: first.display_name.split(",")[0],
        country: first.address?.country ?? "",
        lat: Number(first.lat),
        lon: Number(first.lon),
        quality: LIVE_QUALITY(API_CONFIG.geocode.provider),
      } satisfies GeocodeResult;
    },
    () => localGuess(query),
  );

  cache.set(key, result);
  return result;
}

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)));
}
