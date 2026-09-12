import { LIVE_QUALITY } from "@/api/config";
import type { PlannedExperience, PlannedRestaurant } from "@/lib/types";

const BASE_URL = "https://api.opentripmap.com/0.1/en/places";

interface PlaceListItem {
  xid: string;
  name?: string;
  kinds?: string;
  point?: { lat?: number; lon?: number };
}

interface PlaceDetail extends PlaceListItem {
  preview?: { source?: string };
  wikipedia_extracts?: { text?: string };
}

interface CommonsResponse {
  query?: {
    pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string }[] }>;
  };
}

const key = () => process.env.OPENTRIPMAP_API_KEY?.trim() ?? "";
const commonsCache = new Map<string, string | undefined>();

function isFood(kinds = "") {
  return /foods|restaurants|cafes|pubs/.test(kinds);
}

async function details(xid: string): Promise<PlaceDetail | null> {
  const response = await fetch(`${BASE_URL}/xid/${encodeURIComponent(xid)}?apikey=${key()}`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;
  return (await response.json()) as PlaceDetail;
}

async function wikimediaImage(lat?: number, lon?: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  const cacheKey = `${lat!.toFixed(3)},${lon!.toFixed(3)}`;
  if (commonsCache.has(cacheKey)) return commonsCache.get(cacheKey);
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "geosearch",
    ggsprimary: "all",
    ggsnamespace: "6",
    ggsradius: "750",
    ggscoord: `${lat}|${lon}`,
    ggslimit: "1",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "960",
  });
  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      signal: AbortSignal.timeout(4_000),
      headers: { "Api-User-Agent": "ASTERA/1.0 (travel planner image fallback)" },
    });
    const payload = response.ok ? ((await response.json()) as CommonsResponse) : null;
    const page = Object.values(payload?.query?.pages ?? {})[0];
    const image = page?.imageinfo?.[0]?.thumburl ?? page?.imageinfo?.[0]?.url;
    commonsCache.set(cacheKey, image);
    return image;
  } catch {
    commonsCache.set(cacheKey, undefined);
    return undefined;
  }
}

export const openTripMapProvider = {
  isConfigured: () => Boolean(key()),

  async search(latitude: number, longitude: number) {
    const params = new URLSearchParams({
      radius: "12000",
      lon: String(longitude),
      lat: String(latitude),
      rate: "2",
      kinds: "interesting_places,cultural,historic,architecture,natural,museums,view_points,foods",
      limit: "28",
      format: "json",
      apikey: key(),
    });
    const response = await fetch(`${BASE_URL}/radius?${params}`, {
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) throw new Error(`OpenTripMap search failed (${response.status})`);
    const list = ((await response.json()) as PlaceListItem[]).filter(
      (place) => place.xid && place.name?.trim(),
    );
    const selected = list.slice(0, 16);
    const enriched = await Promise.all(selected.map((place) => details(place.xid)));

    const experiences: PlannedExperience[] = [];
    const restaurants: PlannedRestaurant[] = [];
    for (const place of enriched.filter((item): item is PlaceDetail =>
      Boolean(item?.name?.trim()),
    )) {
      const image =
        place.preview?.source ?? (await wikimediaImage(place.point?.lat, place.point?.lon));
      const common = {
        id: place.xid,
        provider: "opentripmap" as const,
        providerPlaceId: place.xid,
        sourceStatus: "opentripmap-live" as const,
        name: place.name!.trim(),
        image,
        description: place.wikipedia_extracts?.text?.slice(0, 360),
        lat: place.point?.lat,
        lon: place.point?.lon,
        quality: LIVE_QUALITY("OpenTripMap"),
      };
      if (isFood(place.kinds)) restaurants.push(common);
      else {
        experiences.push({
          ...common,
          category: place.kinds?.split(",")[0] || "attraction",
        });
      }
    }
    return { experiences: experiences.slice(0, 12), restaurants: restaurants.slice(0, 6) };
  },
};
