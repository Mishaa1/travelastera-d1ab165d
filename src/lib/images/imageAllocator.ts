import type { PlannedExperience, PlannedRestaurant, TripRoute } from "@/lib/types";
import { isEditorialHeroPlace, rankHeroPlaces } from "../places/place-quality.ts";

export const IMAGE_ALLOCATION_VERSION = 2;
export const NEUTRAL_IMAGE_PLACEHOLDER = "/images/astera-image-placeholder.svg";

export type ImageSource = "google" | "wikimedia" | "hotelbeds" | "bundled" | "placeholder";
export type ImageRole = "destination" | "venue" | "hotel" | "editorial";

export interface ImageAsset {
  id: string;
  source: ImageSource;
  sourceReference?: string;
  resolvedUrl: string;
  city?: string;
  country?: string;
  providerPlaceId?: string;
  placeName?: string;
  role: ImageRole;
  attribution?: unknown[];
  fetchedAt?: string;
  expiresAt?: string;
  verifiedRenderable?: boolean;
  cacheStatus?: "cached-reference" | "provider-reference" | "bundled" | "placeholder";
  fallbackReason?: string;
}

export interface TripImageAllocation {
  version: typeof IMAGE_ALLOCATION_VERSION;
  overviewHero: ImageAsset[];
  quoteBanner: ImageAsset[];
  dayPreviews: Record<number, ImageAsset[]>;
  journeyHeroes: Record<number, ImageAsset[]>;
  placeImages: Record<string, ImageAsset[]>;
  hotelImages: Record<string, ImageAsset[]>;
}

const normalized = (value?: string) => value?.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() ?? "";

export function sameImageCity(requestedCity: string, asset: ImageAsset) {
  return asset.source === "placeholder" || normalized(requestedCity) === normalized(asset.city);
}

function isProviderBacked(place: PlannedExperience | PlannedRestaurant) {
  return Boolean(
    place.providerPlaceId &&
      (place.provider === "google" || place.provider === "overpass") &&
      (place.sourceStatus === "google-live" ||
        place.sourceStatus === "google-cache" ||
        place.sourceStatus === "overpass-live") &&
      Number.isFinite(place.lat) &&
      Number.isFinite(place.lon),
  );
}

function providerAsset(
  place: PlannedExperience | PlannedRestaurant,
  city: string,
  country: string | undefined,
): ImageAsset | null {
  if (!isProviderBacked(place) || !place.image || place.image.includes("place-placeholder")) return null;
  const source: ImageSource = place.provider === "google" ? "google" : "wikimedia";
  return {
    id: `${source}:${place.providerPlaceId}`,
    source,
    sourceReference: place.photoReference,
    resolvedUrl: place.image,
    city,
    country,
    providerPlaceId: place.providerPlaceId,
    placeName: place.name,
    role: "venue",
    attribution: place.photoAttributions,
    verifiedRenderable: false,
    cacheStatus: place.sourceStatus === "google-cache" ? "cached-reference" : "provider-reference",
  };
}

export function neutralImage(city?: string, role: ImageRole = "editorial", reason = "No relevant provider-backed image rendered"): ImageAsset {
  return {
    id: `placeholder:${normalized(city) || "neutral"}:${role}`,
    source: "placeholder",
    resolvedUrl: NEUTRAL_IMAGE_PLACEHOLDER,
    city,
    role,
    verifiedRenderable: true,
    cacheStatus: "placeholder",
    fallbackReason: reason,
  };
}

function unique(assets: ImageAsset[]) {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = asset.sourceReference ?? asset.resolvedUrl;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Allocates only images already embedded in the trip. It performs no provider calls. */
export function allocateTripImages(route: TripRoute): TripImageAllocation {
  const countryByCity = new Map(route.stops.map((stop, index) => [normalized(stop.name), route.countries[index] ?? route.countries.at(-1)]));
  const placeImages: Record<string, ImageAsset[]> = {};
  const dayPreviews: Record<number, ImageAsset[]> = {};
  const journeyHeroes: Record<number, ImageAsset[]> = {};

  for (const day of route.itinerary) {
    const country = countryByCity.get(normalized(day.city));
    const rankedPlaces = rankHeroPlaces([...(day.experiences ?? []), ...(day.restaurantDetails ? [day.restaurantDetails] : [])]);
    const assets = unique(
      [...rankedPlaces.filter(isEditorialHeroPlace), ...rankedPlaces.filter((place) => !isEditorialHeroPlace(place))]
        .map((place) => providerAsset(place, day.city, country))
        .filter((asset): asset is ImageAsset => Boolean(asset)),
    );
    dayPreviews[day.day] = assets;
    journeyHeroes[day.day] = assets;
    for (const asset of assets) {
      if (asset.providerPlaceId) placeImages[asset.providerPlaceId] = [asset];
    }
  }

  const destination = route.stops.at(-1)?.name ?? route.itinerary.at(-1)?.city;
  const destinationAssets = destination
    ? unique(
        route.itinerary
          .filter((day) => normalized(day.city) === normalized(destination))
          .flatMap((day) => dayPreviews[day.day] ?? []),
      ).sort((a, b) => Number(b.source === "google") - Number(a.source === "google"))
    : [];

  const hotelImages: Record<string, ImageAsset[]> = {};
  for (const stop of route.stops) {
    if (!stop.hotel.imageUrl) continue;
    hotelImages[stop.hotel.id] = [{
      id: `hotelbeds:${stop.hotel.id}`,
      source: "hotelbeds",
      resolvedUrl: stop.hotel.imageUrl,
      city: stop.name,
      providerPlaceId: stop.hotel.id,
      placeName: stop.hotel.name,
      role: "hotel",
      verifiedRenderable: false,
      cacheStatus: "provider-reference",
    }];
  }

  return {
    version: IMAGE_ALLOCATION_VERSION,
    overviewHero: destinationAssets.length
      ? destinationAssets.map((asset) => ({ ...asset, role: "destination" as const }))
      : [neutralImage(destination, "destination")],
    quoteBanner: destinationAssets.length > 1
      ? destinationAssets.slice(1).map((asset) => ({ ...asset, role: "editorial" as const }))
      : destinationAssets.map((asset) => ({ ...asset, role: "editorial" as const })),
    dayPreviews,
    journeyHeroes,
    placeImages,
    hotelImages,
  };
}

export function selectExactPlaceImage(
  providerPlaceId: string,
  destinationImages: ImageAsset[],
  exactImages: Record<string, ImageAsset[]>,
) {
  return exactImages[providerPlaceId] ?? destinationImages;
}
