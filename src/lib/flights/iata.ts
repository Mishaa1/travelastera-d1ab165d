import { CITY_GAZETTEER } from "@/data/locations";

/**
 * Resolves free text ("London", "lhr", "Paris CDG") to a single IATA code.
 * Client-safe: it only reads the bundled gazetteer.
 */

const CODE_SET = new Set<string>();
const CITY_TO_CODE = new Map<string, string>();

for (const [city, , , , , airports] of CITY_GAZETTEER) {
  const primary = airports[0]?.[0];
  if (primary) CITY_TO_CODE.set(city.toLowerCase(), primary);
  for (const [code] of airports) CODE_SET.add(code);
}

export function toIataCode(input: string): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;

  const upper = value.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper) && CODE_SET.has(upper)) return upper;

  const direct = CITY_TO_CODE.get(value.toLowerCase());
  if (direct) return direct;

  // "Paris, France" or "London Heathrow" — try the leading token(s).
  const head = value.split(/[,·(]/)[0]?.trim().toLowerCase();
  if (head && CITY_TO_CODE.get(head)) return CITY_TO_CODE.get(head)!;

  const embedded = upper.match(/\b([A-Z]{3})\b/);
  if (embedded && CODE_SET.has(embedded[1])) return embedded[1];

  return null;
}

export const hasIataCode = (input: string) => toIataCode(input) !== null;
