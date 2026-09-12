import type { DayExperience } from "@/services/dayExperienceService";

const memory = new Map<string, Record<string, string>>();
const prefix = "astera:destination-stories:v1:";

function destinationKey(destination: string) {
  return `${prefix}${destination.trim().toLocaleLowerCase("en")}`;
}

function read(destination: string) {
  const key = destinationKey(destination);
  const existing = memory.get(key);
  if (existing) return existing;
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, string>;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return {};
  }
}

function write(destination: string, value: Record<string, string>) {
  const key = destinationKey(destination);
  memory.set(key, value);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or storage quotas should not block the itinerary.
  }
}

/**
 * Creates editorial connective copy from an already-grounded POI. It never
 * fetches, names or invents a venue; the result is cached per destination and
 * provider ID so repeated renders are free and stable.
 */
export function cinematicStory(destination: string, experience: DayExperience) {
  const id = experience.attraction.providerPlaceId!;
  const cached = read(destination);
  if (cached[id]) return cached[id];
  const place = experience.attraction;
  const factualContext = experience.hook || place.historicNote || place.location;
  const paragraph = `${factualContext.replace(/[.!?]+$/, "")}. Give ${place.name} time to unfold: arrive without rushing, notice the details, and let this become the moment that gives ${destination} its rhythm.`;
  write(destination, { ...cached, [id]: paragraph });
  return paragraph;
}

/** Cache any deterministic editorial sentence alongside the destination's POI stories. */
export function cachedEditorialText(destination: string, key: string, create: () => string) {
  const cached = read(destination);
  const storageKey = `editorial:${key}`;
  if (cached[storageKey]) return cached[storageKey];
  const value = create();
  write(destination, { ...cached, [storageKey]: value });
  return value;
}
