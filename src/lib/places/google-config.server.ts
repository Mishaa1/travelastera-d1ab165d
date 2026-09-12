const int = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
};

const bool = (name: string, fallback: boolean) => {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === "true";
};

export const googlePlacesConfig = () => ({
  apiKey: process.env.GOOGLE_PLACES_API_KEY?.trim() ?? "",
  baseUrl: process.env.GOOGLE_PLACES_BASE_URL?.trim() || "https://places.googleapis.com/v1",
  enabled: bool("GOOGLE_PLACES_ENABLED", false),
  languageCode: process.env.GOOGLE_PLACES_LANGUAGE_CODE?.trim() || "en",
  regionCode: process.env.GOOGLE_PLACES_REGION_CODE?.trim() || "FR",
  attractionRadius: int("GOOGLE_PLACES_ATTRACTION_RADIUS_METERS", 10_000),
  restaurantRadius: int("GOOGLE_PLACES_RESTAURANT_RADIUS_METERS", 5_000),
  maxAttractions: int("GOOGLE_PLACES_MAX_ATTRACTIONS_PER_CITY", 12),
  maxRestaurants: int("GOOGLE_PLACES_MAX_RESTAURANTS_PER_CITY", 10),
  maxPhotosPerItinerary: int("GOOGLE_PLACES_MAX_PHOTOS_PER_ITINERARY", 4),
  monthlyLimit: int("GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT", 800),
  dailyLimit: int("GOOGLE_PLACES_DAILY_REQUEST_LIMIT", 40),
  hourlyLimit: int("GOOGLE_PLACES_HOURLY_REQUEST_LIMIT", 10),
  userHourlyLimit: int("GOOGLE_PLACES_MAX_REQUESTS_PER_USER_PER_HOUR", 5),
  itineraryLimit: int("GOOGLE_PLACES_MAX_CALLS_PER_ITINERARY", 3),
  monthlySafetyBuffer: int("GOOGLE_PLACES_MONTHLY_SAFETY_BUFFER", 200),
  poiCacheTtlMs: int("POI_CACHE_TTL_SECONDS", 604_800) * 1_000,
  detailsCacheTtlMs: int("PLACE_DETAILS_CACHE_TTL_SECONDS", 2_592_000) * 1_000,
  photoCacheTtlMs: int("PLACE_PHOTO_CACHE_TTL_SECONDS", 2_592_000) * 1_000,
  trackUsage: bool("TRACK_GOOGLE_PLACES_USAGE", true),
  showUsage: bool("SHOW_GOOGLE_PLACES_USAGE_IN_PROVENANCE", true),
  allowOverpassFallback: bool("ALLOW_OVERPASS_POI_FALLBACK", true),
  allowMockPois: bool("ALLOW_MOCK_POIS", false),
});

export type GooglePlacesConfig = ReturnType<typeof googlePlacesConfig>;
