import { motion } from "motion/react";

/**
 * Elegant animated travel paths — glowing arcs between cities with a
 * subtle moving aircraft/rail indicator. Sits above the satellite map.
 */

type Path = {
  d: string;
  delay: number;
  duration: number;
  /** normalized position along path for the moving dot (0..1) */
  from: { x: number; y: number };
  to: { x: number; y: number };
};

const PATHS: Path[] = [
  {
    d: "M 180 380 Q 480 140 820 300",
    from: { x: 180, y: 380 },
    to: { x: 820, y: 300 },
    delay: 0.6,
    duration: 3.2,
  },
  {
    d: "M 260 200 Q 620 340 1040 220",
    from: { x: 260, y: 200 },
    to: { x: 1040, y: 220 },
    delay: 1.4,
    duration: 3.6,
  },
  {
    d: "M 340 460 Q 700 520 1080 420",
    from: { x: 340, y: 460 },
    to: { x: 1080, y: 420 },
    delay: 2.0,
    duration: 4.0,
  },
];

export function TravelPaths({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 600"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="tp-arc" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="oklch(0.85 0.12 200)" stopOpacity="0" />
          <stop offset="50%" stopColor="oklch(0.9 0.14 195)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="oklch(0.88 0.14 80)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="tp-node" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="oklch(0.95 0.15 85)" stopOpacity="1" />
          <stop offset="60%" stopColor="oklch(0.88 0.14 80)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.88 0.14 80)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {PATHS.map((p, i) => (
        <g key={i}>
          {/* City glow — origin */}
          <circle cx={p.from.x} cy={p.from.y} r={14} fill="url(#tp-node)" />
          {/* City glow — destination */}
          <circle cx={p.to.x} cy={p.to.y} r={14} fill="url(#tp-node)" />

          {/* The arc itself */}
          <motion.path
            d={p.d}
            fill="none"
            stroke="url(#tp-arc)"
            strokeWidth={1}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.7 }}
            transition={{ duration: 2.4, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Moving indicator (aircraft/rail) travelling along the arc */}
          <motion.circle
            r={2.5}
            fill="oklch(0.96 0.14 85)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{
              duration: p.duration,
              delay: p.delay + 1.6,
              repeat: Infinity,
              repeatDelay: 3.5,
              ease: "linear",
            }}
          >
            <animateMotion
              dur={`${p.duration}s`}
              begin={`${p.delay + 1.6}s`}
              repeatCount="indefinite"
              keyPoints="0;1"
              keyTimes="0;1"
              path={p.d}
            />
          </motion.circle>
        </g>
      ))}
    </svg>
  );
}
