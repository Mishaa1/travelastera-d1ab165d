import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  allocateTripImages,
  NEUTRAL_IMAGE_PLACEHOLDER,
  selectExactPlaceImage,
  type ImageAsset,
} from "../src/lib/images/imageAllocator.ts";
import type { TripRoute } from "../src/lib/types.ts";

const quality = { source: "live" as const, provider: "Google Places" };
const place = (id: string, city: string, image: string) => ({
  id,
  provider: "google" as const,
  providerPlaceId: id,
  sourceStatus: "google-cache" as const,
  name: `${city} place ${id}`,
  category: "landmark",
  image,
  photoReference: `places/${id}/photos/photo-${id}`,
  lat: 41.38,
  lon: 2.17,
  quality,
});

function route() {
  return {
    id: "image-test",
    countries: ["Portugal", "Spain"],
    itinerary: [
      { day: 1, city: "Lisbon", experiences: [place("lisbon", "Lisbon", "/api/pois/photo?city=Lisbon")] },
      { day: 2, city: "Barcelona", experiences: [place("barcelona", "Barcelona", "/api/pois/photo?city=Barcelona")] },
    ],
    stops: [
      { name: "Lisbon", hotel: { id: "hotel-lisbon", imageUrl: "https://hotel.test/lisbon.jpg" } },
      { name: "Barcelona", hotel: { id: "hotel-barcelona", imageUrl: "https://hotel.test/barcelona.jpg" } },
    ],
  } as unknown as TripRoute;
}

test("Barcelona hero cannot receive a Lisbon-tagged or hotel image", () => {
  const allocation = allocateTripImages(route());
  assert.equal(allocation.overviewHero[0]?.city, "Barcelona");
  assert.equal(allocation.overviewHero[0]?.providerPlaceId, "barcelona");
  assert.notEqual(allocation.overviewHero[0]?.role, "hotel");
  assert.ok(!allocation.overviewHero.some((asset) => asset.city === "Lisbon"));
});

test("changing the final destination invalidates the prior hero allocation", () => {
  const original = route();
  const barcelona = allocateTripImages(original);
  const changed = { ...original, stops: [original.stops[0]], itinerary: [original.itinerary[0]], countries: ["Portugal"] } as TripRoute;
  const lisbon = allocateTripImages(changed);
  assert.equal(barcelona.overviewHero[0]?.city, "Barcelona");
  assert.equal(lisbon.overviewHero[0]?.city, "Lisbon");
  assert.notEqual(barcelona.overviewHero[0]?.id, lisbon.overviewHero[0]?.id);
});

test("exact providerPlaceId image outranks destination imagery", () => {
  const exact: ImageAsset = { id: "exact", source: "google", resolvedUrl: "/exact", city: "Barcelona", providerPlaceId: "venue", role: "venue" };
  const destination: ImageAsset = { id: "city", source: "google", resolvedUrl: "/city", city: "Barcelona", role: "destination" };
  assert.equal(selectExactPlaceImage("venue", [destination], { venue: [exact] })[0], exact);
});

test("all missing provider photos yield one neutral non-pin placeholder", () => {
  const empty = route();
  empty.itinerary.forEach((day) => day.experiences?.forEach((item) => { item.image = undefined; }));
  const allocation = allocateTripImages(empty);
  assert.equal(allocation.overviewHero.length, 1);
  assert.equal(allocation.overviewHero[0]?.resolvedUrl, NEUTRAL_IMAGE_PLACEHOLDER);
  assert.ok(!NEUTRAL_IMAGE_PLACEHOLDER.includes("place-placeholder"));
});

test("photo endpoint caches verified bytes, not temporary redirects or API keys", () => {
  const server = readFileSync("src/lib/places/google-places.server.ts", "utf8");
  const endpoint = readFileSync("src/routes/api/pois/photo.ts", "utf8");
  const clientImage = readFileSync("src/components/common/SafeProviderImage.tsx", "utf8");
  assert.ok(server.includes("google:photo-bytes-v1"));
  assert.ok(server.includes('contentType.startsWith("image/")'));
  assert.ok(!endpoint.includes("Response.redirect"));
  assert.ok(!endpoint.includes("GOOGLE_PLACES_API_KEY"));
  assert.ok(clientImage.includes("setIndex((value) => value + 1)"));
});

test("+N is gated by successful primary and extra renders", () => {
  const gallery = readFileSync("src/components/trip/DayOverviewGallery.tsx", "utf8");
  assert.ok(gallery.includes("primaryRendered && renderedExtras.has(asset.id)"));
  assert.ok(!gallery.includes("providerPhotoPool"));
});
