import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  googlePlacesConfig,
  type GooglePlacesConfig,
} from "../src/lib/places/google-config.server.ts";
import {
  googlePlacesClient,
  normalizeGooglePlaces,
} from "../src/lib/places/google-places.server.ts";
import {
  MemoryGooglePlacesStore,
  setGooglePlacesStoreForTests,
} from "../src/lib/places/store.server.ts";
import { GooglePlacesUsageGuard, type UsageContext } from "../src/lib/places/usage-guard.server.ts";
import { selectPoiProviders } from "../src/lib/places/provider-selection.ts";

const baseConfig = (overrides: Partial<GooglePlacesConfig> = {}): GooglePlacesConfig => ({
  ...googlePlacesConfig(),
  apiKey: "test-secret-key",
  enabled: true,
  monthlyLimit: 800,
  monthlySafetyBuffer: 0,
  dailyLimit: 40,
  hourlyLimit: 10,
  userHourlyLimit: 5,
  itineraryLimit: 3,
  maxPhotosPerItinerary: 4,
  ...overrides,
});

const context = (
  operation: UsageContext["operation"] = "attraction-search",
  suffix = "1",
): UsageContext => ({
  operation,
  userSessionHash: `session-${suffix}`,
  itineraryRequestId: `trip-${suffix}`,
  city: "Vienna",
});

async function consume(guard: GooglePlacesUsageGuard, value: UsageContext) {
  const reservation = await guard.reserve(value);
  if (reservation.allowed) await guard.complete(reservation.reservationId, 200);
  return reservation;
}

test("cache hit does not increment provider quota", async () => {
  const guard = new GooglePlacesUsageGuard(baseConfig(), new MemoryGooglePlacesStore());
  await guard.recordCacheHit(context());
  assert.equal((await guard.snapshot(context())).callsThisMonth, 0);
});

for (const [name, overrides, first, second] of [
  ["monthly", { monthlyLimit: 1 }, context(), context("attraction-search", "2")],
  ["daily", { dailyLimit: 1 }, context(), context("attraction-search", "2")],
  ["hourly", { hourlyLimit: 1 }, context(), context("attraction-search", "2")],
  [
    "per-user hourly",
    { userHourlyLimit: 1 },
    context(),
    { ...context("attraction-search", "2"), userSessionHash: "session-1" },
  ],
  [
    "per-itinerary",
    { itineraryLimit: 1 },
    context(),
    { ...context("restaurant-search", "2"), itineraryRequestId: "trip-1" },
  ],
] as const) {
  test(`${name} limit blocks Google`, async () => {
    const guard = new GooglePlacesUsageGuard(baseConfig(overrides), new MemoryGooglePlacesStore());
    assert.equal((await consume(guard, first)).allowed, true);
    assert.equal((await guard.reserve(second)).allowed, false);
  });
}

test("photo limit blocks extra photos", async () => {
  const guard = new GooglePlacesUsageGuard(
    baseConfig({ maxPhotosPerItinerary: 1 }),
    new MemoryGooglePlacesStore(),
  );
  assert.equal((await consume(guard, context("photo"))).allowed, true);
  assert.equal((await guard.reserve(context("photo"))).allowed, false);
});

test("concurrent requests cannot bypass the final quota slot", async () => {
  const guard = new GooglePlacesUsageGuard(
    baseConfig({ hourlyLimit: 1 }),
    new MemoryGooglePlacesStore(),
  );
  const outcomes = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      guard.reserve(context("attraction-search", String(index))),
    ),
  );
  assert.equal(outcomes.filter((outcome) => outcome.allowed).length, 1);
});

test("duplicate provider IDs are removed and attribution is preserved", () => {
  const places = [
    {
      id: "google-1",
      displayName: { text: "Museum" },
      location: { latitude: 48.2, longitude: 16.3 },
      rating: 4.7,
      photos: [{ name: "places/google-1/photos/a", authorAttributions: [{ displayName: "Ada" }] }],
    },
    {
      id: "google-1",
      displayName: { text: "Duplicate" },
      location: { latitude: 48.2, longitude: 16.3 },
    },
  ];
  const result = normalizeGooglePlaces(places, "attraction", {
    city: "Vienna",
    latitude: 48.2,
    longitude: 16.3,
    userSessionHash: "hash",
    itineraryRequestId: "trip",
  });
  assert.equal(result.experiences.length, 1);
  assert.equal(result.experiences[0].id, "google-1");
  assert.equal(result.experiences[0].photoAttributions?.[0]?.displayName, "Ada");
});

test("valid search cache avoids a provider request and expired cache refreshes", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  let calls = 0;
  try {
    Object.assign(process.env, {
      GOOGLE_PLACES_ENABLED: "true",
      GOOGLE_PLACES_API_KEY: "test-secret-key",
      GOOGLE_PLACES_MONTHLY_SAFETY_BUFFER: "0",
      GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT: "800",
      GOOGLE_PLACES_DAILY_REQUEST_LIMIT: "40",
      GOOGLE_PLACES_HOURLY_REQUEST_LIMIT: "10",
      GOOGLE_PLACES_MAX_REQUESTS_PER_USER_PER_HOUR: "5",
      GOOGLE_PLACES_MAX_CALLS_PER_ITINERARY: "3",
      POI_CACHE_TTL_SECONDS: "604800",
    });
    setGooglePlacesStoreForTests(new MemoryGooglePlacesStore());
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json({
        places: [
          {
            id: "google-cache-test",
            displayName: { text: "Live Museum" },
            location: { latitude: 48.2, longitude: 16.3 },
          },
        ],
      });
    };
    const request = {
      city: `Cache City ${crypto.randomUUID()}`,
      latitude: 48.2,
      longitude: 16.3,
      userSessionHash: "hash",
      itineraryRequestId: "cache-trip",
    };
    const first = await googlePlacesClient.searchAttractions(request);
    const second = await googlePlacesClient.searchAttractions(request);
    assert.equal(first.diagnostics.source, "google-live");
    assert.equal(second.diagnostics.source, "google-cache");
    assert.equal(calls, 1);

    process.env.POI_CACHE_TTL_SECONDS = "0";
    const expiredRequest = {
      ...request,
      city: `Expired City ${crypto.randomUUID()}`,
      itineraryRequestId: "expired-trip",
    };
    await googlePlacesClient.searchAttractions(expiredRequest);
    await new Promise((resolve) => setTimeout(resolve, 2));
    await googlePlacesClient.searchAttractions(expiredRequest);
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    setGooglePlacesStoreForTests(undefined);
  }
});

test("Google API key is not referenced by browser services or route output", async () => {
  const browserService = await readFile("src/services/poiService.ts", "utf8");
  const route = await readFile("src/routes/api/pois/search.ts", "utf8");
  assert.doesNotMatch(browserService, /GOOGLE_PLACES_API_KEY|X-Goog-Api-Key|VITE_.*GOOGLE/);
  assert.doesNotMatch(route, /apiKey\s*[:,]|GOOGLE_PLACES_API_KEY/);
});

test("Google error falls back to Overpass without fabricated POIs", () => {
  const overpass = { id: "osm:node/1", name: "Real OSM place" };
  const result = selectPoiProviders({
    googleAttractions: [],
    googleRestaurants: [],
    overpassAttractions: [overpass],
    overpassRestaurants: [overpass],
    googleActive: false,
    googleQuotaBlocked: false,
    googleErrorCategory: "provider unavailable",
    maxAttractions: 5,
    maxRestaurants: 4,
  });
  assert.equal(result.source, "overpass-live");
  assert.deepEqual(result.attractions, [overpass]);
  assert.match(result.fallbackMessage ?? "", /using OpenStreetMap/);
});

test("Google application quota block falls back to Overpass", () => {
  const overpass = { id: "osm:node/2", name: "Real OSM venue" };
  const result = selectPoiProviders({
    googleAttractions: [],
    googleRestaurants: [],
    overpassAttractions: [overpass],
    overpassRestaurants: [overpass],
    googleActive: false,
    googleQuotaBlocked: true,
    maxAttractions: 5,
    maxRestaurants: 4,
  });
  assert.equal(result.source, "overpass-live");
  assert.equal(
    result.fallbackMessage,
    "Google Places application quota reached — using OpenStreetMap.",
  );
});

test("mock POIs are never introduced by provider selection", () => {
  const result = selectPoiProviders({
    googleAttractions: [],
    googleRestaurants: [],
    overpassAttractions: [],
    overpassRestaurants: [],
    googleActive: false,
    googleQuotaBlocked: false,
    maxAttractions: 5,
    maxRestaurants: 4,
  });
  assert.equal(result.source, "unavailable");
  assert.deepEqual(result.attractions, []);
  assert.deepEqual(result.restaurants, []);
});
