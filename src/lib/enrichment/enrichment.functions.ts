import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { generateWhyCopy, isOpenRouterConfigured } from "@/lib/enrichment/openrouter.server";
import { lookupWikimedia, isWikimediaConfigured } from "@/lib/enrichment/wikimedia.server";
import { searchPlaces, isGooglePlacesConfigured } from "@/lib/enrichment/google-places.server";

/**
 * Enrichment server functions.
 *
 * These are thin RPC wrappers around the provider helpers. They let client
 * components request real-world images, summaries and personalised copy
 * without exposing API keys.
 */

const WikimediaInput = z.object({ query: z.string().min(1).max(120) });

export const enrichWikimedia = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => WikimediaInput.parse(input))
  .handler(async ({ data }) => {
    const result = await lookupWikimedia(data.query);
    return { result, configured: isWikimediaConfigured() };
  });

const PlacesInput = z.object({
  query: z.string().min(1).max(160),
  limit: z.number().int().min(1).max(10).default(5),
});

export const enrichPlaces = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PlacesInput.parse(input))
  .handler(async ({ data }) => {
    if (!isGooglePlacesConfigured()) {
      return { places: [], configured: false };
    }
    const places = await searchPlaces(data.query, data.limit);
    return { places, configured: true };
  });

const WhyCopyInput = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
  travellerStyle: z.string().min(1),
  interests: z.array(z.string()).min(1),
  diets: z.array(z.string()).default([]),
  pace: z.string().min(1),
  luxuryLevel: z.string().min(1),
  stopNumber: z.number().int().min(1),
  totalStops: z.number().int().min(1),
});

export const enrichWhyCopy = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => WhyCopyInput.parse(input))
  .handler(async ({ data }) => {
    if (!isOpenRouterConfigured()) {
      return { text: "", configured: false };
    }
    const { text, quality } = await generateWhyCopy(data);
    return { text, configured: true, quality };
  });
