import assert from "node:assert/strict";
import test from "node:test";

import { destinationMatchesResolvedCity } from "../src/lib/destination.ts";

test("qualified destination input validates against the geocoder's canonical city", () => {
  assert.equal(destinationMatchesResolvedCity("Prague", "Prague, Czechia", "Prague"), true);
  assert.equal(destinationMatchesResolvedCity("Split", "Split, Croatia", "Split"), true);
});

test("a genuinely different final city still fails the hard destination constraint", () => {
  assert.equal(destinationMatchesResolvedCity("Vienna", "Prague, Czechia", "Prague"), false);
});
