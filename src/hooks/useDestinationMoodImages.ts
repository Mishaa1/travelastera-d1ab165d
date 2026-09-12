import { useEffect, useState } from "react";

import type { ImageAsset } from "@/lib/images/imageAllocator";

type MoodPayload = {
  images?: Array<{
    src?: string;
    fileId?: string;
    title?: string;
    pageUrl?: string;
    role?: string;
  }>;
};

const memoryCache = new Map<string, ImageAsset[]>();
const inFlight = new Map<string, Promise<ImageAsset[]>>();

function loadMoodImages(city: string, country: string) {
  const key = `${city.trim().toLowerCase()}::${country.trim().toLowerCase()}`;
  const cached = memoryCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = fetch(
    `/api/images/mood?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`,
  )
    .then((response) => (response.ok ? response.json() : ({ images: [] } as MoodPayload)))
    .then((payload: MoodPayload) =>
      (payload.images ?? [])
        .filter((image): image is typeof image & { src: string } => Boolean(image.src))
        .map((image): ImageAsset => ({
          id: `wikimedia:${image.fileId ?? image.src}`,
          source: "wikimedia",
          sourceReference: image.fileId,
          resolvedUrl: image.src,
          city,
          placeName: image.title ?? `${city} atmosphere`,
          role: "editorial",
          cacheStatus: "cached-reference",
        })),
    )
    .catch(() => [] as ImageAsset[])
    .then((images) => {
      memoryCache.set(key, images);
      inFlight.delete(key);
      return images;
    });

  inFlight.set(key, request);
  return request;
}

/**
 * Browser-side, single-flight access to the server's long-lived curated
 * Wikimedia cache. It never performs a Google Places request.
 */
export function useDestinationMoodImages(city: string, country = "") {
  const key = `${city.trim().toLowerCase()}::${country.trim().toLowerCase()}`;
  const [images, setImages] = useState<ImageAsset[]>(() => memoryCache.get(key) ?? []);

  useEffect(() => {
    let active = true;
    setImages(memoryCache.get(key) ?? []);
    if (!city.trim()) return () => { active = false; };
    void loadMoodImages(city, country).then((next) => {
      if (active) setImages(next);
    });
    return () => { active = false; };
  }, [city, country, key]);

  return images;
}
