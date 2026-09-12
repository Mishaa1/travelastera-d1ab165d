import assert from "node:assert/strict";
import test from "node:test";

import {
  curateMoodCandidates,
  evaluateMoodCandidate,
  type DestinationMoodRole,
  type WikimediaMoodCandidate,
} from "../src/lib/images/wikimedia-mood.server.ts";

const countries: Record<string, string> = {
  Prague: "Czechia", Barcelona: "Spain", Vienna: "Austria", Karachi: "Pakistan",
};

function candidate(city: string, role: DestinationMoodRole, id: string): WikimediaMoodCandidate {
  const phrase = {
    cityscape: `${city} skyline architecture cityscape`,
    street: `${city} old town street neighbourhood`,
    scenic: `${city} river sunset park landscape`,
    lifestyle: `${city} public square market street`,
  }[role];
  return {
    src: `https://upload.wikimedia.org/${city}-${id}.jpg`,
    pageUrl: `https://commons.wikimedia.org/wiki/File:${city}-${id}.jpg`,
    fileId: `${city}-${id}`,
    title: phrase,
    description: `Outdoor ${phrase} in ${countries[city]}`,
    categories: [`${city} views`, phrase],
    width: 2200,
    height: 1400,
    source: "wikimedia",
  };
}

for (const city of ["Prague", "Barcelona", "Vienna", "Karachi"]) {
  test(`${city} mood selection is relevant, varied and rejects documentary filler`, () => {
    const roles: DestinationMoodRole[] = ["cityscape", "street", "scenic", "lifestyle"];
    const pools = Object.fromEntries(
      roles.map((role) => [role, [
        candidate(city, role, role),
        { ...candidate(city, role, `${role}-bad`), title: `${city} metro map diagram logo` },
      ]]),
    ) as Record<DestinationMoodRole, WikimediaMoodCandidate[]>;
    const selected = curateMoodCandidates(pools, city, countries[city]);
    assert.equal(selected.length, 4);
    assert.equal(new Set(selected.map((image) => image.role)).size, 4);
    assert.equal(new Set(selected.map((image) => image.fileId)).size, selected.length);
    assert.ok(selected.every((image) => image.title.includes(city)));
    assert.ok(selected.every((image) => !/map|diagram|logo/i.test(image.title)));
  });
}

test("weak, unrelated, low-resolution and interior candidates are rejected", () => {
  const base = candidate("Prague", "cityscape", "base");
  assert.equal(evaluateMoodCandidate({ ...base, title: "Vienna skyline", description: "Austria", categories: ["Vienna views"] }, "Prague", "Czechia", "cityscape").accepted, false);
  assert.equal(evaluateMoodCandidate({ ...base, title: "Prague restaurant interior" }, "Prague", "Czechia", "cityscape").accepted, false);
  assert.equal(evaluateMoodCandidate({ ...base, title: "Prague public square plaque" }, "Prague", "Czechia", "lifestyle").accepted, false);
  assert.equal(evaluateMoodCandidate({ ...base, width: 320, height: 200 }, "Prague", "Czechia", "cityscape").accepted, false);
});
