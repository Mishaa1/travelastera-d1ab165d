import { CITIES, type CityRecord } from "@/data/cities";
import { normaliseText } from "@/lib/dedupe";
import type { Interest, RegionalRouteContext, RegionalRouteFamily, TripPreferences } from "@/lib/types";
import { distanceKm } from "@/services/geocodeService";
import { CURATED_DESTINATION_ADJACENCY } from "@/lib/regions/adjacency";

export interface NearbyDestination {
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  estimatedTravelMinutes: number;
  modes: Array<"train" | "bus" | "boat" | "car">;
  type: string;
  themes: string[];
  suitableFor: Array<"day-trip" | "overnight">;
  provenance: "curated-adjacency" | "destination-catalogue" | "wikidata-osrm";
  hiddenGem?: boolean;
}

export interface RegionalRoutePlan {
  family: RegionalRouteFamily;
  cities: CityRecord[];
  nights?: number[];
  nearby?: NearbyDestination;
  llmReasoning?: string;
}

const graphCache = new Map<string, Promise<NearbyDestination[]>>();

function catalogueNearby(destination: CityRecord): NearbyDestination[] {
  return CITIES.filter((city) => city.id !== destination.id)
    .map((city) => {
      const km = distanceKm(destination, city);
      return { city, km, minutes: Math.round((km / 82) * 60 + 18) };
    })
    .filter(({ minutes }) => minutes <= 240)
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, 10)
    .map(({ city, minutes }) => ({
      name: city.name, country: city.country, countryCode: city.countryCode, lat: city.lat, lon: city.lon,
      estimatedTravelMinutes: minutes, modes: ["train" as const, "car" as const],
      type: city.hiddenGem ? "regional-hidden-gem" : "nearby-city",
      themes: Object.entries(city.scores).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name),
      suitableFor: minutes <= 120 ? ["day-trip" as const, "overnight" as const] : ["overnight" as const],
      provenance: "destination-catalogue" as const, hiddenGem: city.hiddenGem,
    }));
}

export async function discoverNearbyDestinations(destination: CityRecord, maxMinutes = 240): Promise<NearbyDestination[]> {
  const key = `${normaliseText(destination.name)}:${maxMinutes}`;
  const cached = graphCache.get(key);
  if (cached) return (await cached).map((entry) => ({ ...entry }));
  const request = (async () => {
    const curated = (CURATED_DESTINATION_ADJACENCY[normaliseText(destination.name)] ?? []) as NearbyDestination[];
    let discovered: NearbyDestination[] = [];
    if (typeof window !== "undefined") {
      try {
        const response = await fetch("/api/regions/nearby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ destination: destination.name, latitude: destination.lat, longitude: destination.lon, maxMinutes }),
          signal: AbortSignal.timeout(40_000),
        });
        const payload = await response.json() as { destinations?: NearbyDestination[] };
        if (response.ok) discovered = payload.destinations ?? [];
      } catch {
        // Curated/catalogue fallback below keeps planning available.
      }
    }
    return [...curated, ...discovered, ...catalogueNearby(destination)]
      .filter((entry) => entry.estimatedTravelMinutes <= maxMinutes)
      .filter((entry, index, all) => all.findIndex((other) => normaliseText(other.name) === normaliseText(entry.name)) === index)
      .sort((left, right) => left.estimatedTravelMinutes - right.estimatedTravelMinutes);
  })();
  graphCache.set(key, request);
  return (await request).map((entry) => ({ ...entry }));
}

function cityFromNearby(nearby: NearbyDestination, prefs: TripPreferences): CityRecord {
  const existing = CITIES.find((city) => normaliseText(city.name) === normaliseText(nearby.name));
  if (existing) return existing;
  const themes = new Set(nearby.themes.map(normaliseText));
  const score = (interest: Interest) => themes.has(interest) ? 92 : nearby.hiddenGem ? 76 : 68;
  return {
    id: `regional-${normaliseText(nearby.name).replaceAll(" ", "-")}`, name: nearby.name,
    country: nearby.country, countryCode: nearby.countryCode, lat: nearby.lat, lon: nearby.lon,
    region: "central", dailyIndex: nearby.type === "major-nearby-city" ? 82 : 68,
    hiddenGem: Boolean(nearby.hiddenGem),
    scores: { nature: score("nature"), food: score("food"), shopping: score("shopping"), photography: score("photography"), history: score("history"), museums: score("museums"), nightlife: score("nightlife"), adventure: score("adventure"), luxury: score("luxury") },
    dayTrips: [], hotels: [], highlights: [],
  };
}

export function createRegionalRoutePlans(destination: CityRecord, prefs: TripPreferences, nights: number, discovered: NearbyDestination[] = []): RegionalRoutePlan[] {
  const mode = prefs.regionalDiscovery ?? "nearby-cities";
  const maxMinutes = prefs.maxAdditionalTravelMinutes ?? 120;
  const hotelRule = prefs.fewerHotelChanges && prefs.regionalHotelChanges !== "flexible"
    ? "none"
    : (prefs.regionalHotelChanges ?? "one");
  const sameCountry = prefs.allowNewCountry === false;
  const existingAccommodation = new RegExp(`accommodation.{0,28}${destination.name}|${destination.name}.{0,28}accommodation`, "i").test(prefs.notes);
  const nearby = discovered.filter((place) =>
    place.estimatedTravelMinutes <= maxMinutes && (!sameCountry || place.countryCode === destination.countryCode),
  );
  const plans: RegionalRoutePlan[] = [{ family: "destination-only", cities: [destination], nights: [nights] }];
  if (mode === "off") return plans;
  const dayTrip = nearby.find((place) => place.suitableFor.includes("day-trip"));
  if (dayTrip) plans.push({ family: "nearby-day-trip", cities: [destination], nights: [nights], nearby: dayTrip });
  const hiddenDayTrip = nights >= 4
    ? nearby.find((place) => place.hiddenGem && place.suitableFor.includes("day-trip") && place.name !== dayTrip?.name)
    : undefined;
  if (hiddenDayTrip) plans.push({ family: "regional-hidden-gem", cities: [destination], nights: [nights], nearby: hiddenDayTrip });
  if (mode === "day-trips" || nights <= 3 || hotelRule === "none" || existingAccommodation) return plans;
  const addOvernight = (family: RegionalRouteFamily, place?: NearbyDestination) => {
    if (!place || !place.suitableFor.includes("overnight")) return;
    const addedNights = nights >= 7 && place.estimatedTravelMinutes > 120 ? 2 : 1;
    if (nights - addedNights < 2) return;
    plans.push({ family, cities: [cityFromNearby(place, prefs), destination], nights: [addedNights, nights - addedNights], nearby: place });
  };
  addOvernight("second-city", nearby.find((place) => place.type === "nearby-capital" || place.estimatedTravelMinutes <= 120));
  if (!hiddenDayTrip) addOvernight("regional-hidden-gem", nearby.find((place) => place.hiddenGem && place.suitableFor.includes("overnight")));
  if (nights >= 5) addOvernight("major-nearby-city", nearby.find((place) => place.type === "major-nearby-city"));
  if (nights >= 6 && mode === "surprise") addOvernight("scenic-route", nearby.find((place) => place.type.includes("scenic") && place.suitableFor.includes("overnight")));
  return plans.slice(0, 5);
}

export function regionalContext(plan: RegionalRoutePlan, prefs: TripPreferences, routeCost: number): RegionalRouteContext {
  const place = plan.nearby;
  const interests = new Set([...prefs.interests, ...prefs.activities].map(normaliseText));
  const matches = place?.themes.filter((theme) => interests.has(normaliseText(theme))).length ?? 0;
  const familyCopy: Record<RegionalRouteFamily, [string, string]> = {
    "destination-only": ["Keeps every day focused on the city you asked for", "Less regional variety"],
    "nearby-day-trip": ["Adds regional contrast without changing hotels", `Uses part of one ${prefs.endCity} day`],
    "second-city": ["Adds a distinct historic centre with a short connection", `Adds one hotel change and about ${place?.estimatedTravelMinutes ?? 0} minutes of transit`],
    "regional-hidden-gem": ["Adds a quieter, less-touristed regional stop", "Trades some headline sights for local atmosphere"],
    "major-nearby-city": ["Adds stronger cultural and food variety", "More transit and one hotel change"],
    "scenic-route": ["Adds landscape and photography value", "Leaves fewer full days in the requested city"],
  };
  const [benefit, tradeOff] = familyCopy[plan.family];
  const added = place ? [{ name: place.name, country: place.country, lat: place.lat, lon: place.lon, estimatedTravelMinutes: place.estimatedTravelMinutes, modes: place.modes, provenance: place.provenance }] : [];
  return {
    requestedDestination: prefs.endCity, family: plan.family, destinationType: place?.type ?? "requested-destination",
    addedDestinations: added, travelMinutesAdded: place?.estimatedTravelMinutes ?? 0,
    primaryBenefit: benefit, tradeOff,
    suggestionReason: place
      ? `${place.name} is about ${place.estimatedTravelMinutes} minutes from ${prefs.endCity}. ${benefit}. This route is ${routeCost <= prefs.budget ? `${Math.round(prefs.budget - routeCost)} ${prefs.currency} below budget` : `${Math.round(routeCost - prefs.budget)} ${prefs.currency} above budget`}.`
      : `${prefs.endCity} works as a focused single-base trip with no added hotel changes.`,
    feasibilityStatus: routeCost <= prefs.budget ? "valid" : "near-miss",
    metrics: {
      regionalDiscoveryValue: place ? Math.min(100, 60 + (place.hiddenGem ? 25 : 10)) : 35,
      travelTimePenalty: place ? Math.round((place.estimatedTravelMinutes / 240) * 100) : 0,
      cityChangePenalty: plan.cities.length > 1 ? 55 : 0,
      thematicDiversity: place ? Math.min(100, 55 + place.themes.length * 8) : 45,
      hiddenGemValue: place?.hiddenGem ? 95 : 30,
      budgetEfficiency: Math.max(0, Math.min(100, Math.round(120 - (routeCost / prefs.budget) * 100))),
      preferenceGain: Math.min(100, 45 + matches * 18),
      overnightValue: plan.cities.length > 1 ? (nightsValue(plan.nights?.[0] ?? 0)) : 70,
      routeCoherence: place ? Math.max(0, 100 - Math.round(place.estimatedTravelMinutes / 4)) : 100,
    },
  };
}

const nightsValue = (nights: number) => nights >= 2 ? 90 : nights === 1 ? 68 : 30;
