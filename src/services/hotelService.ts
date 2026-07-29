import { API_CONFIG, ESTIMATE_QUALITY, LIVE_QUALITY, MOCK_QUALITY } from "@/api/config";
import { apiGet } from "@/api/http";
import { CITY_BY_ID } from "@/data/cities";
import type { HotelSuggestion, LuxuryLevel } from "@/lib/types";

/**
 * Hotel service. Mock inventory today, drop-in shape for Booking.com /
 * Skyscanner style partners tomorrow (see API_CONFIG.hotels).
 */

const LUXURY_FACTOR: Record<LuxuryLevel, number> = {
  hostel: 0.45,
  midscale: 1,
  boutique: 1.45,
  luxury: 2.4,
};

const LUXURY_LABEL: Record<LuxuryLevel, string> = {
  hostel: "Smart budget",
  midscale: "Comfortable midscale",
  boutique: "Boutique character",
  luxury: "Luxury stay",
};

export interface HotelSearchParams {
  cityId: string;
  nights: number;
  travellers: number;
  luxuryLevel: LuxuryLevel;
}

export async function searchHotel(params: HotelSearchParams): Promise<HotelSuggestion> {
  const city = CITY_BY_ID.get(params.cityId);
  const fallback: HotelSuggestion = {
    name: city?.hotels[0]?.name ?? "Central stay",
    area: city?.hotels[0]?.area ?? "City centre",
    style: `${LUXURY_LABEL[params.luxuryLevel]} · ${city?.hotels[0]?.style ?? "Well rated"}`,
    nightlyFrom: Math.round((city?.hotels[0]?.nightlyFrom ?? 95) * LUXURY_FACTOR[params.luxuryLevel]),
    rating: city?.hotels[0]?.rating ?? 4.4,
    quality: MOCK_QUALITY("Astera sample inventory"),
  };

  if (!API_CONFIG.hotels.enabled || !API_CONFIG.hotels.baseUrl) return fallback;

  try {
    const data = await apiGet<{
      hotels: { name: string; district: string; price: number; rating: number }[];
    }>(`${API_CONFIG.hotels.baseUrl}/search`, {
      query: { city: params.cityId, nights: params.nights, guests: params.travellers },
      headers: { Authorization: `Bearer ${API_CONFIG.hotels.apiKey}` },
    });
    const first = data.hotels?.[0];
    if (!first) return fallback;
    return {
      name: first.name,
      area: first.district,
      style: LUXURY_LABEL[params.luxuryLevel],
      nightlyFrom: Math.round(first.price),
      rating: first.rating,
      quality: LIVE_QUALITY(API_CONFIG.hotels.provider),
    };
  } catch {
    return fallback;
  }
}

/** Nightly accommodation budget used by the optimiser before a stay is chosen. */
export function estimateNightlyRate(cityId: string, luxuryLevel: LuxuryLevel) {
  const city = CITY_BY_ID.get(cityId);
  const base = city?.hotels[0]?.nightlyFrom ?? 95;
  return {
    nightly: Math.round(base * LUXURY_FACTOR[luxuryLevel]),
    quality: ESTIMATE_QUALITY("Astera rate model"),
  };
}
