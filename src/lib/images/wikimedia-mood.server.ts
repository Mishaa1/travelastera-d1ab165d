export type DestinationMoodRole = "cityscape" | "street" | "scenic" | "lifestyle";

export interface WikimediaMoodImage {
  src: string;
  pageUrl: string;
  fileId: string;
  title: string;
  creator?: string;
  license?: string;
  categories: string[];
  coordinates?: { lat: number; lon: number };
  width: number;
  height: number;
  role: DestinationMoodRole;
  relevanceScore: number;
  source: "wikimedia";
}

export interface WikimediaMoodCandidate extends Omit<WikimediaMoodImage, "role" | "relevanceScore"> {
  description?: string;
}

interface CommonsPage {
  pageid?: number;
  title?: string;
  imageinfo?: Array<{
    thumburl?: string;
    url?: string;
    descriptionurl?: string;
    width?: number;
    height?: number;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}

interface CommonsResponse { query?: { pages?: Record<string, CommonsPage> } }

const VERSION = process.env.DESTINATION_MOOD_IMAGE_VERSION?.trim() || "6";
const TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const cache = new Map<string, { expiresAt: number; images: WikimediaMoodImage[] }>();
const flights = new Map<string, Promise<WikimediaMoodImage[]>>();

const ROLE_QUERIES: Record<DestinationMoodRole, string[]> = {
  cityscape: ["skyline", "cityscape", "architecture"],
  street: ["old town street", "neighbourhood street"],
  scenic: ["river sunset", "park landscape", "scenic view"],
  lifestyle: ["market street", "public square", "cafe exterior"],
};

const ROLE_TERMS: Record<DestinationMoodRole, RegExp> = {
  cityscape: /skyline|cityscape|panorama|architecture|cathedral|palace|tower|old town/i,
  street: /street|lane|alley|neighbou?rhood|quarter|boulevard|avenue|old town/i,
  scenic: /river|waterfront|park|garden|landscape|sunset|view|lake|harbou?r|coast/i,
  lifestyle: /market|public square|plaza|cafe exterior|coffeehouse|pedestrian|promenade/i,
};

const CITY_ROLE_QUERIES: Record<string, Record<DestinationMoodRole, string[]>> = {
  prague: {
    cityscape: ["Prague skyline", "Prague Castle panorama"],
    street: ["Prague Old Town street", "Malá Strana street"],
    scenic: ["Charles Bridge Vltava sunset", "Prague river panorama"],
    lifestyle: ["Prague Old Town Square", "Prague market street"],
  },
  barcelona: {
    cityscape: ["Barcelona skyline", "Sagrada Familia cityscape"],
    street: ["Barcelona Gothic Quarter street", "Barcelona La Rambla street"],
    scenic: ["Barcelona Montjuic panorama", "Barcelona waterfront sunset"],
    lifestyle: ["Barcelona Boqueria market exterior", "Barcelona public square"],
  },
  vienna: {
    cityscape: ["Vienna skyline architecture", "Vienna historic centre panorama"],
    street: ["Vienna old town street", "Vienna Ringstrasse street"],
    scenic: ["Vienna Danube sunset", "Vienna park landscape"],
    lifestyle: ["Vienna Naschmarkt exterior", "Vienna public square"],
  },
  karachi: {
    cityscape: ["Karachi skyline", "Karachi architecture cityscape"],
    street: ["Karachi Saddar street", "Karachi neighbourhood street"],
    scenic: ["Karachi Clifton beach sunset", "Karachi waterfront landscape"],
    lifestyle: ["Karachi market street", "Karachi public square"],
  },
  split: {
    cityscape: ["Split Croatia skyline", "Diocletian Palace Split panorama"],
    street: ["Split Croatia old town street", "Diocletian Palace street Split"],
    scenic: ["Split Riva waterfront sunset", "Marjan Split panorama"],
    lifestyle: ["Split Riva promenade", "Split Croatia Pjaca square"],
  },
};

const DENY = /restaurant interior|interior of|dish|plate of|food close.?up|menu|logo|coat of arms|flag|\bmap\b|diagram|floor plan|transit plan|metro map|screenshot|poster|advertisement|\bsign\b|bus stop|street sign|plaque|memorial tablet|commemorative stone|ticket|document|portrait of|product photo|construction|crane|scaffolding|statue close.?up|sculpture detail|demonstration|protest|rally|unidentified building|traffic|car park|parking lot|vehicle|bus station|\.svg\b|\.pdf\b|\bscan\b|black and white|monochrome/i;
const LANDMARKS: Record<string, string[]> = {
  prague: ["charles bridge", "old town square", "vltava", "prague castle", "malá strana", "mala strana"],
  barcelona: ["sagrada família", "sagrada familia", "park güell", "park guell", "gothic quarter", "montjuïc", "montjuic", "barceloneta"],
  vienna: ["schönbrunn", "schonbrunn", "stephansdom", "st stephen", "belvedere", "ringstrasse", "danube"],
  karachi: ["clifton", "mohatta", "frere hall", "mazar-e-quaid", "quaid-e-azam", "kemari", "saddar"],
  split: ["diocletian", "riva", "marjan", "peristyle", "peristil", "pjaca", "sveti duje", "saint domnius"],
};

function plain(value?: string) {
  return value?.replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
}

function metadataText(candidate: WikimediaMoodCandidate) {
  return [candidate.title, candidate.description, ...candidate.categories].filter(Boolean).join(" ");
}

export function evaluateMoodCandidate(
  candidate: WikimediaMoodCandidate,
  city: string,
  country: string,
  role: DestinationMoodRole,
) {
  const text = metadataText(candidate);
  const normalized = text.toLocaleLowerCase("en");
  const cityKey = city.trim().toLocaleLowerCase("en");
  const reasons: string[] = [];
  if (DENY.test(text)) reasons.push("denied metadata term");
  if (candidate.width < 700 || candidate.height < 450) reasons.push("low resolution");
  const cityMatch = normalized.includes(cityKey);
  const landmarkMatch = (LANDMARKS[cityKey] ?? []).some((name) => normalized.includes(name));
  if (!cityMatch && !landmarkMatch) reasons.push("weak destination relevance");
  if (role !== "lifestyle" && /restaurant|cafe|food|meal|kitchen|interior/i.test(text))
    reasons.push("interior or food outside lifestyle role");
  if (role === "lifestyle" && /dish|plate|meal|food close.?up|restaurant interior/i.test(text))
    reasons.push("isolated food or restaurant interior");
  const cityRoleSignals = CITY_ROLE_QUERIES[cityKey]?.[role] ?? [];
  const cityRoleMatch = cityRoleSignals.some((query) =>
    query.toLocaleLowerCase("en").split(/\s+/).filter((word) => word.length > 4 && word !== cityKey).some((word) => normalized.includes(word)),
  );
  if (!ROLE_TERMS[role].test(text) && !cityRoleMatch) reasons.push(`weak ${role} role match`);

  let score = 0;
  if (cityMatch) score += 45;
  if (landmarkMatch) score += 28;
  if (country && normalized.includes(country.toLocaleLowerCase("en"))) score += 6;
  if (ROLE_TERMS[role].test(text) || cityRoleMatch) score += 24;
  if (candidate.width > candidate.height) score += 12;
  if (candidate.width >= 1600) score += 8;
  if (/outdoor|exterior|street|skyline|cityscape|panorama|river|park|sunset|architecture/i.test(text)) score += 10;
  if (/sunset|golden hour|evening light|dusk/i.test(text)) score += 4;
  if (/featured picture|quality image|valued image/i.test(text)) score += 16;
  if (candidate.height > candidate.width) score -= 5;
  return { accepted: reasons.length === 0 && score >= 70, score, rejectionReasons: reasons };
}

export function curateMoodCandidates(
  candidatesByRole: Record<DestinationMoodRole, WikimediaMoodCandidate[]>,
  city: string,
  country = "",
) {
  const selected: WikimediaMoodImage[] = [];
  const usedFiles = new Set<string>();
  for (const role of Object.keys(ROLE_QUERIES) as DestinationMoodRole[]) {
    const ranked = candidatesByRole[role]
      .map((candidate) => ({ candidate, result: evaluateMoodCandidate(candidate, city, country, role) }))
      .filter(({ result }) => result.accepted)
      .sort((a, b) => b.result.score - a.result.score);
    const pick = ranked.find(({ candidate }) => !usedFiles.has(candidate.fileId));
    if (!pick) continue;
    usedFiles.add(pick.candidate.fileId);
    selected.push({ ...pick.candidate, role, relevanceScore: pick.result.score });
  }
  return selected;
}

async function searchRole(city: string, role: DestinationMoodRole) {
  const cityKey = city.trim().toLocaleLowerCase("en");
  const roleQueries = CITY_ROLE_QUERIES[cityKey]?.[role] ?? ROLE_QUERIES[role].map((term) => `${city} ${term}`);
  const query = roleQueries.map((term) => `(${term})`).join(" OR ");
  const params = new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search",
    gsrnamespace: "6", gsrlimit: "24", gsrsearch: `${query} -map -logo -poster -interior`,
    prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "1100",
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "Api-User-Agent": "ASTERA/1.0 (curated destination mood imagery)" },
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) throw new Error(`Wikimedia ${role} search failed (${response.status})`);
  const payload = (await response.json()) as CommonsResponse;
  return Object.values(payload.query?.pages ?? {}).map((page): WikimediaMoodCandidate | null => {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const src = info?.thumburl ?? info?.url;
    if (!src || !/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(src)) return null;
    const lat = Number(meta.GPSLatitude?.value);
    const lon = Number(meta.GPSLongitude?.value);
    return {
      src,
      pageUrl: info?.descriptionurl ?? `https://commons.wikimedia.org/?curid=${page.pageid}`,
      fileId: String(page.pageid ?? page.title ?? src),
      title: page.title?.replace(/^File:/, "").replace(/\.[^.]+$/, "") ?? city,
      description: plain(meta.ImageDescription?.value),
      creator: plain(meta.Artist?.value),
      license: plain(meta.LicenseShortName?.value),
      categories: (plain(meta.Categories?.value) ?? "").split("|").map((item) => item.trim()).filter(Boolean),
      coordinates: Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : undefined,
      width: info?.width ?? 0,
      height: info?.height ?? 0,
      source: "wikimedia",
    };
  }).filter((image): image is WikimediaMoodCandidate => Boolean(image));
}

export async function getWikimediaMoodImages(city: string, country = "") {
  const key = `${VERSION}:${city.trim().toLocaleLowerCase("en")}:${country.trim().toLocaleLowerCase("en")}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    if (process.env.NODE_ENV !== "production") console.info("[destination-mood]", { city, country, version: VERSION, cache: "hit", selected: hit.images.map(({ role, fileId, title, categories, coordinates, relevanceScore }) => ({ role, source: "wikimedia", fileId, title, categories, coordinates, relevanceScore })) });
    return { images: hit.images, cacheStatus: "hit" as const, version: VERSION };
  }
  const existing = flights.get(key);
  if (existing) return { images: await existing, cacheStatus: "coalesced" as const, version: VERSION };
  const request = Promise.all(
    (Object.keys(ROLE_QUERIES) as DestinationMoodRole[]).map(async (role) => [role, await searchRole(city, role)] as const),
  ).then((entries) => {
    const pools = Object.fromEntries(entries) as Record<DestinationMoodRole, WikimediaMoodCandidate[]>;
    if (process.env.NODE_ENV !== "production") {
      const rejected = entries.flatMap(([role, candidates]) => candidates.map((candidate) => ({
        requestedCity: city,
        role,
        source: "wikimedia",
        fileId: candidate.fileId,
        title: candidate.title,
        categories: candidate.categories,
        coordinates: candidate.coordinates,
        ...evaluateMoodCandidate(candidate, city, country, role),
      }))).filter((item) => !item.accepted);
      console.info("[destination-mood:rejected]", rejected);
    }
    return curateMoodCandidates(pools, city, country);
  });
  flights.set(key, request);
  try {
    const images = await request;
    cache.set(key, { images, expiresAt: Date.now() + TTL_MS });
    if (process.env.NODE_ENV !== "production") console.info("[destination-mood]", { city, country, version: VERSION, cache: "miss", selected: images.map(({ role, fileId, title, categories, coordinates, relevanceScore }) => ({ role, source: "wikimedia", fileId, title, categories, coordinates, relevanceScore })) });
    return { images, cacheStatus: "miss" as const, version: VERSION };
  } finally { flights.delete(key); }
}
