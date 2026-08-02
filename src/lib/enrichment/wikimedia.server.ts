import { LIVE_QUALITY } from "@/api/config";
import type { DataQuality } from "@/lib/types";

/**
 * Wikimedia enrichment for real images and summaries.
 *
 * Fetches a thumbnail and short extract for a landmark or city from Wikipedia.
 * No API key is required for public read endpoints, but one can be sent in the
 * User-Agent for higher rate limits if configured.
 */

export interface WikimediaResult {
  title: string;
  extract?: string;
  thumbnailUrl?: string;
  pageUrl?: string;
  quality: DataQuality;
}

const SUMMARY_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary";
const IMAGES_BASE = "https://en.wikipedia.org/w/api.php";
const REQUEST_TIMEOUT_MS = 8_000;

export function isWikimediaConfigured(): boolean {
  // Always usable for public reads; the key is optional.
  return true;
}

export async function lookupWikimedia(query: string): Promise<WikimediaResult | null> {
  const title = query.trim();
  if (!title) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const [summary, images] = await Promise.all([
      fetchSummary(title, controller.signal),
      fetchThumbnail(title, controller.signal),
    ]);

    if (!summary && !images) return null;

    return {
      title,
      extract: summary?.extract,
      thumbnailUrl: images?.thumbnailUrl ?? summary?.thumbnail?.source,
      pageUrl:
        summary?.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      quality: LIVE_QUALITY("Wikimedia"),
    };
  } catch (error) {
    console.error("Wikimedia lookup failed", title, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface SummaryResponse {
  title?: string;
  extract?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

async function fetchSummary(title: string, signal: AbortSignal): Promise<SummaryResponse | null> {
  const response = await fetch(`${SUMMARY_BASE}/${encodeURIComponent(title)}`, {
    signal,
    headers: {
      Accept: "application/json",
      "User-Agent": userAgent(),
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Wikimedia summary failed (${response.status})`);
  return (await response.json()) as SummaryResponse;
}

interface ImagesResponse {
  query?: {
    pages?: Record<
      string,
      {
        pageimage?: string;
        thumbnail?: { source?: string };
      }
    >;
  };
}

async function fetchThumbnail(
  title: string,
  signal: AbortSignal,
): Promise<{ thumbnailUrl?: string } | null> {
  const response = await fetch(
    `${IMAGES_BASE}?action=query&prop=pageimages&titles=${encodeURIComponent(title)}&pithumbsize=800&format=json&origin=*`,
    { signal, headers: { "User-Agent": userAgent() } },
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as ImagesResponse;
  const page = Object.values(payload.query?.pages ?? {})[0];
  if (!page?.thumbnail?.source) return null;
  return { thumbnailUrl: page.thumbnail.source };
}

function userAgent(): string {
  const key = process.env.WIKIMEDIA_API_KEY;
  return key
    ? `AsteraTravel/1.0 (contact@astera.lovable.app; key=${key})`
    : "AsteraTravel/1.0 (contact@astera.lovable.app)";
}
