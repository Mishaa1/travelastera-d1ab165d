import { LIVE_QUALITY } from "../../api/config.ts";
import type { HotelSuggestion, LuxuryLevel } from "../types.ts";

const DEFAULT_BASE_URL = "https://api.test.hotelbeds.com";
const PHOTO_BASE_URL = "https://photos.hotelbeds.com/giata/bigger/";
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_AVAILABILITY_TTL_MS = 6 * 60 * 60 * 1_000;
const DEFAULT_CONTENT_TTL_MS = 14 * 24 * 60 * 60 * 1_000;

interface HotelbedsRate {
  net?: string;
  sellingRate?: string;
  boardName?: string;
  rateType?: string;
  rateKey?: string;
}

interface HotelbedsRoom {
  name?: string;
  rates?: HotelbedsRate[];
}

interface HotelbedsAvailabilityHotel {
  code: number;
  name: string;
  categoryCode?: string;
  categoryName?: string;
  destinationName?: string;
  zoneName?: string;
  latitude?: string;
  longitude?: string;
  currency?: string;
  rooms?: HotelbedsRoom[];
}

interface HotelbedsAvailabilityResponse {
  hotels?: { hotels?: HotelbedsAvailabilityHotel[] };
}

interface HotelbedsContent {
  address?: { content?: string };
  description?: { content?: string };
  web?: string;
  facilities?: { description?: { content?: string } }[];
  images?: {
    path?: string;
    visualOrder?: number;
    order?: number;
    imageTypeCode?: string;
  }[];
}

interface HotelbedsContentResponse {
  hotel?: HotelbedsContent;
}

interface TimedCacheEntry<T> {
  storedAt: number;
  expiresAt: number;
  value: T;
}

export interface HotelProviderSearch {
  cityName?: string;
  latitude: number;
  longitude: number;
  checkInDate: string;
  checkOutDate: string;
  travellers: number;
  currency: string;
  luxuryLevel: LuxuryLevel;
}

interface Candidate {
  hotel: HotelbedsAvailabilityHotel;
  room: HotelbedsRoom;
  rate: HotelbedsRate;
  total: number;
  rating: number;
}

export interface HotelbedsDiagnostics {
  status: number | null;
  environment: string;
  responseBody?: string;
  quotaExceeded?: boolean;
  cacheAgeMs?: number | null;
  timedOut?: boolean;
  circuitOpen?: boolean;
}

export class HotelbedsProviderError extends Error {
  readonly diagnostics: HotelbedsDiagnostics;

  constructor(message: string, diagnostics: HotelbedsDiagnostics) {
    super(message);
    this.diagnostics = diagnostics;
    this.name = "HotelbedsProviderError";
  }
}

const availabilityCache = new Map<string, TimedCacheEntry<HotelbedsAvailabilityResponse>>();
const contentCache = new Map<number, TimedCacheEntry<HotelbedsContent | null>>();
const availabilityFlights = new Map<
  string,
  Promise<{
    hotel: HotelSuggestion | null;
    liveHotelCount: number;
    diagnostics: HotelbedsDiagnostics;
  }>
>();
const availabilityFailures = new Map<
  string,
  { expiresAt: number; error: HotelbedsProviderError }
>();
const HOTELBEDS_CIRCUIT_TTL_MS = 7 * 60_000;
let hotelbedsCircuitOpenUntil = 0;
let consecutiveAvailabilityFailures = 0;
const baseUrl = () => process.env.HOTELBEDS_BASE_URL ?? DEFAULT_BASE_URL;
const numericEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
const availabilityTtl = () =>
  Math.max(
    DEFAULT_AVAILABILITY_TTL_MS,
    numericEnv("HOTELBEDS_AVAILABILITY_TTL_MS", DEFAULT_AVAILABILITY_TTL_MS),
  );
const contentTtl = () => numericEnv("HOTELBEDS_CONTENT_TTL_MS", DEFAULT_CONTENT_TTL_MS);

function availabilityKey(input: HotelProviderSearch) {
  const rooms = Math.max(1, Math.ceil(input.travellers / 2));
  const adultsPerRoom = Math.max(1, Math.ceil(input.travellers / rooms));
  return JSON.stringify({
    destination: [
      input.cityName?.trim().toLowerCase() || null,
      input.latitude.toFixed(4),
      input.longitude.toFixed(4),
    ],
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    occupancy: { rooms, adultsPerRoom },
    currency: input.currency.toUpperCase(),
  });
}

function isQuotaExceeded(error: unknown) {
  return (
    error instanceof HotelbedsProviderError &&
    error.diagnostics.status === 403 &&
    /quota exceeded/i.test(error.diagnostics.responseBody ?? "")
  );
}

export const hotelbedsProvider = {
  isConfigured() {
    return Boolean(process.env.HOTELBEDS_API_KEY && process.env.HOTELBEDS_API_SECRET);
  },

  environment: () => baseUrl(),

  search(input: HotelProviderSearch): Promise<{
    hotel: HotelSuggestion | null;
    liveHotelCount: number;
    diagnostics: HotelbedsDiagnostics;
  }> {
    const key = availabilityKey(input);
    const active = availabilityFlights.get(key);
    if (active) return active;
    const request = searchHotelbeds(input).finally(() => availabilityFlights.delete(key));
    availabilityFlights.set(key, request);
    return request;
  },
};

export function resetHotelbedsResilienceForTests() {
  availabilityCache.clear();
  contentCache.clear();
  availabilityFlights.clear();
  availabilityFailures.clear();
  hotelbedsCircuitOpenUntil = 0;
  consecutiveAvailabilityFailures = 0;
}

async function searchHotelbeds(input: HotelProviderSearch): Promise<{
  hotel: HotelSuggestion | null;
  liveHotelCount: number;
  diagnostics: HotelbedsDiagnostics;
}> {
  const key = availabilityKey(input);
  const now = Date.now();
  const cached = availabilityCache.get(key);

  if (cached && cached.expiresAt > now) {
    return normaliseAvailability(
      cached.value,
      input,
      "hotelbeds-cache",
      now - cached.storedAt,
      {
        status: 200,
        environment: baseUrl(),
        quotaExceeded: false,
        cacheAgeMs: now - cached.storedAt,
      },
      true,
    );
  }

  const recentFailure = availabilityFailures.get(key);
  if (recentFailure && recentFailure.expiresAt > now) {
    if (cached) {
      const age = now - cached.storedAt;
      return normaliseAvailability(
        cached.value,
        input,
        "hotelbeds-cache",
        age,
        { ...recentFailure.error.diagnostics, cacheAgeMs: age },
        false,
        "Hotelbeds is temporarily unavailable. This is the most recent cached result and may be outdated.",
      );
    }
    throw recentFailure.error;
  }
  if (hotelbedsCircuitOpenUntil > now) {
    const error = new HotelbedsProviderError("Hotelbeds circuit is temporarily open", {
      status: null,
      environment: baseUrl(),
      cacheAgeMs: cached ? now - cached.storedAt : null,
      circuitOpen: true,
    });
    if (cached) {
      const age = now - cached.storedAt;
      return normaliseAvailability(
        cached.value,
        input,
        "hotelbeds-cache",
        age,
        error.diagnostics,
        false,
        "Hotelbeds is temporarily unavailable. This is the most recent cached result and may be outdated.",
      );
    }
    throw error;
  }

  const rooms = Math.max(1, Math.ceil(input.travellers / 2));
  const adultsPerRoom = Math.max(1, Math.ceil(input.travellers / rooms));
  try {
    const availability = await hotelbedsRequest<HotelbedsAvailabilityResponse>(
      "/hotel-api/1.0/hotels",
      {
        method: "POST",
        body: JSON.stringify({
          stay: {
            checkIn: input.checkInDate,
            checkOut: input.checkOutDate,
          },
          occupancies: [{ rooms, adults: adultsPerRoom, children: 0 }],
          geolocation: {
            latitude: input.latitude,
            longitude: input.longitude,
            radius: 20,
            unit: "km",
          },
          filter: { maxHotels: 20 },
        }),
      },
    );
    availabilityCache.set(key, {
      storedAt: now,
      expiresAt: now + availabilityTtl(),
      value: availability,
    });
    consecutiveAvailabilityFailures = 0;
    return normaliseAvailability(
      availability,
      input,
      "hotelbeds-live",
      0,
      {
        status: 200,
        environment: baseUrl(),
        quotaExceeded: false,
        cacheAgeMs: 0,
      },
      true,
    );
  } catch (error) {
    const providerError =
      error instanceof HotelbedsProviderError
        ? error
        : new HotelbedsProviderError("Hotelbeds availability request timed out", {
            status: null,
            environment: baseUrl(),
            cacheAgeMs: cached ? now - cached.storedAt : null,
            timedOut: error instanceof DOMException && error.name === "AbortError",
            responseBody: error instanceof Error ? error.message : String(error),
          });
    const quotaExceeded = isQuotaExceeded(providerError);
    consecutiveAvailabilityFailures += 1;
    if (quotaExceeded || consecutiveAvailabilityFailures >= 2) {
      hotelbedsCircuitOpenUntil = now + HOTELBEDS_CIRCUIT_TTL_MS;
    }
    availabilityFailures.set(key, {
      expiresAt: now + HOTELBEDS_CIRCUIT_TTL_MS,
      error: providerError,
    });
    if ((quotaExceeded || providerError.diagnostics.timedOut) && cached) {
      const age = now - cached.storedAt;
      return normaliseAvailability(
        cached.value,
        input,
        "hotelbeds-cache",
        age,
        {
          ...providerError.diagnostics,
          quotaExceeded,
          cacheAgeMs: age,
        },
        false,
        quotaExceeded
          ? "Hotelbeds test quota is exhausted. This is the most recent cached result and may be outdated."
          : "Hotelbeds timed out. This is the most recent cached result and may be outdated.",
      );
    }
    throw providerError;
  }
}

async function normaliseAvailability(
  availability: HotelbedsAvailabilityResponse,
  input: HotelProviderSearch,
  source: "hotelbeds-live" | "hotelbeds-cache",
  cacheAgeMs: number,
  diagnostics: HotelbedsDiagnostics,
  liveAvailability: boolean,
  fallbackReason?: string,
) {
  const candidates = toCandidates(availability.hotels?.hotels ?? []);
  if (!candidates.length) {
    return { hotel: null, liveHotelCount: 0, diagnostics };
  }
  const selected = selectForLuxury(candidates, input.luxuryLevel);
  const content = await getHotelContent(selected.hotel.code);
  const nights = Math.max(
    1,
    Math.round(
      (new Date(input.checkOutDate).getTime() - new Date(input.checkInDate).getTime()) / 86_400_000,
    ),
  );
  const image = selectImage(content?.images ?? []);
  const area =
    selected.hotel.zoneName ??
    selected.hotel.destinationName ??
    content?.address?.content ??
    "Central area";
  const detail = [selected.hotel.categoryName, selected.room.name, selected.rate.boardName]
    .filter(Boolean)
    .join(" · ");
  const bookable =
    source === "hotelbeds-live" && liveAvailability && Boolean(selected.rate.rateKey);

  return {
    hotel: {
      id: `hotelbeds:${selected.hotel.code}`,
      name: selected.hotel.name,
      area,
      style: detail || "Hotelbeds room",
      nightlyFrom: Math.round(selected.total / nights),
      totalStayPrice: Math.round(selected.total),
      rating: selected.rating,
      roomType: selected.room.name ?? "Room type not specified",
      boardType: selected.rate.boardName ?? "Board not specified",
      imageUrl: image?.path ? `${PHOTO_BASE_URL}${image.path}` : undefined,
      latitude: numberOrUndefined(selected.hotel.latitude),
      longitude: numberOrUndefined(selected.hotel.longitude),
      currency: selected.hotel.currency,
      websiteUrl: safeWebsiteUrl(content?.web),
      fallbackReason,
      quality: LIVE_QUALITY(
        source === "hotelbeds-live" ? "Hotelbeds" : "Hotelbeds cached availability",
      ),
      hotelProvenance: {
        source,
        httpStatus: diagnostics.status,
        quotaExceeded: Boolean(diagnostics.quotaExceeded),
        cacheAgeMs,
        liveAvailability,
        bookable,
        fallbackReason,
      },
    } satisfies HotelSuggestion,
    liveHotelCount: candidates.length,
    diagnostics,
  };
}

function toCandidates(hotels: HotelbedsAvailabilityHotel[]): Candidate[] {
  return hotels
    .flatMap((hotel) =>
      (hotel.rooms ?? []).flatMap((room) =>
        (room.rates ?? []).map((rate) => ({
          hotel,
          room,
          rate,
          total: Number(rate.sellingRate ?? rate.net),
          rating: categoryRating(hotel),
        })),
      ),
    )
    .filter((candidate) => Number.isFinite(candidate.total) && candidate.total > 0)
    .sort((a, b) => a.total - b.total);
}

function categoryRating(hotel: HotelbedsAvailabilityHotel) {
  const value = hotel.categoryCode?.match(/\d/)?.[0] ?? hotel.categoryName?.match(/\d/)?.[0];
  const rating = Number(value);
  return Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : 0;
}

function selectForLuxury(candidates: Candidate[], luxury: LuxuryLevel) {
  const desired: Record<LuxuryLevel, [number, number]> = {
    hostel: [0, 2],
    midscale: [3, 3],
    boutique: [4, 4],
    luxury: [5, 5],
  };
  const [minimum, maximum] = desired[luxury];
  const matching = candidates.filter(
    (candidate) => candidate.rating >= minimum && candidate.rating <= maximum,
  );
  const pool = matching.length ? matching : candidates;
  const percentile: Record<LuxuryLevel, number> = {
    hostel: 0,
    midscale: 0.2,
    boutique: 0.45,
    luxury: 0.75,
  };
  return pool[Math.min(pool.length - 1, Math.floor((pool.length - 1) * percentile[luxury]))]!;
}

async function getHotelContent(code: number) {
  const cached = contentCache.get(code);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const response = await hotelbedsRequest<HotelbedsContentResponse>(
      `/hotel-content-api/1.0/hotels/${code}/details?language=ENG&useSecondaryLanguage=false`,
    );
    const value = response.hotel ?? null;
    const now = Date.now();
    contentCache.set(code, {
      value,
      storedAt: now,
      expiresAt: now + contentTtl(),
    });
    return value;
  } catch (error) {
    console.error("Hotelbeds content lookup failed", code, error);
    return cached?.value ?? null;
  }
}

function selectImage(images: NonNullable<HotelbedsContent["images"]>) {
  return [...images]
    .filter((image) => image.path)
    .sort(
      (a, b) =>
        Number(a.visualOrder ?? Number.MAX_SAFE_INTEGER) -
          Number(b.visualOrder ?? Number.MAX_SAFE_INTEGER) ||
        Number(a.order ?? Number.MAX_SAFE_INTEGER) - Number(b.order ?? Number.MAX_SAFE_INTEGER),
    )[0];
}

async function hotelbedsRequest<T>(path: string, init: RequestInit = {}) {
  const apiKey = process.env.HOTELBEDS_API_KEY;
  const secret = process.env.HOTELBEDS_API_SECRET;
  if (!apiKey || !secret) throw new Error("Hotelbeds credentials are not configured");

  const timestamp = Math.floor(Date.now() / 1_000).toString();
  const signature = await sha256Hex(`${apiKey}${secret}${timestamp}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(new URL(path, baseUrl()), {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Api-key": apiKey,
        "X-Signature": signature,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new HotelbedsProviderError(`Hotelbeds request failed (${response.status})`, {
        status: response.status,
        environment: baseUrl(),
        responseBody: body
          .split(apiKey)
          .join("[redacted]")
          .split(secret)
          .join("[redacted]")
          .slice(0, 2_000),
        quotaExceeded: response.status === 403 && /quota exceeded/i.test(body),
        cacheAgeMs: null,
      });
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof HotelbedsProviderError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HotelbedsProviderError("Hotelbeds request timed out", {
        status: null,
        environment: baseUrl(),
        responseBody: "Request aborted after timeout",
        timedOut: true,
        cacheAgeMs: null,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function numberOrUndefined(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeWebsiteUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
