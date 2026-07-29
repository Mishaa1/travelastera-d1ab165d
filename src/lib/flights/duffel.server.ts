import type {
  FlightProvider,
  FlightSearchRequest,
  NormalisedFlightOffer,
} from "@/lib/flights/types";
import { MAX_OFFERS_PER_ROUTE } from "@/lib/flights/types";

/**
 * Duffel flight search — server only.
 *
 * The access token is read inside the call (never at module scope) and never
 * leaves this file. Only a normalised subset of the response is returned; the
 * raw Duffel payload is deliberately not exposed to the frontend.
 */

const DUFFEL_URL = "https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=8000";
const REQUEST_TIMEOUT_MS = 12_000;

interface DuffelSegment {
  departing_at: string;
  arriving_at: string;
  origin: { iata_code: string };
  destination: { iata_code: string };
  marketing_carrier?: { name?: string; logo_symbol_url?: string };
  passengers?: { baggages?: { type: string; quantity: number }[] }[];
}

interface DuffelSlice {
  duration?: string;
  segments: DuffelSegment[];
}

interface DuffelOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at?: string;
  owner?: { name?: string; logo_symbol_url?: string };
  slices: DuffelSlice[];
}

/** ISO-8601 duration (PT4H35M) to minutes. */
function durationMinutes(value?: string): number {
  if (!value) return 0;
  const match = value.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function baggageSummary(slice: DuffelSlice): string | undefined {
  const bags = slice.segments[0]?.passengers?.[0]?.baggages ?? [];
  if (!bags.length) return undefined;
  const carry = bags.find((bag) => bag.type === "carry_on")?.quantity ?? 0;
  const checked = bags.find((bag) => bag.type === "checked")?.quantity ?? 0;
  return `${carry} cabin · ${checked} checked`;
}

function normalise(offer: DuffelOffer, cabin: string, test: boolean): NormalisedFlightOffer | null {
  const outbound = offer.slices[0];
  const inbound = offer.slices[1];
  const first = outbound?.segments[0];
  const last = outbound?.segments[outbound.segments.length - 1];
  if (!first || !last) return null;

  const total = Number(offer.total_amount);
  if (!Number.isFinite(total)) return null;

  const totalDuration = offer.slices.reduce(
    (sum, slice) =>
      sum +
      (durationMinutes(slice.duration) ||
        Math.max(
          0,
          Math.round(
            (new Date(slice.segments[slice.segments.length - 1]!.arriving_at).getTime() -
              new Date(slice.segments[0]!.departing_at).getTime()) /
              60000,
          ),
        )),
    0,
  );

  return {
    provider: "duffel",
    offerId: offer.id,
    originCode: first.origin.iata_code,
    destinationCode: last.destination.iata_code,
    outboundDepartAt: first.departing_at,
    outboundArriveAt: last.arriving_at,
    returnDepartAt: inbound?.segments[0]?.departing_at,
    returnArriveAt: inbound?.segments[inbound.segments.length - 1]?.arriving_at,
    totalAmount: Math.round(total),
    currency: offer.total_currency,
    airlineName: offer.owner?.name ?? first.marketing_carrier?.name ?? "Airline",
    airlineLogoUrl: offer.owner?.logo_symbol_url ?? first.marketing_carrier?.logo_symbol_url,
    stops: Math.max(0, outbound.segments.length - 1),
    durationMinutes: totalDuration,
    cabin,
    baggageSummary: baggageSummary(outbound),
    expiresAt: offer.expires_at,
    checkedAt: new Date().toISOString(),
    status: test ? "test" : "live",
  };
}

export const duffelProvider: FlightProvider = {
  name: "duffel",

  isConfigured() {
    return Boolean(process.env.DUFFEL_ACCESS_TOKEN);
  },

  async search(request: FlightSearchRequest): Promise<NormalisedFlightOffer[]> {
    const token = process.env.DUFFEL_ACCESS_TOKEN;
    if (!token) throw new Error("DUFFEL_ACCESS_TOKEN is not configured");

    const cabin = request.cabin ?? "economy";
    const slices = [
      {
        origin: request.origin,
        destination: request.destination,
        departure_date: request.departureDate,
      },
      ...(request.returnDate
        ? [
            {
              origin: request.destination,
              destination: request.origin,
              departure_date: request.returnDate,
            },
          ]
        : []),
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(DUFFEL_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Duffel-Version": "v2",
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            slices,
            passengers: Array.from({ length: request.travellers }, () => ({ type: "adult" })),
            cabin_class: cabin,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`Duffel request failed [${response.status}]: ${body.slice(0, 500)}`);
        throw new Error(`Duffel request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { data?: { offers?: DuffelOffer[] } };
      const offers = payload.data?.offers ?? [];
      const test = token.startsWith("duffel_test");

      return offers
        .map((offer) => normalise(offer, cabin, test))
        .filter((offer): offer is NormalisedFlightOffer => offer !== null)
        .sort((a, b) => a.totalAmount - b.totalAmount)
        .slice(0, MAX_OFFERS_PER_ROUTE);
    } finally {
      clearTimeout(timer);
    }
  },
};
