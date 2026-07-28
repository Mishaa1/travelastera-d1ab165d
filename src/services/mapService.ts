import { API_CONFIG } from "@/api/config";
import type { GeoPoint } from "@/lib/types";

/** Map helpers. MapLibre GL + OpenStreetMap raster tiles, no API key needed. */

export const OSM_RASTER_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export const MAP_PROVIDER = API_CONFIG.map.provider;

export interface Bounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export function boundsOf(points: GeoPoint[]): Bounds {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  };
}

export function routeGeoJson(points: GeoPoint[]) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: points.map((p) => [p.lon, p.lat]),
        },
      },
    ],
  };
}

/** Projects geo points into a normalised 0..1 space for lightweight SVG maps. */
export function projectToUnitSquare(points: GeoPoint[], padding = 0.12) {
  const bounds = boundsOf(points);
  const spanLon = Math.max(0.6, bounds.maxLon - bounds.minLon);
  const spanLat = Math.max(0.6, bounds.maxLat - bounds.minLat);
  const inner = 1 - padding * 2;
  return points.map((point) => ({
    x: padding + ((point.lon - bounds.minLon) / spanLon) * inner,
    y: padding + (1 - (point.lat - bounds.minLat) / spanLat) * inner,
  }));
}
