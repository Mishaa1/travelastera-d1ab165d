import { normaliseText } from "@/lib/dedupe";
import type { PlannedCity, PlannerResponse } from "@/lib/planner/schema";
import type { TripPreferences } from "@/lib/types";

const samePlace = (left: string, right: string) => normaliseText(left) === normaliseText(right);

export function mentionsExistingAccommodation(notes: string, city: string) {
  const text = normaliseText(notes);
  const place = normaliseText(city);
  if (!text || !place || !text.includes(place)) return false;
  return [
    "already have accommodation",
    "already booked accommodation",
    "hotel already booked",
    "accommodation booked",
    "staying with",
    "place to stay",
  ].some((phrase) => text.includes(phrase));
}

export function mentionsExistingTransport(notes: string, from: string, to: string) {
  const text = normaliseText(notes);
  if (!text.includes(normaliseText(from)) || !text.includes(normaliseText(to))) return false;
  return [
    "flight already booked",
    "already booked flight",
    "train already booked",
    "already booked train",
    "transport already booked",
    "already have transport",
  ].some((phrase) => text.includes(phrase));
}

function redistributeNights(cities: PlannedCity[], totalNights: number): PlannedCity[] {
  const result = cities.map((city) => ({ ...city, nights: Math.max(1, city.nights) }));
  let delta = totalNights - result.reduce((sum, city) => sum + city.nights, 0);
  let cursor = 0;
  while (delta !== 0 && result.length) {
    const item = result[cursor % result.length];
    if (delta > 0) {
      item.nights += 1;
      delta -= 1;
    } else if (item.nights > 1) {
      item.nights -= 1;
      delta += 1;
    } else if (result.every((city) => city.nights === 1)) {
      break;
    }
    cursor += 1;
  }
  return result;
}

/** Repairs model output, then applies constraints that an LLM is never trusted to enforce. */
export function enforcePlannerConstraints(
  response: PlannerResponse,
  preferences: TripPreferences,
  requestedDestination: string | null,
  totalNights: number,
): PlannerResponse {
  const destination = requestedDestination?.trim() || null;

  const plans = response.plans
    .map((plan) => {
      const seen = new Set<string>();
      let cities = plan.cities
        .map((entry) => {
          const city = entry.city.trim();
          return city ? { ...entry, city } : null;
        })
        .filter((entry): entry is PlannedCity => Boolean(entry))
        .filter((entry) => {
          const key = normaliseText(entry.city);
          if (seen.has(key) || samePlace(entry.city, preferences.startCity)) return false;
          seen.add(key);
          return true;
        });

      if (destination && !samePlace(destination, preferences.startCity)) {
        cities = cities.filter((entry) => !samePlace(entry.city, destination));
        cities.push({
          city: destination,
          nights: 1,
          activities: preferences.activities.length
            ? preferences.activities.slice(0, 6)
            : preferences.interests.slice(0, 6),
        });
      }
      if (cities.length > totalNights) {
        const finalCity = cities.at(-1)!;
        cities = [...cities.slice(0, Math.max(0, totalNights - 1)), finalCity];
      }
      if (!cities.length) return null;
      return {
        cities: redistributeNights(cities, totalNights),
        routePattern: plan.routePattern,
        regionalDestination: plan.regionalDestination,
        regionalActivities: plan.regionalActivities,
        reasoning: plan.reasoning,
      };
    })
    .filter((plan): plan is PlannerResponse["plans"][number] => Boolean(plan));

  if (!plans.length)
    throw new Error("Planner produced no route that satisfies the hard constraints");
  return { plans };
}
