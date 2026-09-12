import type { Diet, Interest, TransportMode, TripPreferences } from "@/lib/types";

export type GroupPace = "relaxed" | "balanced" | "fast";
export type WalkingTolerance = "short" | "moderate" | "long";
export type NightlifePreference = "avoid" | "optional" | "important";
export type GroupVote = "love" | "okay" | "not-for-me";

export interface TravellerProfile {
  travellerId: string;
  name: string;
  budgetCeiling: number | null;
  interests: Interest[];
  pace: GroupPace;
  walkingTolerance: WalkingTolerance;
  foodPreferences: Diet[];
  nightlifePreference: NightlifePreference;
  mustHave: string;
  dealBreaker: string;
  allergies: string[];
  accessibilityNeeds: string[];
  transportExclusions: Exclude<TransportMode, "mixed">[];
  existingAccommodation: string;
  submittedAt: string;
}

export interface GroupTraveller {
  id: string;
  name: string;
}

export interface StoredVote {
  travellerId: string;
  routeId: string;
  value: GroupVote;
  updatedAt: string;
}

export interface SharedTrip {
  id: string;
  tokenHash: string;
  organizerName: string;
  travellers: GroupTraveller[];
  basePreferences: TripPreferences;
  responses: Record<string, TravellerProfile>;
  votes: Record<string, StoredVote>;
  createdAt: string;
  updatedAt: string;
}

export interface GroupHardConstraints {
  maximumBudget: number;
  allergies: string[];
  accessibilityNeeds: string[];
  transportExclusions: Exclude<TransportMode, "mixed">[];
  existingAccommodation: string[];
  maximumWalkingTolerance: WalkingTolerance;
}

export interface GroupProfile {
  combinedPreferences: TripPreferences;
  sharedPriorities: string[];
  conflictingPreferences: string[];
  unresolvedConflicts: string[];
  weightedInterests: Partial<Record<Interest, number>>;
  hardConstraints: GroupHardConstraints;
  submittedCount: number;
}

export interface RouteGroupInsight {
  groupFit: number;
  suitsBest: string[];
  keyCompromises: string[];
  unresolvedConflicts: string[];
  whyItWorks: string;
}

export interface SharedTripView extends Omit<SharedTrip, "tokenHash"> {
  profile: GroupProfile;
}
