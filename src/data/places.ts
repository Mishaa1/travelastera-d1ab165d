import { CITIES } from "@/data/cities";

/**
 * Search index behind every Safara location field.
 *
 * Cities, their primary airports and countries live in one flat list so a
 * single component can power destination, airport, city and country search.
 * Swap `PLACES` for a live gazetteer later — the shape is intentionally thin.
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

/** Primary airport per known city. Prototype reference data. */
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

/** Common departure hubs that are not optimiser destinations. */
const ORIGIN_HUBS: {
  id: string;
  name: string;
  countryCode: string;
  code: string;
  airport: string;
  lat: number;
  lon: number;
}[] = [
  { id: "london", name: "London", countryCode: "GB", code: "LHR", airport: "Heathrow", lat: 51.5072, lon: -0.1276 },
  { id: "manchester", name: "Manchester", countryCode: "GB", code: "MAN", airport: "Manchester", lat: 53.4808, lon: -2.2426 },
  { id: "dublin", name: "Dublin", countryCode: "IE", code: "DUB", airport: "Dublin", lat: 53.3498, lon: -6.2603 },
  { id: "berlin", name: "Berlin", countryCode: "DE", code: "BER", airport: "Brandenburg", lat: 52.52, lon: 13.405 },
  { id: "munich", name: "Munich", countryCode: "DE", code: "MUC", airport: "Franz Josef Strauss", lat: 48.1372, lon: 11.5756 },
  { id: "madrid", name: "Madrid", countryCode: "ES", code: "MAD", airport: "Barajas", lat: 40.4168, lon: -3.7038 },
  { id: "milan", name: "Milan", countryCode: "IT", code: "MXP", airport: "Malpensa", lat: 45.4642, lon: 9.19 },
  { id: "warsaw", name: "Warsaw", countryCode: "PL", code: "WAW", airport: "Chopin", lat: 52.2297, lon: 21.0122 },
  { id: "brussels", name: "Brussels", countryCode: "BE", code: "BRU", airport: "Zaventem", lat: 50.8476, lon: 4.3572 },
  { id: "stockholm", name: "Stockholm", countryCode: "SE", code: "ARN", airport: "Arlanda", lat: 59.3293, lon: 18.0686 },
];

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

function buildPlaces(): PlaceOption[] {
  const list: PlaceOption[] = [];

  for (const city of CITIES) {
    const airport = AIRPORTS[city.id];
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
    });
    if (airport) {
      list.push({
        id: `air-${city.id}`,
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

  for (const hub of ORIGIN_HUBS) {
    const country = COUNTRY_NAMES[hub.countryCode] ?? hub.countryCode;
    list.push({
      id: `city-${hub.id}`,
      kind: "city",
      value: hub.name,
      name: hub.name,
      subtitle: country,
      country,
      countryCode: hub.countryCode,
      code: hub.code,
      lat: hub.lat,
      lon: hub.lon,
      popular: ["london", "dublin", "berlin", "madrid"].includes(hub.id),
    });
    list.push({
      id: `air-${hub.id}`,
      kind: "airport",
      value: hub.name,
      name: `${hub.airport} Airport`,
      subtitle: `${hub.name}, ${country}`,
      country,
      countryCode: hub.countryCode,
      code: hub.code,
      lat: hub.lat,
      lon: hub.lon,
    });
  }

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

const KIND_WEIGHT: Record<PlaceKind, number> = { city: 0, airport: 1, country: 2 };

/** Ranked fuzzy-ish search across cities, airports and countries. */
export function searchPlaces(query: string, limit = 8): PlaceOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return POPULAR_PLACES.slice(0, limit);

  return PLACES.map((place) => {
    const name = place.name.toLowerCase();
    const country = place.country.toLowerCase();
    const code = place.code?.toLowerCase() ?? "";
    let score = -1;
    if (code && code === q) score = 100;
    else if (name.startsWith(q)) score = 90;
    else if (code.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (country.startsWith(q)) score = 50;
    else if (country.includes(q)) score = 30;
    return { place, score };
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
