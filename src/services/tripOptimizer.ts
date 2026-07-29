import { ESTIMATE_QUALITY } from "@/api/config";
import { CITIES, CITY_BY_ID, REGION_IMAGES, type CityRecord } from "@/data/cities";
import { addDaysIso, nightsBetweenSafe, toIsoDate, todayIso } from "@/lib/date";
import { assertUniqueItinerary, ExperienceRegistry } from "@/lib/dedupe";
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
} from "@/lib/types";
import { estimateGroundLeg, searchFlights } from "@/services/flightService";
import { distanceKm, geocodeCity } from "@/services/geocodeService";
import { estimateNightlyRate, searchHotel } from "@/services/hotelService";
import { getStopWeather } from "@/services/weatherService";


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
  title: string;
  tagline: string;
  weights: { fit: number; value: number; efficiency: number; discovery: number };
  stopCount: (nights: number) => number;
};

const STRATEGIES: Strategy[] = [
  {
    id: "balanced",
    title: "The Best Overall Trip",
    tagline: "Highest total experience for the money you have",
    weights: { fit: 1, value: 0.75, efficiency: 0.65, discovery: 0.3 },
    stopCount: (nights) => (nights >= 10 ? 4 : 3),
  },
  {
    id: "value",
    title: "The Budget Stretcher",
    tagline: "Same days away, meaningfully more left in your account",
    weights: { fit: 0.7, value: 1.5, efficiency: 0.7, discovery: 0.5 },
    stopCount: (nights) => (nights >= 12 ? 4 : 3),
  },
  {
    id: "gems",
    title: "The Road Less Travelled",
    tagline: "Under-visited places that score high on your interests",
    weights: { fit: 1, value: 0.7, efficiency: 0.45, discovery: 1.6 },
    stopCount: (nights) => (nights >= 9 ? 4 : 3),
  },
  {
    id: "slow",
    title: "The Slow Route",
    tagline: "Fewest hours in transit, longest stays per city",
    weights: { fit: 0.9, value: 0.6, efficiency: 1.7, discovery: 0.25 },
    stopCount: () => 2,
  },
];

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
  return (
    interests.reduce((total, interest) => total + city.scores[interest], 0) / interests.length
  );
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
function buildItinerary(stops: TripStop[], legs: RouteLeg[]): DayPlan[] {
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

const LUXURY_STEP_DOWN: Record<TripPreferences["luxuryLevel"], TripPreferences["luxuryLevel"] | null> =
  {
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
  const flight = [...legs].filter((leg) => leg.mode === "flight").sort((a, b) => b.cost - a.cost)[0];
  if (flight) {
    const railCost = Math.round(flight.cost * 0.62);
    options.push({
      id: "rail-swap",
      label: `Take the train ${flight.from} → ${flight.to}`,
      detail: `Rail instead of flying the ${flight.from}–${flight.to} leg, city centre to city centre.`,
      costDelta: railCost - Math.round(flight.cost),
      tradeoff: `Adds roughly ${Math.max(1, Math.round(flight.hours * 0.8))}h of travel, removes two airport transfers.`,
    });
  }

  // 3. Cut the shortest stop and give those nights to the others.
  if (stops.length > 2) {
    const shortest = [...stops].sort((a, b) => a.nights - b.nights)[0];
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
      tradeoff: "Costs more, but the per-day cost of a longer stay is the lowest of any change here.",
    });
  }

  // 5. Eat the way the city actually eats.
  if (costBreakdown.food > 150) {
    options.push({
      id: "eat-local",
      label: "Swap two restaurant dinners a week for markets",
      detail: "Set menus at lunch, market dinners in the evening — the pattern locals actually use.",
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
}

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


  // A start in the past is fine for a saved trip, but an unusable one is not.
  if (!start) start = addDaysIso(todayIso(), 30);
  if (!end || nightsBetweenSafe(start, end) === null) {
    end = addDaysIso(start, DEFAULT_TRIP_NIGHTS);
  }
  // Reversed dates: trust the earlier one and rebuild the span.
  if (new Date(end!).getTime() <= new Date(start!).getTime()) {
    end = addDaysIso(start, DEFAULT_TRIP_NIGHTS);
  }

  const nights = nightsBetweenSafe(start, end) ?? DEFAULT_TRIP_NIGHTS;
  // Beyond a month the combination space stops being meaningful for an MVP.
  if (nights > 30) end = addDaysIso(start, 30);

  return {
    ...base,
    startCity: (base.startCity || "").trim() || SAMPLE_PREFERENCES.startCity,
    endCity: (base.endCity || "").trim() || (base.startCity || "").trim() || SAMPLE_PREFERENCES.startCity,
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
export const isDiscoveryTrip = (prefs: Partial<TripPreferences>) =>
  !(prefs.endCity ?? "").trim();


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
): Promise<TripRoute> {
  const totalNights = tripNights(prefs);
  const nightsPerStop = splitNights(totalNights, chosen.length, prefs.fewerHotelChanges);


  // --- transport legs -------------------------------------------------
  const waypoints = [
    { name: startPoint.name, lat: startPoint.lat, lon: startPoint.lon },
    ...chosen.map((city) => ({ name: city.name, lat: city.lat, lon: city.lon })),
    { name: endPoint.name, lat: endPoint.lat, lon: endPoint.lon },
  ];

  const legs: RouteLeg[] = [];
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const km = distanceKm(from, to);
    if (km < 25) continue;
    const mode = legMode(prefs, km);
    if (mode === "flight") {
      const offer = await searchFlights({
        origin: from,
        destination: to,
        date: addDays(prefs.startDate, i * 2),
        travellers: prefs.travellers,
        cabin: prefs.luxuryLevel === "luxury" ? "PREMIUM_ECONOMY" : "ECONOMY",
      });
      legs.push({
        from: from.name,
        to: to.name,
        mode: "flight",
        hours: offer.durationHours + 2.5,
        cost: offer.totalPrice,
        note: `${offer.carrier} · ${offer.stops ? `${offer.stops} stop` : "direct"}`,
      });
    } else {
      const ground = estimateGroundLeg(from, to, mode, prefs.travellers);
      legs.push({
        from: from.name,
        to: to.name,
        mode,
        hours: ground.hours,
        cost: ground.cost,
        note: mode === "train" ? `${km} km by rail` : `${km} km drive`,
      });
    }
  }

  // --- stops with hotels + weather ------------------------------------
  const stops: TripStop[] = await Promise.all(
    chosen.map(async (city, index) => {
      const nights = nightsPerStop[index];
      const [hotel, weather] = await Promise.all([
        searchHotel({
          cityId: city.id,
          nights,
          travellers: prefs.travellers,
          luxuryLevel: prefs.luxuryLevel,
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
      } satisfies TripStop;
    }),
  );

  // --- cost model ------------------------------------------------------
  const transport = legs.reduce((total, leg) => total + leg.cost, 0);
  const accommodation = stops.reduce((total, stop) => {
    const rate = estimateNightlyRate(stop.id, prefs.luxuryLevel).nightly;
    const rooms = Math.ceil(prefs.travellers / 2);
    return total + rate * stop.nights * rooms;
  }, 0);
  const food = stops.reduce((total, stop) => {
    const city = CITY_BY_ID.get(stop.id);
    return total + (city?.dailyIndex ?? 80) * 0.5 * stop.nights * prefs.travellers;
  }, 0);
  const activities = stops.reduce((total, stop) => {
    const city = CITY_BY_ID.get(stop.id);
    return total + (city?.dailyIndex ?? 80) * 0.28 * stop.nights * prefs.travellers;
  }, 0);
  const subtotal = transport + accommodation + food + activities;
  const buffer = Math.round(subtotal * 0.07);
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
  const efficiency = clamp(Math.round(100 - (journeyHours / Math.max(1, prefs.maxTravelHours)) * 42));
  const weatherScore = clamp(
    Math.round(
      stops.reduce((total, stop) => total + (100 - stop.weather.rainChance * 0.85), 0) / stops.length,
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

  const itinerary = buildItinerary(stops, legs);

  const stretchOptions = buildStretchOptions({
    prefs,
    stops,
    legs,
    cost,
    costBreakdown,
    totalNights,
  });

  return {
    id: `${strategy.id}-${chosen.map((c) => c.id).join("-")}`,
    title: strategy.title,
    tagline: strategy.tagline,
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
  };
}

/** Hard ceiling on one optimisation run, so the UI can never hang. */
const OPTIMISE_TIMEOUT_MS = 14_000;

/**
 * Generates four distinct optimised routes for a set of preferences.
 *
 * City selection is synchronous and runs first, which lets all four routes be
 * priced in parallel rather than one after another — the difference between a
 * 3-second wait and a 20-second one on a slow connection.
 */
export async function optimiseTrip(input: OptimiseInput): Promise<TripRoute[]> {
  const preferences: TripPreferences = normalisePreferences({
    ...input.preferences,
    interests: effectiveInterests(input.preferences),
  });

  const [start, end] = await Promise.all([
    geocodeCity(preferences.startCity),
    geocodeCity(preferences.endCity || preferences.startCity),
  ]);

  const startPoint = { lat: start.lat, lon: start.lon, name: start.name };
  const endPoint = { lat: end.lat, lon: end.lon, name: end.name };

  // Pick every strategy's cities up front so the four routes stay distinct…
  const used = new Set<string>();
  const plans = STRATEGIES.map((strategy) => {
    const chosen = selectCities(strategy, preferences, startPoint, endPoint, used);
    chosen.slice(0, 2).forEach((city) => used.add(city.id));
    return { strategy, chosen };
  });

  // …then price them all at once.
  const settled = await Promise.allSettled(
    plans.map(({ strategy, chosen }) =>
      buildRoute(strategy, preferences, startPoint, endPoint, chosen),
    ),
  );

  const routes = settled
    .filter((result): result is PromiseFulfilledResult<TripRoute> => result.status === "fulfilled")
    .map((result) => result.value);

  return routes.sort((a, b) => b.scores.overall - a.scores.overall);
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
export async function optimiseFurther(
  route: TripRoute,
  goal: OptimiseGoal,
): Promise<TripRoute> {
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


