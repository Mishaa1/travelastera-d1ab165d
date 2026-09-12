import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";

import { OSM_RASTER_STYLE, boundsOf, routeGeoJson } from "@/services/mapService";
import type { RouteMapPoint } from "@/components/map/RouteMap";

// Vite 8 cannot reliably discover MapLibre 6's worker through its dependency
// optimiser. Pin the packaged module worker explicitly so the map never boots
// with a missing `.vite/deps/maplibre-gl-worker.mjs` URL.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

interface RouteMapGLProps {
  points: RouteMapPoint[];
  routePoints: RouteMapPoint[];
  className?: string;
}

function partialRoute(points: RouteMapPoint[], progress: number) {
  if (points.length < 2) return routeGeoJson(points);
  const scaled = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const segment = Math.min(points.length - 2, Math.floor(scaled));
  const fraction = scaled - segment;
  const coordinates = points.slice(0, segment + 1).map((point) => ({ lat: point.lat, lon: point.lon }));
  const from = points[segment]!;
  const to = points[segment + 1]!;
  coordinates.push({ lat: from.lat + (to.lat - from.lat) * fraction, lon: from.lon + (to.lon - from.lon) * fraction });
  return routeGeoJson(coordinates);
}

export default function RouteMapGL({ points, routePoints, className }: RouteMapGLProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const highlightMarkers = useRef<maplibregl.Marker[]>([]);
  const fitView = useRef<(() => void) | null>(null);
  const [showHighlights, setShowHighlights] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const pointKey = points.map((point) => `${point.id}:${point.lat}:${point.lon}:${point.kind}`).join("|");
  const routeKey = routePoints.map((point) => `${point.id}:${point.lat}:${point.lon}`).join("|");

  useEffect(() => {
    highlightMarkers.current.forEach((marker) => {
      marker.getElement().style.display = showHighlights ? "block" : "none";
    });
  }, [showHighlights]);

  useEffect(() => {
    if (!container.current || points.length === 0) return;
    let map: maplibregl.Map | undefined;
    let popup: maplibregl.Popup | undefined;
    let observer: IntersectionObserver | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let frame = 0;
    let cancelled = false;

    setMapError(null);
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: OSM_RASTER_STYLE,
        center: [routePoints[0]?.lon ?? points[0]!.lon, routePoints[0]?.lat ?? points[0]!.lat],
        zoom: 10,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      popup = new maplibregl.Popup({ offset: 18, closeButton: true, closeOnClick: false, maxWidth: "220px" });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.scrollZoom.disable();
      map.on("click", () => popup?.remove());
      map.on("error", (event) => {
        const message = event.error?.message ?? "The map tiles could not be loaded.";
        console.error("[RouteMap] MapLibre error", event.error ?? event);
        setMapError(message);
      });
      resizeObserver = new ResizeObserver(() => map?.resize());
      resizeObserver.observe(container.current);

      const boundsPoints = points.filter((point) => point.kind !== "highlight");
      const reset = () => {
        if (!map || boundsPoints.length === 0) return;
        const b = boundsOf(boundsPoints);
        const effectivelySingle = Math.abs(b.maxLat - b.minLat) < 0.01 && Math.abs(b.maxLon - b.minLon) < 0.01;
        if (effectivelySingle) {
          map.easeTo({ center: [boundsPoints[0]!.lon, boundsPoints[0]!.lat], zoom: 11.5, duration: 650 });
        } else {
          map.fitBounds([[b.minLon, b.minLat], [b.maxLon, b.maxLat]], { padding: { top: 54, right: 54, bottom: 54, left: 54 }, duration: 850, maxZoom: 12 });
        }
      };
      fitView.current = reset;

      map.on("load", () => {
        if (!map) return;
        if (routePoints.length > 1) {
          map.addSource("trip-route", { type: "geojson", lineMetrics: true, data: partialRoute(routePoints, 0) });
          map.addLayer({ id: "trip-route-shadow", type: "line", source: "trip-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.82 } });
          map.addLayer({ id: "trip-route-line", type: "line", source: "trip-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0797a6", "line-width": 3.5, "line-opacity": 1 } });
        }

        const markerElements: HTMLElement[] = [];
        let destinationNumber = 0;
        points.forEach((point) => {
          if (point.kind === "destination") destinationNumber += 1;
          const element = document.createElement("button");
          element.type = "button";
          element.setAttribute("aria-label", `${point.kind}: ${point.name}`);
          element.style.display = point.kind === "highlight" && !showHighlights ? "none" : "grid";
          element.style.placeItems = "center";
          element.style.cursor = "pointer";
          element.style.borderRadius = "999px";
          element.style.fontWeight = "700";
          element.style.fontSize = "11px";
          element.style.boxShadow = "0 8px 20px rgba(6,37,48,.28)";
          element.style.width = point.kind === "origin" ? "20px" : point.kind === "highlight" ? "18px" : "32px";
          element.style.height = element.style.width;
          if (point.kind === "origin") {
            element.style.background = "white"; element.style.border = "3px solid #0b3045"; element.style.color = "#0b3045"; element.textContent = "";
          } else if (point.kind === "stay") {
            element.style.background = "#0797a6"; element.style.border = "2px solid white"; element.style.color = "white"; element.textContent = "H";
          } else if (point.kind === "highlight") {
            element.style.background = "#d3a348"; element.style.border = "2px solid white"; element.style.color = "#0b3045"; element.textContent = "•";
          } else {
            element.style.background = "#0b3045"; element.style.border = "2px solid white"; element.style.color = "white"; element.textContent = point.markerLabel ?? String(destinationNumber);
          }
          markerElements.push(element);
          const marker = new maplibregl.Marker({ element, anchor: "bottom" }).setLngLat([point.lon, point.lat]).addTo(map!);
          if (point.kind === "highlight") highlightMarkers.current.push(marker);
          element.addEventListener("click", (event) => {
            event.stopPropagation();
            markerElements.forEach((item) => { item.style.outline = "none"; });
            element.style.outline = "5px solid rgba(7,151,166,.18)";
            const content = document.createElement("div");
            const name = document.createElement("strong"); name.textContent = point.name;
            const meta = document.createElement("p"); meta.textContent = `${point.kind === "stay" ? "Stay" : point.kind === "origin" ? "Origin" : point.kind === "highlight" ? "Highlight" : "Destination"} · ${point.city}`;
            content.append(name, meta);
            if (point.detail) { const detail = document.createElement("p"); detail.textContent = point.detail; content.append(detail); }
            popup!.setLngLat([point.lon, point.lat]).setDOMContent(content).addTo(map!);
            if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              element.animate([{ boxShadow: "0 0 0 0 rgba(7,151,166,.25)" }, { boxShadow: "0 0 0 12px rgba(7,151,166,0)" }], { duration: 900, iterations: 1 });
            }
          });
        });

        reset();
        let animated = false;
        const draw = () => {
          if (animated || !map || routePoints.length < 2) return;
          animated = true;
          const source = map.getSource("trip-route") as maplibregl.GeoJSONSource;
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { source.setData(routeGeoJson(routePoints)); return; }
          const start = performance.now();
          const tick = (now: number) => {
            if (!map || cancelled) return;
            const progress = Math.max(0, Math.min(1, (now - start) / 1200));
            source.setData(partialRoute(routePoints, progress));
            if (progress < 1) frame = requestAnimationFrame(tick);
          };
          frame = requestAnimationFrame(tick);
        };
        observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { draw(); observer?.disconnect(); } }, { threshold: 0.25 });
        observer.observe(container.current!);
        requestAnimationFrame(() => map?.resize());
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The map could not be initialised.";
      console.error("[RouteMap] MapLibre initialisation failed", error);
      setMapError(message);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      resizeObserver?.disconnect();
      popup?.remove();
      highlightMarkers.current = [];
      fitView.current = null;
      mapRef.current = null;
      map?.remove();
    };
  }, [pointKey, routeKey]);

  const hasHighlights = points.some((point) => point.kind === "highlight");
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div
        ref={container}
        className="h-full w-full"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        role="application"
        aria-label="Trip route map"
      />
      {mapError && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#eef7f8] px-6 text-center">
          <div>
            <p className="font-semibold text-ink">Map temporarily unavailable</p>
            <p className="mt-1 text-xs text-ink/60">{mapError}</p>
          </div>
        </div>
      )}
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        <button type="button" onClick={() => fitView.current?.()} className="rounded-full border border-white/80 bg-white/92 px-3 py-1.5 text-[10px] font-semibold text-ink shadow-sm backdrop-blur hover:bg-ink hover:text-white">Reset view</button>
        {hasHighlights && <button type="button" aria-pressed={showHighlights} onClick={() => setShowHighlights((value) => !value)} className="rounded-full border border-white/80 bg-white/92 px-3 py-1.5 text-[10px] font-semibold text-ink shadow-sm backdrop-blur hover:bg-ink hover:text-white">{showHighlights ? "Hide highlights" : "Show highlights"}</button>}
      </div>
      {routePoints.length > 1 && <span className="absolute right-3 bottom-3 z-10 rounded-full bg-white/88 px-2.5 py-1 text-[9px] text-ink/70 shadow-sm backdrop-blur">Indicative route</span>}
    </div>
  );
}
