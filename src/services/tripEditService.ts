import type { DayPlan, Interest, TripPreferences, TripRoute } from "@/lib/types";
import { optimiseTrip } from "@/services/tripOptimizer";
import type { AITripEditInstruction } from "@/lib/planner/tripEditSchema";

export type TripEditAction =
  | { type: "reduce-budget"; amount: number }
  | { type: "increase-budget"; amount: number }
  | { type: "add-destination"; city: string; preserveExisting: boolean; days: number; extendTrip: boolean; keepBudgetFixed: boolean }
  | { type: "remove-destination"; city: string; preserveExisting: boolean }
  | { type: "replace-city"; from: string; to: string }
  | { type: "add-relaxing-days"; days: number }
  | { type: "remove-interest"; interest: Interest }
  | { type: "add-interest"; interest: Interest }
  | { type: "luxury-hotel" }
  | { type: "fewer-changes" }
  | { type: "existing-accommodation"; city: string }
  | { type: "lock-day"; day: number }
  | { type: "change-pace"; pace: "relaxed" | "balanced" | "fast" }
  | { type: "replace-hotel"; preference: string; city?: string }
  | { type: "add-attraction" | "remove-attraction"; attraction: string }
  | { type: "add-constraint"; constraintType: string; value: string }
  | { type: "transport-preference"; value: string }
  | { type: "restaurant-preference"; value: string }
  | { type: "regenerate" }
  | { type: "expand-regionally"; preference: "day-trips" | "nearby-cities" | "surprise"; maxMinutes?: number; allowNewCountry?: boolean; maxHotelChanges?: number };

export interface TripEditIntent {
  raw: string;
  actions: TripEditAction[];
  lockedDays: number[];
  impacted: { route: boolean; flights: boolean; hotels: boolean; activities: boolean; budget: boolean };
}

export interface TripEditResult {
  route: TripRoute;
  intent: TripEditIntent;
  changes: string[];
  before: { cost: number; score: number };
  after: { cost: number; score: number };
}

export class TripEditClarificationError extends Error {
  constructor(readonly question: string) { super(question); this.name = "TripEditClarificationError"; }
}

async function understandTripEdit(route: TripRoute, prompt: string) {
  const response = await fetch("/api/planner/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    prompt,
    route: {
      origin: route.preferences.startCity, finalDestination: route.preferences.endCity,
      stops: route.stops.map((stop) => ({ city: stop.name, nights: stop.nights, accommodationProvided: stop.accommodationProvided })),
      dates: { start: route.preferences.startDate, end: route.preferences.endDate }, budget: route.preferences.budget,
      currency: route.preferences.currency, pace: route.preferences.fewerHotelChanges ? "relaxed" : "balanced",
      interests: route.preferences.interests, transport: route.preferences.transport,
      days: route.itinerary.map((day) => ({ day: day.day, city: day.city })),
    },
  }) });
  const body = await response.json() as { instruction?: AITripEditInstruction; error?: string };
  if (!response.ok || !body.instruction) throw new Error(body.error ?? "OpenRouter did not return a structured edit.");
  if (import.meta.env.DEV) console.info("[trip-edit:client-intent]", body.instruction);
  if (body.instruction.requiresClarification) throw new TripEditClarificationError(body.instruction.clarificationQuestion ?? "Could you clarify that edit?");
  return body.instruction;
}

function fromAI(instruction: AITripEditInstruction, route: TripRoute): TripEditIntent {
  const actions: TripEditAction[] = [];
  const changes = instruction.changes;
  const destination = changes.destination?.trim();
  const keepBudgetFixed = changes.constraints.some((value) => value.toLowerCase() === "keep_budget_fixed");
  switch (instruction.intent) {
    case "add_destination": if (destination) actions.push({ type: "add-destination", city: destination, preserveExisting: true, days: Math.max(1, changes.tripDurationDeltaDays ?? 1), extendTrip: (changes.tripDurationDeltaDays ?? 1) > 0, keepBudgetFixed }); break;
    case "remove_destination": if (destination) actions.push({ type: "remove-destination", city: destination, preserveExisting: true }); break;
    case "replace_destination": if (destination) actions.push({ type: "replace-city", from: changes.replaceDestination ?? route.stops.at(-1)?.name ?? route.preferences.endCity, to: destination }); break;
    case "change_budget": {
      const delta = changes.budgetDelta ?? 0;
      if (delta < 0) actions.push({ type: "reduce-budget", amount: Math.abs(delta) });
      if (delta > 0) actions.push({ type: "increase-budget", amount: delta });
      break;
    }
    case "change_pace": if (changes.pace) actions.push({ type: "change-pace", pace: changes.pace }); break;
    case "replace_hotel": actions.push({ type: "replace-hotel", preference: changes.hotelPreference ?? "a different hotel", city: destination ?? undefined }); break;
    case "modify_interest": for (const value of changes.constraints) {
      const match = value.match(/^(add|remove)_interest:(.+)$/i);
      const interest = match?.[2]?.trim().toLowerCase();
      if (match && interest && ["nature","food","shopping","photography","history","museums","nightlife","adventure","luxury"].includes(interest)) actions.push({ type: match[1].toLowerCase() === "add" ? "add-interest" : "remove-interest", interest: interest as Interest });
    } break;
    case "add_constraint": for (const value of changes.constraints) actions.push({ type: "add-constraint", constraintType: changes.walkingTolerance ? "accessibility" : "other", value }); break;
    case "remove_constraint": for (const value of changes.constraints) actions.push({ type: "add-constraint", constraintType: "remove", value }); break;
    case "preserve_day": for (const day of changes.preserveDays) actions.push({ type: "lock-day", day }); break;
    case "existing_accommodation": for (const city of changes.existingAccommodation) actions.push({ type: "existing-accommodation", city }); break;
    case "modify_transport": if (changes.transportPreference) actions.push({ type: "transport-preference", value: changes.transportPreference }); break;
    case "modify_food": if (changes.foodPreference) actions.push({ type: "restaurant-preference", value: changes.foodPreference }); break;
    case "change_duration": if ((changes.tripDurationDeltaDays ?? 0) > 0) actions.push({ type: "add-relaxing-days", days: changes.tripDurationDeltaDays! }); break;
    case "regenerate_trip": actions.push({ type: "regenerate" }); break;
    case "expand_route_regionally": actions.push({ type: "expand-regionally", preference: changes.regionalPreference ?? "nearby-cities", maxMinutes: changes.maxAdditionalTravelMinutes ?? undefined, allowNewCountry: changes.allowNewCountry ?? undefined, maxHotelChanges: changes.maxAdditionalHotelChanges ?? undefined }); break;
  }
  for (const day of changes.preserveDays) if (!actions.some((action) => action.type === "lock-day" && action.day === day)) actions.push({ type: "lock-day", day });
  if (changes.walkingTolerance) actions.push({ type: "add-constraint", constraintType: "accessibility", value: `walking tolerance: ${changes.walkingTolerance}` });
  if (!actions.length) throw new TripEditClarificationError(instruction.clarificationQuestion ?? "What specifically would you like changed?");
  const lockedDays = actions.filter((action): action is Extract<TripEditAction, { type: "lock-day" }> => action.type === "lock-day").map((action) => action.day);
  const routeChange = actions.some((a) => ["replace-city", "add-destination", "remove-destination", "add-relaxing-days", "regenerate", "expand-regionally"].includes(a.type));
  return { raw: instruction.intent, actions, lockedDays, impacted: {
    route: routeChange, flights: routeChange || actions.some((a) => ["fewer-changes", "transport-preference"].includes(a.type)),
    hotels: routeChange || actions.some((a) => ["luxury-hotel", "replace-hotel", "existing-accommodation"].includes(a.type)),
    activities: routeChange || actions.some((a) => ["remove-interest", "add-interest", "add-attraction", "remove-attraction", "restaurant-preference"].includes(a.type)),
    budget: routeChange || actions.some((a) => ["reduce-budget", "increase-budget", "luxury-hotel", "replace-hotel", "existing-accommodation"].includes(a.type)),
  } };
}

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

function applyPreferences(route: TripRoute, intent: TripEditIntent) {
  const preferences: TripPreferences = { ...route.preferences, interests: [...route.preferences.interests] };
  for (const action of intent.actions) {
    if (action.type === "reduce-budget") preferences.budget = Math.max(200, preferences.budget - action.amount);
    if (action.type === "increase-budget") preferences.budget += action.amount;
    if (action.type === "add-destination") {
      preferences.endCity = action.city;
      if (action.extendTrip) {
        preferences.endDate = addDays(preferences.endDate, action.days);
        preferences.flexibleNights += action.days;
        if (!action.keepBudgetFixed) preferences.budget = Math.round(preferences.budget * (1 + action.days / Math.max(1, route.itinerary.length)));
      }
      preferences.notes = `${preferences.notes}\nHARD route edit: add ${action.city}. Every existing stop must remain; this is not a replacement.${action.extendTrip ? ` Extend the trip by ${action.days} day(s).` : " Keep the existing duration."}`.trim();
    }
    if (action.type === "remove-destination") {
      const remaining = route.stops.filter((stop) => stop.name.toLowerCase() !== action.city.toLowerCase());
      if (route.preferences.endCity.toLowerCase() === action.city.toLowerCase() || route.stops.at(-1)?.name.toLowerCase() === action.city.toLowerCase()) preferences.endCity = remaining.at(-1)?.name ?? "";
      preferences.notes = `${preferences.notes}\nHARD route edit: remove only ${action.city}. Preserve every other existing stop.`.trim();
    }
    if (action.type === "replace-city") {
      if (preferences.endCity.toLowerCase() === action.from.toLowerCase() || route.stops.at(-1)?.name.toLowerCase() === action.from.toLowerCase()) preferences.endCity = action.to;
      preferences.notes = `${preferences.notes}\nHARD route edit: replace ${action.from} with ${action.to}.`.trim();
    }
    if (action.type === "add-relaxing-days") { preferences.endDate = addDays(preferences.endDate, action.days); preferences.flexibleNights += action.days; preferences.fewerHotelChanges = true; preferences.maxTravelHours = Math.min(preferences.maxTravelHours, 8); }
    if (action.type === "remove-interest") preferences.interests = preferences.interests.filter((value) => value !== action.interest);
    if (action.type === "add-interest") preferences.interests = [...new Set([...preferences.interests, action.interest])];
    if (action.type === "luxury-hotel") preferences.luxuryLevel = "luxury";
    if (action.type === "fewer-changes") preferences.fewerHotelChanges = true;
    if (action.type === "change-pace") { preferences.fewerHotelChanges = action.pace === "relaxed"; preferences.maxTravelHours = action.pace === "relaxed" ? Math.min(preferences.maxTravelHours, 8) : action.pace === "fast" ? Math.max(preferences.maxTravelHours, 24) : 14; }
    if (action.type === "replace-hotel") { if (/luxury|upgrad|five.star/i.test(action.preference)) preferences.luxuryLevel = "luxury"; preferences.notes = `${preferences.notes}\nHotel preference: ${action.preference}${action.city ? ` in ${action.city}` : ""}.`.trim(); }
    if (action.type === "add-attraction") preferences.notes = `${preferences.notes}\nActivity intention to add: ${action.attraction}.`.trim();
    if (action.type === "remove-attraction") preferences.notes = `${preferences.notes}\nDo not include attraction/category: ${action.attraction}.`.trim();
    if (action.type === "add-constraint") preferences.notes = `${preferences.notes}\nHARD ${action.constraintType} constraint: ${action.value}.`.trim();
    if (action.type === "transport-preference") { preferences.notes = `${preferences.notes}\nTransport preference: ${action.value}.`.trim(); if (/no flights|avoid flying/i.test(action.value)) preferences.avoidFlights = true; if (/train/i.test(action.value)) preferences.transport = "train"; }
    if (action.type === "restaurant-preference") preferences.notes = `${preferences.notes}\nRestaurant preference: ${action.value}.`.trim();
    if (action.type === "existing-accommodation") preferences.notes = `${preferences.notes}\nI already have accommodation in ${action.city}.`.trim();
    if (action.type === "lock-day") preferences.notes = `${preferences.notes}\nHARD preservation: keep Day ${action.day} exactly unchanged in future edits.`.trim();
    if (action.type === "expand-regionally") {
      preferences.regionalDiscovery = action.preference;
      if (action.maxMinutes) preferences.maxAdditionalTravelMinutes = action.maxMinutes <= 60 ? 60 : action.maxMinutes <= 120 ? 120 : 240;
      if (action.allowNewCountry != null) preferences.allowNewCountry = action.allowNewCountry;
      if (action.maxHotelChanges != null) preferences.regionalHotelChanges = action.maxHotelChanges === 0 ? "none" : action.maxHotelChanges === 1 ? "one" : "flexible";
    }
  }
  return preferences;
}

const preserveLockedDays = (before: DayPlan[], next: DayPlan[], locked: number[]) => next.map((day) => locked.includes(day.day) ? before.find((old) => old.day === day.day) ?? day : day);

export async function editTripWithAI(route: TripRoute, text: string): Promise<TripEditResult> {
  const instruction = await understandTripEdit(route, text);
  const intent = fromAI(instruction, route);
  const preferences = applyPreferences(route, intent);
  const changes: string[] = [];
  for (const action of intent.actions) {
    if (action.type === "reduce-budget") changes.push(`Budget ceiling reduced by ${action.amount} ${preferences.currency}.`);
    if (action.type === "increase-budget") changes.push(`Budget ceiling increased by ${action.amount} ${preferences.currency}.`);
    if (action.type === "add-destination") changes.push(`${action.city} added after the existing route${action.extendTrip ? ` with ${action.days} extra ${action.days === 1 ? "day" : "days"}` : " within the existing duration"}.`);
    if (action.type === "remove-destination") changes.push(`${action.city} removed from the requested route.`);
    if (action.type === "replace-city") changes.push(`${action.from} replaced with ${action.to}; affected transport, stay and daily places were reconsidered.`);
    if (action.type === "add-relaxing-days") changes.push(`${action.days} relaxing ${action.days === 1 ? "day" : "days"} added with a slower pace.`);
    if (action.type === "remove-interest") changes.push(`${action.interest} removed from activity priorities.`);
    if (action.type === "add-interest") changes.push(`${action.interest} given more weight in the daily plan.`);
    if (action.type === "luxury-hotel") changes.push("Hotels upgraded toward the luxury preference.");
    if (action.type === "fewer-changes") changes.push("The route now prioritises fewer transfers and hotel changes.");
    if (action.type === "existing-accommodation") changes.push(`Hotel recommendations and costs removed for ${action.city}.`);
    if (action.type === "lock-day") changes.push(`Day ${action.day} preserved exactly.`);
    if (action.type === "change-pace") changes.push(`Trip pace changed to ${action.pace}.`);
    if (action.type === "replace-hotel") changes.push(`Hotel selection reconsidered around “${action.preference}”.`);
    if (action.type === "add-attraction") changes.push(`Added “${action.attraction}” as a provider search intention.`);
    if (action.type === "remove-attraction") changes.push(`Removed “${action.attraction}” from the itinerary.`);
    if (action.type === "add-constraint") changes.push(`${action.constraintType} constraint added: ${action.value}.`);
    if (action.type === "transport-preference") changes.push(`Transport preference updated: ${action.value}.`);
    if (action.type === "restaurant-preference") changes.push(`Restaurant matching updated: ${action.value}.`);
    if (action.type === "regenerate") changes.push("The complete trip was explicitly regenerated.");
    if (action.type === "expand-regionally") changes.push(`Regional discovery expanded to ${action.preference.replace("-", " ")}${action.maxMinutes ? ` within ${action.maxMinutes} minutes` : ""}.`);
  }
  const needsProviderRefresh = intent.impacted.route || intent.impacted.flights || intent.impacted.activities || intent.actions.some((a) => a.type === "luxury-hotel");
  let next: TripRoute = { ...route, preferences, budgetLeft: preferences.budget - route.cost, generatedAt: new Date().toISOString() };
  if (needsProviderRefresh) {
    const addRequest = intent.actions.find((action): action is Extract<TripEditAction, { type: "add-destination" }> => action.type === "add-destination");
    const requiredStops = addRequest ? [...route.stops.map((stop) => stop.name), addRequest.city] : undefined;
    const requiredStopNights = addRequest && addRequest.extendTrip
      ? Object.fromEntries([...route.stops.map((stop) => [stop.name.toLowerCase(), stop.nights] as const), [addRequest.city.toLowerCase(), addRequest.days]])
      : undefined;
    const candidates = await optimiseTrip({ preferences, requiredStops, requiredStopNights });
    const currentSignature = route.stops.map((stop) => stop.name.toLowerCase()).join("|");
    const exactRoute = candidates.find((item) => item.stops.map((stop) => stop.name.toLowerCase()).join("|") === currentSignature);
    const addDestination = intent.actions.find((action): action is Extract<TripEditAction, { type: "add-destination" }> => action.type === "add-destination");
    const removeDestination = intent.actions.find((action): action is Extract<TripEditAction, { type: "remove-destination" }> => action.type === "remove-destination");
    const existingNames = route.stops.map((stop) => stop.name.toLowerCase());
    const preservesInOrder = (item: TripRoute, names: string[]) => {
      const candidateNames = item.stops.map((stop) => stop.name.toLowerCase());
      let position = -1;
      return names.every((name) => { position = candidateNames.indexOf(name, position + 1); return position >= 0; });
    };
    const additiveCandidate = addDestination
      ? candidates.find((item) => item.stops.some((stop) => stop.name.toLowerCase() === addDestination.city.toLowerCase()) && preservesInOrder(item, existingNames))
      : undefined;
    const remainingNames = removeDestination ? existingNames.filter((name) => name !== removeDestination.city.toLowerCase()) : [];
    const subtractiveCandidate = removeDestination
      ? candidates.find((item) => !item.stops.some((stop) => stop.name.toLowerCase() === removeDestination.city.toLowerCase()) && preservesInOrder(item, remainingNames))
      : undefined;
    const candidate = addDestination
      ? additiveCandidate
      : removeDestination
        ? subtractiveCandidate
        : intent.impacted.route
      ? candidates.find((item) => item.stops.at(-1)?.name.toLowerCase() === preferences.endCity.toLowerCase()) ?? candidates[0]
      : exactRoute;
    if (!candidate) {
      if (addDestination) throw new Error(`ASTERA could not add ${addDestination.city} without removing or reordering an existing stop. Your current trip was left unchanged.`);
      if (removeDestination) throw new Error(`ASTERA could not remove only ${removeDestination.city} while preserving the rest of the route. Your current trip was left unchanged.`);
      throw new Error("No provider-backed itinerary satisfied that edit.");
    }
    if (addDestination) {
      const addedStop = candidate.stops.find((stop) => stop.name.toLowerCase() === addDestination.city.toLowerCase());
      const addedDays = candidate.itinerary
        .filter((day) => day.city.toLowerCase() === addDestination.city.toLowerCase())
        .slice(0, addDestination.days)
        .map((day, index) => ({ ...day, day: route.itinerary.length + index + 1 }));
      if (!addedStop || !addedDays.length) throw new Error(`Live travel data for the new ${addDestination.city} stop was unavailable. Your current trip was left unchanged.`);
      next = {
        ...candidate,
        stops: [...route.stops, addedStop],
        itinerary: [...route.itinerary, ...addedDays],
        reasoning: [
          `Added ${addDestination.city} after ${route.stops.at(-1)?.name ?? "the existing route"} while preserving all ${route.itinerary.length} existing days.`,
          ...candidate.reasoning.slice(0, 2),
        ],
      };
    } else if (intent.actions.some((action) => action.type === "regenerate") || intent.impacted.route) next = candidate;
    else {
      next = {
        ...route,
        preferences,
        stops: intent.impacted.hotels ? route.stops.map((stop) => candidate.stops.find((item) => item.name === stop.name) ?? stop) : route.stops,
        legs: intent.impacted.flights ? candidate.legs : route.legs,
        itinerary: intent.impacted.activities ? candidate.itinerary : route.itinerary,
        scores: candidate.scores,
        scoreFactors: candidate.scoreFactors,
        provenance: candidate.provenance,
        generatedAt: candidate.generatedAt,
      };
    }
  }
  for (const dayNumber of intent.lockedDays) {
    const beforeDay = route.itinerary.find((day) => day.day === dayNumber);
    const afterDay = next.itinerary.find((day) => day.day === dayNumber);
    if (beforeDay && afterDay && beforeDay.city !== afterDay.city) {
      throw new Error(`Day ${dayNumber} cannot stay exactly the same because that edit removes ${beforeDay.city}. Change the locked day or the route request.`);
    }
  }
  for (const action of intent.actions) {
    if (action.type !== "existing-accommodation") continue;
    next = { ...next, stops: next.stops.map((stop) => stop.name.toLowerCase() === action.city.toLowerCase() ? { ...stop, accommodationProvided: true, hotel: { name: "Your existing accommodation", area: stop.name, nightlyFrom: 0, totalStayPrice: 0, rating: 0, style: "Already arranged", quality: { source: "estimate", provider: "Traveller-provided accommodation" } } } : stop) };
  }
  next.itinerary = preserveLockedDays(route.itinerary, next.itinerary, intent.lockedDays);
  const accommodation = next.stops.reduce((sum, stop) => sum + stop.hotel.nightlyFrom * stop.nights * Math.max(1, Math.ceil(preferences.travellers / 2)), 0);
  const cost = Math.round(next.costBreakdown.transport + accommodation + next.costBreakdown.food + next.costBreakdown.activities + next.costBreakdown.buffer);
  next = { ...next, id: route.id, title: route.title, cost, costBreakdown: { ...next.costBreakdown, accommodation: Math.round(accommodation) }, budgetLeft: preferences.budget - cost, preferences };
  return { route: next, intent, changes, before: { cost: route.cost, score: route.scores.overall }, after: { cost: next.cost, score: next.scores.overall } };
}
