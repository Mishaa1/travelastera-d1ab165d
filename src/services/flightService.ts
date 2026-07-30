import { ESTIMATE_QUALITY } from "@/api/config";
import { distanceKm } from "@/services/geocodeService";
import type { DataQuality, GeoPoint } from "@/lib/types";

/**
 * Flight pricing service.
 *
 * Route construction deliberately uses a deterministic estimate. Fresh Duffel
 * offers are fetched through the server-only `/api/flights/search` route once
 * the optimiser has selected its best route.
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
  const cabinFactor =
    params.cabin === "BUSINESS" ? 2.9 : params.cabin === "PREMIUM_ECONOMY" ? 1.6 : 1;
  const pricePerTraveller = Math.max(29, Math.round((base + variance) * cabinFactor));
  const durationHours = Math.round((0.9 + km / 720) * 10) / 10;

  return {
    id: `est-${seed}`,
    carrier: CARRIERS[seed % CARRIERS.length],
    pricePerTraveller,
    totalPrice: pricePerTraveller * params.travellers,
    durationHours,
    stops: km > 2200 ? 1 : 0,
    quality: ESTIMATE_QUALITY("Astera distance model"),
  };
}

export async function searchFlights(params: FlightSearchParams): Promise<FlightOffer> {
  return estimateOffer(params);
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
    quality: ESTIMATE_QUALITY("Astera distance model"),
  };
}
