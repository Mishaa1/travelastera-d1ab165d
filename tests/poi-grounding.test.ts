import assert from "node:assert/strict";
import test from "node:test";

import {
  groundItineraryDays,
  NO_LIVE_RECOMMENDATION,
} from "../src/lib/places/itinerary-grounding.ts";
import type { DayPlan, PlannedExperience, PlannedRestaurant } from "../src/lib/types.ts";

const quality = { source: "live" as const, provider: "test provider" };
const attraction = (
  index: number,
  provider: "google" | "overpass" = "google",
): PlannedExperience => ({
  id: `${provider}-${index}`,
  provider,
  providerPlaceId: `${provider}-${index}`,
  sourceStatus: provider === "google" ? "google-live" : "overpass-live",
  name: `Provider attraction ${index}`,
  category: index % 2 ? "art_museum" : "historical_landmark",
  lat: 48.2 + index * 0.002,
  lon: 16.37 + index * 0.002,
  rating: 4.8 - index * 0.05,
  reviewCount: 1_000 - index * 50,
  quality,
});
const restaurant = (index: number): PlannedRestaurant => ({
  id: `restaurant-${index}`,
  provider: "google",
  providerPlaceId: `restaurant-${index}`,
  sourceStatus: "google-cache",
  name: `Provider restaurant ${index}`,
  category: "restaurant",
  lat: 48.205 + index * 0.002,
  lon: 16.375 + index * 0.002,
  rating: 4.5,
  quality,
});

test("two-day single-city itinerary grounds every displayed name without duplicates", () => {
  const days: DayPlan[] = [
    {
      day: 1,
      city: "Vienna",
      morning: "Invented palace tour",
      afternoon: "Generated gallery",
      evening: "Imaginary walk",
      restaurant: "Fake Bistro",
      rainyDayAlternative: "indoor activity",
      activityIntents: ["historic landmark", "scenic walk"],
    },
    {
      day: 2,
      city: "Vienna",
      morning: "Made-up museum",
      afternoon: "Generated market",
      evening: "Fictional viewpoint",
      restaurant: "Hallucinated Cafe",
      rainyDayAlternative: "museum",
      activityIntents: ["art museum", "local lunch"],
    },
  ];
  const providerAttractions = Array.from({ length: 6 }, (_, index) =>
    attraction(index, index === 5 ? "overpass" : "google"),
  );
  const providerRestaurants = [restaurant(1), restaurant(2)];
  const result = groundItineraryDays(days, {
    Vienna: { experiences: providerAttractions, restaurants: providerRestaurants },
  });
  const all = result.itinerary.flatMap((day) => [
    ...(day.experiences ?? []),
    ...(day.restaurantDetails ? [day.restaurantDetails] : []),
  ]);
  const providerNames = new Set(
    [...providerAttractions, ...providerRestaurants].map((place) => place.name),
  );

  assert.equal(result.itinerary.length, 2);
  result.itinerary.forEach((day) => {
    assert.equal(day.experiences?.length, 3);
    assert.ok(day.restaurantDetails);
    assert.equal(day.poiProvenance?.generatedNamesRejected, 4);
    [day.morning, day.afternoon, day.evening, day.restaurant].forEach((name) =>
      assert.ok(name === NO_LIVE_RECOMMENDATION || providerNames.has(name)),
    );
  });
  assert.ok(
    !result.itinerary.some(
      (day) =>
        ["Invented palace tour", "Made-up museum", "Fake Bistro", "Hallucinated Cafe"].includes(
          day.morning,
        ) || ["Fake Bistro", "Hallucinated Cafe"].includes(day.restaurant),
    ),
  );
  assert.equal(new Set(all.map((place) => place.providerPlaceId)).size, all.length);
  assert.ok(all.every((place) => place.provider === "google" || place.provider === "overpass"));
  assert.ok(all.every((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon)));
  assert.ok(
    all.every((place) => Math.hypot((place.lat ?? 0) - 48.2082, (place.lon ?? 0) - 16.3738) < 0.05),
  );
});
