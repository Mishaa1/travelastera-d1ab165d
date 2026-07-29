import { CITIES } from "@/data/cities";
import { CITY_GAZETTEER, COUNTRY_BY_CODE } from "@/data/locations";
import { normaliseText } from "@/lib/dedupe";

/**
 * Search index behind every Astera location field.
 *
 * Cities, their airports and countries live in one flat list so a single
 * component can power destination, airport, city and country search. The
 * optimiser's own `CITIES` come first (they carry scoring data); the broader
 * offline gazetteer fills in everywhere else a traveller might start from.
 */

export type PlaceKind = "city" | "airport" | "country";

export interface PlaceOption {
  id: string;
  kind: PlaceKind;
  /** What we write into the trip preferences when picked. */
  value: string;
  name: string;
  subtitle: string;
  country: string;
  countryCode: string;
  /** IATA code for airports. */
  code?: string;
  lat?: number;
  lon?: number;
  popular?: boolean;
  /** True when the optimiser can plan a stay here, not just fly from it. */
  plannable?: boolean;
}

/** Regional indicator flag from an ISO-3166 alpha-2 code. */
export function flagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  return String.fromCodePoint(
    ...countryCode
      .toUpperCase()
      .split("")
      .map((char) => 0x1f1a5 + char.charCodeAt(0)),
  );
}

const COUNTRY_NAMES: Record<string, string> = {
  ...COUNTRY_BY_CODE,
  PT: "Portugal",
  ES: "Spain",
  FR: "France",
  CH: "Switzerland",
  SI: "Slovenia",
  CZ: "Czechia",
  AT: "Austria",
  HU: "Hungary",
  PL: "Poland",
  GR: "Greece",
  HR: "Croatia",
  ME: "Montenegro",
  NO: "Norway",
  DK: "Denmark",
  EE: "Estonia",
  NL: "Netherlands",
  IT: "Italy",
  GB: "United Kingdom",
  IE: "Ireland",
  DE: "Germany",
  BE: "Belgium",
  SE: "Sweden",
};

/** Primary airport per optimiser city. Prototype reference data. */
const AIRPORTS: Record<string, { code: string; name: string }> = {
  lisbon: { code: "LIS", name: "Humberto Delgado" },
  porto: { code: "OPO", name: "Francisco Sá Carneiro" },
  seville: { code: "SVQ", name: "Sevilla" },
  granada: { code: "GRX", name: "Federico García Lorca" },
  barcelona: { code: "BCN", name: "El Prat" },
  "san-sebastian": { code: "EAS", name: "San Sebastián" },
  lyon: { code: "LYS", name: "Saint-Exupéry" },
  annecy: { code: "NCY", name: "Annecy Mont-Blanc" },
  interlaken: { code: "BRN", name: "Bern (nearest)" },
  ljubljana: { code: "LJU", name: "Jože Pučnik" },
  prague: { code: "PRG", name: "Václav Havel" },
  vienna: { code: "VIE", name: "Schwechat" },
  budapest: { code: "BUD", name: "Ferenc Liszt" },
  krakow: { code: "KRK", name: "John Paul II" },
  athens: { code: "ATH", name: "Eleftherios Venizelos" },
  naxos: { code: "JNX", name: "Naxos Island" },
  split: { code: "SPU", name: "Split" },
  kotor: { code: "TIV", name: "Tivat" },
  bergen: { code: "BGO", name: "Flesland" },
  copenhagen: { code: "CPH", name: "Kastrup" },
  tallinn: { code: "TLL", name: "Lennart Meri" },
  amsterdam: { code: "AMS", name: "Schiphol" },
  paris: { code: "CDG", name: "Charles de Gaulle" },
  rome: { code: "FCO", name: "Fiumicino" },
  florence: { code: "FLR", name: "Peretola" },
  bologna: { code: "BLQ", name: "Guglielmo Marconi" },
};

const POPULAR_IDS = new Set([
  "city-lisbon",
  "city-barcelona",
  "city-vienna",
  "city-prague",
  "city-rome",
  "city-split",
  "city-copenhagen",
  "city-athens",
]);

/** URL/ID-safe slug for a city name. */
const slugify = (value: string) => normaliseText(value).replace(/\s+/g, "-");

function buildPlaces(): PlaceOption[] {
  const list: PlaceOption[] = [];
  const seenCities = new Set<string>();
  const seenAirports = new Set<string>();

  // 1. Optimiser cities — these can be planned into a route.
  for (const city of CITIES) {
    const airport = AIRPORTS[city.id];
    seenCities.add(normaliseText(city.name));
    list.push({
      id: `city-${city.id}`,
      kind: "city",
      value: city.name,
      name: city.name,
      subtitle: city.country,
      country: city.country,
      countryCode: city.countryCode,
      code: airport?.code,
      lat: city.lat,
      lon: city.lon,
      popular: POPULAR_IDS.has(`city-${city.id}`),
      plannable: true,
    });
    if (airport && !seenAirports.has(airport.code)) {
      seenAirports.add(airport.code);
      list.push({
        id: `air-${airport.code}`,
        kind: "airport",
        value: city.name,
        name: `${airport.name} Airport`,
        subtitle: `${city.name}, ${city.country}`,
        country: city.country,
        countryCode: city.countryCode,
        code: airport.code,
        lat: city.lat,
        lon: city.lon,
      });
    }
  }

  // 2. The wider offline gazetteer — origins, hubs and everything else.
  for (const [name, country, countryCode, lat, lon, airports] of CITY_GAZETTEER) {
    const key = normaliseText(name);
    if (!seenCities.has(key)) {
      seenCities.add(key);
      list.push({
        id: `city-${slugify(name)}`,
        kind: "city",
        value: name,
        name,
        subtitle: country,
        country,
        countryCode,
        code: airports[0]?.[0],
        lat,
        lon,
        popular: ["London", "Paris", "Rome", "Barcelona", "Amsterdam", "Istanbul"].includes(name),
      });
    }
    for (const [code, airportName] of airports) {
      if (seenAirports.has(code)) continue;
      seenAirports.add(code);
      list.push({
        id: `air-${code}`,
        kind: "airport",
        value: name,
        name: airportName,
        subtitle: `${name}, ${country}`,
        country,
        countryCode,
        code,
        lat,
        lon,
      });
    }
  }

  // 3. Countries.
  const countryCodes = new Set(list.map((place) => place.countryCode));
  for (const code of countryCodes) {
    const name = COUNTRY_NAMES[code];
    if (!name) continue;
    const cityCount = list.filter((p) => p.kind === "city" && p.countryCode === code).length;
    list.push({
      id: `country-${code}`,
      kind: "country",
      value: name,
      name,
      subtitle: `${cityCount} ${cityCount === 1 ? "city" : "cities"} in our index`,
      country: name,
      countryCode: code,
    });
  }

  return list;
}

export const PLACES: PlaceOption[] = buildPlaces();

export const PLACE_BY_ID = new Map(PLACES.map((place) => [place.id, place]));

export const POPULAR_PLACES = PLACES.filter((place) => place.popular);

/** Fast lookup by IATA code, e.g. "LHR". */
export const PLACE_BY_CODE = new Map(
  PLACES.filter((place) => place.kind === "airport" && place.code).map((place) => [
    place.code!.toUpperCase(),
    place,
  ]),
);

const KIND_WEIGHT: Record<PlaceKind, number> = { city: 0, airport: 1, country: 2 };

/** Pre-computed, accent-free haystacks so search stays instant. */
const INDEX = PLACES.map((place) => ({
  place,
  name: normaliseText(place.name),
  value: normaliseText(place.value),
  country: normaliseText(place.country),
  code: (place.code ?? "").toLowerCase(),
}));

/** Ranked, accent-insensitive search across cities, airports and countries. */
export function searchPlaces(query: string, limit = 8): PlaceOption[] {
  const q = normaliseText(query);
  if (!q) return POPULAR_PLACES.slice(0, limit);

  return INDEX.map((entry) => {
    let score = -1;
    if (entry.code && entry.code === q) score = 100;
    else if (entry.name === q || entry.value === q) score = 95;
    else if (entry.name.startsWith(q)) score = 90;
    else if (entry.value.startsWith(q)) score = 85;
    else if (entry.code.startsWith(q)) score = 80;
    else if (entry.name.includes(` ${q}`)) score = 70;
    else if (entry.name.includes(q)) score = 60;
    else if (entry.country.startsWith(q)) score = 50;
    else if (entry.country.includes(q)) score = 30;
    // Plannable destinations edge ahead of pure origin hubs.
    if (score >= 0 && entry.place.plannable) score += 3;
    if (score >= 0 && entry.place.popular) score += 2;
    return { place: entry.place, score };
  })
    .filter((item) => item.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        KIND_WEIGHT[a.place.kind] - KIND_WEIGHT[b.place.kind] ||
        a.place.name.localeCompare(b.place.name),
    )
    .slice(0, limit)
    .map((item) => item.place);
}

/** Suggestions shown while a query is too short to rank well. */
export function suggestedPlaces(query: string, limit = 6): PlaceOption[] {
  const results = searchPlaces(query, limit);
  if (results.length >= 3) return results;
  return [...results, ...POPULAR_PLACES.filter((p) => !results.includes(p))].slice(0, limit);
}

/**
 * Best-effort resolution of arbitrary free text to a known place.
 * Accepts "LHR", "london", "London, United Kingdom".
 */
export function resolvePlace(input: string): PlaceOption | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-z]{3}$/i.test(trimmed)) {
    const byCode = PLACE_BY_CODE.get(trimmed.toUpperCase());
    if (byCode) return byCode;
  }
  const head = normaliseText(trimmed.split(",")[0]);
  const exact = INDEX.find((entry) => entry.name === head || entry.value === head);
  if (exact) return exact.place;
  return searchPlaces(trimmed, 1)[0] ?? null;
}
