import assert from "node:assert/strict";
import test from "node:test";

import {
  getDayLayoutVariant,
  getItineraryPhase,
  shouldInsertEditorialBreak,
} from "../src/lib/tripItineraryPresentation.ts";
import type { DayPlan } from "../src/lib/types.ts";

const days: DayPlan[] = Array.from({ length: 10 }, (_, index) => ({
  day: index + 1,
  city: index < 5 ? "Vienna" : "Prague",
  morning: index === 2 ? "Local food market" : "Historic landmark",
  afternoon: "Art museum",
  evening: "Scenic evening walk",
  restaurant: "",
  rainyDayAlternative: "",
  transportNote: index === 5 ? "Train to Prague" : undefined,
  experiences: Array.from({ length: 3 }, (_, placeIndex) => ({
    id: `place-${index}-${placeIndex}`,
    provider: "google" as const,
    providerPlaceId: `google-${index}-${placeIndex}`,
    sourceStatus: "google-live" as const,
    name: `Provider place ${index}-${placeIndex}`,
    category: "landmark",
    lat: 48.2 + index * 0.001,
    lon: 16.3 + placeIndex * 0.001,
    quality: { source: "live" as const },
  })),
}));

test("a ten-day itinerary has a narrative beginning and ending", () => {
  assert.equal(getItineraryPhase(days, 0), "Arrival");
  assert.equal(getItineraryPhase(days, 9), "Farewell");
  assert.ok(new Set(days.map((day, index) => getItineraryPhase(days, index))).size >= 5);
});

test("long itineraries receive deterministic varied layouts and two pauses", () => {
  const first = days.map((day, index) => getDayLayoutVariant(day, index, days));
  const second = days.map((day, index) => getDayLayoutVariant(day, index, days));
  assert.deepEqual(first, second);
  assert.ok(new Set(first).size >= 3);
  assert.equal(days.filter((_, index) => shouldInsertEditorialBreak(index, days.length)).length, 2);
});

test("fixture provider identities remain unique across every displayed day", () => {
  const ids = days.flatMap((day) => day.experiences?.map((place) => place.providerPlaceId) ?? []);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(days.slice(1).every((day) => day.day > 1));
});
