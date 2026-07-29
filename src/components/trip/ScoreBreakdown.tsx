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
    <div className={cn("rounded-3xl border border-border bg-background/60 p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          How this scored {overall}
        </h4>
        <span className="text-[11px] text-muted-foreground">weighted average</span>
      </div>

      <ul className="mt-3 space-y-3">
        {factors.map((factor, index) => (
          <li key={factor.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium">
                {factor.label}
                <span className="ml-1.5 text-muted-foreground">
                  {Math.round(factor.weight * 100)}% of score
                </span>
              </span>
              <span className="text-xs font-semibold tabular-nums">{Math.round(factor.value)}</span>
            </div>
            <div
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
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
                transition={{ duration: 0.8, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {factor.explanation}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
