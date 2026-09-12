import { ESTIMATE_QUALITY } from "@/api/config";
import { CITY_BY_ID } from "@/data/cities";
import { demoHotelFixture } from "@/data/demoHotels";
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

export interface HotelSearchParams {
  cityId: string;
  cityName?: string;
  latitude?: number;
  longitude?: number;
  /** Location-aware fallback used only when this city is outside the curated catalogue. */
  baseNightlyRate?: number;
  nights: number;
  travellers: number;
  luxuryLevel: LuxuryLevel;
  checkInDate: string;
  checkOutDate: string;
  currency: "EUR" | "USD" | "GBP";
}

const hotelSearchCache = new Map<string, Promise<HotelSuggestion>>();

export async function searchHotel(params: HotelSearchParams): Promise<HotelSuggestion> {
  const city = CITY_BY_ID.get(params.cityId);
  const fallback = (
    fallbackReason: string,
    status: number | null = null,
    quotaExceeded = false,
  ): HotelSuggestion =>
    demoHotelFixture({
      cityName: params.cityName,
      latitude: params.latitude ?? city?.lat ?? 0,
      longitude: params.longitude ?? city?.lon ?? 0,
      checkInDate: params.checkInDate,
      checkOutDate: params.checkOutDate,
      travellers: params.travellers,
      currency: params.currency,
      luxuryLevel: params.luxuryLevel,
      fallbackReason,
      httpStatus: status,
      quotaExceeded,
    });

  if (typeof window === "undefined") {
    return fallback("Live hotel availability is checked when the results load in your browser.");
  }

  const cacheKey = JSON.stringify(params);
  const cached = hotelSearchCache.get(cacheKey);
  if (cached) return cached;

  const search = (async () => {
    try {
      const response = await fetch("/api/hotels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: params.latitude ?? city?.lat,
          longitude: params.longitude ?? city?.lon,
          cityName: params.cityName ?? city?.name,
          checkInDate: params.checkInDate,
          checkOutDate: params.checkOutDate,
          travellers: params.travellers,
          currency: params.currency,
          luxuryLevel: params.luxuryLevel,
        }),
        signal: AbortSignal.timeout(2_500),
      });
      const data = (await response.json()) as {
        hotel?: HotelSuggestion | null;
        configured?: boolean;
        error?: string;
        requiredLiveData?: boolean;
        liveHotelCount?: number;
        diagnostics?: {
          status: number | null;
          environment: string;
          responseBody?: string;
        };
        demoMode?: boolean;
      };
      if (data.requiredLiveData && (!response.ok || !data.hotel)) {
        throw new Error(
          `${data.error ?? "Live Hotelbeds availability is required but unavailable."}${
            data.diagnostics ? ` — ${JSON.stringify(data.diagnostics)}` : ""
          }`,
        );
      }
      if (!response.ok) {
        return fallback(
          data.error ?? `Hotel search failed (${response.status}).`,
          data.diagnostics?.status ?? response.status,
          /quota/i.test(data.error ?? ""),
        );
      }
      if (data.hotel) {
        return {
          ...data.hotel,
          providerDiagnostics: {
            status: data.diagnostics?.status ?? 200,
            environment: data.diagnostics?.environment ?? "Hotelbeds",
            liveHotelCount: data.liveHotelCount ?? 0,
            responseBody: data.diagnostics?.responseBody,
          },
        };
      }
      if (!data.configured) {
        throw new Error(
          data.error ?? "Hotelbeds is not configured and labelled demo hotels are disabled.",
        );
      }
      throw new Error(
        data.error ?? "Hotelbeds returned no availability and labelled demo hotels are disabled.",
      );
    } catch (error) {
      if (
        error instanceof Error &&
        /required|Hotelbeds request failed|Live Hotelbeds|labelled demo hotels are disabled/i.test(
          error.message,
        )
      ) {
        throw error;
      }
      return fallback(
        "Hotelbeds could not be reached. Labelled demo hotel inventory is shown and is not bookable.",
      );
    }
  })();
  hotelSearchCache.set(cacheKey, search);
  return search;
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
