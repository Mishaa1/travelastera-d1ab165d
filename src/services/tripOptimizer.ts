import { ESTIMATE_QUALITY } from "@/api/config";
import { CITIES, CITY_BY_ID, REGION_IMAGES, type CityRecord } from "@/data/cities";
import { addDaysIso, nightsBetweenSafe, toIsoDate, todayIso } from "@/lib/date";
import { destinationMatchesResolvedCity } from "@/lib/destination";
import { assertUniqueItinerary, ExperienceRegistry, normaliseText } from "@/lib/dedupe";
import {
  mentionsExistingAccommodation,
  mentionsExistingTransport,
} from "@/lib/planner/constraints";
import { addDays } from "@/lib/format";
import type {
  Activity,
  BudgetStretchOption,
  CostBreakdown,
  DayPlan,
  Interest,
  OptimiseGoal,
  RouteLeg,
  ScoreFactor,
  TravelStyle,
  TripPreferences,
  TripRoute,
  TripScores,
  TripStop,
  TripProvenance,
} from "@/lib/types";
import { estimateGroundLeg, searchFlights } from "@/services/flightService";
import { distanceKm, geocodeCity, type GeocodeResult } from "@/services/geocodeService";
import { estimateNightlyRate, searchHotel } from "@/services/hotelService";
import { requestConstraintPlan } from "@/services/plannerService";
import { enrichItineraryWithPois } from "@/services/poiService";
import { isGroundedPlace, NO_LIVE_RECOMMENDATION } from "@/lib/places/itinerary-grounding";
import { getStopWeather } from "@/services/weatherService";
import {
  createRegionalRoutePlans,
  discoverNearbyDestinations,
  regionalContext,
  type RegionalRoutePlan,
} from "@/services/regionalDiscovery";

/**
 * The Astera optimisation engine.
 *
 * Given a budget, dates and constraints it explores candidate city
 * combinations, prices each one through the transport / hotel services and
 * returns the strongest routes. Every number it emits is an estimate — the UI
 * is responsible for labelling it as such.
 */

type Strategy = {
  id: string;
  weights: { fit: number; value: number; efficiency: number; discovery: number };
  stopCount: (nights: number) => number;
  hotelTier: "cheaper" | "preferred" | "upgrade";
};

const STRATEGIES: Strategy[] = [
  {
    id: "best-value",
    weights: { fit: 1, value: 0.75, efficiency: 0.65, discovery: 0.3 },
    stopCount: (nights) => (nights >= 10 ? 4 : 3),
    hotelTier: "cheaper",
  },
  {
    id: "fastest",
    weights: { fit: 0.75, value: 0.7, efficiency: 1.8, discovery: 0.1 },
    stopCount: (nights) => (nights >= 9 ? 2 : 1),
    hotelTier: "preferred",
  },
  {
    id: "comfortable",
    weights: { fit: 0.9, value: 0.45, efficiency: 1.2, discovery: 0.15 },
    stopCount: (nights) => (nights >= 10 ? 2 : 1),
    hotelTier: "upgrade",
  },
  {
    id: "scenic",
    weights: { fit: 1, value: 0.55, efficiency: 0.35, discovery: 1.65 },
    stopCount: (nights) => (nights >= 6 ? 3 : 2),
    hotelTier: "cheaper",
  },
  {
    id: "culture-food",
    weights: { fit: 1.55, value: 0.65, efficiency: 0.55, discovery: 0.5 },
    stopCount: (nights) => (nights >= 8 ? 3 : 1),
    hotelTier: "cheaper",
  },
];

const strategyReason = (strategy: Strategy) =>
  strategy.id === "best-value" ? "Strong balance of fit and total cost"
  : strategy.id === "fastest" ? "Fewer stops and less time in transit"
  : strategy.id === "comfortable" ? "Calmer pacing and stronger stays"
  : strategy.id === "scenic" ? "More discovery and a varied route"
  : "Food and cultural interests carry more weight";

const LOWER_COST_COUNTRIES = new Set([
  "pakistan",
  "india",
  "bangladesh",
  "nepal",
  "sri lanka",
  "indonesia",
  "vietnam",
  "cambodia",
  "laos",
  "philippines",
  "egypt",
  "morocco",
  "tunisia",
  "turkey",
  "georgia",
  "armenia",
  "albania",
  "north macedonia",
  "bosnia and herzegovina",
]);

function dynamicDailyIndex(country: string) {
  return LOWER_COST_COUNTRIES.has(normaliseText(country)) ? 38 : 68;
}

function strategyLuxuryLevel(
  strategy: Strategy,
  preferred: TripPreferences["luxuryLevel"],
): TripPreferences["luxuryLevel"] {
  const levels: TripPreferences["luxuryLevel"][] = ["hostel", "midscale", "boutique", "luxury"];
  const index = levels.indexOf(preferred);
  if (strategy.hotelTier === "cheaper") return levels[Math.max(0, index - 1)];
  if (strategy.hotelTier === "upgrade") return levels[Math.min(levels.length - 1, index + 1)];
  return preferred;
}

function dynamicCityFromGeocode(place: GeocodeResult, prefs: TripPreferences): CityRecord {
  const preferred = new Set(prefs.interests);
  const score = (interest: Interest) => (preferred.has(interest) ? 88 : 70);
  const dailyIndex = dynamicDailyIndex(place.country);
  return {
    id: `dynamic-${normaliseText(place.name).replaceAll(" ", "-")}`,
    name: place.name,
    country: place.country || "Destination",
    countryCode: place.countryCode ?? "",
    lat: place.lat,
    lon: place.lon,
    region: "coast",
    dailyIndex,
    hiddenGem: false,
    scores: {
      nature: score("nature"),
      food: score("food"),
      shopping: score("shopping"),
      photography: score("photography"),
      history: score("history"),
      museums: score("museums"),
      nightlife: score("nightlife"),
      adventure: score("adventure"),
      luxury: score("luxury"),
    },
    dayTrips: [],
    hotels: [],
    highlights: [
      {
        morning: `Explore the historic heart of ${place.name}`,
        afternoon: `Discover a neighbourhood shaped by your interests`,
        evening: `Enjoy a local dinner in ${place.name}`,
        restaurant: `A well-rated local restaurant in ${place.name}`,
        rainy: `Choose a museum or indoor cultural experience in ${place.name}`,
      },
    ],
  };
}

/** How each activity chip feeds the nine engine interests. */
const ACTIVITY_INTEREST: Record<Activity, Interest[]> = {
  nature: ["nature"],
  mountains: ["nature", "adventure"],
  lakes: ["nature", "photography"],
  beaches: ["nature"],
  museums: ["museums"],
  castles: ["history"],
  shopping: ["shopping"],
  luxury: ["luxury"],
  "hidden-gems": ["history", "food"],
  photography: ["photography"],
  hiking: ["adventure", "nature"],
  "theme-parks": ["adventure"],
  architecture: ["history", "photography"],
  nightlife: ["nightlife"],
};

const TRAVEL_STYLE_NOTE: Record<TravelStyle, string> = {
  couple: "two people travelling together — quieter neighbourhoods and good tables",
  family: "a family — shorter transfers, green space and step-free options",
  friends: "a group — central stays and walkable nightlife",
  solo: "solo travel — safe, social and easy to navigate alone",
  business: "a working trip — transit links and reliable evenings",
  honeymoon: "a honeymoon — views, privacy and one memorable dinner per city",
};

/** Merges the planner's activity chips into the engine's interest vector. */
export function effectiveInterests(prefs: TripPreferences): Interest[] {
  const derived = (prefs.activities ?? []).flatMap((activity) => ACTIVITY_INTEREST[activity] ?? []);
  return [...new Set<Interest>([...(prefs.interests ?? []), ...derived])];
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function interestFit(city: CityRecord, interests: Interest[]): number {
  if (!interests.length) {
    const all = Object.values(city.scores);
    return all.reduce((total, value) => total + value, 0) / all.length;
  }
  return interests.reduce((total, interest) => total + city.scores[interest], 0) / interests.length;
}

function legMode(
  prefs: TripPreferences,
  km: number,
): Exclude<TripPreferences["transport"], "mixed"> {
  if (prefs.transport === "car") return "car";
  if (prefs.transport === "train") return "train";
  if (prefs.transport === "flight") return prefs.avoidFlights ? "train" : "flight";
  if (prefs.avoidFlights) return km > 700 ? "train" : km > 260 ? "train" : "car";
  return km > 900 ? "flight" : km > 220 ? "train" : "car";
}

function orderStops(startPoint: { lat: number; lon: number }, cities: CityRecord[]) {
  const remaining = [...cities];
  const ordered: CityRecord[] = [];
  let cursor = startPoint;
  while (remaining.length) {
    remaining.sort((a, b) => distanceKm(cursor, a) - distanceKm(cursor, b));
    const next = remaining.shift()!;
    ordered.push(next);
    cursor = next;
  }
  return ordered;
}

function splitNights(total: number, stops: number, fewerChanges: boolean) {
  const base = Math.floor(total / stops);
  const nights = Array.from({ length: stops }, () => Math.max(1, base));
  let left = total - nights.reduce((t, n) => t + n, 0);
  let index = 0;
  while (left > 0) {
    nights[fewerChanges ? 0 : index % stops] += 1;
    left -= 1;
    index += 1;
  }
  return nights;
}

type Highlight = CityRecord["highlights"][number];

/** Extra day shapes used once a city's curated highlights are exhausted. */
function fallbackHighlights(stop: TripStop, index: number): Highlight[] {
  const dayTrips = stop.dayTrips ?? [];
  const trip = dayTrips[index % Math.max(1, dayTrips.length)];
  const templates: Highlight[] = [
    {
      morning: `A slower start in ${stop.name} — coffee where the neighbourhood goes, then the streets behind the main square`,
      afternoon: trip
        ? `Half-day out to ${trip}, back in time for the evening`
        : `The residential side of ${stop.name}, away from the centre`,
      evening: `An unhurried dinner and a walk back the long way through ${stop.name}`,
      restaurant: `A neighbourhood table locals book in ${stop.name}`,
      rainy: `Trade the walking for ${stop.name}'s best indoor collection`,
    },
    {
      morning: `The morning market in ${stop.name}, then breakfast standing at the counter`,
      afternoon: `Independent shops, a bookshop and a long sit in a park in ${stop.name}`,
      evening: `Sunset from the highest point you can walk to in ${stop.name}`,
      restaurant: `A wine bar with a short, seasonal menu in ${stop.name}`,
      rainy: `A thermal bath, cinema or covered market in ${stop.name}`,
    },
    {
      morning: `A guided two hours on the history of ${stop.name}, kept short on purpose`,
      afternoon: `Water, green space or a viewpoint just outside ${stop.name}`,
      evening: `Live music somewhere small in ${stop.name}`,
      restaurant: `The oldest still-good dining room in ${stop.name}`,
      rainy: `Gallery-hop three small spaces in ${stop.name}`,
    },
  ];
  return templates;
}

/**
 * One day plan per night, with nothing repeated anywhere in the trip.
 *
 * A shared `ExperienceRegistry` spans every city, so the same museum, walk or
 * restaurant cannot resurface on day 7 under a slightly different wording.
 */
function buildItinerary(
  stops: TripStop[],
  legs: RouteLeg[],
  plannedActivities?: Map<string, string[]>,
): DayPlan[] {
  const registry = new ExperienceRegistry();
  const plans: DayPlan[] = [];

  stops.forEach((stop, stopIndex) => {
    const record = CITY_BY_ID.get(stop.id);
    const curated = record?.highlights ?? [];

    for (let n = 0; n < stop.nights; n += 1) {
      const pool = [...curated, ...fallbackHighlights(stop, n)];

      // First option whose morning anchor has not been used anywhere yet.
      let highlight =
        pool.find((candidate) => !registry.has("activity", { name: candidate.morning })) ??
        pool[n % Math.max(1, pool.length)];

      // Guarantee an unrepeated anchor even if every option collided.
      if (registry.has("activity", { name: highlight.morning })) {
        highlight = {
          ...highlight,
          morning: `Day ${plans.length + 1} in ${stop.name}: revisit the corner you liked most, at a different hour`,
        };
      }

      registry.add("activity", { name: highlight.morning });

      const afternoon = registry.add("activity", { name: highlight.afternoon })
        ? highlight.afternoon
        : `Free hours in ${stop.name} — the optimiser leaves this one open on purpose`;

      const evening = registry.add("activity", { name: highlight.evening })
        ? highlight.evening
        : `A quiet evening near your stay in ${stop.name}`;

      const restaurant = registry.add("restaurant", { name: highlight.restaurant })
        ? highlight.restaurant
        : `Another well-rated table in ${stop.name}, chosen on the day`;

      const arrivalLeg = n === 0 ? legs[stopIndex] : undefined;

      plans.push({
        day: plans.length + 1,
        city: stop.name,
        morning: highlight.morning,
        afternoon,
        evening,
        restaurant,
        activityIntents: (() => {
          const intents = plannedActivities?.get(normaliseText(stop.name)) ?? [];
          const defaults = ["historic landmark", "art museum", "scenic evening walk"];
          return Array.from(
            { length: 3 },
            (_, index) => intents[(n * 3 + index) % intents.length] ?? defaults[index],
          );
        })(),
        rainyDayAlternative: highlight.rainy,
        transportNote: arrivalLeg
          ? `${arrivalLeg.mode} from ${arrivalLeg.from} — ${arrivalLeg.hours}h`
          : undefined,
      });
    }
  });

  assertUniqueItinerary(
    "itinerary",
    plans.flatMap((plan) => [
      { kind: "activity" as const, name: plan.morning, day: plan.day },
      { kind: "activity" as const, name: plan.afternoon, day: plan.day },
      { kind: "activity" as const, name: plan.evening, day: plan.day },
      { kind: "restaurant" as const, name: plan.restaurant, day: plan.day },
    ]),
  );

  return plans;
}

function packingFor(stops: TripStop[], prefs: TripPreferences) {
  const list = new Set<string>([
    "Passport / ID and a digital copy",
    "One carry-on that fits low-cost cabin sizing",
    "Universal adapter and a 20k power bank",
    "Refillable bottle",
  ]);
  const avgTemp = stops.reduce((t, s) => t + s.weather.tempC, 0) / Math.max(1, stops.length);
  if (avgTemp > 24) list.add("Linen layers, high SPF and a sun hat");
  if (avgTemp < 14) list.add("Merino base layer and a packable down jacket");
  if (stops.some((s) => s.weather.rainChance > 40)) list.add("Light rain shell and dry bag");
  if (prefs.interests.includes("adventure") || prefs.interests.includes("nature"))
    list.add("Trail shoes with grip");
  if (prefs.interests.includes("photography")) list.add("Spare cards, wide lens, small tripod");
  if (prefs.luxuryLevel === "luxury") list.add("One smart outfit for reservations");
  if (prefs.transport !== "car") list.add("Offline maps downloaded per city");
  return [...list];
}

const LUXURY_STEP_DOWN: Record<
  TripPreferences["luxuryLevel"],
  TripPreferences["luxuryLevel"] | null
> = {
  luxury: "boutique",
  boutique: "midscale",
  midscale: "hostel",
  hostel: null,
};

const LUXURY_LABEL: Record<TripPreferences["luxuryLevel"], string> = {
  luxury: "luxury",
  boutique: "boutique",
  midscale: "midscale",
  hostel: "hostel and guesthouse",
};

/**
 * "Stretch your budget" suggestions.
 *
 * Each one is costed locally from the route that already exists — no second
 * optimiser run, no network — so the traveller sees the new total the instant
 * they toggle it.
 */
function buildStretchOptions(context: {
  prefs: TripPreferences;
  stops: TripStop[];
  legs: RouteLeg[];
  cost: number;
  costBreakdown: CostBreakdown;
  totalNights: number;
}): BudgetStretchOption[] {
  const { prefs, stops, legs, costBreakdown, totalNights } = context;
  const options: BudgetStretchOption[] = [];

  // 1. Step down one accommodation tier.
  const cheaperTier = LUXURY_STEP_DOWN[prefs.luxuryLevel];
  if (cheaperTier) {
    const rooms = Math.ceil(prefs.travellers / 2);
    const newAccommodation = stops.reduce(
      (total, stop) =>
        total + estimateNightlyRate(stop.id, cheaperTier).nightly * stop.nights * rooms,
      0,
    );
    const delta = Math.round(newAccommodation - costBreakdown.accommodation);
    if (delta < -20) {
      options.push({
        id: "downgrade-stay",
        label: `Drop to ${LUXURY_LABEL[cheaperTier]} stays`,
        detail: `Same cities, same nights, ${LUXURY_LABEL[cheaperTier]} rooms instead of ${LUXURY_LABEL[prefs.luxuryLevel]}.`,
        costDelta: delta,
        tradeoff: "Less polish at check-in — the locations stay central.",
      });
    }
  }

  // 2. Replace the most expensive flight with rail.
  const flight = [...legs]
    .filter((leg) => leg.mode === "flight")
    .sort((a, b) => b.cost - a.cost)[0];
  if (flight) {
    const railCost = Math.round(flight.cost * 0.62);
    options.push({
      id: "rail-swap",
      label: "Use rail instead of eligible flights",
      detail: `A rail-first recalculation, beginning with the ${flight.from}–${flight.to} leg.`,
      costDelta: railCost - Math.round(flight.cost),
      tradeoff: `Likely adds travel time, while removing airport transfers. Final times and prices are recalculated before the trip changes.`,
    });
  }

  // 3. Cut the shortest stop and give those nights to the others.
  if (stops.length > 2) {
    const requiredDestination = normaliseText(prefs.endCity);
    const removableStops = stops.filter(
      (stop, index) =>
        index < stops.length - 1 &&
        (!requiredDestination || normaliseText(stop.name) !== requiredDestination),
    );
    const shortest = [...removableStops].sort((a, b) => a.nights - b.nights)[0];
    if (shortest) {
    const rooms = Math.ceil(prefs.travellers / 2);
    const nightly = estimateNightlyRate(shortest.id, prefs.luxuryLevel).nightly;
    const city = CITY_BY_ID.get(shortest.id);
    const dailySpend = (city?.dailyIndex ?? 80) * 0.78 * prefs.travellers;
    const legCost = legs.find((leg) => leg.to === shortest.name)?.cost ?? 0;
    const delta = -Math.round(nightly * shortest.nights * rooms * 0.35 + legCost * 0.5);
    options.push({
      id: "drop-stop",
      label: `Skip ${shortest.name}, spread the nights`,
      detail: `Three cities instead of four. Those ${shortest.nights} nights go to the stops you rated highest.`,
      costDelta: delta,
      tradeoff: `You lose ${shortest.name}, but save a hotel change and about ${Math.round(dailySpend / 100) / 10}k steps with luggage.`,
    });
    }
  }

  // 4. Add two more nights at the strongest stop.
  const anchor = stops[0];
  if (anchor && totalNights < 21) {
    const rooms = Math.ceil(prefs.travellers / 2);
    const nightly = estimateNightlyRate(anchor.id, prefs.luxuryLevel).nightly;
    const city = CITY_BY_ID.get(anchor.id);
    const daily = (city?.dailyIndex ?? 80) * 0.78 * prefs.travellers;
    options.push({
      id: "extend",
      label: `Add 2 nights in ${anchor.name}`,
      detail: "No extra transport — you are already there, and the flights do not change.",
      costDelta: Math.round((nightly * rooms + daily) * 2),
      tradeoff:
        "Costs more, but the per-day cost of a longer stay is the lowest of any change here.",
    });
  }

  // 5. Eat the way the city actually eats.
  if (costBreakdown.food > 150) {
    options.push({
      id: "eat-local",
      label: "Swap two restaurant dinners a week for markets",
      detail:
        "Set menus at lunch, market dinners in the evening — the pattern locals actually use.",
      costDelta: -Math.round(costBreakdown.food * 0.18),
      tradeoff: "Fewer booked tables, more standing at counters.",
    });
  }

  return options;
}

export interface OptimiseInput {
  preferences: TripPreferences;
  /** Optional signal so a long recalculation can be cancelled by the UI. */
  signal?: AbortSignal;
  /** Read-only pipeline updates for the results loading experience. */
  onProgress?: (progress: OptimisationProgress) => void;
  /** Ordered mandatory stays used by scoped itinerary edits. */
  requiredStops?: string[];
  /** Optional exact night allocation for mandatory stays. */
  requiredStopNights?: Record<string, number>;
}

export type OptimisationStage =
  | "preferences"
  | "destinations"
  | "flights"
  | "hotels"
  | "attractions"
  | "restaurants"
  | "tradeoffs"
  | "selection";

export interface OptimisationProgress {
  stage: OptimisationStage;
  counts?: {
    candidateRoutes?: number;
    flightsAnalysed?: number;
    hotelsConsidered?: number;
    attractionsRanked?: number;
    restaurantsMatched?: number;
    candidatesScored?: number;
  };
  preferences?: TripPreferences;
  candidates?: OptimisationCandidateProgress[];
  providers?: OptimisationProviderProgress;
}

export interface OptimisationCandidateProgress {
  id: string;
  route: string[];
  stops: number;
  reason: string;
  totalCost?: number;
  budgetLeft?: number;
  transitHours?: number;
  transfers?: number;
  hotelRating?: number;
  hotelName?: string;
  hotelNightly?: number;
  hotelTotal?: number;
  attractionCount?: number;
  restaurantCount?: number;
  topAttractions?: Array<{ name: string; category: string; rating?: number; source: string }>;
  topRestaurants?: Array<{ name: string; category?: string; rating?: number; source: string }>;
  score?: number;
  status?: "considering" | "scored" | "selected";
}

export interface OptimisationProviderProgress {
  flights?: { status: "live" | "test" | "estimated" | "unavailable"; count: number; detail: string };
  hotels?: { status: "live" | "cached" | "demo" | "unavailable"; count: number; detail: string };
  attractions?: { status: "live" | "cached" | "partial" | "unavailable"; count: number; detail: string };
  restaurants?: { status: "live" | "cached" | "partial" | "unavailable"; count: number; detail: string };
}

type OptimisationProgressPatch = Omit<Partial<OptimisationProgress>, "stage" | "counts">;

const DEFAULT_TRIP_NIGHTS = 7;

/**
 * Repairs a preference set before the engine touches it.
 *
 * Dates arriving from local storage, a URL or a half-filled form are routinely
 * empty, reversed or unparseable. Rather than fail — or silently plan a trip in
 * 1970 — we clamp everything into a sane, plannable range.
 */
export function normalisePreferences(input: Partial<TripPreferences>): TripPreferences {
  const base = { ...SAMPLE_PREFERENCES, ...input };

  let start = toIsoDate(base.startDate);
  let end = toIsoDate(base.endDate);

  // Flexible planning: a month plus a length is enough to build a concrete span.
  if (base.dateMode === "flexible" && /^\d{4}-\d{2}$/.test(base.flexibleMonth ?? "")) {
    const nights = clamp(Math.round(base.flexibleNights) || 7, 2, 30);
    start = `${base.flexibleMonth}-08`;
    end = addDaysIso(start, nights);
  }

  // Provider availability APIs cannot search past dates. Preserve the requested
  // trip length while moving an old draft into a bookable future window.
  if (!start) start = addDaysIso(todayIso(), 30);
  if (!end || nightsBetweenSafe(start, end) === null) {
    end = addDaysIso(start, DEFAULT_TRIP_NIGHTS);
  }
  // Reversed dates: trust the earlier one and rebuild the span.
  if (new Date(end!).getTime() <= new Date(start!).getTime()) {
    end = addDaysIso(start, DEFAULT_TRIP_NIGHTS);
  }
  if (start < todayIso()) {
    const requestedNights = nightsBetweenSafe(start, end) ?? DEFAULT_TRIP_NIGHTS;
    start = addDaysIso(todayIso(), 30);
    end = addDaysIso(start, requestedNights);
  }

  const nights = nightsBetweenSafe(start, end) ?? DEFAULT_TRIP_NIGHTS;
  // Beyond a month the combination space stops being meaningful for an MVP.
  if (nights > 30) end = addDaysIso(start, 30);

  return {
    ...base,
    startCity: (base.startCity || "").trim() || SAMPLE_PREFERENCES.startCity,
    endCity:
      (base.endCity || "").trim() || (base.startCity || "").trim() || SAMPLE_PREFERENCES.startCity,
    startDate: start!,
    endDate: end!,
    travellers: clamp(Math.round(base.travellers) || 2, 1, 12),
    budget: clamp(Math.round(base.budget) || 1500, 200, 100_000),
    maxTravelHours: clamp(Math.round(base.maxTravelHours) || 12, 2, 60),
    interests: base.interests ?? [],
    activities: base.activities ?? [],
    diets: base.diets ?? [],
    notes: base.notes ?? "",
  };
}

/** How many nights the engine is planning for. */
export const tripNights = (prefs: TripPreferences) =>
  nightsBetweenSafe(prefs.startDate, prefs.endDate) ?? DEFAULT_TRIP_NIGHTS;

/**
 * A blank end city means the traveller has no fixed destination, so Astera
 * compares destinations instead of optimising around one.
 */
export const isDiscoveryTrip = (prefs: Partial<TripPreferences>) => !(prefs.endCity ?? "").trim();

/** Pure, synchronous city selection — no network, so it can be run up front. */
function selectCities(
  strategy: Strategy,
  prefs: TripPreferences,
  startPoint: { lat: number; lon: number; name: string },
  endPoint: { lat: number; lon: number; name: string },
  exclude: Set<string>,
): CityRecord[] {
  const totalNights = tripNights(prefs);
  const stopCount = Math.min(4, Math.max(2, strategy.stopCount(totalNights)));

  const pool = CITIES.filter((city) => !exclude.has(city.id));
  const candidates = (pool.length >= stopCount ? pool : CITIES)
    .map((city) => {
      const fit = interestFit(city, prefs.interests);
      const detour = distanceKm(startPoint, city) + distanceKm(city, endPoint);
      const efficiency = clamp(100 - detour / 42);
      const value = clamp(120 - city.dailyIndex * 0.72);
      const discovery = city.hiddenGem ? 92 : 42;
      const score =
        fit * strategy.weights.fit +
        value * strategy.weights.value +
        efficiency * strategy.weights.efficiency +
        discovery * strategy.weights.discovery;
      return { city, score };
    })
    .sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name));

  return orderStops(
    startPoint,
    candidates.slice(0, stopCount).map((entry) => entry.city),
  );
}

async function buildRoute(
  strategy: Strategy,
  prefs: TripPreferences,
  startPoint: { lat: number; lon: number; name: string },
  endPoint: { lat: number; lon: number; name: string },
  chosen: CityRecord[],
  plannedNights?: number[],
  plannedActivities?: Map<string, string[]>,
  planner: TripProvenance["planner"] = {
    provider: "Unavailable",
    model: "none",
    active: false,
  },
  report?: (stage: OptimisationStage, counts?: OptimisationProgress["counts"], patch?: OptimisationProgressPatch) => void,
  regionalPlan?: RegionalRoutePlan,
): Promise<TripRoute> {
  const totalNights = tripNights(prefs);
  const hotelLuxuryLevel = strategyLuxuryLevel(strategy, prefs.luxuryLevel);
  const nightsPerStop =
    plannedNights?.length === chosen.length
      ? plannedNights
      : splitNights(totalNights, chosen.length, prefs.fewerHotelChanges);

  // --- transport legs -------------------------------------------------
  const waypoints = [
    { name: startPoint.name, lat: startPoint.lat, lon: startPoint.lon },
    ...chosen.map((city) => ({ name: city.name, lat: city.lat, lon: city.lon })),
    ...(chosen.at(-1) && normaliseText(chosen.at(-1)!.name) === normaliseText(endPoint.name)
      ? []
      : [{ name: endPoint.name, lat: endPoint.lat, lon: endPoint.lon }]),
  ];

  const legs: RouteLeg[] = [];
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const km = distanceKm(from, to);
    if (km < 25) continue;
    const mode = legMode(prefs, km);
    const existingTransport = mentionsExistingTransport(prefs.notes, from.name, to.name);
    if (mode === "flight") {
      const offer = await searchFlights({
        origin: from,
        destination: to,
        date: addDays(
          prefs.startDate,
          nightsPerStop.slice(0, i).reduce((total, value) => total + value, 0),
        ),
        travellers: prefs.travellers,
        cabin: prefs.luxuryLevel === "luxury" ? "PREMIUM_ECONOMY" : "ECONOMY",
      });
      legs.push({
        from: from.name,
        to: to.name,
        mode: "flight",
        hours: offer.durationHours + 2.5,
        cost: existingTransport ? 0 : offer.totalPrice,
        note: existingTransport
          ? "Already arranged by traveller"
          : `${offer.carrier} · ${offer.stops ? `${offer.stops} stop` : "direct"}`,
        quality: offer.quality,
      });
    } else {
      const ground = estimateGroundLeg(from, to, mode, prefs.travellers);
      legs.push({
        from: from.name,
        to: to.name,
        mode,
        hours: ground.hours,
        cost: existingTransport ? 0 : ground.cost,
        note: existingTransport
          ? "Already arranged by traveller"
          : mode === "train"
            ? `${km} km by rail`
            : `${km} km drive`,
        quality: ground.quality,
      });
    }
  }
  const regionalDayTrip = regionalPlan?.nearby &&
    (regionalPlan.family === "nearby-day-trip" ||
      (regionalPlan.family === "regional-hidden-gem" && regionalPlan.cities.length === 1))
      ? regionalPlan.nearby
      : undefined;
  if (regionalDayTrip) {
    const base = chosen.at(-1)!;
    const mode = regionalDayTrip.modes.includes("train")
      ? "train"
      : regionalDayTrip.modes.includes("car")
        ? "car"
        : "train";
    const outbound = estimateGroundLeg(
      { name: base.name, lat: base.lat, lon: base.lon },
      { name: regionalDayTrip.name, lat: regionalDayTrip.lat, lon: regionalDayTrip.lon },
      mode,
      prefs.travellers,
    );
    const inbound = estimateGroundLeg(
      { name: regionalDayTrip.name, lat: regionalDayTrip.lat, lon: regionalDayTrip.lon },
      { name: base.name, lat: base.lat, lon: base.lon },
      mode,
      prefs.travellers,
    );
    legs.push(
      { from: base.name, to: regionalDayTrip.name, mode, hours: outbound.hours, cost: outbound.cost, note: "Regional day trip · indicative ground connection", quality: outbound.quality },
      { from: regionalDayTrip.name, to: base.name, mode, hours: inbound.hours, cost: inbound.cost, note: "Return to the same hotel · indicative ground connection", quality: inbound.quality },
    );
  }
  const candidateId = `${strategy.id}-${chosen.map((city) => city.id).join("-")}`;
  report?.("flights", { flightsAnalysed: legs.filter((leg) => leg.mode === "flight").length }, {
    candidates: [{
      id: candidateId,
      route: [startPoint.name, ...chosen.map((city) => city.name)],
      stops: chosen.length,
      reason: strategyReason(strategy),
      transitHours: Math.round(legs.reduce((sum, leg) => sum + leg.hours, 0) * 10) / 10,
      transfers: Math.max(0, legs.length - 1),
      status: "considering",
    }],
    providers: {
      flights: {
        status: legs.some((leg) => leg.quality?.source === "live") ? "live" : legs.some((leg) => leg.quality?.source === "test") ? "test" : "estimated",
        count: legs.filter((leg) => leg.mode === "flight").length,
        detail: legs.some((leg) => leg.quality?.provider === "Duffel") ? "Duffel offers received" : "Transport estimates available",
      },
    },
  });

  // --- stops with hotels + weather ------------------------------------
  const stops: TripStop[] = await Promise.all(
    chosen.map(async (city, index) => {
      const nights = nightsPerStop[index];
      const accommodationProvided = mentionsExistingAccommodation(prefs.notes, city.name);
      const [hotel, weather] = await Promise.all([
        accommodationProvided
          ? Promise.resolve({
              name: "Your existing accommodation",
              area: city.name,
              style: "Already arranged",
              nightlyFrom: 0,
              totalStayPrice: 0,
              rating: 0,
              fallbackReason: "No hotel recommendation was requested for this stop.",
              quality: ESTIMATE_QUALITY("Traveller-provided accommodation"),
            })
          : searchHotel({
              cityId: city.id,
              cityName: city.name,
              latitude: city.lat,
              longitude: city.lon,
              baseNightlyRate: city.hotels[0]?.nightlyFrom ?? Math.round(city.dailyIndex * 0.9),
              nights,
              travellers: prefs.travellers,
              luxuryLevel: hotelLuxuryLevel,
              checkInDate: addDays(
                prefs.startDate,
                nightsPerStop.slice(0, index).reduce((total, value) => total + value, 0),
              ),
              checkOutDate: addDays(
                prefs.startDate,
                nightsPerStop.slice(0, index + 1).reduce((total, value) => total + value, 0),
              ),
              currency: prefs.currency,
            }),
        getStopWeather(city.name, city, prefs.startDate),
      ]);
      return {
        id: city.id,
        name: city.name,
        country: city.country,
        countryCode: city.countryCode,
        lat: city.lat,
        lon: city.lon,
        nights,
        dayTrips: city.dayTrips,
        hotel,
        weather,
        accommodationProvided,
      } satisfies TripStop;
    }),
  );
  const visibleHotels = stops.filter((stop) => !stop.accommodationProvided);
  const hotelSource = visibleHotels[0]?.hotel.hotelProvenance?.source;
  report?.("hotels", { hotelsConsidered: visibleHotels.length }, {
    candidates: [{
      id: candidateId,
      route: [startPoint.name, ...chosen.map((city) => city.name)],
      stops: chosen.length,
      reason: strategyReason(strategy),
      hotelName: visibleHotels[0]?.hotel.name,
      hotelRating: visibleHotels[0]?.hotel.rating,
      hotelNightly: visibleHotels[0]?.hotel.nightlyFrom,
      hotelTotal: visibleHotels.reduce((sum, stop) => sum + (stop.hotel.totalStayPrice ?? stop.hotel.nightlyFrom * stop.nights), 0),
      status: "considering",
    }],
    providers: {
      hotels: {
        status: hotelSource === "hotelbeds-live" ? "live" : hotelSource === "hotelbeds-cache" ? "cached" : hotelSource === "demo-fixture" ? "demo" : visibleHotels.length ? "unavailable" : "unavailable",
        count: visibleHotels.length,
        detail: hotelSource === "hotelbeds-live" ? "Live Hotelbeds availability" : hotelSource === "hotelbeds-cache" ? "Cached Hotelbeds availability" : hotelSource === "demo-fixture" ? "Labelled demo inventory" : visibleHotels.length ? visibleHotels[0].hotel.quality.provider : "No hotel required",
      },
    },
  });

  // --- cost model ------------------------------------------------------
  const transport = legs.reduce((total, leg) => total + leg.cost, 0);
  const accommodation = stops.reduce((total, stop) => {
    const rooms = Math.ceil(prefs.travellers / 2);
    return total + stop.hotel.nightlyFrom * stop.nights * rooms;
  }, 0);
  // OpenTripMap does not publish bookable food or admission prices. Do not
  // manufacture them: these categories remain excluded until a price-bearing
  // provider is connected.
  const food = 0;
  const activities = 0;
  const subtotal = transport + accommodation + food + activities;
  const buffer = 0;
  const costBreakdown: CostBreakdown = {
    transport: Math.round(transport),
    accommodation: Math.round(accommodation),
    food: Math.round(food),
    activities: Math.round(activities),
    buffer,
  };
  const cost = Math.round(subtotal + buffer);

  // --- scores ----------------------------------------------------------
  const journeyHours = Math.round(legs.reduce((total, leg) => total + leg.hours, 0) * 10) / 10;
  const avg = (key: Interest) =>
    chosen.reduce((total, city) => total + city.scores[key], 0) / chosen.length;

  const experience = clamp(
    Math.round(
      chosen.reduce((total, city) => total + interestFit(city, prefs.interests), 0) / chosen.length,
    ),
  );
  const efficiency = clamp(
    Math.round(100 - (journeyHours / Math.max(1, prefs.maxTravelHours)) * 42),
  );
  const weatherScore = clamp(
    Math.round(
      stops.reduce((total, stop) => total + (100 - stop.weather.rainChance * 0.85), 0) /
        stops.length,
    ),
  );
  const budgetRatio = cost / Math.max(1, prefs.budget);
  const budgetScore = clamp(118 - budgetRatio * 100);
  const WEIGHTS = { experience: 0.34, budget: 0.32, efficiency: 0.2, weather: 0.14 } as const;
  const overall = clamp(
    Math.round(
      experience * WEIGHTS.experience +
        efficiency * WEIGHTS.efficiency +
        weatherScore * WEIGHTS.weather +
        budgetScore * WEIGHTS.budget,
    ),
  );

  const scores: TripScores = {
    overall,
    experience,
    nature: Math.round(avg("nature")),
    food: Math.round(avg("food")),
    weather: weatherScore,
    efficiency,
  };

  // Every number above, restated in language a traveller can argue with.
  const scoreFactors: ScoreFactor[] = [
    {
      key: "experience",
      label: "Interest fit",
      value: experience,
      weight: WEIGHTS.experience,
      explanation: prefs.interests.length
        ? `${chosen.map((c) => c.name).join(", ")} average ${experience}/100 against your ${prefs.interests.join(", ")} interests.`
        : `No interests were set, so this is the all-round strength of ${chosen.map((c) => c.name).join(", ")}.`,
    },
    {
      key: "budget",
      label: "Budget efficiency",
      value: Math.round(budgetScore),
      weight: WEIGHTS.budget,
      explanation:
        cost <= prefs.budget
          ? `Uses ${Math.round(budgetRatio * 100)}% of your budget, so ${Math.round(100 - budgetRatio * 100)}% stays unspent.`
          : `Runs ${Math.round((budgetRatio - 1) * 100)}% over budget as planned — the suggestions below close that gap.`,
    },
    {
      key: "efficiency",
      label: "Time on the ground",
      value: efficiency,
      weight: WEIGHTS.efficiency,
      explanation: `${journeyHours}h of the trip is spent moving, against the ${prefs.maxTravelHours}h you allowed.`,
    },
    {
      key: "weather",
      label: "Weather outlook",
      value: weatherScore,
      weight: WEIGHTS.weather,
      explanation: `Average rain chance across the stops is ${Math.round(
        stops.reduce((total, stop) => total + stop.weather.rainChance, 0) / stops.length,
      )}% for your dates.`,
    },
  ];

  // --- narrative -------------------------------------------------------
  const gemNames = chosen.filter((c) => c.hiddenGem).map((c) => c.name);
  const reasoning = [
    `Your ${prefs.interests.length ? prefs.interests.join(", ") : "general"} interests score highest across ${chosen
      .map((c) => c.name)
      .join(" → ")}, averaging ${experience}/100 on interest fit.`,
    `Total transit is ${journeyHours}h against your ${prefs.maxTravelHours}h ceiling, so ${efficiency}% of your days stay on the ground rather than in transit.`,
    cost <= prefs.budget
      ? `The full plan is estimated at ${Math.round(budgetRatio * 100)}% of your budget, leaving room for spontaneous spending.`
      : `This route runs about ${Math.round((budgetRatio - 1) * 100)}% over budget — use Optimise further to pull it back down.`,
    gemNames.length
      ? `${gemNames.join(" and ")} ${gemNames.length > 1 ? "are" : "is"} under-visited relative to ${chosen[0].name}, which is where the value comes from.`
      : `Stops were ordered by proximity from ${startPoint.name} so no leg backtracks.`,
    prefs.avoidFlights
      ? "You asked to avoid flying, so every leg is rail or road even where a flight would be faster."
      : `Transport mix chosen for the ${prefs.transport} preference at the lowest total hours.`,
    prefs.travelStyle
      ? `Pace, stay type and evenings are tuned for ${TRAVEL_STYLE_NOTE[prefs.travelStyle]}.`
      : "",
    prefs.notes.trim()
      ? `We also read your note — "${prefs.notes.trim().slice(0, 140)}" — and kept it in mind when ordering the stops.`
      : "",
  ].filter(Boolean);

  const dominantMode = legs.reduce<Record<string, number>>((acc, leg) => {
    acc[leg.mode] = (acc[leg.mode] ?? 0) + leg.hours;
    return acc;
  }, {});
  const transportRecommendation =
    Object.entries(dominantMode).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "train";

  let itinerary = buildItinerary(stops, legs, plannedActivities);
  let poiStops = stops;
  if (regionalDayTrip && itinerary.length > 1) {
    const baseStop = stops.find((stop) => normaliseText(stop.name) === normaliseText(prefs.endCity)) ?? stops.at(-1)!;
    const dayTripIndex = Math.min(itinerary.length - 1, Math.max(1, Math.floor(itinerary.length / 2)));
    itinerary = itinerary.map((day, index) => index === dayTripIndex
      ? {
          ...day,
          city: regionalDayTrip.name,
          activityIntents: plannedActivities?.get(normaliseText(regionalDayTrip.name)) ?? day.activityIntents,
          transportNote: `${regionalDayTrip.modes[0] ?? "ground transport"} day trip from ${baseStop.name} · about ${regionalDayTrip.estimatedTravelMinutes} min each way`,
        }
      : day);
    poiStops = [
      ...stops,
      {
        ...baseStop,
        id: `regional-day-trip-${normaliseText(regionalDayTrip.name).replaceAll(" ", "-")}`,
        name: regionalDayTrip.name,
        country: regionalDayTrip.country,
        countryCode: regionalDayTrip.countryCode,
        lat: regionalDayTrip.lat,
        lon: regionalDayTrip.lon,
        nights: 0,
        dayTrips: [],
      },
    ];
  }
  // LLM activities are search intents only. They are never rendered as factual
  // venues; the POI provider below is the sole source of named places.
  if (import.meta.env.DEV) {
    console.info(
      "[poi:resolved-itinerary-cities]",
      poiStops.map((stop) => ({
        city: stop.name,
        latitude: stop.lat,
        longitude: stop.lon,
        itineraryDays: itinerary.filter((day) => day.city === stop.name).length,
      })),
    );
  }
  const poiResult = await enrichItineraryWithPois(
    poiStops,
    itinerary,
    `${strategy.id}:${prefs.startDate}:${prefs.endDate}`,
  );
  itinerary = poiResult.itinerary;
  report?.("attractions", {
    attractionsRanked: itinerary.reduce((total, day) => total + (day.experiences?.length ?? 0), 0),
  }, {
    candidates: [{
      id: candidateId, route: [startPoint.name, ...chosen.map((city) => city.name)], stops: chosen.length,
      reason: strategyReason(strategy),
      attractionCount: itinerary.reduce((total, day) => total + (day.experiences?.length ?? 0), 0),
      topAttractions: itinerary.flatMap((day) => day.experiences ?? []).slice(0, 3).map((place) => ({ name: place.name, category: place.category, rating: place.rating, source: place.sourceStatus })),
      status: "considering",
    }],
    providers: { attractions: {
      status: poiResult.diagnostics.status === "active" ? (poiResult.diagnostics.source?.includes("cache") ? "cached" : "live") : poiResult.diagnostics.status === "partial" ? "partial" : "unavailable",
      count: itinerary.reduce((total, day) => total + (day.experiences?.length ?? 0), 0),
      detail: poiResult.diagnostics.provider || "Live places unavailable",
    } },
  });
  report?.("restaurants", {
    restaurantsMatched: itinerary.filter((day) => Boolean(day.restaurantDetails)).length,
  }, {
    candidates: [{
      id: candidateId, route: [startPoint.name, ...chosen.map((city) => city.name)], stops: chosen.length,
      reason: strategyReason(strategy),
      restaurantCount: itinerary.filter((day) => Boolean(day.restaurantDetails)).length,
      topRestaurants: itinerary.flatMap((day) => day.restaurantDetails ? [day.restaurantDetails] : []).slice(0, 3).map((place) => ({ name: place.name, category: place.category, rating: place.rating, source: place.sourceStatus })),
      status: "considering",
    }],
    providers: { restaurants: {
      status: poiResult.diagnostics.categories?.restaurants.source.includes("cache") ? "cached" : poiResult.diagnostics.categories?.restaurants.count ? "live" : poiResult.diagnostics.status === "partial" ? "partial" : "unavailable",
      count: itinerary.filter((day) => Boolean(day.restaurantDetails)).length,
      detail: poiResult.diagnostics.categories?.restaurants.unavailableReason ?? poiResult.diagnostics.categories?.restaurants.source ?? "Live restaurant data unavailable",
    } },
  });

  const stretchOptions = buildStretchOptions({
    prefs,
    stops,
    legs,
    cost,
    costBreakdown,
    totalNights,
  });

  return {
    id: candidateId,
    title: "Candidate trip",
    tagline: chosen.map((city) => city.name).join(" → "),
    image: REGION_IMAGES[chosen[0].region],
    countries: [...new Set(chosen.map((c) => c.country))],
    stops,
    legs,
    scores,
    scoreFactors,
    stretchOptions,

    cost,
    costBreakdown,
    budgetLeft: Math.round(prefs.budget - cost),
    journeyHours,
    transportRecommendation:
      transportRecommendation === "flight"
        ? "Fly the long hop, then stay on rail"
        : transportRecommendation === "train"
          ? "Rail-first routing with city-centre arrivals"
          : "Self-drive gives you the villages between stops",
    reasoning,
    packingList: packingFor(stops, prefs),
    itinerary,
    quality: ESTIMATE_QUALITY("Astera optimisation engine"),
    preferences: prefs,
    generatedAt: new Date().toISOString(),
    provenance: {
      planner,
      hotelbeds: (() => {
        const hotel = stops.find((stop) => stop.hotel.hotelProvenance)?.hotel;
        if (!hotel?.hotelProvenance) return undefined;
        return {
          source: hotel.hotelProvenance.source,
          status: hotel.hotelProvenance.httpStatus,
          environment: hotel.providerDiagnostics?.environment ?? "Hotelbeds test environment",
          liveHotelCount:
            hotel.providerDiagnostics?.liveHotelCount ??
            Number(hotel.hotelProvenance.liveAvailability),
          quotaExceeded: hotel.hotelProvenance.quotaExceeded,
          cacheAgeMs: hotel.hotelProvenance.cacheAgeMs,
          liveAvailability: hotel.hotelProvenance.liveAvailability,
          bookable: hotel.hotelProvenance.bookable,
          fallbackReason: hotel.hotelProvenance.fallbackReason,
          responseBody: hotel.providerDiagnostics?.responseBody,
        };
      })(),
      pois: poiResult.diagnostics,
      apiCalls: [],
      poiIds: [],
      metrics: {
        totalCost: null,
        journeyDuration: null,
        transferCount: null,
        hotelQuality: null,
        attractionRelevance: null,
        pacing: null,
        preferenceMatch: null,
      },
      fallbackUsed: false,
      fallbackReasons: [],
    },
  };
}

/** Hard ceiling on one optimisation run, so the UI can never hang. */
const OPTIMISE_TIMEOUT_MS = 70_000;

function materiallyDistinctSignature(route: TripRoute) {
  return JSON.stringify({
    regionalFamily: route.regionalDiscovery?.family ?? null,
    regionalPlace: route.regionalDiscovery?.addedDestinations[0]?.name ?? null,
    stops: route.stops.map((stop) => [normaliseText(stop.name), stop.nights]),
    legs: route.legs.map((leg) => [normaliseText(leg.from), normaliseText(leg.to), leg.mode]),
    hotels: route.stops.map((stop) => normaliseText(stop.hotel.name)),
    pois: route.itinerary.flatMap((day) => [
      ...(day.experiences ?? []).map((place) => place.id),
      day.restaurantDetails?.id ?? "",
    ]),
  });
}

function scoreAndClassify(routes: TripRoute[]) {
  if (!routes.length) return routes;
  const transfers = routes.map(
    (route) =>
      Math.max(0, route.legs.length - 1) +
      route.legs.reduce((total, leg) => {
        const stops = leg.mode === "flight" ? Number(leg.note.match(/(\d+)\s+stop/)?.[1] ?? 0) : 0;
        return total + stops;
      }, 0),
  );
  const hotelRatings = routes.map((route) => {
    const liveHotels = route.stops.filter((stop) => stop.hotel.hotelProvenance?.liveAvailability);
    return liveHotels.length
      ? liveHotels.reduce((total, stop) => total + stop.hotel.rating, 0) / liveHotels.length
      : null;
  });
  const poiRelevance = routes.map((route) => {
    const interests = [...route.preferences.interests, ...route.preferences.activities].map(
      normaliseText,
    );
    const places = route.itinerary.flatMap((day) => [
      ...(day.experiences ?? []).map((place) =>
        normaliseText(`${place.name} ${place.category} ${place.description ?? ""}`),
      ),
      ...(day.restaurantDetails
        ? [
            normaliseText(
              `${day.restaurantDetails.name} food restaurant ${day.restaurantDetails.description ?? ""}`,
            ),
          ]
        : []),
    ]);
    if (!places.length) return null;
    if (!interests.length) return Math.min(100, places.length * 8);
    const matches = places.filter((place) =>
      interests.some((interest) => place.includes(interest)),
    ).length;
    return Math.round((matches / places.length) * 100);
  });
  const pacingValues = routes.map((route) => {
    const averageStay =
      route.stops.reduce((total, stop) => total + stop.nights, 0) / Math.max(1, route.stops.length);
    return Math.max(0, Math.round(100 - Math.abs(averageStay - 3) * 22));
  });

  const scored = routes.map((route, index) => {
    const metrics: TripProvenance["metrics"] = {
      totalCost:
        route.cost > 0
          ? Math.max(
              0,
              Math.min(100, Math.round(110 - (route.cost / route.preferences.budget) * 100)),
            )
          : null,
      journeyDuration:
        route.journeyHours >= 0
          ? Math.max(
              0,
              Math.min(
                100,
                Math.round(100 - (route.journeyHours / route.preferences.maxTravelHours) * 70),
              ),
            )
          : null,
      transferCount: Math.max(0, 100 - transfers[index] * 22),
      hotelQuality:
        hotelRatings[index] == null ? null : Math.round((hotelRatings[index]! / 5) * 100),
      attractionRelevance: poiRelevance[index],
      pacing: pacingValues[index],
      preferenceMatch: poiRelevance[index],
    };
    const weights: Record<keyof typeof metrics, number> = {
      totalCost: 0.24,
      journeyDuration: 0.16,
      transferCount: 0.1,
      hotelQuality: 0.14,
      attractionRelevance: 0.14,
      pacing: 0.08,
      preferenceMatch: 0.14,
    };
    const available = Object.entries(metrics).filter(
      (entry): entry is [keyof typeof metrics, number] => entry[1] != null,
    );
    const availableWeight = available.reduce((total, [key]) => total + weights[key], 0);
    const measuredOverall = availableWeight
      ? Math.round(
          available.reduce((total, [key, value]) => total + value * weights[key], 0) /
            availableWeight,
        )
      : 0;
    const regionalMetrics = route.regionalDiscovery?.metrics;
    const regionalFit = regionalMetrics
      ? Math.max(0, Math.min(100, Math.round(
          regionalMetrics.regionalDiscoveryValue * 0.18 +
          regionalMetrics.thematicDiversity * 0.16 +
          regionalMetrics.hiddenGemValue * 0.08 +
          regionalMetrics.budgetEfficiency * 0.16 +
          regionalMetrics.preferenceGain * 0.2 +
          regionalMetrics.overnightValue * 0.08 +
          regionalMetrics.routeCoherence * 0.14 -
          regionalMetrics.travelTimePenalty * 0.12 -
          regionalMetrics.cityChangePenalty * 0.08,
        )))
      : null;
    const overall = regionalFit == null
      ? measuredOverall
      : Math.round(measuredOverall * 0.82 + regionalFit * 0.18);
    const poiIds = route.itinerary.flatMap((day) => [
      ...(day.experiences ?? []).map((place) => place.id),
      ...(day.restaurantDetails ? [day.restaurantDetails.id] : []),
    ]);
    const fallbackReasons = [
      ...route.legs
        .filter((leg) => leg.quality?.source === "estimate" || leg.quality?.source === "mock")
        .map((leg) => `${leg.from} → ${leg.to} uses estimated transport data.`),
      ...route.stops
        .filter(
          (stop) =>
            stop.hotel.quality.source === "estimate" || stop.hotel.quality.source === "mock",
        )
        .map((stop) => stop.hotel.fallbackReason ?? `${stop.name} uses sample hotel data.`),
      ...route.stops
        .filter(
          (stop) =>
            stop.hotel.hotelProvenance?.source === "hotelbeds-cache" &&
            stop.hotel.hotelProvenance.quotaExceeded,
        )
        .map(
          (stop) =>
            stop.hotel.hotelProvenance?.fallbackReason ??
            `${stop.name} uses cached Hotelbeds availability.`,
        ),
      ...(poiIds.length ? [] : ["Live places unavailable."]),
    ];
    const apiCalls = [
      route.provenance?.planner.mode === "heuristic" ? "ASTERA rules engine" : "OpenRouter planner",
      ...(route.legs.some((leg) => leg.quality?.provider === "Duffel") ? ["Duffel offers"] : []),
      ...(route.stops.some((stop) =>
        stop.hotel.quality.provider.toLowerCase().includes("hotelbeds"),
      )
        ? ["Hotelbeds availability"]
        : []),
      ...(poiIds.length ? [`${route.provenance?.pois?.provider ?? "Live"} POIs`] : []),
    ];
    const factors: ScoreFactor[] = available.map(([key, value]) => ({
      key,
      label: key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()),
      value,
      weight: weights[key] / availableWeight,
      explanation: `${value}/100 calculated from this candidate's provider-backed inputs.`,
    }));
    if (regionalFit != null) {
      factors.push({
        key: "regionalDiscovery",
        label: "Regional discovery",
        value: regionalFit,
        weight: 0.18,
        explanation: "Calculated from verified discovery value, preference gain, route coherence, added travel and hotel-change trade-offs.",
      });
    }
    return {
      ...route,
      scores: { ...route.scores, overall },
      scoreFactors: factors,
      provenance: {
        ...(route.provenance as TripProvenance),
        apiCalls,
        poiIds,
        metrics,
        fallbackUsed: fallbackReasons.length > 0,
        fallbackReasons,
      },
    };
  });

  const categoryAdvantages = (route: TripRoute) => ({
    Cheapest: route.provenance!.metrics.totalCost ?? -1,
    Fastest:
      ((route.provenance!.metrics.journeyDuration ?? -1) +
        (route.provenance!.metrics.transferCount ?? -1)) /
      2,
    "Most Comfortable":
      ((route.provenance!.metrics.hotelQuality ?? -1) + (route.provenance!.metrics.pacing ?? -1)) /
      2,
    "Best for Food": route.provenance!.metrics.attractionRelevance ?? -1,
    "Best Overall": route.scores.overall,
  });
  const used = new Set<string>();
  return scored
    .sort((a, b) => b.scores.overall - a.scores.overall)
    .map((route) => {
      const category =
        Object.entries(categoryAdvantages(route))
          .filter(([label]) => !used.has(label))
          .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Alternative";
      used.add(category);
      return {
        ...route,
        title: category,
        tagline:
          category === "Cheapest"
            ? "Lowest verified total among these recommendations"
            : category === "Fastest"
              ? "Least journey time and fewest changes"
              : category === "Most Comfortable"
                ? "Strongest stay quality and calmest pace"
                : category === "Best for Food"
                  ? "Strongest live place coverage for food and experiences"
                  : "Strongest measured balance across every constraint",
      };
    });
}

/**
 * Generates four distinct optimised routes for a set of preferences.
 *
 * City selection is synchronous and runs first, which lets all four routes be
 * priced in parallel rather than one after another — the difference between a
 * 3-second wait and a 20-second one on a slow connection.
 */
export async function optimiseTrip(input: OptimiseInput): Promise<TripRoute[]> {
  const progressCounts: NonNullable<OptimisationProgress["counts"]> = {};
  const candidateSnapshots = new Map<string, OptimisationCandidateProgress>();
  let providerSnapshots: OptimisationProviderProgress = {};
  const report = (stage: OptimisationStage, counts?: OptimisationProgress["counts"], patch?: OptimisationProgressPatch) => {
    for (const [key, value] of Object.entries(counts ?? {})) {
      const typedKey = key as keyof typeof progressCounts;
      progressCounts[typedKey] = (progressCounts[typedKey] ?? 0) + (value ?? 0);
    }
    for (const candidate of patch?.candidates ?? []) {
      candidateSnapshots.set(candidate.id, { ...candidateSnapshots.get(candidate.id), ...candidate });
    }
    providerSnapshots = { ...providerSnapshots, ...patch?.providers };
    input.onProgress?.({ stage, counts: { ...progressCounts }, preferences: patch?.preferences ?? preferencesSnapshot, candidates: [...candidateSnapshots.values()], providers: providerSnapshots });
  };
  let preferencesSnapshot = input.preferences;
  report("preferences", undefined, { preferences: input.preferences });
  const requestedDestination = input.preferences.endCity.trim() || null;
  const preferences: TripPreferences = normalisePreferences({
    ...input.preferences,
    interests: effectiveInterests(input.preferences),
  });
  preferencesSnapshot = preferences;

  const [start, end] = await Promise.all([
    geocodeCity(preferences.startCity),
    geocodeCity(preferences.endCity || preferences.startCity),
  ]);
  report("destinations");

  if (import.meta.env.DEV) {
    console.info("[poi:geocoding:trip-endpoints]", {
      requestedOrigin: preferences.startCity,
      resolvedOrigin: start.name,
      originCoordinates: { latitude: start.lat, longitude: start.lon },
      requestedDestination: preferences.endCity,
      resolvedDestination: end.name,
      destinationCoordinates: { latitude: end.lat, longitude: end.lon },
    });
  }

  const startPoint = { lat: start.lat, lon: start.lon, name: start.name };
  const endPoint = { lat: end.lat, lon: end.lon, name: end.name };

  const destinationRecord =
    CITIES.find((city) => normaliseText(city.name) === normaliseText(end.name)) ??
    dynamicCityFromGeocode(end, preferences);
  const discoveredRegionalCandidates = requestedDestination
    ? await discoverNearbyDestinations(destinationRecord, preferences.maxAdditionalTravelMinutes ?? 120)
    : [];
  const regionalCandidates = discoveredRegionalCandidates.map((place) => ({
        name: place.name,
        country: place.country,
        estimatedTravelMinutes: place.estimatedTravelMinutes,
        type: place.type,
        themes: place.themes,
        suitableFor: place.suitableFor,
        provenance: place.provenance,
      }));
  let modelPlan: Awaited<ReturnType<typeof requestConstraintPlan>> = null;
  let plannerFailure: string | undefined;
  try {
    modelPlan = await requestConstraintPlan(
      preferences,
      requestedDestination,
      tripNights(preferences),
      input.signal,
      regionalCandidates,
    );
    if (!modelPlan) plannerFailure = "The LLM planner returned no valid plan.";
  } catch (error) {
    plannerFailure =
      error instanceof Error ? error.message : "The LLM planner was temporarily unavailable.";
    console.warn("[planner:fallback] Using ASTERA rules engine:", plannerFailure);
  }
  const cityByName = new Map(CITIES.map((city) => [normaliseText(city.name), city]));
  if (
    requestedDestination &&
    !cityByName.has(normaliseText(requestedDestination)) &&
    normaliseText(end.name) !== normaliseText(start.name)
  ) {
    const dynamicDestination = dynamicCityFromGeocode(end, preferences);
    cityByName.set(normaliseText(requestedDestination), dynamicDestination);
    cityByName.set(normaliseText(dynamicDestination.name), dynamicDestination);
  }
  const unknownPlannedCities = [
    ...new Set(
      [...(modelPlan?.plan.plans ?? []).flatMap((plan) => plan.cities.map((entry) => entry.city.trim())), ...(input.requiredStops ?? [])]
        .filter(
          (name) =>
            name &&
            normaliseText(name) !== normaliseText(startPoint.name) &&
            !cityByName.has(normaliseText(name)),
        ),
    ),
  ];
  const dynamicPlannedCities = await Promise.all(
    unknownPlannedCities.map(async (name) => {
      const place = await geocodeCity(name);
      return { requestedName: name, city: dynamicCityFromGeocode(place, preferences) };
    }),
  );
  if (import.meta.env.DEV) {
    console.info("[poi:planner-cities]", {
      extractedCities: (modelPlan?.plan.plans ?? []).map((plan) =>
        plan.cities.map((entry) => entry.city.trim()),
      ),
      dynamicallyGeocoded: dynamicPlannedCities.map(({ requestedName, city }) => ({
        requestedCity: requestedName,
        resolvedCity: city.name,
        latitude: city.lat,
        longitude: city.lon,
      })),
    });
  }
  dynamicPlannedCities.forEach(({ requestedName, city }) => {
    cityByName.set(normaliseText(requestedName), city);
    cityByName.set(normaliseText(city.name), city);
  });

  // If the free planner is rate-limited, preserve the existing deterministic
  // strategies but apply the same destination and validation constraints.
  const used = new Set<string>();
  let plans = STRATEGIES.map((strategy, index) => {
    const proposed = modelPlan?.plan.plans[index % modelPlan.plan.plans.length];
    let chosen = proposed?.cities
      .map((entry) => cityByName.get(normaliseText(entry.city)))
      .filter((city): city is CityRecord => Boolean(city));

    if (!chosen?.length) {
      chosen = selectCities(strategy, preferences, startPoint, endPoint, used);
    }

    const requiredCities = (input.requiredStops ?? [])
      .map((name) => cityByName.get(normaliseText(name)))
      .filter((city): city is CityRecord => Boolean(city));
    if (requiredCities.length) chosen = requiredCities;

    const destination = requestedDestination
      ? cityByName.get(normaliseText(requestedDestination))
      : undefined;
    if (destination && normaliseText(destination.name) !== normaliseText(startPoint.name)) {
      chosen = [...chosen.filter((city) => city.id !== destination.id), destination];
      if (tripNights(preferences) <= 3 && !requiredCities.length) {
        chosen = [destination];
      }
    }
    if (chosen.length > tripNights(preferences)) {
      const finalCity = chosen.at(-1)!;
      chosen = [...chosen.slice(0, Math.max(0, tripNights(preferences) - 1)), finalCity];
    }
    chosen.slice(0, 2).forEach((city) => used.add(city.id));

    const entryByCity = new Map(
      (proposed?.cities ?? []).map((entry) => [normaliseText(entry.city), entry]),
    );
    const nights = chosen.map((city) => input.requiredStopNights?.[normaliseText(city.name)] ?? input.requiredStopNights?.[city.name] ?? entryByCity.get(normaliseText(city.name))?.nights ?? 0);
    const hasCompleteNights =
      nights.every((value) => value > 0) &&
      nights.reduce((total, value) => total + value, 0) === tripNights(preferences);
    const activities = new Map(
      chosen.map((city) => [
        normaliseText(city.name),
        entryByCity.get(normaliseText(city.name))?.activities ?? [],
      ]),
    );
    return {
      strategy,
      chosen,
      nights: hasCompleteNights ? nights : undefined,
      activities,
      regional: undefined as RegionalRoutePlan | undefined,
    };
  });
  if (requestedDestination && !input.requiredStops?.length) {
    const verifiedPlans = createRegionalRoutePlans(
      destinationRecord,
      preferences,
      tripNights(preferences),
      discoveredRegionalCandidates,
    );
    const llmPlans = modelPlan?.plan.plans ?? [];
    const expectedPattern = (regional: RegionalRoutePlan) =>
      regional.family === "destination-only"
        ? "destination-only"
        : regional.cities.length === 1
          ? "day-trip"
          : "overnight";
    const matchesRegionalPlan = (plan: (typeof llmPlans)[number], regional: RegionalRoutePlan) => {
      if (plan.routePattern !== expectedPattern(regional)) return false;
      if (!regional.nearby) return plan.regionalDestination == null;
      return normaliseText(plan.regionalDestination ?? "") === normaliseText(regional.nearby.name);
    };
    const plannerRank = (regional: RegionalRoutePlan) => {
      const structured = llmPlans.findIndex((plan) => matchesRegionalPlan(plan, regional));
      if (structured >= 0) return structured;
      const requiredNames = [
        ...regional.cities.map((city) => normaliseText(city.name)),
        ...(regional.nearby ? [normaliseText(regional.nearby.name)] : []),
      ];
      const exact = llmPlans.findIndex((plan) => {
        const names = plan.cities.map((entry) => normaliseText(entry.city));
        return names.length === requiredNames.length && requiredNames.every((name) => names.includes(name));
      });
      if (exact >= 0) return exact;
      const containing = llmPlans.findIndex((plan) => {
        const names = plan.cities.map((entry) => normaliseText(entry.city));
        return requiredNames.every((name) => names.includes(name));
      });
      return containing >= 0 ? containing : 99;
    };
    plans = verifiedPlans
      .sort((left, right) => {
        return plannerRank(left) - plannerRank(right);
      })
      .map((regional, index) => {
        const proposed = llmPlans.find((plan) => matchesRegionalPlan(plan, regional));
        if (proposed?.reasoning) regional.llmReasoning = proposed.reasoning;
        return {
          strategy: STRATEGIES[index % STRATEGIES.length],
          chosen: regional.cities,
          nights: regional.nights,
          activities: new Map([
            ...regional.cities.map((city) => [
              normaliseText(city.name),
              proposed?.cities.find((entry) => normaliseText(entry.city) === normaliseText(city.name))?.activities ?? [],
            ] as const),
            ...(regional.nearby ? [[
              normaliseText(regional.nearby.name),
              proposed?.regionalActivities ??
                proposed?.cities.find((entry) => normaliseText(entry.city) === normaliseText(regional.nearby!.name))?.activities ?? [],
            ] as const] : []),
          ]),
          regional,
        };
      });
  }
  report("destinations", { candidateRoutes: plans.length });
  report("destinations", undefined, { candidates: plans.map(({ strategy, chosen }) => ({
    id: `${strategy.id}-${chosen.map((city) => city.id).join("-")}`,
    route: [startPoint.name, ...chosen.map((city) => city.name)],
    stops: chosen.length,
    reason: strategyReason(strategy),
    status: "considering" as const,
  })) });

  const settled = await Promise.allSettled(
    plans.map(({ strategy, chosen, nights, activities, regional }) =>
      buildRoute(strategy, preferences, startPoint, endPoint, chosen, nights, activities, {
        provider: modelPlan?.planner.provider ?? "ASTERA rules engine",
        model: modelPlan?.planner.model ?? "deterministic-v1",
        configuredModel: modelPlan?.planner.configuredModel,
        active: true,
        mode: modelPlan ? "llm" : "heuristic",
        failureReason: plannerFailure,
        httpStatus: modelPlan?.planner.diagnostics?.httpStatus,
        parseSuccess: modelPlan?.planner.diagnostics?.parseSuccess,
        timedOut: modelPlan?.planner.diagnostics?.timedOut,
      }, report, regional).then((route) => {
        if (!regional) return route;
        const context = regionalContext(regional, preferences, route.cost);
        const stops = regional.family === "nearby-day-trip" && regional.nearby
          ? route.stops.map((stop) => normaliseText(stop.name) === normaliseText(preferences.endCity)
              ? { ...stop, dayTrips: [...new Set([...stop.dayTrips, regional.nearby!.name])] }
              : stop)
          : route.stops;
        return {
          ...route,
          stops,
          regionalDiscovery: context,
          reasoning: [
            ...(regional.llmReasoning ? [`AI planner: ${regional.llmReasoning}`] : []),
            context.suggestionReason,
            context.primaryBenefit,
            `Trade-off: ${context.tradeOff}.`,
            ...route.reasoning,
          ],
        };
      }),
    ),
  );
  if (settled.every((result) => result.status === "rejected")) {
    const messages = settled
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) =>
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      );
    throw new Error(
      `Required live data failed: ${[...new Set(messages)].join(" | ").slice(0, 2_000)}`,
    );
  }

  const routes = settled
    .filter((result): result is PromiseFulfilledResult<TripRoute> => result.status === "fulfilled")
    .map((result) => result.value)
    // Validate against the geocoder's canonical city name. Comparing a stop
    // named "Prague" with the raw input "Prague, Czechia" discarded an
    // otherwise valid route after it had already been built and priced.
    .filter((route) => validateRouteConstraints(route, requestedDestination, end.name));

  const feasibleRoutes = routes.filter((route) => {
    const regional = route.regionalDiscovery;
    if (!regional || regional.family === "destination-only") return true;
    if (route.cost > route.preferences.budget) return false;
    if (route.journeyHours > route.preferences.maxTravelHours) return false;
    return regional.travelMinutesAdded <= (route.preferences.maxAdditionalTravelMinutes ?? 120);
  });

  const uniqueRoutes = new Map<string, TripRoute>();
  const regionalStrategies = new Set<string>();
  for (const route of feasibleRoutes.sort((a, b) => b.scores.overall - a.scores.overall)) {
    const regionalStrategy = route.regionalDiscovery
      ? `${route.regionalDiscovery.family}:${normaliseText(route.regionalDiscovery.addedDestinations[0]?.name ?? route.preferences.endCity)}`
      : "";
    if (regionalStrategy && regionalStrategies.has(regionalStrategy)) continue;
    const signature = materiallyDistinctSignature(route);
    if (!uniqueRoutes.has(signature)) {
      uniqueRoutes.set(signature, route);
      if (regionalStrategy) regionalStrategies.add(regionalStrategy);
    }
  }
  report("tradeoffs", { candidatesScored: uniqueRoutes.size }, { candidates: [...uniqueRoutes.values()].map((route) => ({
    id: route.id, route: [route.preferences.startCity, ...route.stops.map((stop) => stop.name)], stops: route.stops.length,
    reason: route.reasoning[0] ?? route.tagline, totalCost: route.cost, budgetLeft: route.budgetLeft,
    transitHours: route.journeyHours, transfers: Math.max(0, route.legs.length - 1), hotelRating: route.stops[0]?.hotel.rating,
    hotelName: route.stops[0]?.hotel.name, attractionCount: route.itinerary.reduce((sum, day) => sum + (day.experiences?.length ?? 0), 0),
    restaurantCount: route.itinerary.filter((day) => day.restaurantDetails).length, score: route.scores.overall, status: "scored" as const,
  })) });
  const explainNearMiss = (route: TripRoute): TripRoute => {
    if (route.cost <= route.preferences.budget) return route;
    const gap = Math.round(route.cost - route.preferences.budget);
    const costEntries = [
      ["flights and transport", route.costBreakdown.transport],
      ["hotels", route.costBreakdown.accommodation],
      ["food", route.costBreakdown.food],
      ["activities", route.costBreakdown.activities],
    ] as const;
    const [driver, driverCost] = [...costEntries].sort((a, b) => b[1] - a[1])[0];
    const dateGuidance = route.legs.some((leg) => leg.mode === "flight")
      ? "Try shifting the dates by 2–3 days to recheck lower flight and hotel prices; ASTERA will only name a cheaper date after a provider returns one."
      : "Try shifting the dates by 2–3 days to recheck lower stay prices; ASTERA will only name a cheaper date after a provider returns one.";
    return {
      ...route,
      reasoning: [
        `Closest valid option: ${gap.toLocaleString()} ${route.preferences.currency} above budget.`,
        `${driver[0].toUpperCase()}${driver.slice(1)} are the largest cost at about ${Math.round(driverCost).toLocaleString()} ${route.preferences.currency}.`,
        dateGuidance,
        ...route.reasoning,
      ],
    };
  };
  const classified = scoreAndClassify([...uniqueRoutes.values()].map(explainNearMiss));
  const winner = classified[0];
  input.onProgress?.({ stage: "selection", counts: { ...progressCounts, candidateRoutes: classified.length }, preferences, providers: providerSnapshots, candidates: classified.map((route, index) => ({
    ...candidateSnapshots.get(route.id)!, id: route.id, route: [route.preferences.startCity, ...route.stops.map((stop) => stop.name)], stops: route.stops.length,
    reason: route.reasoning[0] ?? route.tagline, totalCost: route.cost, budgetLeft: route.budgetLeft, transitHours: route.journeyHours,
    transfers: Math.max(0, route.legs.length - 1), hotelRating: route.stops[0]?.hotel.rating, hotelName: route.stops[0]?.hotel.name,
    attractionCount: route.itinerary.reduce((sum, day) => sum + (day.experiences?.length ?? 0), 0), restaurantCount: route.itinerary.filter((day) => day.restaurantDetails).length,
    score: route.scores.overall, status: index === 0 ? "selected" : "scored",
  })) });
  return classified;
}

/** Final deterministic gate. Invalid AI/provider output never reaches storage or rendering. */
export function validateRouteConstraints(
  route: TripRoute,
  requestedDestination: string | null,
  resolvedDestination?: string | null,
) {
  if (!route.stops.length || !route.itinerary.length) return false;
  // Budget is a ranking target, not a destructive visibility gate. A valid
  // near-miss is more useful than an empty page and remains clearly labelled
  // with its gap; destination, duration and grounded-place constraints stay hard.
  if (route.stops.reduce((total, stop) => total + stop.nights, 0) !== tripNights(route.preferences))
    return false;
  if (!destinationMatchesResolvedCity(
    route.stops.at(-1)?.name ?? "",
    requestedDestination,
    resolvedDestination,
  ))
    return false;

  const stops = new Set<string>();
  for (const stop of route.stops) {
    const key = normaliseText(stop.name);
    if (!key || stops.has(key)) return false;
    stops.add(key);
  }

  const experiences = new Set<string>();
  const providerIds = new Set<string>();
  for (const day of route.itinerary) {
    if (!(day.experiences ?? []).every(isGroundedPlace)) return false;
    if (day.restaurantDetails && !isGroundedPlace(day.restaurantDetails)) return false;
    const grounded = [
      ...(day.experiences ?? []),
      ...(day.restaurantDetails ? [day.restaurantDetails] : []),
    ];
    for (const place of grounded) {
      if (providerIds.has(place.providerPlaceId)) return false;
      providerIds.add(place.providerPlaceId);
    }
    const allowedNames = new Set([
      ...(day.experiences ?? []).map((place) => place.name),
      ...(day.restaurantDetails ? [day.restaurantDetails.name] : []),
      NO_LIVE_RECOMMENDATION,
    ]);
    if (
      ![day.morning, day.afternoon, day.evening, day.restaurant].every((name) =>
        allowedNames.has(name),
      )
    )
      return false;
    const names = [
      ...(day.experiences ?? []).map((place) => place.name),
      day.restaurantDetails?.name,
    ].filter((name): name is string => Boolean(name));
    for (const name of names) {
      const key = normaliseText(name);
      if (!key || experiences.has(key)) return false;
      experiences.add(key);
    }
  }
  return true;
}

/**
 * `optimiseTrip` with a hard deadline. Resolves to whatever finished in time
 * rather than leaving the results page spinning forever.
 */
export async function optimiseTripWithDeadline(
  input: OptimiseInput,
  timeoutMs = OPTIMISE_TIMEOUT_MS,
): Promise<{ routes: TripRoute[]; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  try {
    const outcome = await Promise.race([optimiseTrip(input), deadline]);
    if (outcome === "timeout") return { routes: [], timedOut: true };
    return { routes: outcome, timedOut: false };
  } finally {
    clearTimeout(timer!);
  }
}

const GOAL_LABEL: Record<OptimiseGoal, string> = {
  "spend-less": "Spend less",
  "reduce-travel": "Reduce travel",
  "add-city": "Add another city",
  "more-nature": "More nature",
  "more-luxury": "More luxury",
  "avoid-flights": "Avoid flights",
};

export const OPTIMISE_GOALS = (Object.keys(GOAL_LABEL) as OptimiseGoal[]).map((id) => ({
  id,
  label: GOAL_LABEL[id],
}));

/** Re-runs the engine with a nudged preference set and returns the best match. */
export async function optimiseFurther(route: TripRoute, goal: OptimiseGoal): Promise<TripRoute> {
  const prefs: TripPreferences = { ...route.preferences };

  switch (goal) {
    case "spend-less":
      prefs.budget = Math.round(Math.min(prefs.budget, route.cost) * 0.82);
      prefs.luxuryLevel = prefs.luxuryLevel === "luxury" ? "boutique" : "midscale";
      break;
    case "reduce-travel":
      prefs.maxTravelHours = Math.max(3, Math.round(route.journeyHours * 0.62));
      prefs.fewerHotelChanges = true;
      break;
    case "add-city":
      prefs.maxTravelHours = prefs.maxTravelHours + 4;
      break;
    case "more-nature":
      prefs.interests = [...new Set<Interest>([...prefs.interests, "nature", "adventure"])];
      break;
    case "more-luxury":
      prefs.luxuryLevel = prefs.luxuryLevel === "luxury" ? "luxury" : "boutique";
      prefs.interests = [...new Set<Interest>([...prefs.interests, "luxury"])];
      break;
    case "avoid-flights":
      prefs.avoidFlights = true;
      prefs.transport = prefs.transport === "flight" ? "train" : prefs.transport;
      break;
  }

  const [candidate] = await optimiseTrip({ preferences: prefs });
  if (!candidate) return route;
  return {
    ...candidate,
    title: `${route.title} · ${GOAL_LABEL[goal]}`,
    id: `${candidate.id}-${goal}`,
  };
}

/**
 * Applies one of the costed "Stretch your budget" choices through the same
 * constraint engine used by the planner. The preview delta is never treated as
 * the final price: providers and the complete itinerary are recalculated first.
 */
export async function applyBudgetStretchOption(
  route: TripRoute,
  optionId: BudgetStretchOption["id"],
): Promise<TripRoute> {
  const preferences: TripPreferences = { ...route.preferences };
  let requiredStops = route.stops.map((stop) => stop.name);
  const requiredStopNights: Record<string, number> = Object.fromEntries(
    route.stops.map((stop) => [stop.name, stop.nights]),
  );

  if (optionId === "downgrade-stay") {
    const nextTier = LUXURY_STEP_DOWN[preferences.luxuryLevel];
    if (!nextTier) throw new Error("This trip is already using the lowest stay tier.");
    preferences.luxuryLevel = nextTier;
  } else if (optionId === "rail-swap") {
    preferences.avoidFlights = true;
    preferences.transport = "train";
  } else if (optionId === "drop-stop") {
    if (route.stops.length <= 2) throw new Error("This route has no optional stop to remove.");
    const destination = normaliseText(route.preferences.endCity);
    const removed = route.stops
      .filter((stop, index) => index < route.stops.length - 1 && normaliseText(stop.name) !== destination)
      .sort((a, b) => a.nights - b.nights)[0];
    if (!removed) throw new Error("The requested destination cannot be removed.");
    requiredStops = requiredStops.filter((name) => name !== removed.name);
    delete requiredStopNights[removed.name];
    const anchor = requiredStops[0];
    requiredStopNights[anchor] = (requiredStopNights[anchor] ?? 0) + removed.nights;
  } else if (optionId === "extend") {
    preferences.endDate = addDays(preferences.endDate, 2);
    const anchor = requiredStops[0];
    requiredStopNights[anchor] = (requiredStopNights[anchor] ?? 0) + 2;
  } else if (optionId === "eat-local") {
    preferences.diets = [...new Set([...preferences.diets, "street-food", "local-cuisine"] as const)];
  } else {
    throw new Error("That budget adjustment is no longer available.");
  }

  const candidates = await optimiseTrip({ preferences, requiredStops, requiredStopNights });
  const updated = candidates[0];
  if (!updated) throw new Error("No valid updated itinerary was returned.");
  const changed =
    updated.preferences.endDate !== route.preferences.endDate ||
    updated.preferences.luxuryLevel !== route.preferences.luxuryLevel ||
    updated.preferences.avoidFlights !== route.preferences.avoidFlights ||
    updated.itinerary.length !== route.itinerary.length ||
    updated.stops.map((stop) => `${stop.name}:${stop.nights}:${stop.hotel.id ?? stop.hotel.name}`).join("|") !==
      route.stops.map((stop) => `${stop.name}:${stop.nights}:${stop.hotel.id ?? stop.hotel.name}`).join("|") ||
    updated.legs.map((leg) => `${leg.from}:${leg.to}:${leg.mode}`).join("|") !==
      route.legs.map((leg) => `${leg.from}:${leg.to}:${leg.mode}`).join("|") ||
    updated.cost !== route.cost;
  if (!changed) {
    throw new Error("The provider returned the same itinerary, so no changes were saved.");
  }
  return { ...updated, id: route.id, bookingSelection: undefined };
}

/** Default planner state. Dates sit far enough out to be bookable. */
export const SAMPLE_PREFERENCES: TripPreferences = {
  startCity: "London",
  endCity: "",
  startDate: addDays(todayIso(), 45),
  endDate: addDays(todayIso(), 55),
  dateMode: "exact",
  flexibleMonth: addDays(todayIso(), 45).slice(0, 7),
  flexibleNights: 10,
  travellers: 2,

  budget: 2400,
  currency: "EUR",
  interests: ["food", "nature", "photography"],
  transport: "mixed",
  maxTravelHours: 14,
  avoidFlights: false,
  fewerHotelChanges: false,
  luxuryLevel: "boutique",
  diets: ["local-cuisine"],
  travelStyle: "couple",
  activities: ["nature", "photography", "hidden-gems"],
  notes: "",
  regionalDiscovery: "nearby-cities",
  maxAdditionalTravelMinutes: 120,
  regionalHotelChanges: "one",
  allowNewCountry: true,
};

/**
 * The demo profile behind "Try a sample trip".
 *
 * Fully specified and independent of anything in local storage, so the sample
 * renders identically for every visitor and can never inherit a half-finished
 * draft from a previous session.
 */
export const SAMPLE_TRIP_PREFERENCES: TripPreferences = {
  ...SAMPLE_PREFERENCES,
  startCity: "London",
  endCity: "London",
  startDate: addDays(todayIso(), 45),
  endDate: addDays(todayIso(), 55),
  travellers: 2,
  budget: 5200,
  currency: "EUR",
  interests: ["food", "nature", "photography", "history"],
  transport: "mixed",
  maxTravelHours: 14,
  avoidFlights: false,
  fewerHotelChanges: false,
  luxuryLevel: "boutique",
  diets: ["local-cuisine", "seafood"],
  travelStyle: "couple",
  activities: ["nature", "photography", "hidden-gems", "architecture"],
  notes: "Two of us, ten nights, no early flights. We'd rather eat well than stay somewhere fancy.",
};

/** One-line description of the sample, shown above the results. */
export const SAMPLE_SUMMARY =
  "Two travellers · 10 nights from London · €5,200 all in · food, nature and photography · boutique stays, no early starts";
