import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { IMAGE_FALLBACK } from "@/lib/imagery";
import { cn } from "@/lib/utils";

interface ExperienceImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Tailwind aspect ratio class; landscape by default. */
  ratioClassName?: string;
  width?: number;
  height?: number;
  /** Adds the dark bottom gradient used behind overlaid labels. */
  overlay?: boolean;
  children?: React.ReactNode;
  zoomOnHover?: boolean;
}

/**
 * Image with a refined skeleton, graceful fallback and consistent
 * landscape cropping. Used everywhere an experience picture appears.
 */
export function ExperienceImage({
  src,
  alt,
  className,
  ratioClassName = "aspect-[4/3]",
  width = 1280,
  height = 960,
  overlay = false,
  children,
  zoomOnHover = true,
}: ExperienceImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState(src || IMAGE_FALLBACK);

  return (
    <div className={cn("relative overflow-hidden bg-secondary/60", ratioClassName, className)}>
      {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
      <img
        src={source}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (source !== IMAGE_FALLBACK) setSource(IMAGE_FALLBACK);
          setLoaded(true);
        }}
        className={cn(
          "h-full w-full object-cover transition-[transform,opacity] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          loaded ? "opacity-100" : "opacity-0",
          zoomOnHover && "group-hover:scale-[1.04]",
        )}
      />
      {overlay && (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent"
        />
      )}
      {children}
    </div>
  );
}
