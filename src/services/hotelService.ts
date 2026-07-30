import { ESTIMATE_QUALITY, MOCK_QUALITY } from "@/api/config";
import { CITY_BY_ID } from "@/data/cities";
import type { HotelSuggestion, LuxuryLevel } from "@/lib/types";

/**
 * Hotel service. Uses Astera's server-only Hotelbeds route when
 * configured and always keeps the curated city inventory as a safe fallback.
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
  checkInDate: string;
  checkOutDate: string;
}

export async function searchHotel(params: HotelSearchParams): Promise<HotelSuggestion> {
  const city = CITY_BY_ID.get(params.cityId);
  const nightlyFrom = Math.round(
    (city?.hotels[0]?.nightlyFrom ?? 95) * LUXURY_FACTOR[params.luxuryLevel],
  );
  const rooms = Math.max(1, Math.ceil(params.travellers / 2));
  const fallback = (fallbackReason: string): HotelSuggestion => ({
    name: city?.hotels[0]?.name ?? "Central stay",
    area: city?.hotels[0]?.area ?? "City centre",
    style: `${LUXURY_LABEL[params.luxuryLevel]} · ${city?.hotels[0]?.style ?? "Well rated"}`,
    nightlyFrom,
    totalStayPrice: nightlyFrom * Math.max(1, params.nights) * rooms,
    roomType: LUXURY_LABEL[params.luxuryLevel],
    boardType: "Board not specified",
    rating: city?.hotels[0]?.rating ?? 4.4,
    fallbackReason,
    quality: MOCK_QUALITY("Astera sample inventory"),
  });

  if (!city) return fallback("This destination is not available in the hotel search catalogue.");
  if (typeof window === "undefined") {
    return fallback("Live hotel availability is checked when the results load in your browser.");
  }

  try {
    const response = await fetch("/api/hotels/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: city.lat,
        longitude: city.lon,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        travellers: params.travellers,
        luxuryLevel: params.luxuryLevel,
      }),
    });
    const data = (await response.json()) as {
      hotel?: HotelSuggestion | null;
      configured?: boolean;
      error?: string;
    };
    if (!response.ok) {
      return fallback(data.error ?? `Hotel search failed (${response.status}).`);
    }
    if (!data.configured) {
      return fallback(
        "Hotelbeds is not configured, so sample accommodation pricing is being used.",
      );
    }
    return (
      data.hotel ??
      fallback(
        data.error ??
          "Hotelbeds returned no availability for these dates, so sample accommodation pricing is being used.",
      )
    );
  } catch {
    return fallback(
      "The Hotelbeds search could not be reached, so sample accommodation pricing is being used.",
    );
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
