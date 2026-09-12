import assert from "node:assert/strict";
import test from "node:test";

import { isEditorialHeroPlace, rankHeroPlaces } from "../src/lib/places/place-quality.ts";
import { journeyDaySummary } from "../src/lib/journeyViewModel.ts";
import type { DayPlan, PlannedExperience } from "../src/lib/types.ts";

const place = (name: string, category: string, reviews: number): PlannedExperience => ({
  id: name,
  provider: "google",
  providerPlaceId: `google-${name}`,
  sourceStatus: "google-cache",
  name,
  category,
  lat: 46.68,
  lon: 7.86,
  rating: 4.7,
  reviewCount: reviews,
  image: `/api/pois/photo?photo=${name}`,
  quality: { source: "live", provider: "Google Places API (New)" },
});

test("an iconic alpine place outranks an airport for a day hero", () => {
  const ranked = rankHeroPlaces([
    place("Interlaken Airport", "airport", 300),
    place("Harder Kulm", "mountain viewpoint", 18_000),
  ]);
  assert.equal(ranked[0]?.name, "Harder Kulm");
});

test("minor statues are supporting stops, never cinematic heroes", () => {
  const statue = place("Yash Chopra Statue", "tourist attraction monument statue", 5_000);
  const viewpoint = place("Harder Kulm", "alpine mountain viewpoint", 18_000);
  assert.equal(isEditorialHeroPlace(statue), false);
  assert.equal(isEditorialHeroPlace(viewpoint), true);
  assert.equal(rankHeroPlaces([statue, viewpoint])[0]?.name, "Harder Kulm");
});

test("day summary uses grounded hero and never promotes airport logistics", () => {
  const day = {
    day: 1,
    city: "Interlaken",
    morning: "Harder Kulm",
    afternoon: "Lake Thun",
    evening: "Höhematte Park",
    restaurant: "No additional live recommendation available.",
    transportNote: "flight from Paris — 2h",
    activityIntents: ["airport vibes", "alpine panorama"],
    rainyDayAlternative: "Museum",
  } satisfies DayPlan;
  const summary = journeyDaySummary(day, place("Harder Kulm", "mountain viewpoint", 18_000));
  assert.match(summary, /Harder Kulm/);
  assert.match(summary, /alpine panorama/);
  assert.doesNotMatch(summary, /airport|flight/i);
});
