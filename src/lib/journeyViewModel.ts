import type {
  DayPlan,
  PlannedExperience,
  PlannedRestaurant,
  TripRoute,
  TripStop,
} from "@/lib/types";
import { isEditorialHeroPlace, rankHeroPlaces } from "./places/place-quality.ts";

const LIVE_SOURCE = new Set(["google-live", "google-cache", "overpass-live"]);

export interface JourneyDayViewModel {
  dayNumber: number;
  city: string;
  title: string;
  summary: string;
  day: DayPlan;
  stop?: TripStop;
  heroMoment: PlannedExperience | null;
  orderedStops: PlannedExperience[];
  restaurant: PlannedRestaurant | null;
  contextualPois: PlannedExperience[];
  moodImages: Array<{ src: string; providerPlaceId: string; name: string }>;
  imageProvenance: Array<{ src: string; providerPlaceId: string; sourceStatus: string }>;
}

function isGrounded(place: PlannedExperience | PlannedRestaurant) {
  return Boolean(
    place.providerPlaceId &&
    (place.provider === "google" || place.provider === "overpass") &&
    LIVE_SOURCE.has(place.sourceStatus) &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lon),
  );
}

function hasRealImage(place: PlannedExperience | PlannedRestaurant) {
  return Boolean(place.image && !place.image.includes("place-placeholder"));
}

export function journeyDayTitle(day: DayPlan) {
  const text = `${day.morning} ${day.afternoon} ${day.evening}`.toLowerCase();
  if (day.day === 1) return `First impressions of ${day.city}`;
  if (/food|market|restaurant|taste|cafe|café/.test(text)) return `A taste of ${day.city}`;
  if (/view|sunset|river|garden|park|nature/.test(text)) return `${day.city} in a different light`;
  if (/museum|history|castle|cathedral|old town/.test(text))
    return `Stories written into ${day.city}`;
  return `${day.city}, at your own pace`;
}

export function journeyDaySummary(day: DayPlan, hero?: PlannedExperience | null) {
  if (hero) {
    const intent = day.activityIntents?.find((value) => !/airport|station|transfer|terminal/i.test(value));
    return intent
      ? `${hero.name} anchors a day shaped around ${intent.toLowerCase()} in ${day.city}.`
      : `${hero.name} sets the tone for a considered day through ${day.city}.`;
  }
  return day.morning ?? `A considered day through ${day.city}.`;
}

/**
 * Builds a Journey view from the canonical stored trip only. This function is
 * deliberately synchronous and performs no provider requests.
 */
export function buildJourneyDayViewModel(
  route: TripRoute,
  requestedDay?: number,
): JourneyDayViewModel | null {
  const day =
    route.itinerary.find((candidate) => candidate.day === requestedDay) ?? route.itinerary[0];
  if (!day) return null;

  const seenProviderIds = new Set<string>();
  const orderedStops = (day.experiences ?? []).filter((place) => {
    if (!isGrounded(place) || seenProviderIds.has(place.providerPlaceId)) return false;
    seenProviderIds.add(place.providerPlaceId);
    return true;
  });
  const sameCityPlaces = route.itinerary
    .filter((candidateDay) => candidateDay.city === day.city)
    .flatMap((candidateDay) => candidateDay.experiences ?? [])
    .filter(isGrounded);
  const dayHero = rankHeroPlaces(orderedStops).find(isEditorialHeroPlace);
  const cityHeroCandidates = rankHeroPlaces(sameCityPlaces).filter(isEditorialHeroPlace);
  const cityHero = cityHeroCandidates[(Math.max(1, day.day) - 1) % Math.max(1, cityHeroCandidates.length)];
  const heroMoment = dayHero ?? cityHero ?? null;
  const restaurant =
    day.restaurantDetails &&
    isGrounded(day.restaurantDetails) &&
    !seenProviderIds.has(day.restaurantDetails.providerPlaceId)
      ? day.restaurantDetails
      : null;

  const contextualPois: PlannedExperience[] = [];
  for (const candidateDay of route.itinerary) {
    if (candidateDay.city !== day.city || candidateDay.day === day.day) continue;
    for (const place of candidateDay.experiences ?? []) {
      if (!isGrounded(place) || seenProviderIds.has(place.providerPlaceId)) continue;
      seenProviderIds.add(place.providerPlaceId);
      contextualPois.push(place);
    }
  }

  const usedImages = new Set<string>();
  if (heroMoment?.image) usedImages.add(heroMoment.image);
  const moodImages = [...contextualPois, ...orderedStops]
    .filter(hasRealImage)
    .filter((place) => {
      if (!place.image || usedImages.has(place.image)) return false;
      usedImages.add(place.image);
      return true;
    })
    .slice(0, 4)
    .map((place) => ({
      src: place.image!,
      providerPlaceId: place.providerPlaceId,
      name: place.name,
    }));

  return {
    dayNumber: day.day,
    city: day.city,
    title: journeyDayTitle(day),
    summary: journeyDaySummary(day, heroMoment),
    day,
    stop: route.stops.find((candidate) => candidate.name === day.city),
    heroMoment,
    orderedStops,
    restaurant,
    contextualPois,
    moodImages,
    imageProvenance: [heroMoment, ...orderedStops, ...contextualPois]
      .filter((place): place is PlannedExperience => Boolean(place && place.image))
      .filter(
        (place, index, places) => places.findIndex((item) => item.image === place.image) === index,
      )
      .map((place) => ({
        src: place.image!,
        providerPlaceId: place.providerPlaceId,
        sourceStatus: place.sourceStatus,
      })),
  };
}

export function buildJourneyViewModels(route: TripRoute) {
  return route.itinerary
    .map((day) => buildJourneyDayViewModel(route, day.day))
    .filter((day): day is JourneyDayViewModel => Boolean(day));
}

export function calculateDayWalking(day: DayPlan) {
  const points = (day.experiences ?? []).filter(
    (place) => Number.isFinite(place.lat) && Number.isFinite(place.lon),
  );
  if (points.length < 2) return null;
  const radians = (value: number) => (value * Math.PI) / 180;
  let directKm = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const dLat = radians(current.lat! - previous.lat!);
    const dLon = radians(current.lon! - previous.lon!);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(radians(previous.lat!)) * Math.cos(radians(current.lat!)) * Math.sin(dLon / 2) ** 2;
    directKm += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  const km = directKm * 1.25;
  return { km, steps: Math.round((km * 1_300) / 50) * 50 };
}
