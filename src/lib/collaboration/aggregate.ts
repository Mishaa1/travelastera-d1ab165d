import type { Interest, TripPreferences, TripRoute } from "@/lib/types";
import type {
  GroupProfile,
  RouteGroupInsight,
  SharedTrip,
  TravellerProfile,
  WalkingTolerance,
} from "./types";

const WALKING_RANK: Record<WalkingTolerance, number> = { short: 0, moderate: 1, long: 2 };
const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

export function combineGroupPreferences(
  trip: Pick<SharedTrip, "basePreferences" | "responses" | "travellers">,
): GroupProfile {
  const base = trip.basePreferences;
  const profiles = Object.values(trip.responses);
  const budgets = [base.budget, ...profiles.flatMap((profile) =>
    [profile.budgetCeiling].filter((value): value is number => typeof value === "number" && value > 0),
  )];
  const maximumBudget = Math.min(...budgets);
  const interestCounts = new Map<Interest, number>();
  for (const interest of base.interests) interestCounts.set(interest, 1);
  for (const profile of profiles) {
    for (const interest of profile.interests) {
      interestCounts.set(interest, (interestCounts.get(interest) ?? 0) + 1);
    }
  }
  const denominator = Math.max(1, profiles.length + 1);
  const weightedInterests = Object.fromEntries(
    [...interestCounts.entries()].map(([interest, count]) => [interest, count / denominator]),
  ) as Partial<Record<Interest, number>>;
  const rankedInterests = [...interestCounts.entries()].sort((a, b) => b[1] - a[1]);
  const selectedInterests = rankedInterests.filter(([, count]) => count / denominator >= 0.34).map(([id]) => id);
  const diets = unique([...base.diets, ...profiles.flatMap((profile) => profile.foodPreferences)]);
  const allergies = unique(profiles.flatMap((profile) => profile.allergies));
  const accessibilityNeeds = unique(profiles.flatMap((profile) => profile.accessibilityNeeds));
  const transportExclusions = unique(profiles.flatMap((profile) => profile.transportExclusions)) as Array<"flight" | "train" | "car">;
  const existingAccommodation = unique(profiles.map((profile) => profile.existingAccommodation));
  const walkingTolerance = profiles.reduce<WalkingTolerance>(
    (lowest, profile) => WALKING_RANK[profile.walkingTolerance] < WALKING_RANK[lowest] ? profile.walkingTolerance : lowest,
    "long",
  );
  const nightlife = new Set(profiles.map((profile) => profile.nightlifePreference));
  const paces = new Set(profiles.map((profile) => profile.pace));
  const budgetSpread = budgets.length > 1 ? Math.max(...budgets) - Math.min(...budgets) : 0;
  const conflicts = [
    ...(nightlife.has("avoid") && nightlife.has("important") ? ["Different nightlife preferences"] : []),
    ...(paces.size > 1 ? ["Different preferred trip paces"] : []),
    ...(budgetSpread > maximumBudget * 0.2 ? ["Different individual budget ceilings"] : []),
  ];
  const notes = unique([
    base.notes,
    ...profiles.map((profile) => profile.mustHave && `${profile.name} must have: ${profile.mustHave}`),
    ...profiles.map((profile) => profile.dealBreaker && `${profile.name} deal-breaker: ${profile.dealBreaker}`),
    allergies.length ? `HARD dietary/allergy constraints: ${allergies.join(", ")}` : "",
    accessibilityNeeds.length ? `HARD accessibility needs: ${accessibilityNeeds.join(", ")}` : "",
    transportExclusions.length ? `HARD excluded transport: ${transportExclusions.join(", ")}` : "",
    existingAccommodation.length ? `HARD existing accommodation: ${existingAccommodation.join("; ")}` : "",
    walkingTolerance === "short" ? "HARD constraint: keep walking short and provide low-walking days." : "",
  ]).join("\n");
  const allowedTransport = (["flight", "train", "car"] as const).filter((mode) => !transportExclusions.includes(mode));
  const combinedPreferences: TripPreferences = {
    ...base,
    budget: maximumBudget,
    interests: selectedInterests.length ? selectedInterests : base.interests,
    diets: diets as TripPreferences["diets"],
    notes,
    avoidFlights: base.avoidFlights || transportExclusions.includes("flight"),
    transport: allowedTransport.length === 1 ? allowedTransport[0] : base.transport,
    fewerHotelChanges: base.fewerHotelChanges || walkingTolerance === "short" || profiles.some((p) => p.pace === "relaxed"),
    maxTravelHours: profiles.some((profile) => profile.pace === "relaxed")
      ? Math.min(base.maxTravelHours, 8)
      : base.maxTravelHours,
  };
  const sharedPriorities = rankedInterests
    .filter(([, count]) => count >= Math.max(1, Math.ceil(denominator / 2)))
    .slice(0, 5)
    .map(([interest]) => interest);
  return {
    combinedPreferences,
    sharedPriorities,
    conflictingPreferences: conflicts,
    unresolvedConflicts: conflicts,
    weightedInterests,
    hardConstraints: {
      maximumBudget,
      allergies,
      accessibilityNeeds,
      transportExclusions,
      existingAccommodation,
      maximumWalkingTolerance: walkingTolerance,
    },
    submittedCount: profiles.length,
  };
}

export function routeGroupInsight(
  route: TripRoute,
  trip: Pick<SharedTrip, "travellers" | "responses">,
  profile: GroupProfile,
): RouteGroupInsight {
  const responses = Object.values(trip.responses);
  const routeInterests = new Set(route.preferences.interests);
  const memberScores = responses.map((response) => {
    const matched = response.interests.filter((interest) => routeInterests.has(interest)).length;
    const interestFit = response.interests.length ? matched / response.interests.length : 1;
    const budgetFit = response.budgetCeiling == null || route.cost <= response.budgetCeiling ? 1 : 0;
    const walkFit = response.walkingTolerance !== "short" || route.preferences.fewerHotelChanges ? 1 : 0.65;
    return { name: response.name, score: interestFit * 0.55 + budgetFit * 0.3 + walkFit * 0.15 };
  });
  const groupFit = memberScores.length
    ? Math.round(memberScores.reduce((sum, item) => sum + item.score, 0) / memberScores.length * 100)
    : Math.round(route.scores.overall);
  const suitsBest = memberScores.sort((a, b) => b.score - a.score).filter((item) => item.score >= 0.7).map((item) => item.name);
  const compromises = [
    ...(route.cost > profile.hardConstraints.maximumBudget ? ["This route exceeds the group’s lowest budget ceiling"] : []),
    ...(profile.conflictingPreferences.includes("Different preferred trip paces") ? ["Uses a balanced pace between different preferences"] : []),
    ...(profile.conflictingPreferences.includes("Different nightlife preferences") ? ["Keeps nightlife optional"] : []),
  ];
  const priorities = profile.sharedPriorities.slice(0, 3).join(", ");
  return {
    groupFit: Math.max(0, Math.min(100, groupFit)),
    suitsBest,
    keyCompromises: compromises,
    unresolvedConflicts: profile.unresolvedConflicts,
    whyItWorks: priorities
      ? `It protects the group’s hard limits while giving the strongest shared priorities — ${priorities} — meaningful space.`
      : "It protects every submitted hard constraint and balances the group’s individual preferences.",
  };
}

export function blankTravellerProfile(travellerId: string, name: string): TravellerProfile {
  return {
    travellerId, name, budgetCeiling: null, interests: [], pace: "balanced", walkingTolerance: "moderate",
    foodPreferences: [], nightlifePreference: "optional", mustHave: "", dealBreaker: "", allergies: [],
    accessibilityNeeds: [], transportExclusions: [], existingAccommodation: "", submittedAt: "",
  };
}
