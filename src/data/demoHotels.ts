import { MOCK_QUALITY } from "@/api/config";
import type { HotelSuggestion, LuxuryLevel } from "@/lib/types";

interface DemoHotelFixture {
  id: string;
  city: string;
  latitude: number;
  longitude: number;
  name: string;
  area: string;
  rating: number;
  roomType: string;
  boardType: string;
  nightlyFrom: number;
}

const FIXTURES: DemoHotelFixture[] = [
  {
    id: "demo-vienna-josefstadt",
    city: "Vienna",
    latitude: 48.211,
    longitude: 16.35,
    name: "Josefstadt Atelier Hotel — Demo fixture",
    area: "Josefstadt, Vienna",
    rating: 4.4,
    roomType: "Courtyard double",
    boardType: "Breakfast included",
    nightlyFrom: 142,
  },
  {
    id: "demo-paris-canal",
    city: "Paris",
    latitude: 48.872,
    longitude: 2.365,
    name: "Canal Saint-Martin House — Demo fixture",
    area: "Canal Saint-Martin, Paris",
    rating: 4.3,
    roomType: "Classic double",
    boardType: "Room only",
    nightlyFrom: 168,
  },
  {
    id: "demo-lisbon-alfama",
    city: "Lisbon",
    latitude: 38.712,
    longitude: -9.13,
    name: "Alfama Courtyard Rooms — Demo fixture",
    area: "Alfama, Lisbon",
    rating: 4.5,
    roomType: "Terrace double",
    boardType: "Breakfast included",
    nightlyFrom: 126,
  },
  {
    id: "demo-london-bloomsbury",
    city: "London",
    latitude: 51.522,
    longitude: -0.125,
    name: "Bloomsbury Garden Hotel — Demo fixture",
    area: "Bloomsbury, London",
    rating: 4.2,
    roomType: "Garden double",
    boardType: "Room only",
    nightlyFrom: 174,
  },
  {
    id: "demo-karachi-clifton",
    city: "Karachi",
    latitude: 24.814,
    longitude: 67.03,
    name: "Clifton Courtyard Stay — Demo fixture",
    area: "Clifton, Karachi",
    rating: 4.1,
    roomType: "Deluxe double",
    boardType: "Breakfast included",
    nightlyFrom: 92,
  },
];

const distanceSquared = (fixture: DemoHotelFixture, latitude: number, longitude: number) =>
  (fixture.latitude - latitude) ** 2 + (fixture.longitude - longitude) ** 2;

export function demoHotelFixture(input: {
  cityName?: string;
  latitude: number;
  longitude: number;
  checkInDate: string;
  checkOutDate: string;
  travellers: number;
  currency: string;
  luxuryLevel: LuxuryLevel;
  fallbackReason: string;
  httpStatus: number | null;
  quotaExceeded: boolean;
}): HotelSuggestion {
  const exact = FIXTURES.find(
    (fixture) => fixture.city.toLowerCase() === input.cityName?.trim().toLowerCase(),
  );
  const fixture =
    exact ??
    [...FIXTURES].sort(
      (a, b) =>
        distanceSquared(a, input.latitude, input.longitude) -
        distanceSquared(b, input.latitude, input.longitude),
    )[0]!;
  const nights = Math.max(
    1,
    Math.round(
      (new Date(input.checkOutDate).getTime() - new Date(input.checkInDate).getTime()) / 86_400_000,
    ),
  );
  const rooms = Math.max(1, Math.ceil(input.travellers / 2));
  const tierFactor: Record<LuxuryLevel, number> = {
    hostel: 0.65,
    midscale: 1,
    boutique: 1.25,
    luxury: 1.65,
  };
  const nightlyFrom = Math.round(fixture.nightlyFrom * tierFactor[input.luxuryLevel]);
  return {
    id: fixture.id,
    name: fixture.name,
    area: fixture.area,
    style: "Labelled development fixture",
    nightlyFrom,
    totalStayPrice: nightlyFrom * nights * rooms,
    rating: fixture.rating,
    roomType: fixture.roomType,
    boardType: fixture.boardType,
    latitude: fixture.latitude,
    longitude: fixture.longitude,
    currency: input.currency,
    fallbackReason: input.fallbackReason,
    quality: MOCK_QUALITY("ASTERA demo hotel fixtures"),
    hotelProvenance: {
      source: "demo-fixture",
      httpStatus: input.httpStatus,
      quotaExceeded: input.quotaExceeded,
      cacheAgeMs: null,
      liveAvailability: false,
      bookable: false,
      fallbackReason: input.fallbackReason,
    },
  };
}
