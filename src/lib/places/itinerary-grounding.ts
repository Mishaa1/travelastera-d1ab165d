import type { DayPlan, PlannedExperience, PlannedRestaurant } from "../types.ts";
import { isTransportOrUtilityPlace, placeHeroScore } from "./place-quality.ts";

export const NO_LIVE_RECOMMENDATION = "No additional live recommendation available.";

type ProviderPool = {
  experiences: PlannedExperience[];
  restaurants: PlannedRestaurant[];
};

export function isGroundedPlace(
  place: PlannedExperience | PlannedRestaurant | undefined,
): place is PlannedExperience | PlannedRestaurant {
  return Boolean(
    place?.providerPlaceId &&
    (place.provider === "google" || place.provider === "overpass") &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lon) &&
    (place.sourceStatus === "google-live" ||
      place.sourceStatus === "google-cache" ||
      place.sourceStatus === "overpass-live"),
  );
}

const distance = (a: { lat?: number; lon?: number }, b: { lat?: number; lon?: number }) =>
  Math.hypot((a.lat ?? 0) - (b.lat ?? 0), (a.lon ?? 0) - (b.lon ?? 0));

const words = (values: string[]) =>
  new Set(
    values
      .join(" ")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length > 3),
  );

function attractionScore(place: PlannedExperience, day: DayPlan, anchor?: PlannedExperience) {
  const intent = words(day.activityIntents ?? [day.morning, day.afternoon, day.evening]);
  const category = place.category.toLowerCase().replaceAll("_", " ");
  const matches = [...intent].filter((word) => category.includes(word)).length;
  return (
    matches * 100 +
    placeHeroScore(place) * 0.35 +
    (place.rating ?? 3.8) * 8 +
    Math.log10(place.reviewCount ?? 1) * 4 -
    (anchor ? distance(place, anchor) * 180 : 0)
  );
}

/** Assigns validated live/cache POIs round-robin so later days retain inventory. */
export function groundItineraryDays(days: DayPlan[], pools: Record<string, ProviderPool>) {
  const usedAttractionIds = new Set<string>();
  const usedRestaurantIds = new Set<string>();
  const usedProviderIds = new Set<string>();
  const assignments = new Map<number, PlannedExperience[]>();
  const mealAssignments = new Map<number, PlannedRestaurant>();

  for (const city of new Set(days.map((day) => day.city))) {
    const cityDays = days.filter((day) => day.city === city);
    const attractions = (pools[city]?.experiences ?? []).filter(isGroundedPlace);
    const restaurants = (pools[city]?.restaurants ?? []).filter(isGroundedPlace);

    for (let slot = 0; slot < 3; slot += 1) {
      for (const day of cityDays) {
        const bucket = assignments.get(day.day) ?? [];
        const available = attractions.filter(
          (place) =>
            !usedAttractionIds.has(place.providerPlaceId) &&
            !usedProviderIds.has(place.providerPlaceId),
        );
        // The first activity becomes the editorial hero. Prefer a genuinely
        // destination-defining place and keep airports/stations as logistics.
        const heroEligible = slot === 0
          ? available.filter((place) => !isTransportOrUtilityPlace(place) && Boolean(place.image))
          : available;
        const candidates = heroEligible.length ? heroEligible : available;
        const selected = candidates.sort(
          (a, b) => attractionScore(b, day, bucket[0]) - attractionScore(a, day, bucket[0]),
        )[0];
        if (!selected) continue;
        bucket.push(selected);
        assignments.set(day.day, bucket);
        usedAttractionIds.add(selected.providerPlaceId);
        usedProviderIds.add(selected.providerPlaceId);
      }
    }

    for (const day of cityDays) {
      const anchor = assignments.get(day.day)?.[0];
      const selected = restaurants
        .filter(
          (place) =>
            !usedRestaurantIds.has(place.providerPlaceId) &&
            !usedProviderIds.has(place.providerPlaceId),
        )
        .sort(
          (a, b) =>
            (b.rating ?? 3.8) * 8 -
            (a.rating ?? 3.8) * 8 +
            (anchor ? (distance(a, anchor) - distance(b, anchor)) * 180 : 0),
        )[0];
      if (!selected) continue;
      mealAssignments.set(day.day, selected);
      usedRestaurantIds.add(selected.providerPlaceId);
      usedProviderIds.add(selected.providerPlaceId);
    }
  }

  const itinerary = days.map((day) => {
    const experiences = (assignments.get(day.day) ?? []).filter(isGroundedPlace);
    const restaurant = mealAssignments.get(day.day);
    const names = experiences.map((place) => place.name);
    const all = [...experiences, ...(restaurant ? [restaurant] : [])];
    return {
      ...day,
      experiences,
      restaurantDetails: isGroundedPlace(restaurant) ? restaurant : undefined,
      morning: names[0] ?? NO_LIVE_RECOMMENDATION,
      afternoon: names[1] ?? NO_LIVE_RECOMMENDATION,
      evening: names[2] ?? NO_LIVE_RECOMMENDATION,
      restaurant: restaurant?.name ?? NO_LIVE_RECOMMENDATION,
      poiProvenance: {
        attractionsDisplayed: experiences.length,
        restaurantsDisplayed: Number(Boolean(restaurant)),
        googleIds: all
          .filter((place) => place.provider === "google")
          .map((place) => place.providerPlaceId),
        overpassIds: all
          .filter((place) => place.provider === "overpass")
          .map((place) => place.providerPlaceId),
        generatedNamesRejected: 4,
      },
    };
  });

  return { itinerary, usedAttractionIds, usedRestaurantIds, usedProviderIds };
}
