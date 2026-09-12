import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const requestSchema = z.object({
  destination: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  maxMinutes: z.number().int().min(30).max(240).default(240),
});

type NearbyRow = {
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  population: number | null;
  wikidataId: string;
};

type NearbyResult = NearbyRow & {
  estimatedTravelMinutes: number;
  distanceKm: number;
  modes: ["car"];
  type: string;
  themes: string[];
  suitableFor: Array<"day-trip" | "overnight">;
  provenance: "wikidata-osrm";
  hiddenGem: boolean;
};

const CACHE_TTL_MS = 7 * 24 * 60 * 60_000;
const cache = new Map<string, { expiresAt: number; values: NearbyResult[] }>();
const flights = new Map<string, Promise<NearbyResult[]>>();

const keyFor = (input: z.infer<typeof requestSchema>) =>
  `${input.latitude.toFixed(3)},${input.longitude.toFixed(3)}:${input.maxMinutes}`;

function sparql(input: z.infer<typeof requestSchema>) {
  // Keep this query deliberately shallow. Following the entire P31/P279
  // subclass graph inside a 260 km radius is expensive enough to time out for
  // dense parts of Europe. Population + a small set of direct settlement
  // classes gives us a useful discovery pool; OSRM remains the reachability
  // authority below.
  return `SELECT DISTINCT ?place ?placeLabel ?countryLabel ?countryCode ?coord ?population WHERE {
    SERVICE wikibase:around {
      ?place wdt:P625 ?coord.
      bd:serviceParam wikibase:center "Point(${input.longitude} ${input.latitude})"^^geo:wktLiteral;
                      wikibase:radius "260";
                      wikibase:distance ?distance.
    }
    VALUES ?settlementType { wd:Q515 wd:Q3957 wd:Q1549591 wd:Q174844 }
    ?place wdt:P31 ?settlementType;
           wdt:P17 ?country;
           wdt:P1082 ?population.
    OPTIONAL { ?country wdt:P297 ?countryCode. }
    FILTER(?population >= 5000)
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }
  ORDER BY DESC(?population)
  LIMIT 60`;
}

function point(value: string) {
  const match = value.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  return match ? { lon: Number(match[1]), lat: Number(match[2]) } : null;
}

async function discover(input: z.infer<typeof requestSchema>): Promise<NearbyResult[]> {
  const query = sparql(input);
  const response = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": "ASTERA/1.0 regional-discovery" },
    signal: AbortSignal.timeout(18_000),
  });
  if (!response.ok) throw new Error(`Wikidata nearby discovery failed (${response.status})`);
  const payload = await response.json() as { results?: { bindings?: Array<Record<string, { value: string }>> } };
  const candidates = (payload.results?.bindings ?? []).flatMap((binding) => {
    const coordinate = point(binding.coord?.value ?? "");
    const name = binding.placeLabel?.value?.trim();
    if (!coordinate || !name || name.toLocaleLowerCase("en") === input.destination.toLocaleLowerCase("en")) return [];
    return [{
      name,
      country: binding.countryLabel?.value ?? "",
      countryCode: binding.countryCode?.value ?? "",
      lat: coordinate.lat,
      lon: coordinate.lon,
      population: binding.population ? Number(binding.population.value) : null,
      wikidataId: binding.place?.value?.split("/").at(-1) ?? "",
    } satisfies NearbyRow];
  }).filter((candidate, index, all) =>
    Number.isFinite(candidate.lat) && Number.isFinite(candidate.lon) &&
    all.findIndex((other) => other.name.toLocaleLowerCase("en") === candidate.name.toLocaleLowerCase("en")) === index,
  ).slice(0, 35);
  if (!candidates.length) return [];

  const coordinates = [
    `${input.longitude},${input.latitude}`,
    ...candidates.map((candidate) => `${candidate.lon},${candidate.lat}`),
  ].join(";");
  const tableResponse = await fetch(`https://router.project-osrm.org/table/v1/driving/${coordinates}?sources=0&annotations=duration,distance`, {
    headers: { "User-Agent": "ASTERA/1.0 regional-discovery" },
    signal: AbortSignal.timeout(18_000),
  });
  if (!tableResponse.ok) throw new Error(`OSRM regional validation failed (${tableResponse.status})`);
  const table = await tableResponse.json() as { durations?: Array<Array<number | null>>; distances?: Array<Array<number | null>> };
  const durations = table.durations?.[0]?.slice(1) ?? [];
  const distances = table.distances?.[0]?.slice(1) ?? [];

  return candidates.flatMap((candidate, index) => {
    const seconds = durations[index];
    const metres = distances[index];
    if (seconds == null || metres == null) return [];
    const minutes = Math.round(seconds / 60);
    if (minutes < 20 || minutes > input.maxMinutes) return [];
    const population = candidate.population ?? 0;
    const hiddenGem = population > 0 && population < 120_000;
    const type = population >= 700_000 ? "major-nearby-city" : hiddenGem ? "historic-town" : "nearby-city";
    return [{
      ...candidate,
      estimatedTravelMinutes: minutes,
      distanceKm: Math.round(metres / 1000),
      modes: ["car"],
      type,
      themes: hiddenGem
        ? ["hidden-gems", "history", "food", "photography"]
        : ["culture", "food", "history", "photography"],
      suitableFor: minutes <= 120 ? ["day-trip", "overnight"] : ["overnight"],
      provenance: "wikidata-osrm",
      hiddenGem,
    } satisfies NearbyResult];
  }).sort((left, right) => left.estimatedTravelMinutes - right.estimatedTravelMinutes).slice(0, 14);
}

async function cachedDiscovery(input: z.infer<typeof requestSchema>) {
  const key = keyFor(input);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return { values: hit.values, cacheStatus: "hit" as const };
  const running = flights.get(key);
  if (running) return { values: await running, cacheStatus: "coalesced" as const };
  const promise = discover(input).finally(() => flights.delete(key));
  flights.set(key, promise);
  const values = await promise;
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, values });
  return { values, cacheStatus: "miss" as const };
}

export const Route = createFileRoute("/api/regions/nearby")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid nearby-destination request" }, { status: 400 });
        try {
          const result = await cachedDiscovery(parsed.data);
          return Response.json({ destinations: result.values, source: "Wikidata + OSRM", cacheStatus: result.cacheStatus });
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Regional discovery failed", destinations: [] }, { status: 502 });
        }
      },
    },
  },
});
