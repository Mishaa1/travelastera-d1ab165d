import { groundItineraryDays } from "@/lib/places/itinerary-grounding";
import type { DayPlan, PlannedExperience, PlannedRestaurant, TripStop } from "@/lib/types";

interface PoiResponse {
  experiences: PlannedExperience[];
  restaurants: PlannedRestaurant[];
  provider: string;
  source?: "google-live" | "google-cache" | "overpass-live" | "unavailable";
  status: "active" | "partial" | "empty" | "error";
  requiredLiveData?: boolean;
  fallbackMessage?: string;
  diagnostics?: {
    city?: string;
    latitude: number;
    longitude: number;
    attempts?: Array<{
      attempt: string;
      radiusMetres: number;
      endpoint?: string;
      query: string;
      httpStatus: number;
      returnedElementCount: number;
      parsedElementCount: number;
      normalizedAttractionCount: number;
      normalizedRestaurantCount: number;
    }>;
    google?: {
      enabled: boolean;
      active: boolean;
      source?: string;
      httpStatus: number | null;
      callsThisItinerary: number;
      callsThisHour: number;
      callsToday: number;
      callsThisMonth: number;
      configuredMonthlyLimit: number;
      configuredDailyLimit: number;
      configuredHourlyLimit: number;
      remainingMonthlyAllowance: number;
      cacheHits: number;
      cacheMisses: number;
      attractionSearchCalls: number;
      restaurantSearchCalls: number;
      detailsCalls: number;
      photoCalls: number;
      quotaBlocked: boolean;
      quotaBlockReason?: string;
      errorCategory?: string;
    };
    fallbackProvider?: string | null;
    partial?: boolean;
    categories?: {
      attractions: { source: string; count: number; unavailableReason?: string };
      restaurants: { source: string; count: number; unavailableReason?: string };
    };
  };
}

const poiSearchCache = new Map<string, Promise<PoiResponse>>();

function anonymousSessionId() {
  const key = "astera:anonymous-session";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

async function searchPois(
  stop: TripStop,
  itineraryRequestId: string,
  requiredAttractions: number,
  requiredRestaurants: number,
): Promise<PoiResponse> {
  if (typeof window === "undefined") {
    if (import.meta.env.DEV)
      console.error("[poi:client] POI search attempted outside the browser", {
        city: stop.name,
        latitude: stop.lat,
        longitude: stop.lon,
      });
    return { experiences: [], restaurants: [], provider: "none", status: "error" };
  }
  const cacheKey = `${itineraryRequestId}:${stop.lat.toFixed(4)},${stop.lon.toFixed(4)}`;
  const cached = poiSearchCache.get(cacheKey);
  if (cached) return cached;
  const search = (async () => {
    try {
      const response = await fetch("/api/pois/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityName: stop.name,
          latitude: stop.lat,
          longitude: stop.lon,
          userSessionId: anonymousSessionId(),
          itineraryRequestId,
          requiredAttractions,
          requiredRestaurants,
        }),
        signal: AbortSignal.timeout(65_000),
      });
      const payload = (await response.json()) as PoiResponse & {
        error?: string;
        requiredLiveData?: boolean;
      };
      if (!response.ok || payload.status === "error") {
        if (payload.requiredLiveData && payload.status === "error") {
          throw new Error(payload.error ?? "Live places unavailable");
        }
        return payload;
      }
      if (import.meta.env.DEV)
        console.info("[poi:client:response]", {
          city: stop.name,
          httpStatus: response.status,
          provider: payload.provider,
          attractions: payload.experiences.length,
          restaurants: payload.restaurants.length,
          diagnostics: payload.diagnostics,
        });
      return payload;
    } catch (error) {
      if (error instanceof Error && /Live places|Overpass|OpenTripMap/i.test(error.message)) {
        throw error;
      }
      const failed: PoiResponse = {
        experiences: [],
        restaurants: [],
        provider: "none",
        status: "error",
      };
      poiSearchCache.delete(cacheKey);
      if (import.meta.env.DEV)
        console.error("[poi:client:error]", {
          city: stop.name,
          error: error instanceof Error ? error.message : String(error),
        });
      return failed;
    }
  })();
  poiSearchCache.set(cacheKey, search);
  return search;
}

/** Adds provider POIs without changing the DayPlan shape consumed by the itinerary UI. */
export async function enrichItineraryWithPois(
  stops: TripStop[],
  itinerary: DayPlan[],
  itineraryRequestId: string = crypto.randomUUID(),
) {
  const byCity = new Map(
    await Promise.all(
      stops.map(async (stop) => {
        const days = itinerary.filter((day) => day.city === stop.name).length;
        return [stop.name, await searchPois(stop, itineraryRequestId, days * 3, days)] as const;
      }),
    ),
  );
  const grounded = groundItineraryDays(
    itinerary,
    Object.fromEntries(
      [...byCity].map(([city, data]) => [
        city,
        { experiences: data.experiences, restaurants: data.restaurants },
      ]),
    ),
  );
  const enrichedItinerary = grounded.itinerary;
  const renderedByCity = stops.map((stop) => {
    const renderedDays = enrichedItinerary.filter((day) => day.city === stop.name);
    const source = byCity.get(stop.name);
    const lastAttempt = source?.diagnostics?.attempts?.at(-1);
    const renderingAttractionCount = renderedDays.reduce(
      (total, day) => total + (day.experiences?.length ?? 0),
      0,
    );
    const renderingRestaurantCount = renderedDays.filter((day) => day.restaurantDetails).length;
    const cityDiagnostics = {
      requestedCity: stop.name,
      latitude: stop.lat,
      longitude: stop.lon,
      httpStatus: lastAttempt?.httpStatus ?? null,
      returnedElementCount: lastAttempt?.returnedElementCount ?? 0,
      parsedElementCount: lastAttempt?.parsedElementCount ?? 0,
      normalizedAttractionCount: source?.experiences.length ?? 0,
      normalizedRestaurantCount: source?.restaurants.length ?? 0,
      renderingAttractionCount,
      renderingRestaurantCount,
      attempts: source?.diagnostics?.attempts,
    };
    if (import.meta.env.DEV) console.info("[poi:rendering]", cityDiagnostics);
    return cityDiagnostics;
  });
  if (import.meta.env.DEV) {
    enrichedItinerary.forEach((day) =>
      console.info(`[poi:day-${day.day}:provenance]`, day.poiProvenance),
    );
  }
  const googleRows = [...byCity.values()]
    .map((value) => value.diagnostics?.google)
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  const latestGoogle = googleRows.at(-1);
  const google = latestGoogle
    ? {
        ...latestGoogle,
        active: googleRows.some((value) => value.active),
        cacheHits: googleRows.reduce((total, value) => total + value.cacheHits, 0),
        cacheMisses: googleRows.reduce((total, value) => total + value.cacheMisses, 0),
        attractionSearchCalls: googleRows.reduce(
          (total, value) => total + value.attractionSearchCalls,
          0,
        ),
        restaurantSearchCalls: googleRows.reduce(
          (total, value) => total + value.restaurantSearchCalls,
          0,
        ),
        detailsCalls: googleRows.reduce((total, value) => total + value.detailsCalls, 0),
        quotaBlocked: googleRows.some((value) => value.quotaBlocked),
        quotaBlockReason: googleRows.find((value) => value.quotaBlockReason)?.quotaBlockReason,
        errorCategory: googleRows.find((value) => value.errorCategory)?.errorCategory,
      }
    : undefined;
  return {
    itinerary: enrichedItinerary,
    diagnostics: {
      provider: [...new Set([...byCity.values()].map((value) => value.provider))].join(", "),
      status: [...byCity.values()].every((value) => value.status === "active")
        ? ("active" as const)
        : [...byCity.values()].some((value) => value.status === "partial")
          ? ("partial" as const)
          : [...byCity.values()].some((value) => value.status === "error")
            ? ("error" as const)
            : ("empty" as const),
      liveAttractionCount: [...byCity.values()].reduce(
        (total, value) => total + value.experiences.length,
        0,
      ),
      liveRestaurantCount: [...byCity.values()].reduce(
        (total, value) => total + value.restaurants.length,
        0,
      ),
      cities: renderedByCity,
      source:
        [...new Set([...byCity.values()].map((value) => value.source).filter(Boolean))].join(
          ", ",
        ) || "unavailable",
      google,
      fallbackProvider:
        [...byCity.values()].map((value) => value.diagnostics?.fallbackProvider).find(Boolean) ??
        null,
      fallbackMessage: [...byCity.values()].map((value) => value.fallbackMessage).find(Boolean),
      partial: [...byCity.values()].some((value) => value.diagnostics?.partial),
      categories: [...byCity.values()].map((value) => value.diagnostics?.categories).find(Boolean),
    },
  };
}
