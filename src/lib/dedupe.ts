/**
 * Experience de-duplication.
 *
 * Itineraries are assembled from several independent generators, so the same
 * place can arrive under three different names ("Belvedere Palace", "Upper
 * Belvedere", "Belvedere Museum"). This module gives every record a canonical
 * key and tracks what has already been used, per category, for one trip.
 */

import { devWarn } from "@/lib/date";

export type ExperienceKind =
  | "attraction"
  | "restaurant"
  | "neighbourhood"
  | "daytrip"
  | "activity";

/** Words that carry no distinguishing meaning for a venue name. */
const NOISE_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "de",
  "del",
  "della",
  "di",
  "du",
  "la",
  "le",
  "les",
  "el",
  "das",
  "der",
  "die",
  "und",
  "and",
  "palace",
  "palais",
  "palazzo",
  "museum",
  "museo",
  "musee",
  "gallery",
  "galleries",
  "galerie",
  "castle",
  "chateau",
  "schloss",
  "cathedral",
  "basilica",
  "church",
  "quarter",
  "district",
  "gardens",
  "garden",
  "park",
  "tower",
  "upper",
  "lower",
  "old",
  "new",
  "grand",
  "great",
  "national",
  "royal",
  "city",
  "centre",
  "center",
  "house",
  "hall",
  "square",
  "bridge",
  "market",
  "hill",
  "viewpoint",
  "restaurant",
  "bistro",
  "cafe",
  "bar",
  "tour",
  "trip",
  "visit",
]);

/** Lowercase, de-accent, de-punctuate and collapse whitespace. */
export function normaliseText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The comparable core of a venue name: noise words removed, remaining tokens
 * sorted so word order cannot disguise a duplicate.
 */
export function normaliseVenueName(value: string): string {
  const tokens = normaliseText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !NOISE_WORDS.has(token));
  const meaningful = tokens.length ? tokens : normaliseText(value).split(" ").filter(Boolean);
  return [...new Set(meaningful)].sort().join(" ");
}

export interface DedupeRecord {
  /** Stable canonical ID from the source data, when one exists. */
  id?: string;
  name: string;
  category?: string;
  lat?: number;
  lon?: number;
}

/** ~110 m at the equator — close enough to be the same venue. */
const SAME_PLACE_DEGREES = 0.001;

const sameCoords = (a: DedupeRecord, b: DedupeRecord) =>
  a.lat != null &&
  a.lon != null &&
  b.lat != null &&
  b.lon != null &&
  Math.abs(a.lat - b.lat) < SAME_PLACE_DEGREES &&
  Math.abs(a.lon - b.lon) < SAME_PLACE_DEGREES;

/** Do two normalised names share a distinctive token? ("belvedere") */
function sharesDistinctiveToken(a: string, b: string) {
  if (!a || !b) return false;
  const left = new Set(a.split(" "));
  return b.split(" ").some((token) => token.length >= 5 && left.has(token));
}

/**
 * Tracks everything already placed in one itinerary so the same experience
 * cannot reappear under a different label.
 */
export class ExperienceRegistry {
  private readonly used = new Map<ExperienceKind, DedupeRecord[]>();
  private readonly rejected: { kind: ExperienceKind; reason: string; name: string }[] = [];

  /** Why this record cannot be added, or `null` when it is safe to use. */
  reject(kind: ExperienceKind, record: DedupeRecord): string | null {
    const seen = this.used.get(kind) ?? [];
    const key = normaliseVenueName(record.name);

    for (const entry of seen) {
      if (record.id && entry.id && record.id === entry.id) return "duplicate canonical id";
      const entryKey = normaliseVenueName(entry.name);
      if (key && key === entryKey) return "duplicate normalised name";
      if (sameCoords(record, entry) && (key === entryKey || sharesDistinctiveToken(key, entryKey)))
        return "same location and near-identical name";
      if (
        record.category &&
        entry.category === record.category &&
        sharesDistinctiveToken(key, entryKey)
      )
        return "alias of an existing experience";
    }
    return null;
  }

  has(kind: ExperienceKind, record: DedupeRecord): boolean {
    return this.reject(kind, record) !== null;
  }

  /** Registers the record when it is unique. Returns false when rejected. */
  add(kind: ExperienceKind, record: DedupeRecord): boolean {
    const reason = this.reject(kind, record);
    if (reason) {
      this.rejected.push({ kind, reason, name: record.name });
      devWarn(
        "itinerary",
        `Rejected duplicate ${kind}: "${record.name}"${record.id ? ` (${record.id})` : ""} — ${reason}`,
      );
      return false;
    }
    const seen = this.used.get(kind) ?? [];
    seen.push(record);
    this.used.set(kind, seen);
    return true;
  }

  /** Forces a record in, e.g. an intentionally revisited restaurant. */
  force(kind: ExperienceKind, record: DedupeRecord) {
    const seen = this.used.get(kind) ?? [];
    seen.push(record);
    this.used.set(kind, seen);
  }

  count(kind: ExperienceKind) {
    return this.used.get(kind)?.length ?? 0;
  }

  get rejections() {
    return [...this.rejected];
  }
}

/**
 * Development-only final pass. Logs anything that slipped through so the
 * problem is visible during a build rather than to a traveller.
 */
export function assertUniqueItinerary(
  label: string,
  entries: { kind: ExperienceKind; name: string; id?: string; day?: number }[],
) {
  if (!import.meta.env.DEV) return;
  const registry = new ExperienceRegistry();
  for (const entry of entries) {
    if (registry.has(entry.kind, entry)) {
      devWarn(
        "itinerary-validation",
        `${label}: "${entry.name}" repeats as a ${entry.kind}${entry.day ? ` on day ${entry.day}` : ""}.`,
      );
    } else {
      registry.force(entry.kind, entry);
    }
  }
}
