import { LIVE_QUALITY } from "@/api/config";
import type { DataQuality } from "@/lib/types";

/**
 * Google Places (New API) enrichment.
 *
 * Searches for real places by text query and returns a normalised shape
 * the experience layer can use for attractions, restaurants and hotels.
 */

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  photoUrl?: string;
  website?: string;
  quality: DataQuality;
}

interface PlacesResponse {
  places?: {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    photos?: { name?: string }[];
    websiteUri?: string;
  }[];
}

const BASE_URL = "https://places.googleapis.com/v1/places:searchText";
const REQUEST_TIMEOUT_MS = 8_000;

export function isGooglePlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

export async function searchPlaces(query: string, limit = 5): Promise<PlaceResult[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.photos,places.websiteUri",
      },
      body: JSON.stringify({ textQuery: query, pageSize: limit }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Google Places request failed [${response.status}]: ${body.slice(0, 500)}`);
      throw new Error(`Google Places request failed (${response.status})`);
    }

    const payload = (await response.json()) as PlacesResponse;
    return (payload.places ?? []).map(normalise);
  } finally {
    clearTimeout(timer);
  }
}

function normalise(place: PlacesResponse["places"][number]): PlaceResult {
  return {
    id: place.id ?? "",
    name: place.displayName?.text ?? "",
    address: place.formattedAddress ?? "",
    latitude: place.location?.latitude ?? 0,
    longitude: place.location?.longitude ?? 0,
    rating: place.rating,
    photoUrl: place.photos?.[0]?.name
      ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=800&key=${process.env.GOOGLE_PLACES_API_KEY}`
      : undefined,
    website: place.websiteUri,
    quality: LIVE_QUALITY("Google Places"),
  };
}
