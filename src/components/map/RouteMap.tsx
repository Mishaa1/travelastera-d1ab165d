import { Suspense, lazy, useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { GeoPoint } from "@/lib/types";

const RouteMapGL = lazy(() => import("@/components/map/RouteMapGL"));

interface RouteMapProps {
  points: (GeoPoint & { name: string })[];
  className?: string;
}

/** SSR-safe wrapper: MapLibre only ever loads in the browser. */
export function RouteMap({ points, className = "h-[360px] w-full rounded-3xl" }: RouteMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <Skeleton className={className} />;

  return (
    <Suspense fallback={<Skeleton className={className} />}>
      <RouteMapGL points={points} className={`${className} overflow-hidden`} />
    </Suspense>
  );
}
