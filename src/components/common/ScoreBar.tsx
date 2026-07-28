import { motion } from "motion/react";

import { cn } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  value: number;
  tone?: "primary" | "teal" | "emerald" | "sunset";
  delay?: number;
}

const TONE: Record<NonNullable<ScoreBarProps["tone"]>, string> = {
  primary: "bg-primary",
  teal: "bg-teal",
  emerald: "bg-emerald",
  sunset: "bg-sunset",
};

export function ScoreBar({ label, value, tone = "primary", delay = 0 }: ScoreBarProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums">{Math.round(value)}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <motion.div
          className={cn("h-full rounded-full", TONE[tone])}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.min(100, value)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
