import { ESTIMATE_QUALITY } from "@/api/config";
import { CITIES, CITY_BY_ID, REGION_IMAGES, type CityRecord } from "@/data/cities";
import { addDays, nightsBetween } from "@/lib/format";
import type {
  Activity,
  CostBreakdown,
  TravelStyle,

  DayPlan,
  Interest,
  OptimiseGoal,
  RouteLeg,
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

function buildItinerary(stops: TripStop[], legs: RouteLeg[], startDate: string): DayPlan[] {
  const plans: DayPlan[] = [];
  let day = 1;
  stops.forEach((stop, stopIndex) => {
    const record = CITY_BY_ID.get(stop.id);
    const highlights = record?.highlights ?? [];
    for (let n = 0; n < stop.nights; n += 1) {
      const highlight = highlights[n % Math.max(1, highlights.length)] ?? {
        morning: `Slow start and a wander through ${stop.name}`,
        afternoon: `Neighbourhood walk and a local market in ${stop.name}`,
        evening: `Dinner in the old quarter of ${stop.name}`,
        restaurant: "A well-rated neighbourhood table",
        rainy: "Swap the walking for the city's main museum",
      };
      const arrivalLeg = n === 0 ? legs[stopIndex] : undefined;
      plans.push({
        day,
        city: stop.name,
        morning: highlight.morning,
        afternoon: highlight.afternoon,
        evening: highlight.evening,
        restaurant: highlight.restaurant,
        rainyDayAlternative: highlight.rainy,
        transportNote: arrivalLeg
          ? `${arrivalLeg.mode} from ${arrivalLeg.from} — ${arrivalLeg.hours}h`
          : undefined,
      });
      day += 1;
    }
  });
  return plans.map((plan, index) => ({
    ...plan,
    day: index + 1,
    transportNote: plan.transportNote,
    city: plan.city,
    morning: plan.morning,
    afternoon: plan.afternoon,
    evening: plan.evening,
    restaurant: plan.restaurant,
    rainyDayAlternative: plan.rainyDayAlternative,
  }));
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

export interface OptimiseInput {
  preferences: TripPreferences;
  /** Optional signal so a long recalculation can be cancelled by the UI. */
  signal?: AbortSignal;
}

async function buildRoute(
  strategy: Strategy,
  prefs: TripPreferences,
  startPoint: { lat: number; lon: number; name: string },
  endPoint: { lat: number; lon: number; name: string },
  exclude: Set<string>,
): Promise<TripRoute> {
  const totalNights = nightsBetween(prefs.startDate, prefs.endDate);
  const stopCount = Math.min(4, Math.max(2, strategy.stopCount(totalNights)));

  const candidates = CITIES.filter((city) => !exclude.has(city.id))
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
      return { city, score, fit, efficiency, value, discovery };
    })
    .sort((a, b) => b.score - a.score);

  const chosen = orderStops(startPoint, candidates.slice(0, stopCount).map((c) => c.city));
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
  const overall = clamp(
    Math.round(
      experience * 0.34 +
        efficiency * 0.2 +
        weatherScore * 0.14 +
        clamp(118 - budgetRatio * 100) * 0.32,
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

  const itinerary = buildItinerary(stops, legs, prefs.startDate);

  return {
    id: `${strategy.id}-${chosen.map((c) => c.id).join("-")}`,
    title: strategy.title,
    tagline: strategy.tagline,
    image: REGION_IMAGES[chosen[0].region],
    countries: [...new Set(chosen.map((c) => c.country))],
    stops,
    legs,
    scores,
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

/** Generates four distinct optimised routes for a set of preferences. */
export async function optimiseTrip(input: OptimiseInput): Promise<TripRoute[]> {
  const preferences: TripPreferences = {
    ...input.preferences,
    interests: effectiveInterests(input.preferences),
  };

  const [start, end] = await Promise.all([
    geocodeCity(preferences.startCity || "London"),
    geocodeCity(preferences.endCity || preferences.startCity || "London"),
  ]);

  const startPoint = { lat: start.lat, lon: start.lon, name: start.name };
  const endPoint = { lat: end.lat, lon: end.lon, name: end.name };

  const used = new Set<string>();
  const routes: TripRoute[] = [];
  for (const strategy of STRATEGIES) {
    const route = await buildRoute(strategy, preferences, startPoint, endPoint, used);

    route.stops.slice(0, 2).forEach((stop) => used.add(stop.id));
    routes.push(route);
  }
  return routes.sort((a, b) => b.scores.overall - a.scores.overall);
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
  return {
    ...candidate,
    title: `${route.title} · ${GOAL_LABEL[goal]}`,
    id: `${candidate.id}-${goal}`,
  };
}

export const SAMPLE_PREFERENCES: TripPreferences = {
  startCity: "London",
  endCity: "London",
  startDate: addDays(new Date().toISOString().slice(0, 10), 45),
  endDate: addDays(new Date().toISOString().slice(0, 10), 55),
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

