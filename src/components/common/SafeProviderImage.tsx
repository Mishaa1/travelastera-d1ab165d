import { useEffect, useMemo, useState } from "react";

import {
  NEUTRAL_IMAGE_PLACEHOLDER,
  neutralImage,
  sameImageCity,
  type ImageAsset,
} from "@/lib/images/imageAllocator";

interface Props {
  candidates: ImageAsset[];
  requestedCity?: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  placeholder?: boolean;
  onRenderableChange?: (rendered: boolean, asset: ImageAsset) => void;
}

export function SafeProviderImage({
  candidates,
  requestedCity,
  alt,
  className,
  loading = "lazy",
  placeholder = true,
  onRenderableChange,
}: Props) {
  // Parents commonly construct candidate arrays inline. Depending on the array
  // identity reset the retry index after every failed image, trapping the
  // component on candidate zero. A content signature keeps retries stable.
  const candidateKey = candidates
    .map((asset) => `${asset.resolvedUrl}|${asset.city}|${asset.providerPlaceId ?? ""}`)
    .join("::");
  const approved = useMemo(() => {
    const relevant = candidates.filter((asset) => !requestedCity || sameImageCity(requestedCity, asset));
    const rejected = candidates.filter((asset) => requestedCity && !sameImageCity(requestedCity, asset));
    if (import.meta.env.DEV && rejected.length) {
      console.warn("[image:city-mismatch-rejected]", {
        requestedCity,
        rejected: rejected.map((asset) => ({ city: asset.city, source: asset.source, placeId: asset.providerPlaceId })),
      });
    }
    const values = [
      ...relevant,
      ...(placeholder ? [neutralImage(requestedCity)] : []),
    ];
    return values.filter((asset, index) => values.findIndex((item) => item.resolvedUrl === asset.resolvedUrl) === index);
  // candidateKey intentionally represents the contents rather than the array
  // object, which may be recreated by a parent on every render.
  }, [candidateKey, placeholder, requestedCity]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [candidateKey, placeholder, requestedCity]);
  const asset = approved[index];
  if (!asset) return null;

  return (
    <img
      src={asset.resolvedUrl || NEUTRAL_IMAGE_PLACEHOLDER}
      alt={asset.source === "placeholder" ? `${alt} — image unavailable` : alt}
      loading={loading}
      className={className}
      onLoad={(event) => {
        const renderable = event.currentTarget.naturalWidth > 1 && event.currentTarget.naturalHeight > 1;
        if (!renderable) {
          setIndex((value) => value + 1);
          return;
        }
        onRenderableChange?.(asset.source !== "placeholder", asset);
        if (import.meta.env.DEV) console.info("[image:rendered]", { requestedCity, source: asset.source, selectedCity: asset.city, placeId: asset.providerPlaceId, placeName: asset.placeName, cacheStatus: asset.cacheStatus });
      }}
      onError={() => {
        onRenderableChange?.(false, asset);
        setIndex((value) => value + 1);
      }}
    />
  );
}
