import { motion } from "motion/react";

import { projectToUnitSquare } from "@/services/mapService";
import { cn } from "@/lib/utils";
import type { GeoPoint } from "@/lib/types";

interface RouteSketchProps {
  points: (GeoPoint & { name?: string })[];
  className?: string;
  showLabels?: boolean;
  animated?: boolean;
}

/**
 * Lightweight animated route drawing. Used wherever a full map would be heavy
 * (hero background, result cards). The interactive map lives in RouteMap.
 */
export function RouteSketch({
  points,
  className,
  showLabels = false,
  animated = true,
}: RouteSketchProps) {
  if (points.length < 2) return null;
  const projected = projectToUnitSquare(points).map((p) => ({ x: p.x * 100, y: p.y * 100 }));
  const path = projected
    .map((p, index) => {
      if (index === 0) return `M ${p.x} ${p.y}`;
      const prev = projected[index - 1];
      const cx = (prev.x + p.x) / 2;
      const cy = Math.min(prev.y, p.y) - 8;
      return `Q ${cx} ${cy} ${p.x} ${p.y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("h-full w-full", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="safara-route" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      <motion.path
        d={path}
        fill="none"
        stroke="url(#safara-route)"
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeDasharray="3 2.2"
        initial={animated ? { pathLength: 0 } : false}
        whileInView={animated ? { pathLength: 1 } : undefined}
        viewport={{ once: true }}
        transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
      />
      {projected.map((point, index) => (
        <g key={`${point.x}-${point.y}-${index}`}>
          <motion.circle
            cx={point.x}
            cy={point.y}
            r={1.6}
            className="fill-current"
            initial={animated ? { scale: 0, opacity: 0 } : false}
            whileInView={animated ? { scale: 1, opacity: 1 } : undefined}
            viewport={{ once: true }}
            transition={{ delay: 0.25 + index * 0.18, duration: 0.5 }}
            style={{ transformOrigin: `${point.x}px ${point.y}px` }}
          />
          {showLabels && points[index].name && (
            <text
              x={point.x}
              y={point.y - 3.4}
              textAnchor="middle"
              className="fill-current text-[3.4px] font-medium"
            >
              {points[index].name}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
