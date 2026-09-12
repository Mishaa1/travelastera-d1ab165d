import { LIVE_QUALITY } from "../../api/config.ts";
import { developmentDiagnostics } from "../live-data.ts";
import type { PlannedExperience, PlannedRestaurant } from "../types.ts";

const CONFIGURED_OVERPASS_URL = process.env.OVERPASS_BASE_URL?.trim();
const OVERPASS_URLS = CONFIGURED_OVERPASS_URL
  ? [CONFIGURED_OVERPASS_URL]
  : ["https://overpass-api.de/api/interpreter", "https://lz4.overpass-api.de/api/interpreter"];

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OsmElement[];
}

export interface OverpassAttemptDiagnostics {
  attempt: "primary" | "expanded-radius" | "simplified";
  radiusMetres: number;
  endpoint: string;
  query: string;
  httpStatus: number;
  returnedElementCount: number;
  parsedElementCount: number;
  normalizedAttractionCount: number;
  normalizedRestaurantCount: number;
  category?: "attraction" | "restaurant";
  circuitOpen?: boolean;
  negativeCacheHit?: boolean;
}

type PoiCategory = "attraction" | "restaurant";
const OVERPASS_TIMEOUT_MS = 8_000;
const NEGATIVE_CACHE_TTL_MS = 7 * 60_000;
const CIRCUIT_TTL_MS = 7 * 60_000;
const categoryFlights = new Map<
  string,
  Promise<
    ReturnType<typeof normalize> & { diagnostics: OverpassAttemptDiagnostics[]; failure?: string }
  >
>();
const negativeCache = new Map<string, { expiresAt: number; reason: string }>();
let circuitOpenUntil = 0;
let consecutiveEndpointFailures = 0;

const imageFromTags = (tags: Record<string, string>) => {
  if (tags.image?.startsWith("https://")) return tags.image;
  if (tags.wikimedia_commons) {
    const filename = tags.wikimedia_commons.replace(/^File:/i, "");
    return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}?width=1200`;
  }
  return undefined;
};

const coordinates = (element: OsmElement) => ({
  lat: element.lat ?? element.center?.lat,
  lon: element.lon ?? element.center?.lon,
});

function makeQuery(
  latitude: number,
  longitude: number,
  radius: number,
  simplified: boolean,
  category?: PoiCategory,
) {
  const around = `around:${radius},${latitude},${longitude}`;
  // Dense city-centre food nodes become prohibitively expensive at attraction
  // radii. Three kilometres already covers hundreds of useful venues.
  const foodAround = `around:${Math.min(radius, 3_000)},${latitude},${longitude}`;
  const attractionLines = simplified
    ? `node[tourism][name](${around});\n  node[historic][name](${around});`
    : `node[tourism~"^(attraction|museum|gallery|viewpoint)$"][name](${around});\n  node[historic][name](${around});`;
  const restaurantLines = simplified
    ? `node[amenity=restaurant][name](${foodAround});\n  node[amenity=cafe][name](${foodAround});`
    : `node[amenity~"^(restaurant|cafe|food_court)$"][name](${foodAround});`;
  const lines =
    category === "attraction"
      ? attractionLines
      : category === "restaurant"
        ? restaurantLines
        : `${restaurantLines}\n  ${attractionLines}`;
  return simplified
    ? `[out:json][timeout:25];
(
  ${lines}
);
out 160;`
    : `[out:json][timeout:20];
(
  ${lines}
);
out 120;`;
}

function normalize(elements: OsmElement[]) {
  const seen = new Set<string>();
  const experiences: PlannedExperience[] = [];
  const restaurants: PlannedRestaurant[] = [];
  let parsedElementCount = 0;

  for (const element of elements) {
    const tags = element.tags ?? {};
    const name = tags.name?.trim();
    const point = coordinates(element);
    if (!name || point.lat == null || point.lon == null) continue;
    parsedElementCount += 1;
    const dedupeKey = `${/restaurant|cafe|food_court/.test(tags.amenity ?? "") ? "food" : "place"}:${name.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const common = {
      id: `osm:${element.type}/${element.id}`,
      provider: "overpass" as const,
      providerPlaceId: `osm:${element.type}/${element.id}`,
      sourceStatus: "overpass-live" as const,
      name,
      image: imageFromTags(tags),
      description: tags["description:en"] ?? tags.description,
      lat: point.lat,
      lon: point.lon,
      quality: LIVE_QUALITY("OpenStreetMap / Overpass"),
    };
    if (/restaurant|cafe|food_court/.test(tags.amenity ?? "")) restaurants.push(common);
    else experiences.push({ ...common, category: tags.tourism ?? tags.historic ?? "attraction" });
  }
  return { experiences, restaurants, parsedElementCount };
}

async function runAttempt(
  latitude: number,
  longitude: number,
  attempt: OverpassAttemptDiagnostics["attempt"],
  radiusMetres: number,
  simplified: boolean,
  category?: PoiCategory,
  endpoints = OVERPASS_URLS,
) {
  const query = makeQuery(latitude, longitude, radiusMetres, simplified, category);
  if (developmentDiagnostics()) console.info("[poi:overpass:query]", { attempt, query });
  let response: Response | undefined;
  let body = "";
  let endpoint = OVERPASS_URLS[0];
  let lastError = "Overpass request failed";
  for (endpoint of endpoints) {
    try {
      const candidate = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "ASTERA/1.0 live itinerary planner",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
      });
      body = await candidate.text();
      if (candidate.ok) {
        response = candidate;
        break;
      }
      lastError = `Overpass failed (${candidate.status}): ${body.slice(0, 300)}`;
      if (developmentDiagnostics())
        console.warn("[poi:overpass:endpoint-failed]", { endpoint, status: candidate.status });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (developmentDiagnostics())
        console.warn("[poi:overpass:endpoint-failed]", { endpoint, error: lastError });
    }
  }
  if (!response) throw new Error(lastError);

  let payload: OverpassResponse;
  try {
    payload = JSON.parse(body) as OverpassResponse;
  } catch {
    throw new Error(`Overpass returned invalid JSON (${response.status}): ${body.slice(0, 200)}`);
  }
  const elements = payload.elements ?? [];
  const normalized = normalize(elements);
  const diagnostics: OverpassAttemptDiagnostics = {
    attempt,
    radiusMetres,
    endpoint,
    query,
    httpStatus: response.status,
    returnedElementCount: elements.length,
    parsedElementCount: normalized.parsedElementCount,
    normalizedAttractionCount: normalized.experiences.length,
    normalizedRestaurantCount: normalized.restaurants.length,
    category,
  };
  if (developmentDiagnostics()) console.info("[poi:overpass:result]", diagnostics);
  return { ...normalized, diagnostics };
}

function categoryKey(
  latitude: number,
  longitude: number,
  category: PoiCategory,
  itineraryRequestId: string,
) {
  return `${itineraryRequestId}:${latitude.toFixed(4)}:${longitude.toFixed(4)}:${category}`;
}

async function searchCategoryOnce(
  latitude: number,
  longitude: number,
  category: PoiCategory,
  itineraryRequestId: string,
) {
  const key = categoryKey(latitude, longitude, category, itineraryRequestId);
  const now = Date.now();
  const negative = negativeCache.get(key);
  if (negative && negative.expiresAt > now) {
    return {
      experiences: [],
      restaurants: [],
      parsedElementCount: 0,
      diagnostics: [] as OverpassAttemptDiagnostics[],
      failure: `${category}s unavailable: ${negative.reason}`,
    };
  }
  if (circuitOpenUntil > now) {
    return {
      experiences: [],
      restaurants: [],
      parsedElementCount: 0,
      diagnostics: [] as OverpassAttemptDiagnostics[],
      failure: `Overpass circuit open; ${category}s unavailable`,
    };
  }

  const diagnostics: OverpassAttemptDiagnostics[] = [];
  let lastError = "Overpass unavailable";
  for (let index = 0; index < OVERPASS_URLS.length; index += 1) {
    try {
      const result = await runAttempt(
        latitude,
        longitude,
        index === 0 ? "primary" : "simplified",
        index === 0 ? 5_000 : 12_000,
        index > 0,
        category,
        [OVERPASS_URLS[index]!],
      );
      diagnostics.push(result.diagnostics);
      consecutiveEndpointFailures = 0;
      const count =
        category === "attraction" ? result.experiences.length : result.restaurants.length;
      if (count > 0) return { ...result, diagnostics };
      lastError = `zero ${category} results`;
    } catch (error) {
      consecutiveEndpointFailures += 1;
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  if (consecutiveEndpointFailures >= OVERPASS_URLS.length) {
    circuitOpenUntil = now + CIRCUIT_TTL_MS;
  }
  negativeCache.set(key, { expiresAt: now + NEGATIVE_CACHE_TTL_MS, reason: lastError });
  return {
    experiences: [],
    restaurants: [],
    parsedElementCount: 0,
    diagnostics,
    failure: `${category}s unavailable: ${lastError}`,
  };
}

export const osmPoiProvider = {
  name: "OpenStreetMap / Overpass",
  isConfigured: () => true,

  searchCategory(
    latitude: number,
    longitude: number,
    category: PoiCategory,
    itineraryRequestId: string,
  ) {
    const key = categoryKey(latitude, longitude, category, itineraryRequestId);
    const active = categoryFlights.get(key);
    if (active) return active;
    const request = searchCategoryOnce(latitude, longitude, category, itineraryRequestId).finally(
      () => categoryFlights.delete(key),
    );
    categoryFlights.set(key, request);
    return request;
  },

  async search(latitude: number, longitude: number) {
    const itineraryRequestId = `legacy:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
    const [attractions, restaurants] = await Promise.all([
      this.searchCategory(latitude, longitude, "attraction", itineraryRequestId),
      this.searchCategory(latitude, longitude, "restaurant", itineraryRequestId),
    ]);
    return {
      experiences: attractions.experiences.slice(0, 18),
      restaurants: restaurants.restaurants.slice(0, 12),
      diagnostics: [...attractions.diagnostics, ...restaurants.diagnostics],
      ...(!attractions.experiences.length || !restaurants.restaurants.length
        ? { failure: [attractions.failure, restaurants.failure].filter(Boolean).join("; ") }
        : {}),
    };
  },
};

export function resetOverpassResilienceForTests() {
  categoryFlights.clear();
  negativeCache.clear();
  circuitOpenUntil = 0;
  consecutiveEndpointFailures = 0;
}
