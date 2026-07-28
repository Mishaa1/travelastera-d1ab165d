import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

import { OSM_RASTER_STYLE, boundsOf, routeGeoJson } from "@/services/mapService";
import type { GeoPoint } from "@/lib/types";

interface RouteMapGLProps {
  points: (GeoPoint & { name: string })[];
  className?: string;
}

/** Interactive MapLibre + OpenStreetMap route map. Client-only by design. */
export default function RouteMapGL({ points, className }: RouteMapGLProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current || points.length === 0) return;
    let map: import("maplibre-gl").Map | undefined;
    let cancelled = false;

    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !container.current) return;

      map = new maplibre.Map({
        container: container.current,
        style: OSM_RASTER_STYLE,
        center: [points[0].lon, points[0].lat],
        zoom: 4,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.scrollZoom.disable();

      map.on("load", () => {
        if (!map) return;
        map.addSource("route", { type: "geojson", data: routeGeoJson(points) });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#1d3f73", "line-width": 3.5, "line-dasharray": [1.6, 1.2] },
        });

        points.forEach((point, index) => {
          const el = document.createElement("div");
          el.className =
            "grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground shadow-soft";
          el.textContent = String(index + 1);
          el.setAttribute("aria-label", point.name);
          new maplibre.Marker({ element: el })
            .setLngLat([point.lon, point.lat])
            .setPopup(new maplibre.Popup({ offset: 18 }).setText(point.name))
            .addTo(map!);
        });

        const b = boundsOf(points);
        map.fitBounds(
          [
            [b.minLon, b.minLat],
            [b.maxLon, b.maxLat],
          ],
          { padding: 64, duration: 1400, maxZoom: 8 },
        );
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);

  return <div ref={container} className={className} role="application" aria-label="Route map" />;
}
