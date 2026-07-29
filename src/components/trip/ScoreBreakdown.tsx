import { motion } from "motion/react";

import type { ScoreFactor } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ScoreBreakdownProps {
  factors: ScoreFactor[];
  overall: number;
  className?: string;
}

const TONE = [
  "bg-primary",
  "bg-emerald",
  "bg-teal",
  "bg-sunset",
] as const;

/**
 * Shows exactly how a route reached its score: each factor, what it scored,
 * how much it counted, and a sentence saying why.
 */
export function ScoreBreakdown({ factors, overall, className }: ScoreBreakdownProps) {
  if (!factors.length) return null;

  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-background/70 p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          How this scored {overall}
        </h4>
        <span className="text-[11px] tracking-wide text-muted-foreground/80">
          weighted average
        </span>
      </div>

      <ul className="mt-5 space-y-5">
        {factors.map((factor, index) => (
          <li key={factor.key} className="grid gap-2">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium tracking-[-0.005em]">
                  {factor.label}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {Math.round(factor.weight * 100)}% of the total score
                </p>
              </div>
              <span className="font-display text-lg font-medium tabular-nums tracking-[-0.01em]">
                {Math.round(factor.value)}
              </span>
            </div>
            <div
              className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/70"
              role="meter"
              aria-valuenow={Math.round(factor.value)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={factor.label}
            >
              <motion.div
                className={cn("h-full rounded-full", TONE[index % TONE.length])}
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.min(100, Math.max(0, factor.value))}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <p className="text-[13px] leading-[1.6] text-muted-foreground">
              {factor.explanation}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

