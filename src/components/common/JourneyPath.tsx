import { motion } from "motion/react";

/**
 * Understated animated journey path used behind the hero copy.
 * A single hairline arc with two markers — travel implied, not shouted.
 */
export function JourneyPath({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 600"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="jp-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="30%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d="M 40 420 C 260 440, 420 200, 640 260 S 980 460, 1160 240"
        fill="none"
        stroke="url(#jp-line)"
        strokeWidth={1.25}
        strokeDasharray="1 8"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.6 }}
        transition={{ duration: 2.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.circle
        cx={40}
        cy={420}
        r={4}
        fill="currentColor"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      />
      <motion.circle
        cx={1160}
        cy={240}
        r={4}
        fill="currentColor"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 0.9, scale: 1 }}
        transition={{ duration: 0.6, delay: 2.4, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
