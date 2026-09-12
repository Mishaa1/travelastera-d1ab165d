import type { PlannedExperience, PlannedRestaurant } from "../types.ts";

type Place = PlannedExperience | PlannedRestaurant;

const TRANSPORT = /airport|airfield|terminal|train station|railway station|bus station|parking|car park|service area|transit/i;
const SCENIC = /viewpoint|lookout|panorama|mountain|peak|summit|alpine|lake|waterfall|gorge|valley|river|waterfront|promenade|historic quarter|old town|castle|palace|cathedral|bridge|botanical garden|national park/i;
const CULTURAL = /landmark|museum|historic|architecture|church|gallery|theatre|theater/i;
const OBJECT_OR_MEMORIAL = /statue|sculpture|memorial|monument|bust|plaque|tomb|grave|fountain/i;
const LOW_VALUE = /shop|store|movie theater|cinema|office|supermarket|lodging|accommodation/i;

export function isTransportOrUtilityPlace(place: Place) {
  return TRANSPORT.test(`${place.name} ${place.category} ${place.address ?? ""}`);
}

/** A valid attraction is not automatically suitable for a cinematic hero. */
export function isEditorialHeroPlace(place: Place) {
  const identity = `${place.name} ${place.category}`;
  const scenicContext = `${identity} ${place.description ?? ""}`;
  return Boolean(
    place.image &&
      !place.image.includes("place-placeholder") &&
      !isTransportOrUtilityPlace(place) &&
      !LOW_VALUE.test(identity) &&
      !OBJECT_OR_MEMORIAL.test(identity) &&
      (SCENIC.test(scenicContext) || CULTURAL.test(identity) || /archaeological|heritage site/i.test(identity)),
  );
}

/**
 * Ranks already provider-backed POIs for editorial prominence. It never creates
 * a place or image; it only decides which verified candidate tells the city
 * story best.
 */
export function placeHeroScore(place: Place) {
  const text = `${place.name} ${place.category} ${place.description ?? ""}`;
  const rating = place.rating ?? 0;
  const reviews = place.reviewCount ?? 0;
  return (
    rating * 18 +
    Math.log10(Math.max(1, reviews)) * 15 +
    Number(Boolean(place.image)) * 45 +
    Number(SCENIC.test(text)) * 70 +
    Number(CULTURAL.test(text)) * 22 -
    Number(OBJECT_OR_MEMORIAL.test(text)) * 145 -
    Number(LOW_VALUE.test(text)) * 35 -
    Number(isTransportOrUtilityPlace(place)) * 180
  );
}

export function rankHeroPlaces<T extends Place>(places: T[]) {
  return [...places].sort((a, b) => placeHeroScore(b) - placeHeroScore(a));
}
