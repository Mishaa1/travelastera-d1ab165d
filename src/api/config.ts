/**
 * Central API configuration.
 *
 * Every service reads its endpoints and credentials from here so that swapping
 * a mocked provider for a live one is a one-line change.
 */

const env = import.meta.env as Record<string, string | undefined>;

export const API_CONFIG = {
  weather: {
    baseUrl: "https://api.open-meteo.com/v1",
    provider: "Open-Meteo",
    enabled: true,
  },
  geocode: {
    baseUrl: "https://nominatim.openstreetmap.org",
    provider: "Nominatim / OpenStreetMap",
    enabled: true,
  },
  map: {
    styleUrl: "https://demotiles.maplibre.org/style.json",
    provider: "MapLibre / OpenStreetMap",
    enabled: true,
  },
  flights: {
    baseUrl: env.VITE_AMADEUS_BASE_URL ?? "https://test.api.amadeus.com/v2",
    apiKey: env.VITE_AMADEUS_API_KEY,
    provider: "Amadeus Self-Service",
    get enabled() {
      return Boolean(env.VITE_AMADEUS_API_KEY);
    },
  },
  hotels: {
    baseUrl: env.VITE_HOTELS_BASE_URL,
    apiKey: env.VITE_HOTELS_API_KEY,
    provider: "Hotel inventory partner",
    get enabled() {
      return Boolean(env.VITE_HOTELS_API_KEY);
    },
  },
} as const;

export const MOCK_QUALITY = (provider: string) =>
  ({ source: "mock", provider }) as const;

export const LIVE_QUALITY = (provider: string) =>
  ({ source: "live", provider }) as const;

export const ESTIMATE_QUALITY = (provider: string) =>
  ({ source: "estimate", provider }) as const;
