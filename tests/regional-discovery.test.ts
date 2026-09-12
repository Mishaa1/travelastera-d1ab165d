import assert from "node:assert/strict";
import test from "node:test";

import { allowedRegionalFamilies, verifiedNearbyFor } from "../src/lib/regions/adjacency.ts";

test("Vienna adjacency uses structured, reachable destinations with provenance", () => {
  const nearby = verifiedNearbyFor({ destination: "Vienna", maxMinutes: 240 });
  assert.ok(nearby.length >= 6);
  assert.ok(nearby.some((place) => place.name === "Bratislava" && place.estimatedTravelMinutes === 60));
  assert.ok(nearby.some((place) => place.name === "Wachau Valley" && place.type === "scenic-region"));
  assert.ok(nearby.every((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon) && place.provenance === "curated-adjacency"));
});

test("Milan and Annecy retain verified regional choices when public discovery is unavailable", () => {
  const milan = verifiedNearbyFor({ destination: "Milan", maxMinutes: 180 });
  assert.ok(milan.some((place) => place.name === "Como" && place.themes.includes("photography")));
  assert.ok(milan.some((place) => place.name === "Lugano" && place.countryCode === "CH"));

  const annecy = verifiedNearbyFor({ destination: "Annecy", maxMinutes: 240 });
  assert.ok(annecy.some((place) => place.name === "Chamonix" && place.suitableFor.includes("day-trip")));
  assert.ok(annecy.some((place) => place.name === "Aosta" && place.suitableFor.includes("overnight")));
  assert.ok(annecy.some((place) => place.name === "Interlaken" && place.estimatedTravelMinutes <= 240));
  assert.ok(annecy.every((place) => Number.isFinite(place.lat) && Number.isFinite(place.lon)));
});

test("a two-day Vienna trip cannot gain an overnight city", () => {
  const families = allowedRegionalFamilies({ nights: 2, mode: "nearby-cities", hotelChanges: "one", existingAccommodation: false });
  assert.deepEqual(families, ["destination-only", "nearby-day-trip"]);
});

test("five days exposes day-trip, hidden-gem, second-city and regional options", () => {
  const families = allowedRegionalFamilies({ nights: 5, mode: "nearby-cities", hotelChanges: "one", existingAccommodation: false });
  assert.ok(families.includes("destination-only"));
  assert.ok(families.includes("nearby-day-trip"));
  assert.ok(families.includes("regional-hidden-gem"));
  assert.ok(families.includes("second-city"));
  assert.ok(families.includes("major-nearby-city"));
});

test("existing accommodation or no hotel changes limits expansion to day trips", () => {
  for (const input of [
    { hotelChanges: "one" as const, existingAccommodation: true },
    { hotelChanges: "none" as const, existingAccommodation: false },
  ]) {
    const families = allowedRegionalFamilies({ nights: 7, mode: "surprise", ...input });
    assert.ok(!families.includes("second-city"));
    assert.ok(families.includes("nearby-day-trip"));
  }
});

test("country and travel-time controls filter the verified graph", () => {
  const sameCountry = verifiedNearbyFor({ destination: "Vienna", maxMinutes: 120, countryCode: "AT", sameCountryOnly: true });
  assert.deepEqual(sameCountry.map((place) => place.name), ["Wachau Valley"]);
  assert.ok(verifiedNearbyFor({ destination: "Vienna", maxMinutes: 60 }).every((place) => place.estimatedTravelMinutes <= 60));
});
