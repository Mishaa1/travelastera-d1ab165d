import { toIataCode } from "@/lib/flights/iata";
import {
  MAX_DISCOVERY_DESTINATIONS,
  type FlightSearchResponse,
  type NormalisedFlightOffer,
} from "@/lib/flights/types";

/**
 * Browser-side flight helper.
 *
 * Talks only to Astera's own endpoint — the provider token stays on the server.
 * Never throws: a failure resolves to an empty result so the caller can fall
 * back to the estimated flight price.
 */

export interface RouteFlightQuery {
  origin: string;
  destinations: string[];
  departureDate: string;
  returnDate?: string;
  travellers: number;
}

export interface RouteFlightResult {
  destination: string;
  offers: NormalisedFlightOffer[];
  error?: string;
}

export interface FlightLookup {
  results: RouteFlightResult[];
  configured: boolean;
  error?: string;
}

const EMPTY: FlightLookup = { results: [], configured: false };

export function buildFlightQuery(input: {
  startCity: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  travellers: number;
}): RouteFlightQuery | null {
  const origin = toIataCode(input.startCity);
  if (!origin) return null;

  const destinations = Array.from(
    new Set(
      input.destinations
        .map(toIataCode)
        .filter((code): code is string => Boolean(code) && code !== origin),
    ),
  ).slice(0, MAX_DISCOVERY_DESTINATIONS);

  if (!destinations.length) return null;

  return {
    origin,
    destinations,
    departureDate: input.startDate,
    returnDate: input.endDate,
    travellers: Math.max(1, Math.min(9, input.travellers)),
  };
}

export async function searchFlightOffers(
  query: RouteFlightQuery,
  signal?: AbortSignal,
): Promise<FlightLookup> {
  try {
    const response = await fetch("/api/flights/search", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...query, cabin: "economy" }),
    });
    const payload = (await response.json()) as Partial<FlightLookup> & { error?: string };
    if (!response.ok) return { ...EMPTY, error: payload.error ?? "Flight search failed" };
    if (!Array.isArray(payload.results)) {
      return { ...EMPTY, error: "Flight search returned an invalid response" };
    }
    return {
      results: payload.results,
      configured: Boolean(payload.configured),
      error: payload.error,
    };
  } catch {
    return { ...EMPTY, error: "Flight search unavailable" };
  }
}

export type { FlightSearchResponse, NormalisedFlightOffer };
