import { ESTIMATE_QUALITY, MOCK_QUALITY } from "@/api/config";
import { CITY_BY_ID, type CityRecord } from "@/data/cities";
import { distanceKm } from "@/services/geocodeService";
import type {
  Activity,
  DataQuality,
  Diet,
  RouteLeg,
  TripPreferences,
  TripStop,
} from "@/lib/types";

import landmark from "@/assets/exp-landmark.jpg";
import museum from "@/assets/exp-museum.jpg";
import foodImg from "@/assets/exp-food.jpg";
import nature from "@/assets/exp-nature.jpg";
import coast from "@/assets/exp-coast.jpg";
import night from "@/assets/exp-night.jpg";
import market from "@/assets/exp-market.jpg";
import viewpoint from "@/assets/exp-view.jpg";

/**
 * Experience layer.
 *
 * Turns an optimised stop into the things a traveller actually chooses
 * between — attractions, tables, neighbourhoods and day trips — and, more
 * importantly, into the reason each one was surfaced. Everything here is a
 * deterministic prototype model so the same stop always renders the same
 * cards; swap any single function for a live provider later.
 */

export type ExperienceCategory =
  | "landmark"
  | "museum"
  | "nature"
  | "viewpoint"
  | "market"
  | "coast"
  | "nightlife"
  | "food";

const CATEGORY_IMAGE: Record<ExperienceCategory, string> = {
  landmark,
  museum,
  nature,
  viewpoint,
  market,
  coast,
  nightlife: night,
  food: foodImg,
};

export const CATEGORY_LABEL: Record<ExperienceCategory, string> = {
  landmark: "Historic landmark",
  museum: "Museum & galleries",
  nature: "Nature & parks",
  viewpoint: "Viewpoint",
  market: "Market & shopping",
  coast: "Water & coast",
  nightlife: "After dark",
  food: "Food experience",
};

export interface Attraction {
  id: string;
  cityId: string;
  city: string;
  name: string;
  category: ExperienceCategory;
  image: string;
  gallery: string[];
  /** 0–5, one decimal. */
  rating: number;
  /** 0–100 crowd/interest index. */
  popularity: number;
  historicNote: string;
  visitMinutes: number;
  bestFor: string[];
  why: string;
  location: string;
  priceLabel: string;
  quality: DataQuality;
}

export type PriceLevel = 1 | 2 | 3 | 4;

export interface Restaurant {
  id: string;
  cityId: string;
  city: string;
  name: string;
  cuisine: string;
  image: string;
  rating: number;
  priceLevel: PriceLevel;
  signatureDish: string;
  diets: Diet[];
  walkMinutes: number;
  area: string;
  why: string;
  quality: DataQuality;
}

export type DayTripLength = "Half day" | "Full day" | "Weekend";
export type DayTripDifficulty = "Easy" | "Moderate" | "Committed";

export interface DayTrip {
  id: string;
  fromCityId: string;
  from: string;
  name: string;
  image: string;
  travelMinutes: number;
  mode: "train" | "bus" | "car" | "boat";
  estimatedCost: number;
  length: DayTripLength;
  difficulty: DayTripDifficulty;
  why: string;
  quality: DataQuality;
}

export interface NeighbourhoodProfile {
  name: string;
  city: string;
  whyStay: string;
  walkScore: number;
  transitScore: number;
  foodScore: number;
  safetyScore: number;
  nightlifeScore: number;
  familyScore: number;
  quality: DataQuality;
}

export interface LegDetail {
  airline?: string;
  serviceName: string;
  durationLabel: string;
  stopsLabel: string;
  baggageLabel: string;
  co2Kg: number;
  price: number;
  quality: DataQuality;
}

// ---------------------------------------------------------------- helpers

function hash(seed: string): number {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

const pick = <T,>(items: readonly T[], seed: string) => items[hash(seed) % items.length];
const between = (seed: string, min: number, max: number) => min + (hash(seed) % (max - min + 1));

const round1 = (value: number) => Math.round(value * 10) / 10;

// ------------------------------------------------------------ attractions

const NAME_BANK: Record<ExperienceCategory, string[]> = {
  landmark: ["{city} Old Town", "The Royal Palace of {city}", "{city} Cathedral Quarter", "{city} Citadel"],
  museum: ["{city} Museum of Fine Arts", "The {city} City Museum", "Gallery of Modern {city}"],
  nature: ["{city} Riverside Gardens", "{city} Botanical Park", "The Green Ridge, {city}"],
  viewpoint: ["{city} Panorama Terrace", "Sunset Point above {city}", "The Belltower View, {city}"],
  market: ["{city} Central Market", "Artisan Lane, {city}", "{city} Flea & Design Market"],
  coast: ["{city} Waterfront Promenade", "The Old Harbour, {city}", "{city} Lido Beach"],
  nightlife: ["{city} Late Quarter", "The Cellar Bars of {city}", "{city} Riverside Terraces"],
  food: ["{city} Tasting Walk", "The Bakery Row, {city}", "{city} Cellar Tasting Rooms"],
};

const HISTORIC_NOTE: Record<ExperienceCategory, string[]> = {
  landmark: [
    "UNESCO World Heritage Site",
    "Continuously occupied since the 12th century",
    "Rebuilt after the great fire, façades original",
  ],
  museum: [
    "National collection, founded 1891",
    "Holds three works considered nationally significant",
    "Purpose-built exhibition halls from the 1930s",
  ],
  nature: ["Protected landscape since 1964", "Designed as a public park in the 1800s", "Regional nature reserve"],
  viewpoint: ["Historic fortification wall", "Marked on maps since the 1600s", "Built as a signalling tower"],
  market: ["Trading on this site since the middle ages", "Iron-and-glass hall from 1897", "Guild market, still family run"],
  coast: ["Working harbour for over 500 years", "Blue Flag water quality", "Old fishing quarter, now protected"],
  nightlife: ["Vaulted cellars from the wine trade era", "Historic theatre district", "Former industrial quarter, now cultural"],
  food: ["Recipes protected by regional designation", "One of the oldest food halls in the country", "Traditional method, unchanged"],
};

const CATEGORY_ACTIVITY: Record<ExperienceCategory, Activity[]> = {
  landmark: ["castles", "architecture", "hidden-gems"],
  museum: ["museums"],
  nature: ["nature", "lakes", "hiking"],
  viewpoint: ["photography", "mountains"],
  market: ["shopping", "hidden-gems"],
  coast: ["beaches", "lakes", "nature"],
  nightlife: ["nightlife"],
  food: ["hidden-gems", "photography"],
};

const CATEGORY_BEST_FOR: Record<ExperienceCategory, string[]> = {
  landmark: ["History lovers", "Architecture fans", "First-time visitors"],
  museum: ["Rainy afternoons", "Art lovers", "Slow mornings"],
  nature: ["Families", "Walkers", "Quiet mornings"],
  viewpoint: ["Photographers", "Couples", "Golden hour"],
  market: ["Food lovers", "Souvenir hunting", "Early risers"],
  coast: ["Families", "Swimmers", "Sunset walks"],
  nightlife: ["Groups", "Live music", "Late dinners"],
  food: ["Food lovers", "Curious eaters", "Small groups"],
};

const CATEGORY_ORDER: ExperienceCategory[] = [
  "landmark",
  "viewpoint",
  "museum",
  "market",
  "nature",
  "coast",
  "food",
  "nightlife",
];

const ACTIVITY_LABEL: Record<Activity, string> = {
  nature: "nature",
  mountains: "mountains",
  lakes: "lakes",
  beaches: "beaches",
  museums: "museums",
  castles: "castles",
  shopping: "shopping",
  luxury: "luxury",
  "hidden-gems": "hidden gems",
  photography: "photography",
  hiking: "hiking",
  "theme-parks": "theme parks",
  architecture: "architecture",
  nightlife: "nightlife",
};

function categoryScore(city: CityRecord, category: ExperienceCategory): number {
  switch (category) {
    case "landmark":
      return city.scores.history;
    case "museum":
      return city.scores.museums;
    case "nature":
      return city.scores.nature;
    case "viewpoint":
      return city.scores.photography;
    case "market":
      return city.scores.shopping;
    case "coast":
      return (city.scores.nature + city.scores.photography) / 2;
    case "nightlife":
      return city.scores.nightlife;
    case "food":
      return city.scores.food;
  }
}

/** Ranked, explained attractions for one stop. */
export function getAttractions(
  stop: Pick<TripStop, "id" | "name" | "country">,
  prefs: TripPreferences,
  limit = 6,
): Attraction[] {
  const city = CITY_BY_ID.get(stop.id);
  const chosenActivities = prefs.activities ?? [];

  const ranked = CATEGORY_ORDER.map((category) => {
    const base = city ? categoryScore(city, category) : 70;
    const matched = CATEGORY_ACTIVITY[category].filter((activity) =>
      chosenActivities.includes(activity),
    );
    return { category, matched, score: base + matched.length * 22 };
  }).sort((a, b) => b.score - a.score);

  return ranked.slice(0, limit).map(({ category, matched, score }, index) => {
    const seed = `${stop.id}-${category}`;
    const name = pick(NAME_BANK[category], seed).replaceAll("{city}", stop.name);
    const matchedLabels = matched.map((activity) => ACTIVITY_LABEL[activity]);
    const why = matchedLabels.length
      ? `Recommended because your profile includes ${listWords(matchedLabels)} — this is the strongest ${CATEGORY_LABEL[
          category
        ].toLowerCase()} in ${stop.name}.`
      : `${stop.name} scores ${Math.round(score)}/100 here, which is well above the average stop on your route.`;

    return {
      id: `${stop.id}-${category}`,
      cityId: stop.id,
      city: stop.name,
      name,
      category,
      image: CATEGORY_IMAGE[category],
      gallery: [
        CATEGORY_IMAGE[category],
        CATEGORY_IMAGE[CATEGORY_ORDER[(index + 2) % CATEGORY_ORDER.length]],
        CATEGORY_IMAGE[CATEGORY_ORDER[(index + 5) % CATEGORY_ORDER.length]],
      ],
      rating: round1(3.9 + (hash(`${seed}r`) % 11) / 10),
      popularity: Math.min(99, Math.round(score)),
      historicNote: pick(HISTORIC_NOTE[category], seed),
      visitMinutes: between(`${seed}v`, 45, 210),
      bestFor: CATEGORY_BEST_FOR[category].slice(0, 2),
      why,
      location: `${stop.name}, ${stop.country}`,
      priceLabel:
        category === "nature" || category === "viewpoint"
          ? "Free to visit"
          : `From €${between(`${seed}p`, 6, 28)} per person`,
      quality: MOCK_QUALITY("Safara experience model"),
    } satisfies Attraction;
  });
}

// ------------------------------------------------------------ restaurants

const RESTAURANT_NAMES = [
  "Casa Verde",
  "Taverna Sette",
  "Mercato Piccolo",
  "The Salt House",
  "Osteria Lume",
  "Bistro Marée",
  "Konoba Stara",
  "Kaffeehaus Elias",
  "Zeytin & Sofra",
  "La Cantina Bassa",
  "Hearth & Rye",
  "Fig Tree Table",
];

const CUISINES = [
  "Modern regional",
  "Family trattoria",
  "Seafood grill",
  "Market kitchen",
  "Plant-forward",
  "Mediterranean mezze",
  "Bakery & coffee",
  "Tasting menu",
];

const DISHES = [
  "slow-braised shoulder with local herbs",
  "the day's catch over charcoal",
  "hand-rolled pasta with 24-hour ragù",
  "flatbread from the wood oven",
  "market vegetables with smoked butter",
  "the house pastry, made twice daily",
  "grilled aubergine with pomegranate",
  "the six-course seasonal menu",
];

const DIET_POOL: Diet[] = [
  "halal",
  "vegetarian",
  "vegan",
  "gluten-free",
  "seafood",
  "local-cuisine",
  "fine-dining",
  "street-food",
  "coffee",
  "dessert",
];

export const DIET_LABEL: Record<Diet, string> = {
  halal: "Halal",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  "gluten-free": "Gluten free",
  seafood: "Seafood",
  "local-cuisine": "Local cuisine",
  "fine-dining": "Fine dining",
  "street-food": "Street food",
  coffee: "Coffee lover",
  dessert: "Dessert lover",
};

export const priceLevelLabel = (level: PriceLevel) => "€".repeat(level);

/** Explained restaurant picks for one stop, biased to the traveller's diet. */
export function getRestaurants(
  stop: Pick<TripStop, "id" | "name" | "hotel">,
  prefs: TripPreferences,
  limit = 4,
): Restaurant[] {
  const wanted = prefs.diets ?? [];
  const luxuryBias = prefs.luxuryLevel === "luxury" ? 1 : prefs.luxuryLevel === "hostel" ? -1 : 0;

  return Array.from({ length: limit }, (_, index) => {
    const seed = `${stop.id}-rest-${index}`;
    // Guarantee the traveller's own diets show up on the first cards.
    const guaranteed = wanted.slice(index, index + 2);
    const extras = [pick(DIET_POOL, `${seed}d1`), pick(DIET_POOL, `${seed}d2`)];
    const diets = [...new Set<Diet>([...guaranteed, ...extras])];
    const matches = diets.filter((diet) => wanted.includes(diet));
    const priceLevel = Math.min(
      4,
      Math.max(1, 1 + (hash(`${seed}pl`) % 3) + luxuryBias),
    ) as PriceLevel;
    const walkMinutes = between(`${seed}w`, 3, 18);

    return {
      id: seed,
      cityId: stop.id,
      city: stop.name,
      name: pick(RESTAURANT_NAMES, seed),
      cuisine: pick(CUISINES, `${seed}c`),
      image: foodImg,
      rating: round1(4 + (hash(`${seed}r`) % 10) / 10),
      priceLevel,
      signatureDish: pick(DISHES, `${seed}s`),
      diets,
      walkMinutes,
      area: stop.hotel.area,
      why: matches.length
        ? `Matches your ${listWords(matches.map((diet) => DIET_LABEL[diet].toLowerCase()))} preference, and it is ${walkMinutes} minutes on foot from ${stop.hotel.area}.`
        : `Consistently the highest-rated table within ${walkMinutes} minutes of ${stop.hotel.area}, at a price level that fits your budget.`,
      quality: MOCK_QUALITY("Safara experience model"),
    } satisfies Restaurant;
  });
}

/** Which of the traveller's diets a restaurant can serve. */
export const dietMatches = (restaurant: Restaurant, prefs: TripPreferences) =>
  restaurant.diets.filter((diet) => (prefs.diets ?? []).includes(diet));

// -------------------------------------------------------------- day trips

const TRIP_MODES: DayTrip["mode"][] = ["train", "bus", "car", "boat"];

const TRIP_REASONS = [
  "A completely different landscape less than a morning away.",
  "The old town is compact enough to see properly between two trains.",
  "Locals go at weekends — prices drop the moment you leave the city.",
  "Best light of the whole route for photographs, late afternoon.",
  "It adds a second country to your trip without a second flight.",
];

/** "Nearby places worth visiting" for one stop. */
export function getDayTrips(stop: Pick<TripStop, "id" | "name" | "dayTrips">): DayTrip[] {
  const city = CITY_BY_ID.get(stop.id);
  const names = stop.dayTrips.length ? stop.dayTrips : city?.dayTrips ?? [];

  return names.map((name, index) => {
    const seed = `${stop.id}-dt-${index}`;
    const travelMinutes = between(`${seed}t`, 35, 210);
    const length: DayTripLength =
      travelMinutes < 70 ? "Half day" : travelMinutes < 150 ? "Full day" : "Weekend";
    const difficulty: DayTripDifficulty =
      travelMinutes < 70 ? "Easy" : travelMinutes < 150 ? "Moderate" : "Committed";
    const mode = pick(TRIP_MODES, `${seed}m`);

    return {
      id: seed,
      fromCityId: stop.id,
      from: stop.name,
      name,
      image: CATEGORY_IMAGE[CATEGORY_ORDER[hash(seed) % CATEGORY_ORDER.length]],
      travelMinutes,
      mode,
      estimatedCost: between(`${seed}c`, 12, 88),
      length,
      difficulty,
      why: pick(TRIP_REASONS, `${seed}r`),
      quality: MOCK_QUALITY("Safara day-trip model"),
    } satisfies DayTrip;
  });
}

/** Day trips reachable from a stop, ordered by how little travel they need. */
export const rankDayTrips = (trips: DayTrip[]) =>
  [...trips].sort((a, b) => a.travelMinutes - b.travelMinutes);

// ---------------------------------------------------------- neighbourhood

const STAY_REASONS = [
  "Central without being on the tourist spine — you can walk home from dinner.",
  "Quiet at night, five minutes from the main transit interchange.",
  "The best concentration of independent food anywhere in the city.",
  "Where residents actually live, so prices are a level below the old town.",
];

export function getNeighbourhood(stop: TripStop): NeighbourhoodProfile {
  const city = CITY_BY_ID.get(stop.id);
  const seed = `${stop.id}-hood`;
  const clamp = (value: number) => Math.max(35, Math.min(99, Math.round(value)));

  return {
    name: stop.hotel.area,
    city: stop.name,
    whyStay: pick(STAY_REASONS, seed),
    walkScore: clamp((city?.scores.history ?? 70) * 0.5 + 45 + (hash(`${seed}w`) % 8)),
    transitScore: clamp((city?.scores.shopping ?? 70) * 0.4 + 50 + (hash(`${seed}t`) % 8)),
    foodScore: clamp(city?.scores.food ?? 78),
    safetyScore: clamp(74 + (hash(`${seed}s`) % 22)),
    nightlifeScore: clamp(city?.scores.nightlife ?? 68),
    familyScore: clamp(96 - (city?.scores.nightlife ?? 60) * 0.35 + (hash(`${seed}f`) % 10)),
    quality: ESTIMATE_QUALITY("Safara neighbourhood model"),
  };
}

// -------------------------------------------------------------- transport

const AIRLINES = ["Aeris", "Nordwing", "Vueling", "Iberia Express", "Transavia", "Aegean"];
const RAIL_BRANDS = ["EuroCity", "Regional Express", "Intercity", "Night Line"];
const COACH_BRANDS = ["FlixBus", "Regional Coach", "Express Coach"];

const CO2_PER_KM: Record<RouteLeg["mode"], number> = {
  flight: 0.158,
  train: 0.035,
  car: 0.121,
};

/** Presentation-only enrichment of an optimised leg. */
export function describeLeg(leg: RouteLeg, travellers: number): LegDetail {
  const seed = `${leg.from}-${leg.to}-${leg.mode}`;
  const approxKm = Math.round(leg.hours * (leg.mode === "flight" ? 620 : leg.mode === "train" ? 120 : 85));
  const stops = leg.mode === "flight" ? hash(`${seed}s`) % 2 : 0;

  return {
    airline:
      leg.mode === "flight"
        ? pick(AIRLINES, seed)
        : leg.mode === "train"
          ? pick(RAIL_BRANDS, seed)
          : undefined,
    serviceName:
      leg.mode === "flight"
        ? "Direct-booking fare, hand luggage fare class"
        : leg.mode === "train"
          ? "Second class, seat reservation included"
          : pick(COACH_BRANDS, seed),
    durationLabel:
      leg.mode === "flight"
        ? `${Math.max(1, Math.round((leg.hours - 2.5) * 10) / 10)}h in the air · ${leg.hours}h door to door`
        : `${leg.hours}h door to door`,
    stopsLabel: leg.mode === "flight" ? (stops ? `${stops} stop` : "Direct") : "No changes modelled",
    baggageLabel:
      leg.mode === "flight" ? "Carry-on included (placeholder)" : "Luggage included",
    co2Kg: Math.round(approxKm * CO2_PER_KM[leg.mode] * Math.max(1, travellers)),
    price: leg.cost,
    quality: MOCK_QUALITY("Safara transport model"),
  };
}

// ---------------------------------------------------------------- shared

function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

export const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

/** Straight-line distance helper re-exported for day-trip UIs. */
export { distanceKm };
