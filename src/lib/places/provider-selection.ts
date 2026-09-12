export interface ProviderSelectionInput<TAttraction, TRestaurant> {
  googleAttractions: TAttraction[];
  googleRestaurants: TRestaurant[];
  overpassAttractions: TAttraction[];
  overpassRestaurants: TRestaurant[];
  googleActive: boolean;
  googleQuotaBlocked: boolean;
  googleErrorCategory?: string;
  maxAttractions: number;
  maxRestaurants: number;
  requiredAttractions?: number;
  requiredRestaurants?: number;
}

/** Pure provider selection used by the API route and quota/fallback tests. */
export function selectPoiProviders<TAttraction, TRestaurant>(
  input: ProviderSelectionInput<TAttraction, TRestaurant>,
) {
  const needsFallback =
    input.googleAttractions.length < (input.requiredAttractions ?? 1) ||
    input.googleRestaurants.length < (input.requiredRestaurants ?? 1);
  const identity = (value: unknown) => {
    const place = value as { providerPlaceId?: string; id?: string };
    return place.providerPlaceId ?? place.id ?? JSON.stringify(value);
  };
  const merge = <T>(primary: T[], supplemental: T[], maximum: number) => {
    const used = new Set<string>();
    return [...primary, ...supplemental]
      .filter((place) => {
        const id = identity(place);
        if (used.has(id)) return false;
        used.add(id);
        return true;
      })
      .slice(0, maximum);
  };
  const attractions = merge(
    input.googleAttractions,
    input.overpassAttractions,
    input.maxAttractions,
  );
  const restaurants = merge(
    input.googleRestaurants,
    input.overpassRestaurants,
    input.maxRestaurants,
  );
  const supplementalUsed =
    (input.googleAttractions.length < input.maxAttractions &&
      input.overpassAttractions.length > 0) ||
    (input.googleRestaurants.length < input.maxRestaurants && input.overpassRestaurants.length > 0);
  const fallbackProvider = needsFallback && supplementalUsed ? "OpenStreetMap / Overpass" : null;
  return {
    attractions,
    restaurants,
    fallbackProvider,
    fallbackMessage: fallbackProvider
      ? input.googleQuotaBlocked
        ? "Google Places application quota reached — using OpenStreetMap."
        : `Google Places unavailable${input.googleErrorCategory ? ` (${input.googleErrorCategory})` : ""} — using OpenStreetMap.`
      : undefined,
    source: input.googleActive
      ? fallbackProvider
        ? "mixed-live"
        : "google-live"
      : fallbackProvider
        ? "overpass-live"
        : "unavailable",
  };
}
