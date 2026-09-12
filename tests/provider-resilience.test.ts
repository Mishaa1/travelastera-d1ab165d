import assert from "node:assert/strict";
import test from "node:test";

import {
  hotelbedsProvider,
  resetHotelbedsResilienceForTests,
} from "../src/lib/hotels/hotelbeds.server.ts";
import { osmPoiProvider, resetOverpassResilienceForTests } from "../src/lib/pois/osm.server.ts";
import { selectPoiProviders } from "../src/lib/places/provider-selection.ts";

test("partial provider selection preserves cached attractions when restaurants fail", () => {
  const attraction = { id: "google-1", providerPlaceId: "google-1" };
  const selected = selectPoiProviders({
    googleAttractions: [attraction],
    googleRestaurants: [],
    overpassAttractions: [],
    overpassRestaurants: [],
    googleActive: true,
    googleQuotaBlocked: true,
    maxAttractions: 12,
    maxRestaurants: 10,
    requiredAttractions: 1,
    requiredRestaurants: 1,
  });
  assert.deepEqual(selected.attractions, [attraction]);
  assert.deepEqual(selected.restaurants, []);
});

test("identical concurrent Overpass category requests share one provider sequence", async () => {
  resetOverpassResilienceForTests();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(
      JSON.stringify({
        elements: [
          {
            type: "node",
            id: 1,
            lat: 50.08,
            lon: 14.43,
            tags: { name: "Old Town", historic: "yes" },
          },
        ],
      }),
      { status: 200 },
    );
  };
  try {
    const requests = Array.from({ length: 4 }, () =>
      osmPoiProvider.searchCategory(50.08, 14.43, "attraction", "prague-test"),
    );
    const results = await Promise.all(requests);
    assert.equal(calls, 1);
    assert.ok(results.every((result) => result.experiences.length === 1));
  } finally {
    globalThis.fetch = originalFetch;
    resetOverpassResilienceForTests();
  }
});

test("Overpass failures are negatively cached after each endpoint is tried once", async () => {
  resetOverpassResilienceForTests();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError("endpoint unavailable");
  };
  try {
    const first = await osmPoiProvider.searchCategory(50.08, 14.43, "restaurant", "prague-fail");
    const second = await osmPoiProvider.searchCategory(50.08, 14.43, "restaurant", "prague-fail");
    assert.equal(calls, 2);
    assert.equal(first.restaurants.length, 0);
    assert.match(second.failure ?? "", /unavailable/i);
  } finally {
    globalThis.fetch = originalFetch;
    resetOverpassResilienceForTests();
  }
});

test("identical Hotelbeds searches coalesce and timeout is not immediately retried", async () => {
  resetHotelbedsResilienceForTests();
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.HOTELBEDS_API_KEY;
  const originalSecret = process.env.HOTELBEDS_API_SECRET;
  process.env.HOTELBEDS_API_KEY = "test-key";
  process.env.HOTELBEDS_API_SECRET = "test-secret";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new DOMException("aborted", "AbortError");
  };
  const input = {
    cityName: "Prague",
    latitude: 50.08,
    longitude: 14.43,
    checkInDate: "2026-09-13",
    checkOutDate: "2026-09-15",
    travellers: 2,
    currency: "EUR",
    luxuryLevel: "midscale" as const,
  };
  try {
    await Promise.allSettled([
      hotelbedsProvider.search(input),
      hotelbedsProvider.search(input),
      hotelbedsProvider.search(input),
    ]);
    assert.equal(calls, 1);
    await assert.rejects(hotelbedsProvider.search(input));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey == null) delete process.env.HOTELBEDS_API_KEY;
    else process.env.HOTELBEDS_API_KEY = originalKey;
    if (originalSecret == null) delete process.env.HOTELBEDS_API_SECRET;
    else process.env.HOTELBEDS_API_SECRET = originalSecret;
    resetHotelbedsResilienceForTests();
  }
});
