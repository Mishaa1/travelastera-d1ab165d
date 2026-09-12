import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { developmentDiagnostics, requireLiveData } from "@/lib/live-data";
import { googlePlacesConfig } from "@/lib/places/google-config.server";
import {
  googlePlacesClient,
  type GoogleSearchDiagnostics,
} from "@/lib/places/google-places.server";
import { selectPoiProviders } from "@/lib/places/provider-selection";
import { osmPoiProvider } from "@/lib/pois/osm.server";
import type { PlannedExperience, PlannedRestaurant } from "@/lib/types";

const bodySchema = z.object({
  cityName: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  userSessionId: z.string().trim().min(1).max(160),
  itineraryRequestId: z.string().trim().min(1).max(200),
  requiredAttractions: z.number().int().min(0).max(36).default(3),
  requiredRestaurants: z.number().int().min(0).max(12).default(1),
});

const PIPELINE_CACHE_TTL_MS = 10 * 60_000;
const pipelineFlights = new Map<string, Promise<Record<string, unknown>>>();
const pipelineCache = new Map<string, { expiresAt: number; value: Record<string, unknown> }>();

async function sessionHash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function aggregateGoogle(diagnostics: GoogleSearchDiagnostics[]) {
  const last = diagnostics.at(-1);
  const sources = new Set(diagnostics.map((item) => item.source));
  const quota = diagnostics.find((item) => item.quotaBlocked);
  return {
    enabled: googlePlacesClient.isEnabled(),
    active: diagnostics.some(
      (item) => item.source === "google-live" || item.source === "google-cache",
    ),
    source:
      sources.size === 1
        ? last?.source
        : sources.has("google-live")
          ? "google-live"
          : sources.has("google-cache")
            ? "google-cache"
            : "unavailable",
    httpStatus: diagnostics.find((item) => item.httpStatus != null)?.httpStatus ?? null,
    callsThisItinerary: last?.usage.callsThisItinerary ?? 0,
    callsThisHour: last?.usage.callsThisHour ?? 0,
    callsToday: last?.usage.callsToday ?? 0,
    callsThisMonth: last?.usage.callsThisMonth ?? 0,
    configuredMonthlyLimit: last?.usage.configuredMonthlyLimit ?? googlePlacesConfig().monthlyLimit,
    configuredDailyLimit: last?.usage.configuredDailyLimit ?? googlePlacesConfig().dailyLimit,
    configuredHourlyLimit: last?.usage.configuredHourlyLimit ?? googlePlacesConfig().hourlyLimit,
    remainingMonthlyAllowance: last?.usage.remainingMonthlyAllowance ?? 0,
    cacheHits: diagnostics.filter((item) => item.cacheHit).length,
    cacheMisses: diagnostics.filter((item) => item.cacheMiss).length,
    attractionSearchCalls: diagnostics.filter(
      (item) => item.operation === "attraction-search" && item.source === "google-live",
    ).length,
    restaurantSearchCalls: diagnostics.filter(
      (item) => item.operation === "restaurant-search" && item.source === "google-live",
    ).length,
    detailsCalls: 0,
    photoCalls: last?.usage.photoCallsThisItinerary ?? 0,
    quotaBlocked: Boolean(quota),
    quotaBlockReason: quota?.quotaBlockReason,
    errorCategory: diagnostics.find((item) => item.errorCategory)?.errorCategory,
  };
}

function pipelineKey(data: z.infer<typeof bodySchema>) {
  return [
    data.itineraryRequestId,
    data.cityName.trim().toLocaleLowerCase("en"),
    data.latitude.toFixed(4),
    data.longitude.toFixed(4),
  ].join(":");
}

async function runPoiPipeline(
  data: z.infer<typeof bodySchema>,
  context: {
    city: string;
    latitude: number;
    longitude: number;
    userSessionHash: string;
    itineraryRequestId: string;
  },
) {
  const config = googlePlacesConfig();
  const [attractions, restaurants] = await Promise.all([
    googlePlacesClient.searchAttractions(context),
    googlePlacesClient.searchRestaurants(context),
  ]);
  const googleDiagnostics = aggregateGoogle([attractions.diagnostics, restaurants.diagnostics]);
  let overpassExperiences: PlannedExperience[] = [];
  let overpassFood: PlannedRestaurant[] = [];
  const overpassDiagnostics = [];
  let attractionFallbackFailure: string | undefined;
  let restaurantFallbackFailure: string | undefined;
  // A successful category is retained as-is. Fallback is category-specific and
  // only runs when that category is entirely missing; it never re-runs a city
  // merely to pad an already valid Google candidate pool.
  const needsAttractions = data.requiredAttractions > 0 && attractions.experiences.length === 0;
  const needsRestaurants = data.requiredRestaurants > 0 && restaurants.restaurants.length === 0;

  if (config.allowOverpassFallback && needsAttractions) {
    const fallback = await osmPoiProvider.searchCategory(
      context.latitude,
      context.longitude,
      "attraction",
      context.itineraryRequestId,
    );
    overpassExperiences = fallback.experiences;
    overpassDiagnostics.push(...fallback.diagnostics);
    attractionFallbackFailure = fallback.failure;
  }
  if (config.allowOverpassFallback && needsRestaurants) {
    const fallback = await osmPoiProvider.searchCategory(
      context.latitude,
      context.longitude,
      "restaurant",
      context.itineraryRequestId,
    );
    overpassFood = fallback.restaurants;
    overpassDiagnostics.push(...fallback.diagnostics);
    restaurantFallbackFailure = fallback.failure;
  }

  const selected = selectPoiProviders({
    googleAttractions: attractions.experiences,
    googleRestaurants: restaurants.restaurants,
    overpassAttractions: overpassExperiences,
    overpassRestaurants: overpassFood,
    googleActive: googleDiagnostics.active,
    googleQuotaBlocked: googleDiagnostics.quotaBlocked,
    googleErrorCategory: googleDiagnostics.errorCategory,
    maxAttractions: config.maxAttractions,
    maxRestaurants: config.maxRestaurants,
    requiredAttractions: data.requiredAttractions,
    requiredRestaurants: data.requiredRestaurants,
  });
  const experiences = selected.attractions;
  const food = selected.restaurants;
  const attractionsAvailable = experiences.length > 0;
  const restaurantsAvailable = food.length > 0;
  const active = attractionsAvailable && restaurantsAvailable;
  const partial = attractionsAvailable !== restaurantsAvailable;
  const attractionSource = attractions.experiences.length
    ? attractions.diagnostics.source
    : overpassExperiences.length
      ? "overpass-live"
      : "unavailable";
  const restaurantSource = restaurants.restaurants.length
    ? restaurants.diagnostics.source
    : overpassFood.length
      ? "overpass-live"
      : "unavailable";
  const restaurantReason = !restaurantsAvailable
    ? [
        restaurants.diagnostics.quotaBlocked
          ? `quota blocked (${restaurants.diagnostics.quotaBlockReason})`
          : restaurants.diagnostics.errorCategory,
        restaurantFallbackFailure,
      ]
        .filter(Boolean)
        .join("; ") || "restaurants unavailable"
    : undefined;
  const attractionReason = !attractionsAvailable
    ? [attractions.diagnostics.errorCategory, attractionFallbackFailure]
        .filter(Boolean)
        .join("; ") || "attractions unavailable"
    : undefined;
  const fallbackProvider = selected.fallbackProvider;
  const provider = googleDiagnostics.active
    ? fallbackProvider
      ? "Google Places API (New) + OpenStreetMap / Overpass"
      : "Google Places API (New)"
    : fallbackProvider
      ? "OpenStreetMap / Overpass"
      : "none";
  const fallbackMessage = !restaurantsAvailable
    ? `Restaurants unavailable${restaurantReason ? `: ${restaurantReason}` : ""}.`
    : !attractionsAvailable
      ? `Attractions unavailable${attractionReason ? `: ${attractionReason}` : ""}.`
      : selected.fallbackMessage;

  if (developmentDiagnostics())
    console.info("[poi:pipeline:result]", {
      city: context.city,
      provider,
      attractions: {
        source: attractionSource,
        count: experiences.length,
        reason: attractionReason,
      },
      restaurants: { source: restaurantSource, count: food.length, reason: restaurantReason },
      partial,
      google: googleDiagnostics,
      fallbackProvider,
    });

  return {
    experiences,
    restaurants: food,
    configured: googleDiagnostics.enabled || config.allowOverpassFallback,
    provider,
    source: active
      ? googleDiagnostics.active
        ? googleDiagnostics.source
        : "overpass-live"
      : partial
        ? attractionSource === "unavailable"
          ? restaurantSource
          : attractionSource
        : "unavailable",
    status: active ? "active" : partial ? "partial" : "error",
    requiredLiveData: requireLiveData(),
    fallbackMessage,
    diagnostics: {
      city: context.city,
      latitude: context.latitude,
      longitude: context.longitude,
      google: googleDiagnostics,
      fallbackProvider,
      attempts: overpassDiagnostics,
      partial,
      categories: {
        attractions: {
          source: attractionSource,
          count: experiences.length,
          unavailableReason: attractionReason,
        },
        restaurants: {
          source: restaurantSource,
          count: food.length,
          unavailableReason: restaurantReason,
        },
      },
    },
    ...(!active ? { error: fallbackMessage ?? "Live places unavailable" } : {}),
  };
}

export const Route = createFileRoute("/api/pois/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = bodySchema.safeParse(await request.json());
        } catch {
          return Response.json({ error: "Malformed POI request" }, { status: 400 });
        }
        if (!parsed.success)
          return Response.json({ error: "Invalid POI request" }, { status: 400 });

        const context = {
          city: parsed.data.cityName,
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          userSessionHash: await sessionHash(parsed.data.userSessionId),
          itineraryRequestId: parsed.data.itineraryRequestId,
        };
        if (developmentDiagnostics())
          console.info("[poi:google:city]", {
            ...context,
            userSessionHash: `${context.userSessionHash.slice(0, 12)}…`,
          });

        const key = pipelineKey(parsed.data);
        const cached = pipelineCache.get(key);
        let value: Record<string, unknown>;
        if (cached && cached.expiresAt > Date.now()) {
          value = cached.value;
        } else {
          const active = pipelineFlights.get(key);
          const request = active ?? runPoiPipeline(parsed.data, context);
          if (!active) pipelineFlights.set(key, request);
          try {
            value = await request;
            pipelineCache.set(key, { expiresAt: Date.now() + PIPELINE_CACHE_TTL_MS, value });
          } finally {
            if (!active) pipelineFlights.delete(key);
          }
        }
        const complete = value.status === "active";
        return Response.json(value, { status: !complete && requireLiveData() ? 503 : 200 });
      },
    },
  },
});
