/** Provider-independent flight shapes shared by the server and the UI. */

export type FlightPriceStatus = "live" | "test" | "estimate" | "sample";

export interface FlightSearchRequest {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  travellers: number;
  cabin?: "economy";
}

export interface NormalisedFlightOffer {
  provider: string;
  offerId: string;
  originCode: string;
  destinationCode: string;
  outboundDepartAt: string;
  outboundArriveAt: string;
  returnDepartAt?: string;
  returnArriveAt?: string;
  totalAmount: number;
  currency: string;
  airlineName: string;
  airlineLogoUrl?: string;
  stops: number;
  durationMinutes: number;
  cabin: string;
  baggageSummary?: string;
  expiresAt?: string;
  checkedAt: string;
  status: FlightPriceStatus;
}

export interface FlightSearchResponse {
  offers: NormalisedFlightOffer[];
  status: FlightPriceStatus;
  /** Present when the provider could not answer; the UI falls back to estimates. */
  error?: string;
}

/** Every flight source Astera can plug in implements this. */
export interface FlightProvider {
  readonly name: string;
  isConfigured(): boolean;
  search(request: FlightSearchRequest): Promise<NormalisedFlightOffer[]>;
}

export const MAX_OFFERS_PER_ROUTE = 5;
export const MAX_DISCOVERY_DESTINATIONS = 3;
