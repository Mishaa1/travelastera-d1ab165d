import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { blankTravellerProfile, combineGroupPreferences } from "../src/lib/collaboration/aggregate.ts";
import { FileCollaborationStore } from "../src/lib/collaboration/store.server.ts";
import type { TripPreferences } from "../src/lib/types.ts";

const SAMPLE_PREFERENCES: TripPreferences = {
  startCity: "Paris", endCity: "Vienna", startDate: "2026-09-01", endDate: "2026-09-05",
  dateMode: "exact", flexibleMonth: "", flexibleNights: 4, travellers: 2, budget: 2000,
  currency: "EUR", interests: ["food", "history"], transport: "mixed", maxTravelHours: 14,
  avoidFlights: false, fewerHotelChanges: false, luxuryLevel: "midscale", diets: [],
  travelStyle: "friends", activities: [], notes: "",
};

const shared = (profiles: ReturnType<typeof blankTravellerProfile>[]) => ({
  basePreferences: { ...SAMPLE_PREFERENCES, budget: 2000, interests: ["food", "history"] as const },
  travellers: profiles.map((profile) => ({ id: profile.travellerId, name: profile.name })),
  responses: Object.fromEntries(profiles.map((profile) => [profile.travellerId, profile])),
});

test("aligned travellers produce shared priorities", () => {
  const a = { ...blankTravellerProfile("a", "Alex"), interests: ["food", "history"] as const };
  const b = { ...blankTravellerProfile("b", "Sam"), interests: ["food", "history"] as const };
  const result = combineGroupPreferences(shared([a, b]));
  assert.ok(result.sharedPriorities.includes("food"));
  assert.equal(result.conflictingPreferences.length, 0);
});

test("conflicting budgets preserve the lowest hard ceiling", () => {
  const a = { ...blankTravellerProfile("a", "Alex"), budgetCeiling: 900 };
  const b = { ...blankTravellerProfile("b", "Sam"), budgetCeiling: 1800 };
  const result = combineGroupPreferences(shared([a, b]));
  assert.equal(result.combinedPreferences.budget, 900);
  assert.ok(result.conflictingPreferences.includes("Different individual budget ceilings"));
});

test("dietary and low-walking hard constraints survive aggregation", () => {
  const a = { ...blankTravellerProfile("a", "Alex"), allergies: ["peanuts"], walkingTolerance: "short" as const };
  const result = combineGroupPreferences(shared([a]));
  assert.deepEqual(result.hardConstraints.allergies, ["peanuts"]);
  assert.equal(result.hardConstraints.maximumWalkingTolerance, "short");
  assert.equal(result.combinedPreferences.fewerHotelChanges, true);
  assert.match(result.combinedPreferences.notes, /peanuts/);
});

test("votes replace duplicates and invite data persists across store instances", async () => {
  const directory = await mkdtemp(join(tmpdir(), "astera-collab-"));
  const path = join(directory, "store.json");
  const store = new FileCollaborationStore(path);
  const created = await store.create("Misha", ["Alex"], SAMPLE_PREFERENCES);
  const travellerId = created.trip.travellers[0].id;
  await store.saveVote(created.token, { travellerId, routeId: "route-1", value: "love" });
  await store.saveVote(created.token, { travellerId, routeId: "route-1", value: "okay" });
  const reloaded = await new FileCollaborationStore(path).get(created.token);
  assert.ok(reloaded);
  assert.equal(Object.keys(reloaded.votes).length, 1);
  assert.equal(reloaded.votes[`route-1:${travellerId}`].value, "okay");
  assert.equal(reloaded.organizerName, "Misha");
});
