import { Suspense, lazy, useEffect, useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { GeoPoint } from "@/lib/types";

const RouteMapGL = lazy(() => import("@/components/map/RouteMapGL"));

export type RouteMapPoint = GeoPoint & {
  id: string;
  name: string;
  city: string;
  kind: "origin" | "destination" | "stay" | "highlight";
  markerLabel?: string;
  detail?: string;
};

interface RouteMapProps {
  points: RouteMapPoint[];
  routePoints?: RouteMapPoint[];
  className?: string;
}

const validCoordinate = (point: GeoPoint) =>
  Number.isFinite(point.lat) &&
  Number.isFinite(point.lon) &&
  Math.abs(point.lat) <= 90 &&
  Math.abs(point.lon) <= 180;

/** SSR-safe wrapper: MapLibre only ever loads in the browser. */
export function RouteMap({ points, routePoints, className = "h-[360px] w-full rounded-3xl" }: RouteMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const validPoints = useMemo(() => points.filter(validCoordinate), [points]);
  const validRoute = useMemo(
    () => (routePoints ?? validPoints.filter((point) => point.kind !== "stay" && point.kind !== "highlight")).filter(validCoordinate),
    [routePoints, validPoints],
  );

  if (!mounted) return <Skeleton className={className} />;
  return (
    <Suspense fallback={<Skeleton className={className} />}>
      <RouteMapGL points={validPoints} routePoints={validRoute} className={className} />
    </Suspense>
  );
}
