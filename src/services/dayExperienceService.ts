import {
  ACTIVITY_LABEL,
  CATEGORY_ACTIVITY,
  CATEGORY_LABEL,
  DIET_LABEL,
  getAttractions,
  getRestaurants,
  type Attraction,
  type ExperienceCategory,
  type Restaurant,
} from "@/services/experienceService";
import { resolveExperienceImage } from "@/lib/imagery";
import type { DayPlan, TripPreferences, TripStop } from "@/lib/types";

/**
 * Itinerary experience layer.
 *
 * Turns the optimiser's morning / afternoon / evening lines into image-led,
 * explainable cards. It reuses the existing experience service completely —
 * nothing new is scored here, the periods are only matched to the picks the
 * engine already produced and given a short, human "why".
 */

export type DaySlot = "morning" | "afternoon" | "evening";

export interface DayExperience {
  slot: DaySlot;
  label: string;
  /** Reused Attraction shape so AttractionCard renders it directly. */
  attraction: Attraction;
  /** The original itinerary line, kept intact as the descriptive hook. */
  hook: string;
  tags: string[];
}

export interface DayExperienceSet {
  slots: DayExperience[];
  restaurant: Restaurant | null;
}

const SLOT_LABEL: Record<DaySlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

/** Which categories naturally belong to each part of the day. */
const SLOT_CATEGORIES: Record<DaySlot, ExperienceCategory[]> = {
  morning: ["museum", "market", "landmark", "nature"],
  afternoon: ["landmark", "viewpoint", "nature", "coast", "museum"],
  evening: ["nightlife", "food", "viewpoint", "coast"],
};

const SLOT_TIMING: Record<DaySlot, string> = {
  morning: "Uses the morning period, when queues are usually lighter",
  afternoon: "Sits in the middle of the day, close to where you are already walking",
  evening: "Placed last so the day ends near your dinner and your bed",
};

export const SLOT_BEST_TIME: Record<DaySlot, string> = {
  morning: "Early morning, before the first coach groups arrive",
  afternoon: "Mid-afternoon, when the light is at its best",
  evening: "Late afternoon into the evening",
};

function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

const STYLE_PHRASE: Partial<Record<TripPreferences["travelStyle"], string>> = {
  family: "works for a family day without long transfers",
  couple: "suits a couples' trip at an unhurried pace",
  honeymoon: "keeps the day calm and memorable",
  solo: "is easy and safe to do on your own",
  friends: "works well for a group",
  business: "fits into a short window between commitments",
};

/**
 * One or two concrete factors, drawn only from data the traveller gave us.
 * Never exposes scores or raw optimiser internals.
 */
export function personalisedWhy(
  attraction: Attraction,
  slot: DaySlot,
  prefs: TripPreferences,
): string {
  const chosen = prefs.activities ?? [];
  const matched = CATEGORY_ACTIVITY[attraction.category]
    .filter((activity) => chosen.includes(activity))
    .map((activity) => ACTIVITY_LABEL[activity]);

  const factors: string[] = [];

  if (matched.length) {
    factors.push(`a strong match for your ${listWords(matched.slice(0, 2))} interests`);
  }

  if (factors.length < 2 && prefs.notes?.trim()) {
    const note = prefs.notes.trim();
    factors.push(`it also fits what you told us: “${note.length > 70 ? `${note.slice(0, 67)}…` : note}”`);
  }

  if (factors.length < 2) {
    const style = STYLE_PHRASE[prefs.travelStyle];
    if (style) factors.push(`it ${style}`);
  }

  if (factors.length < 2 && prefs.luxuryLevel === "hostel") {
    factors.push("it keeps the day's spending low");
  }

  if (!factors.length) {
    factors.push(`one of the best-rated things to do in ${attraction.city}`);
  }

  return `${SLOT_TIMING[slot]}, and ${listWords(factors)}.`;
}

function pickForSlot(
  pool: Attraction[],
  slot: DaySlot,
  used: Set<string>,
  offset: number,
): Attraction {
  const wanted = SLOT_CATEGORIES[slot];
  const candidates = pool.filter((item) => !used.has(item.id));
  const bySlot = candidates.filter((item) => wanted.includes(item.category));
  const list = bySlot.length ? bySlot : candidates.length ? candidates : pool;
  return list[offset % list.length];
}

/** Image-led, explained experiences for one itinerary day. */
export function buildDayExperiences(
  day: DayPlan,
  stop: TripStop | undefined,
  prefs: TripPreferences,
): DayExperienceSet {
  if (!stop) return { slots: [], restaurant: null };

  const pool = getAttractions(stop, prefs, 8);
  const restaurants = getRestaurants(stop, prefs, 4);
  const used = new Set<string>();
  const hooks: Record<DaySlot, string> = {
    morning: day.morning,
    afternoon: day.afternoon,
    evening: day.evening,
  };

  const slots = (Object.keys(SLOT_LABEL) as DaySlot[]).map((slot, index) => {
    const base = pickForSlot(pool, slot, used, day.day + index);
    used.add(base.id);

    const image = resolveExperienceImage({
      name: base.name,
      city: base.city,
      category: base.category,
      preferred: base.image,
    });

    const attraction: Attraction = {
      ...base,
      // Unique per day so favourites and story state don't collide.
      id: `${base.id}-d${day.day}-${slot}`,
      image: image.src,
      gallery: image.gallery,
      why: personalisedWhy(base, slot, prefs),
    };

    return {
      slot,
      label: SLOT_LABEL[slot],
      attraction,
      hook: hooks[slot],
      tags: [CATEGORY_LABEL[base.category], ...base.bestFor.slice(0, 1)],
    } satisfies DayExperience;
  });

  const base = restaurants.length ? restaurants[day.day % restaurants.length] : null;
  const restaurant: Restaurant | null = base
    ? {
        ...base,
        id: `${base.id}-d${day.day}`,
        image: resolveExperienceImage({
          name: base.name,
          city: base.city,
          category: "food",
          preferred: base.image,
        }).src,
      }
    : null;

  return { slots, restaurant };
}

/** Short dietary compatibility summary for a food venue. */
export function dietSummary(restaurant: Restaurant, prefs: TripPreferences): string {
  const matches = restaurant.diets.filter((diet) => (prefs.diets ?? []).includes(diet));
  if (!matches.length) return "No specific dietary preference recorded for this trip.";
  return `Can cover your ${listWords(matches.map((diet) => DIET_LABEL[diet].toLowerCase()))} preference.`;
}
