import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildJourneyDayViewModel, buildJourneyViewModels } from "../src/lib/journeyViewModel.ts";
import type { DayPlan, PlannedExperience, PlannedRestaurant, TripRoute } from "../src/lib/types.ts";

const quality = { source: "live" as const, provider: "Google Places" };

function attraction(index: number, day: number): PlannedExperience {
  return {
    id: `place-${day}-${index}`,
    provider: index === 2 ? "overpass" : "google",
    providerPlaceId: `provider-${day}-${index}`,
    sourceStatus: index === 2 ? "overpass-live" : "google-cache",
    name: `Real place ${day}-${index}`,
    category: index === 0 ? "historical_landmark" : "museum",
    image: `https://images.example.test/day-${day}-place-${index}.jpg`,
    lat: 50.08 + day * 0.001 + index * 0.0001,
    lon: 14.43 + day * 0.001 + index * 0.0001,
    quality,
  };
}

function restaurant(day: number): PlannedRestaurant {
  return {
    id: `restaurant-${day}`,
    provider: "google",
    providerPlaceId: `restaurant-${day}`,
    sourceStatus: "google-live",
    name: `Real restaurant ${day}`,
    category: "restaurant",
    image: `https://images.example.test/day-${day}-restaurant.jpg`,
    lat: 50.085 + day * 0.001,
    lon: 14.435 + day * 0.001,
    quality,
  };
}

const itinerary: DayPlan[] = [1, 2, 3].map((day) => ({
  day,
  city: "Prague",
  morning: `Provider-backed morning ${day}`,
  afternoon: `Provider-backed afternoon ${day}`,
  evening: `Provider-backed evening ${day}`,
  restaurant: `Provider-backed restaurant ${day}`,
  rainyDayAlternative: "Live indoor recommendation unavailable",
  experiences: [attraction(0, day), attraction(1, day), attraction(2, day)],
  restaurantDetails: restaurant(day),
}));

const route = {
  id: "prague-canonical-trip",
  title: "Prague, considered slowly",
  itinerary,
  stops: [
    {
      id: "prague",
      name: "Prague",
      country: "Czechia",
      countryCode: "CZ",
      lat: 50.0755,
      lon: 14.4378,
      nights: 3,
      dayTrips: [],
      hotel: {
        name: "Provider hotel",
        area: "Old Town",
        nightlyFrom: 120,
        rating: 4.6,
        style: "Boutique",
        quality,
      },
      weather: {
        city: "Prague",
        tempC: 19,
        rainChance: 20,
        summary: "Clear",
        quality,
      },
    },
  ],
} as unknown as TripRoute;

test("Journey selects a requested day from the same canonical trip without mutating it", () => {
  const before = JSON.stringify(route);
  const view = buildJourneyDayViewModel(route, 2);

  assert.equal(view?.day, route.itinerary[1]);
  assert.equal(view?.dayNumber, 2);
  assert.equal(JSON.stringify(route), before);
  assert.equal(buildJourneyViewModels(route).length, route.itinerary.length);
});

test("every rendered Journey venue is grounded and provider IDs are unique per day", () => {
  const view = buildJourneyDayViewModel(route, 1);
  assert.ok(view);
  const venues = [...view.orderedStops, ...(view.restaurant ? [view.restaurant] : [])];
  const ids = venues.map((place) => place.providerPlaceId);

  assert.equal(new Set(ids).size, ids.length);
  assert.ok(
    venues.every(
      (place) =>
        (place.provider === "google" || place.provider === "overpass") &&
        Boolean(place.providerPlaceId) &&
        Number.isFinite(place.lat) &&
        Number.isFinite(place.lon),
    ),
  );
});

test("Journey removes ungrounded and duplicate venues instead of displaying them", () => {
  const duplicate = { ...attraction(1, 1), name: "Duplicate display name" };
  const invented = {
    ...attraction(9, 1),
    providerPlaceId: "",
    name: "Invented attraction",
  };
  const changed = {
    ...route,
    itinerary: [
      {
        ...itinerary[0],
        experiences: [...(itinerary[0]?.experiences ?? []), duplicate, invented],
      },
    ],
  } as TripRoute;
  const view = buildJourneyDayViewModel(changed, 1);

  assert.ok(view);
  assert.equal(view.orderedStops.length, 3);
  assert.ok(!view.orderedStops.some((place) => place.name === "Invented attraction"));
  assert.ok(!view.orderedStops.some((place) => place.name === "Duplicate display name"));
});

test("Journey image allocation avoids hero and mood duplicates when alternatives exist", () => {
  const view = buildJourneyDayViewModel(route, 1);
  assert.ok(view?.heroMoment?.image);
  const images = [view.heroMoment.image, ...view.moodImages.map((item) => item.src)];

  assert.equal(new Set(images).size, images.length);
  assert.ok(view.moodImages.length > 0);
});

test("Overview and Journey keep decision and companion responsibilities separate", () => {
  const overview = readFileSync("src/routes/trip.$tripId.tsx", "utf8");
  const gallery = readFileSync("src/components/trip/DayOverviewGallery.tsx", "utf8");
  const journey = readFileSync("src/routes/trip.$tripId.journey.tsx", "utf8");

  assert.ok(!overview.includes("TripPulseDay"));
  assert.ok(overview.includes("BookingStage"));
  assert.ok(overview.includes("<Outlet />"));
  assert.ok(overview.includes('endsWith("/journey")'));
  assert.ok(gallery.includes('to="/trip/$tripId/journey"'));
  assert.ok(gallery.includes("search={{ day: view.dayNumber }}"));
  assert.ok(journey.includes("findRouteById(tripId)"));
  assert.ok(journey.includes("TripPulseDay"));
  assert.ok(!journey.includes("BookingStage"));
  assert.ok(!journey.includes("WhyAstera"));
});

test("Journey switching makes no POI searches and mood imagery uses only the cached image endpoint", () => {
  const journey = readFileSync("src/routes/trip.$tripId.journey.tsx", "utf8");
  const pulse = readFileSync("src/components/trip/TripPulseDay.tsx", "utf8");
  const combined = `${journey}\n${pulse}`;

  assert.ok(combined.includes('fetch(`/api/images/mood?city='));
  assert.ok(!combined.includes("/api/pois"));
  assert.ok(!combined.includes("searchGooglePlaces"));
  assert.ok(!combined.includes("BookingStage"));
  assert.ok(!combined.includes("insurance is active"));
  assert.ok(!combined.includes("available offline"));
  assert.ok(journey.includes("overflow-x-auto"));
  assert.ok(journey.includes("min-w-0"));
});
