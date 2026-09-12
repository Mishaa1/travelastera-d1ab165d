import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { boundsOf, routeGeoJson } from "../src/services/mapService.ts";

test("Paris to Prague bounds include the complete route", () => {
  const points = [{ lat: 48.8566, lon: 2.3522 }, { lat: 50.0755, lon: 14.4378 }];
  const bounds = boundsOf(points);
  assert.deepEqual(bounds, { minLat: 48.8566, maxLat: 50.0755, minLon: 2.3522, maxLon: 14.4378 });
  assert.deepEqual(routeGeoJson(points).features[0]?.geometry.coordinates, [[2.3522, 48.8566], [14.4378, 50.0755]]);
});

test("Paris to Prague to Vienna preserves route order", () => {
  const points = [{ lat: 48.8566, lon: 2.3522 }, { lat: 50.0755, lon: 14.4378 }, { lat: 48.2082, lon: 16.3738 }];
  assert.deepEqual(routeGeoJson(points).features[0]?.geometry.coordinates, [[2.3522, 48.8566], [14.4378, 50.0755], [16.3738, 48.2082]]);
});

test("map implementation keeps highlights opt-in and popups click-only", () => {
  const source = readFileSync("src/components/map/RouteMapGL.tsx", "utf8");
  assert.ok(source.includes('point.kind === "highlight" && !showHighlights'));
  assert.ok(source.includes('setShowHighlights((value) => !value)'));
  assert.ok(source.includes('element.addEventListener("click"'));
  assert.ok(!source.includes(".setPopup("));
  assert.ok(source.includes("partialRoute(routePoints, progress)"));
  assert.ok(source.includes("fitBounds"));
});
