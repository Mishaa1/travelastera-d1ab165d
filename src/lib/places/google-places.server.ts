import { LIVE_QUALITY } from "../../api/config.ts";
import type { PlannedExperience, PlannedRestaurant } from "../types.ts";

import { googlePlacesConfig } from "./google-config.server.ts";
import { googlePlacesStore, type PlaceCacheEntry } from "./store.server.ts";
import {
  GooglePlacesUsageGuard,
  type UsageContext,
  type UsageSnapshot,
} from "./usage-guard.server.ts";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "places.currentOpeningHours",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.photos",
  "places.attributions",
].join(",");
const FIELD_MASK_VERSION = "nearby-v2-grounded-2026-07";

interface GoogleAuthorAttribution {
  displayName?: string;
  uri?: string;
  photoUri?: string;
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
  currentOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
  websiteUri?: string;
  googleMapsUri?: string;
  photos?: Array<{ name?: string; authorAttributions?: GoogleAuthorAttribution[] }>;
  attributions?: Array<{ provider?: string; providerUri?: string }>;
}

interface GoogleSearchResponse {
  places?: GooglePlace[];
}

export interface GooglePlacesRequestContext {
  city: string;
  latitude: number;
  longitude: number;
  userSessionHash: string;
  itineraryRequestId: string;
}

export interface GoogleSearchDiagnostics {
  source: "google-live" | "google-cache" | "unavailable";
  operation: "attraction-search" | "restaurant-search";
  httpStatus: number | null;
  cacheHit: boolean;
  cacheMiss: boolean;
  quotaBlocked: boolean;
  quotaBlockReason?: string;
  errorCategory?: string;
  usage: UsageSnapshot;
}

export interface GoogleSearchResult {
  experiences: PlannedExperience[];
  restaurants: PlannedRestaurant[];
  diagnostics: GoogleSearchDiagnostics;
}

const flights = new Map<string, Promise<GoogleSearchResult>>();

const normalizedCity = (city: string) => city.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
const rounded = (value: number) => value.toFixed(4);

function cacheKey(
  kind: "attraction" | "restaurant",
  context: GooglePlacesRequestContext,
  radius: number,
  language: string,
  region: string,
) {
  return [
    "google",
    FIELD_MASK_VERSION,
    kind,
    normalizedCity(context.city),
    rounded(context.latitude),
    rounded(context.longitude),
    radius,
    language,
    region,
  ].join(":");
}

function usageContext(
  context: GooglePlacesRequestContext,
  operation: UsageContext["operation"],
): UsageContext {
  return {
    operation,
    userSessionHash: context.userSessionHash,
    itineraryRequestId: context.itineraryRequestId,
    city: context.city,
  };
}

function errorCategory(status: number, body: string) {
  const value = body.toLowerCase();
  if (status === 401 || value.includes("api key not valid")) return "invalid API key";
  if (status === 403 && value.includes("billing")) return "billing disabled";
  if (status === 403) return "unauthorized";
  if (status === 429 && value.includes("quota")) return "quota exceeded";
  if (status === 429) return "rate limited";
  if (status === 400) return "invalid request";
  if (status >= 500) return "provider unavailable";
  return "provider unavailable";
}

function rank(place: GooglePlace, center: { latitude: number; longitude: number }) {
  const rating = place.rating == null ? 3.8 : place.rating;
  const confidence = Math.log10(Math.max(1, place.userRatingCount ?? 1));
  const lat = place.location?.latitude ?? center.latitude;
  const lon = place.location?.longitude ?? center.longitude;
  const distance = Math.hypot(lat - center.latitude, lon - center.longitude);
  const open = place.currentOpeningHours?.openNow === false ? -0.25 : 0;
  return rating + confidence * 0.35 - distance * 2 + open;
}

function common(place: GooglePlace) {
  const photo = place.photos?.[0];
  return {
    id: place.id!,
    provider: "google" as const,
    providerPlaceId: place.id!,
    sourceStatus: "google-live" as const,
    name: place.displayName!.text!.trim(),
    lat: place.location!.latitude,
    lon: place.location!.longitude,
    address: place.formattedAddress,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    openingHours:
      place.currentOpeningHours?.weekdayDescriptions ??
      place.regularOpeningHours?.weekdayDescriptions,
    openNow: place.currentOpeningHours?.openNow,
    website: place.websiteUri,
    providerUrl: place.googleMapsUri,
    photoReference: photo?.name,
    photoAttributions: photo?.authorAttributions,
    quality: LIVE_QUALITY("Google Places API (New)"),
  };
}

function photoProxyUrl(photoName: string | undefined, context: GooglePlacesRequestContext) {
  if (!photoName) return undefined;
  return `/api/pois/photo?${new URLSearchParams({
    photo: photoName,
    city: context.city,
    itineraryRequestId: context.itineraryRequestId,
    session: context.userSessionHash,
  })}`;
}

export function normalizeGooglePlaces(
  places: GooglePlace[],
  kind: "attraction" | "restaurant",
  context: GooglePlacesRequestContext,
) {
  const seen = new Set<string>();
  const valid = places
    .filter((place) => {
      if (
        !place.id ||
        !place.displayName?.text?.trim() ||
        !Number.isFinite(place.location?.latitude) ||
        !Number.isFinite(place.location?.longitude) ||
        seen.has(place.id)
      )
        return false;
      seen.add(place.id);
      return true;
    })
    .sort((a, b) => rank(b, context) - rank(a, context));
  if (kind === "restaurant") {
    return {
      experiences: [],
      restaurants: valid.map((place): PlannedRestaurant => ({
        ...common(place),
        image: photoProxyUrl(place.photos?.[0]?.name, context),
        category: place.primaryType ?? place.types?.[0] ?? "restaurant",
      })),
    };
  }
  return {
    experiences: valid.map((place): PlannedExperience => ({
      ...common(place),
      image: photoProxyUrl(place.photos?.[0]?.name, context),
      category: place.primaryType ?? place.types?.[0] ?? "tourist_attraction",
    })),
    restaurants: [],
  };
}

async function cached<T>(key: string) {
  return googlePlacesStore().transaction((data) => {
    const entry = data.caches[key] as PlaceCacheEntry<T> | undefined;
    return entry && Date.parse(entry.expiresAt) > Date.now() ? entry : undefined;
  });
}

async function saveCache<T>(entry: PlaceCacheEntry<T>) {
  await googlePlacesStore().transaction((data) => {
    data.caches[entry.key] = entry as PlaceCacheEntry;
  });
}

async function search(
  kind: "attraction" | "restaurant",
  context: GooglePlacesRequestContext,
): Promise<GoogleSearchResult> {
  const config = googlePlacesConfig();
  const operation = kind === "attraction" ? "attraction-search" : "restaurant-search";
  const usage = usageContext(context, operation);
  const guard = new GooglePlacesUsageGuard(config);
  const radius = kind === "attraction" ? config.attractionRadius : config.restaurantRadius;
  const key = cacheKey(kind, context, radius, config.languageCode, config.regionCode);
  const hit = await cached<{ experiences: PlannedExperience[]; restaurants: PlannedRestaurant[] }>(
    key,
  );
  if (hit) {
    await guard.recordCacheHit(usage);
    const cachedValue = {
      experiences: hit.value.experiences.map((place) => ({
        ...place,
        sourceStatus: "google-cache" as const,
      })),
      restaurants: hit.value.restaurants.map((place) => ({
        ...place,
        sourceStatus: "google-cache" as const,
      })),
    };
    return {
      ...cachedValue,
      diagnostics: {
        source: "google-cache",
        operation,
        httpStatus: 200,
        cacheHit: true,
        cacheMiss: false,
        quotaBlocked: false,
        usage: await guard.snapshot(usage),
      },
    };
  }
  if (!config.enabled || !config.apiKey) {
    return {
      experiences: [],
      restaurants: [],
      diagnostics: {
        source: "unavailable",
        operation,
        httpStatus: null,
        cacheHit: false,
        cacheMiss: true,
        quotaBlocked: false,
        errorCategory: config.enabled ? "invalid API key" : "disabled",
        usage: await guard.snapshot(usage),
      },
    };
  }
  const reservation = await guard.reserve(usage);
  if (!reservation.allowed) {
    return {
      experiences: [],
      restaurants: [],
      diagnostics: {
        source: "unavailable",
        operation,
        httpStatus: null,
        cacheHit: false,
        cacheMiss: true,
        quotaBlocked: true,
        quotaBlockReason: reservation.reason,
        errorCategory: "application quota reached",
        usage: reservation.usage,
      },
    };
  }
  let status: number | null = null;
  try {
    const response = await fetch(`${config.baseUrl}/places:searchNearby`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.apiKey,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes:
          kind === "attraction"
            ? ["tourist_attraction", "museum", "art_gallery", "historical_landmark", "park"]
            : ["restaurant", "cafe"],
        maxResultCount:
          kind === "attraction"
            ? Math.min(20, Math.max(config.maxAttractions, 10))
            : Math.min(20, Math.max(config.maxRestaurants, 8)),
        languageCode: config.languageCode,
        regionCode: config.regionCode,
        rankPreference: "POPULARITY",
        locationRestriction: {
          circle: { center: { latitude: context.latitude, longitude: context.longitude }, radius },
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    status = response.status;
    const body = await response.text();
    if (!response.ok) {
      await guard.complete(reservation.reservationId, status);
      return {
        experiences: [],
        restaurants: [],
        diagnostics: {
          source: "unavailable",
          operation,
          httpStatus: status,
          cacheHit: false,
          cacheMiss: true,
          quotaBlocked: false,
          errorCategory: errorCategory(status, body.slice(0, 1_000)),
          usage: await guard.snapshot(usage),
        },
      };
    }
    const payload = JSON.parse(body) as GoogleSearchResponse;
    const normalized = normalizeGooglePlaces(payload.places ?? [], kind, context);
    const limited = {
      experiences: normalized.experiences.slice(0, config.maxAttractions),
      restaurants: normalized.restaurants.slice(0, config.maxRestaurants),
    };
    await guard.complete(reservation.reservationId, status);
    const cacheTtl =
      (payload.places?.length ?? 0)
        ? config.poiCacheTtlMs
        : Math.min(config.poiCacheTtlMs, 5 * 60_000);
    await saveCache({
      key,
      provider: "google-places",
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + cacheTtl).toISOString(),
      sourceStatus: (payload.places?.length ?? 0) ? "success" : "zero-results",
      providerIds: [...limited.experiences, ...limited.restaurants].map((place) => place.id),
      attribution: (payload.places ?? []).flatMap((place) => [
        ...(place.attributions ?? []),
        ...(place.photos?.flatMap((photo) => photo.authorAttributions ?? []) ?? []),
      ]),
      value: limited,
    });
    return {
      ...limited,
      diagnostics: {
        source: "google-live",
        operation,
        httpStatus: status,
        cacheHit: false,
        cacheMiss: true,
        quotaBlocked: false,
        usage: await guard.snapshot(usage),
      },
    };
  } catch (error) {
    await guard.complete(reservation.reservationId, status);
    return {
      experiences: [],
      restaurants: [],
      diagnostics: {
        source: "unavailable",
        operation,
        httpStatus: status,
        cacheHit: false,
        cacheMiss: true,
        quotaBlocked: false,
        errorCategory:
          error instanceof DOMException && error.name === "TimeoutError"
            ? "timeout"
            : "provider unavailable",
        usage: await guard.snapshot(usage),
      },
    };
  }
}

type PhotoFetchResult = {
  bytes: Uint8Array | null;
  contentType: string | null;
  source: "google-live" | "google-cache" | "unavailable";
  quotaBlockReason?: string;
  errorCategory?: string;
};

// A page can render the same provider photo in several responsive/editorial
// slots at once. Share that first cache miss so it produces one Google request
// and one cache write rather than a burst of duplicate calls.
const photoFlights = new Map<string, Promise<PhotoFetchResult>>();

export const googlePlacesClient = {
  isEnabled: () => {
    const config = googlePlacesConfig();
    return config.enabled && Boolean(config.apiKey);
  },
  searchAttractions(context: GooglePlacesRequestContext) {
    const key = `attraction:${cacheKey("attraction", context, googlePlacesConfig().attractionRadius, googlePlacesConfig().languageCode, googlePlacesConfig().regionCode)}`;
    const active = flights.get(key);
    if (active) return active;
    const request = search("attraction", context).finally(() => flights.delete(key));
    flights.set(key, request);
    return request;
  },
  searchRestaurants(context: GooglePlacesRequestContext) {
    const key = `restaurant:${cacheKey("restaurant", context, googlePlacesConfig().restaurantRadius, googlePlacesConfig().languageCode, googlePlacesConfig().regionCode)}`;
    const active = flights.get(key);
    if (active) return active;
    const request = search("restaurant", context).finally(() => flights.delete(key));
    flights.set(key, request);
    return request;
  },
  async fetchPhoto(photoName: string, context: GooglePlacesRequestContext) {
    const flightKey = `${photoName}:960`;
    const active = photoFlights.get(flightKey);
    if (active) return active;

    const request = (async (): Promise<PhotoFetchResult> => {
    const config = googlePlacesConfig();
    // Cache verified image bytes against the stable Google photo resource. We
    // deliberately never persist Google's temporary googleusercontent redirect.
    const key = `google:photo-bytes-v1:${photoName}:960`;
    const usage = usageContext(context, "photo");
    const guard = new GooglePlacesUsageGuard(config);
    const hit = await cached<{ base64: string; contentType: string }>(key);
    if (hit) {
      await guard.recordCacheHit(usage);
      return {
        bytes: Uint8Array.from(atob(hit.value.base64), (character) => character.charCodeAt(0)),
        contentType: hit.value.contentType,
        source: "google-cache" as const,
      };
    }
    // One-time migration from the old cache format. The temporary URI is not
    // returned or retained as canonical state: it is fetched, verified, and
    // replaced with cached image bytes before the quota guard is consulted.
    const legacy = await cached<{ photoUri: string }>(`google:photo-v1:${photoName}:960`);
    if (legacy?.value.photoUri) {
      try {
        const legacyResponse = await fetch(legacy.value.photoUri, {
          signal: AbortSignal.timeout(8_000),
        });
        const legacyType = legacyResponse.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
        if (legacyResponse.ok && legacyType.startsWith("image/")) {
          const legacyBytes = new Uint8Array(await legacyResponse.arrayBuffer());
          if (legacyBytes.byteLength >= 32) {
            let binary = "";
            for (let offset = 0; offset < legacyBytes.length; offset += 0x8000) {
              binary += String.fromCharCode(...legacyBytes.subarray(offset, offset + 0x8000));
            }
            await saveCache({
              key,
              provider: "google-places",
              fetchedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + config.photoCacheTtlMs).toISOString(),
              sourceStatus: "success",
              providerIds: [photoName],
              attribution: [],
              value: { base64: btoa(binary), contentType: legacyType },
            });
            await guard.recordCacheHit(usage);
            return { bytes: legacyBytes, contentType: legacyType, source: "google-cache" as const };
          }
        }
      } catch {
        // Continue to the guarded provider request when the legacy URI expired.
      }
    }
    const reservation = await guard.reserve(usage);
    if (!reservation.allowed)
      return {
        bytes: null,
        contentType: null,
        source: "unavailable" as const,
        quotaBlockReason: reservation.reason,
      };
    let status: number | null = null;
    try {
      const params = new URLSearchParams({ maxWidthPx: "960", skipHttpRedirect: "false" });
      const response = await fetch(`${config.baseUrl}/${photoName}/media?${params}`, {
        headers: { "X-Goog-Api-Key": config.apiKey },
        signal: AbortSignal.timeout(10_000),
      });
      status = response.status;
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      await guard.complete(reservation.reservationId, status);
      if (!response.ok || !contentType.startsWith("image/"))
        return {
          bytes: null,
          contentType: null,
          source: "unavailable" as const,
          errorCategory: response.ok ? "invalid image response" : errorCategory(status, ""),
        };
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 32)
        return {
          bytes: null,
          contentType: null,
          source: "unavailable" as const,
          errorCategory: "empty image response",
        };
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      await saveCache({
        key,
        provider: "google-places",
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + config.photoCacheTtlMs).toISOString(),
        sourceStatus: "success",
        providerIds: [photoName],
        attribution: [],
        value: { base64: btoa(binary), contentType },
      });
      return { bytes, contentType, source: "google-live" as const };
    } catch (error) {
      await guard.complete(reservation.reservationId, status);
      return {
        bytes: null,
        contentType: null,
        source: "unavailable" as const,
        errorCategory:
          error instanceof DOMException && error.name === "TimeoutError"
            ? "timeout"
            : "provider unavailable",
      };
    }
    })();

    photoFlights.set(flightKey, request);
    return request.finally(() => photoFlights.delete(flightKey));
  },
};
