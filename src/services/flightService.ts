import { API_CONFIG, ESTIMATE_QUALITY, LIVE_QUALITY } from "@/api/config";
import { apiGet } from "@/api/http";
import { distanceKm } from "@/services/geocodeService";
import type { DataQuality, GeoPoint } from "@/lib/types";

/**
 * Flight pricing service.
 *
 * Shaped after the Amadeus Self-Service `shopping/flight-offers` contract so the
 * mock can be swapped for the live call by adding VITE_AMADEUS_API_KEY.
 */

export interface FlightSearchParams {
  origin: GeoPoint & { name: string };
  destination: GeoPoint & { name: string };
  date: string;
  travellers: number;
  cabin?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS";
}

export interface FlightOffer {
  id: string;
  carrier: string;
  pricePerTraveller: number;
  totalPrice: number;
  durationHours: number;
  stops: number;
  quality: DataQuality;
}

interface AmadeusOffer {
  id: string;
  price: { total: string };
  itineraries: { duration: string; segments: { carrierCode: string }[] }[];
}

const CARRIERS = ["Aeris", "Nordwing", "Vueling", "Iberia Express", "Transavia"];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 100000;
  return hash;
}

function estimateOffer(params: FlightSearchParams): FlightOffer {
  const km = distanceKm(params.origin, params.destination);
  const seed = hashString(`${params.origin.name}${params.destination.name}${params.date}`);
  const base = 38 + km * 0.072;
  const variance = ((seed % 23) - 11) * 1.8;
  const cabinFactor = params.cabin === "BUSINESS" ? 2.9 : params.cabin === "PREMIUM_ECONOMY" ? 1.6 : 1;
  const pricePerTraveller = Math.max(29, Math.round((base + variance) * cabinFactor));
  const durationHours = Math.round((0.9 + km / 720) * 10) / 10;

  return {
    id: `est-${seed}`,
    carrier: CARRIERS[seed % CARRIERS.length],
    pricePerTraveller,
    totalPrice: pricePerTraveller * params.travellers,
    durationHours,
    stops: km > 2200 ? 1 : 0,
    quality: ESTIMATE_QUALITY("Safara distance model"),
  };
}

export async function searchFlights(params: FlightSearchParams): Promise<FlightOffer> {
  if (!API_CONFIG.flights.enabled) return estimateOffer(params);

  try {
    const data = await apiGet<{ data: AmadeusOffer[] }>(
      `${API_CONFIG.flights.baseUrl}/shopping/flight-offers`,
      {
        query: {
          originLocationCode: params.origin.name.slice(0, 3).toUpperCase(),
          destinationLocationCode: params.destination.name.slice(0, 3).toUpperCase(),
          departureDate: params.date,
          adults: params.travellers,
          travelClass: params.cabin ?? "ECONOMY",
          max: 1,
        },
        headers: { Authorization: `Bearer ${API_CONFIG.flights.apiKey}` },
      },
    );
    const offer = data.data?.[0];
    if (!offer) return estimateOffer(params);
    const total = Number(offer.price.total);
    return {
      id: offer.id,
      carrier: offer.itineraries[0]?.segments[0]?.carrierCode ?? "—",
      pricePerTraveller: Math.round(total / params.travellers),
      totalPrice: Math.round(total),
      durationHours: 2,
      stops: Math.max(0, (offer.itineraries[0]?.segments.length ?? 1) - 1),
      quality: LIVE_QUALITY(API_CONFIG.flights.provider),
    };
  } catch {
    return estimateOffer(params);
  }
}

/** Ground transport estimate used when the optimiser prefers rail or road. */
export function estimateGroundLeg(
  from: GeoPoint,
  to: GeoPoint,
  mode: "train" | "car",
  travellers: number,
): { cost: number; hours: number; quality: DataQuality } {
  const km = distanceKm(from, to);
  const speed = mode === "train" ? 118 : 82;
  const perKm = mode === "train" ? 0.14 : 0.11;
  const cost = Math.round(km * perKm * (mode === "train" ? travellers : 1) + 12);
  return {
    cost,
    hours: Math.round((km / speed + 0.6) * 10) / 10,
    quality: ESTIMATE_QUALITY("Safara distance model"),
  };
}
