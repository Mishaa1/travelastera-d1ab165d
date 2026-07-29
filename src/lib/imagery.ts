import type { ExperienceCategory } from "@/services/experienceService";

import landmark from "@/assets/exp-landmark.jpg";
import museum from "@/assets/exp-museum.jpg";
import foodImg from "@/assets/exp-food.jpg";
import nature from "@/assets/exp-nature.jpg";
import coast from "@/assets/exp-coast.jpg";
import night from "@/assets/exp-night.jpg";
import market from "@/assets/exp-market.jpg";
import viewpoint from "@/assets/exp-view.jpg";
import heroCoast from "@/assets/hero-coast.jpg";

/**
 * Single place where experience imagery is resolved.
 *
 * Nothing in the UI should hardcode an image URL: it asks for a picture of
 * "this thing, in this city" and gets back a deterministic, stable result.
 * Swapping this module for a real image API later is a one-file change.
 */

export const IMAGE_POOL: Record<ExperienceCategory, string> = {
  landmark,
  museum,
  nature,
  viewpoint,
  market,
  coast,
  nightlife: night,
  food: foodImg,
};

/** Never render an empty grey block — this is the last resort. */
export const IMAGE_FALLBACK = heroCoast;

const ALL_IMAGES = [landmark, museum, nature, viewpoint, market, coast, night, foodImg];

function hash(seed: string): number {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

export interface ImageQuery {
  name: string;
  city: string;
  category?: ExperienceCategory;
  /** Existing image from the data layer; always wins when present. */
  preferred?: string;
}

export interface ResolvedImage {
  src: string;
  alt: string;
  gallery: string[];
}

/** Deterministic image + gallery + alt text for any named place. */
export function resolveExperienceImage(query: ImageQuery): ResolvedImage {
  const { name, city, category, preferred } = query;
  const seed = `${name}|${city}|${category ?? ""}`;
  const base = preferred ?? (category ? IMAGE_POOL[category] : undefined) ?? ALL_IMAGES[hash(seed) % ALL_IMAGES.length] ?? IMAGE_FALLBACK;

  const gallery = [
    base,
    ALL_IMAGES[hash(`${seed}-b`) % ALL_IMAGES.length],
    ALL_IMAGES[hash(`${seed}-c`) % ALL_IMAGES.length],
  ].filter((image, index, list) => list.indexOf(image) === index);

  return {
    src: base,
    alt: `${name} in ${city}`,
    gallery,
  };
}
