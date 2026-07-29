import { API_CONFIG } from "@/api/config";
import { PLACES, resolvePlace, searchPlaces, type PlaceOption } from "@/data/places";
import { normaliseText } from "@/lib/dedupe";

/**
 * Location search with a guaranteed answer.
 *
 * The offline gazetteer answers first and always. A remote gazetteer is then
 * consulted to widen coverage to towns and villages we do not ship, but it can
 * never block, throw or empty the list — if it is slow, blocked or offline the
 * traveller simply keeps the local results.
 */

const REMOTE_TIMEOUT_MS = 2500;
const MIN_REMOTE_QUERY = 3;

interface NominatimItem {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  type?: string;
  address?: { country?: string; country_code?: string };
}

const remoteCache = new Map<string, PlaceOption[]>();
/** In-flight requests, so repeated keystrokes share one network call. */
const inFlight = new Map<string, Promise<PlaceOption[]>>();

function toPlace(item: NominatimItem): PlaceOption | null {
  const name = item.name?.trim() || item.display_name.split(",")[0]?.trim();
  if (!name) return null;
  const country = item.address?.country ?? item.display_name.split(",").pop()?.trim() ?? "";
  const countryCode = (item.address?.country_code ?? "").toUpperCase();
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    id: `geo-${item.place_id}`,
    kind: "city",
    value: name,
    name,
    subtitle: country ? `${country}` : item.display_name,
    country,
    countryCode,
    lat,
    lon,
  };
}

async function searchRemote(query: string, signal?: AbortSignal): Promise<PlaceOption[]> {
  const key = normaliseText(query);
  const cached = remoteCache.get(key);
  if (cached) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    try {
      const url = new URL(`${API_CONFIG.geocode.baseUrl}/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "5");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("featuretype", "city");
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json", "Accept-Language": "en" },
      });
      if (!response.ok) return [];
      const items = (await response.json()) as NominatimItem[];
      const places = items
        .map(toPlace)
        .filter((place): place is PlaceOption => place !== null);
      remoteCache.set(key, places);
      return places;
    } catch {
      // Offline, blocked, rate-limited or aborted — local results still stand.
      return [];
    } finally {
      clearTimeout(timer);
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  return request;
}

export interface LocationSearchResult {
  places: PlaceOption[];
  /** True when the remote gazetteer contributed nothing (offline or blocked). */
  localOnly: boolean;
}

/** Instant, synchronous results from the bundled gazetteer. */
export function searchLocationsLocal(query: string, limit = 8): PlaceOption[] {
  return searchPlaces(query, limit);
}

/**
 * Local results immediately, widened with remote matches when available.
 * Never rejects.
 */
export async function searchLocations(
  query: string,
  limit = 8,
  signal?: AbortSignal,
): Promise<LocationSearchResult> {
  const local = searchPlaces(query, limit);
  const trimmed = query.trim();

  if (trimmed.length < MIN_REMOTE_QUERY || local.length >= limit) {
    return { places: local, localOnly: true };
  }

  const remote = await searchRemote(trimmed, signal);
  if (!remote.length) return { places: local, localOnly: true };

  const seen = new Set(local.map((place) => normaliseText(place.name)));
  const extra = remote.filter((place) => {
    const key = normaliseText(place.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { places: [...local, ...extra].slice(0, limit), localOnly: false };
}

/** Turns arbitrary typed text into a known place when we can recognise it. */
export const resolveLocation = resolvePlace;

/** Total number of searchable entries — used in trust microcopy. */
export const LOCATION_INDEX_SIZE = PLACES.length;
