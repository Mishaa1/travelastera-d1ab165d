import { LIVE_QUALITY } from "@/api/config";
import type { HotelSuggestion, LuxuryLevel } from "@/lib/types";

const DEFAULT_BASE_URL = "https://api.test.hotelbeds.com";
const PHOTO_BASE_URL = "https://photos.hotelbeds.com/giata/bigger/";
const REQUEST_TIMEOUT_MS = 10_000;
const CONTENT_CACHE_MS = 24 * 60 * 60 * 1_000;

interface HotelbedsRate {
  net?: string;
  sellingRate?: string;
  boardName?: string;
  rateType?: string;
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
  hotels?: {
    hotels?: HotelbedsAvailabilityHotel[];
  };
}

interface HotelbedsContent {
  address?: { content?: string };
  web?: string;
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

interface ContentCacheEntry {
  expiresAt: number;
  value: HotelbedsContent | null;
}

export interface HotelProviderSearch {
  latitude: number;
  longitude: number;
  checkInDate: string;
  checkOutDate: string;
  travellers: number;
  luxuryLevel: LuxuryLevel;
}

interface Candidate {
  hotel: HotelbedsAvailabilityHotel;
  room: HotelbedsRoom;
  rate: HotelbedsRate;
  total: number;
  rating: number;
}

const contentCache = new Map<number, ContentCacheEntry>();

const baseUrl = () => process.env.HOTELBEDS_BASE_URL ?? DEFAULT_BASE_URL;

export const hotelbedsProvider = {
  isConfigured() {
    return Boolean(process.env.HOTELBEDS_API_KEY && process.env.HOTELBEDS_API_SECRET);
  },

  async search(input: HotelProviderSearch): Promise<HotelSuggestion | null> {
    const rooms = Math.max(1, Math.ceil(input.travellers / 2));
    const adultsPerRoom = Math.max(1, Math.ceil(input.travellers / rooms));
    const availability = await hotelbedsRequest<HotelbedsAvailabilityResponse>(
      "/hotel-api/1.0/hotels",
      {
        method: "POST",
        body: JSON.stringify({
          stay: {
            checkIn: input.checkInDate,
            checkOut: input.checkOutDate,
          },
          occupancies: [
            {
              rooms,
              adults: adultsPerRoom,
              children: 0,
            },
          ],
          geolocation: {
            latitude: input.latitude,
            longitude: input.longitude,
            radius: 20,
            unit: "km",
          },
          filter: {
            maxHotels: 20,
          },
        }),
      },
    );

    const candidates = toCandidates(availability.hotels?.hotels ?? []);
    if (!candidates.length) return null;

    const selected = selectForLuxury(candidates, input.luxuryLevel);
    const content = await getHotelContent(selected.hotel.code);
    const nights = Math.max(
      1,
      Math.round(
        (new Date(input.checkOutDate).getTime() - new Date(input.checkInDate).getTime()) /
          86_400_000,
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

    return {
      name: selected.hotel.name,
      area,
      style: detail || "Hotelbeds available room",
      nightlyFrom: Math.round(selected.total / nights),
      totalStayPrice: Math.round(selected.total),
      rating: selected.rating,
      roomType: selected.room.name ?? "Available room",
      boardType: selected.rate.boardName ?? "Board not specified",
      imageUrl: image?.path ? `${PHOTO_BASE_URL}${image.path}` : undefined,
      latitude: numberOrUndefined(selected.hotel.latitude),
      longitude: numberOrUndefined(selected.hotel.longitude),
      currency: selected.hotel.currency,
      websiteUrl: safeWebsiteUrl(content?.web),
      quality: LIVE_QUALITY("Hotelbeds"),
    };
  },
};

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

function categoryRating(hotel: HotelbedsAvailabilityHotel): number {
  const value = hotel.categoryCode?.match(/\d/)?.[0] ?? hotel.categoryName?.match(/\d/)?.[0];
  const rating = Number(value);
  return Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : 0;
}

function selectForLuxury(candidates: Candidate[], luxury: LuxuryLevel): Candidate {
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

async function getHotelContent(code: number): Promise<HotelbedsContent | null> {
  const cached = contentCache.get(code);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const response = await hotelbedsRequest<HotelbedsContentResponse>(
      `/hotel-content-api/1.0/hotels/${code}/details?language=ENG&useSecondaryLanguage=false`,
    );
    const value = response.hotel ?? null;
    contentCache.set(code, { value, expiresAt: Date.now() + CONTENT_CACHE_MS });
    return value;
  } catch (error) {
    console.error("Hotelbeds content lookup failed", code, error);
    contentCache.set(code, { value: null, expiresAt: Date.now() + CONTENT_CACHE_MS });
    return null;
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

async function hotelbedsRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    if (!response.ok) throw new Error(`Hotelbeds request failed (${response.status})`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function numberOrUndefined(value?: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeWebsiteUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
