/**
 * Central API configuration.
 *
 * Every service reads its endpoints and credentials from here so that swapping
 * a mocked provider for a live one is a one-line change.
 */

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
} as const;

export const MOCK_QUALITY = (provider: string) => ({ source: "mock", provider }) as const;

export const LIVE_QUALITY = (provider: string) => ({ source: "live", provider }) as const;

export const TEST_QUALITY = (provider: string) => ({ source: "test", provider }) as const;

export const ESTIMATE_QUALITY = (provider: string) => ({ source: "estimate", provider }) as const;
