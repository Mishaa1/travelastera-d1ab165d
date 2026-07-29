import { ArrowDownRight, ArrowUpRight, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { formatCurrency } from "@/lib/format";
import type { BudgetStretchOption, TripRoute } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BudgetStretchProps {
  route: TripRoute;
  className?: string;
}

/**
 * "Stretch your budget".
 *
 * Every suggestion is already costed against this exact route, so toggling one
 * updates the total instantly — no second optimiser run, no spinner, no
 * network. What the traveller gives up is always stated next to the saving.
 */
export function BudgetStretch({ route, className }: BudgetStretchProps) {
  const [applied, setApplied] = useState<string[]>([]);
  const currency = route.preferences.currency;
  const options = route.stretchOptions ?? [];

  const delta = useMemo(
    () =>
      options
        .filter((option) => applied.includes(option.id))
        .reduce((total, option) => total + option.costDelta, 0),
    [options, applied],
  );

  if (!options.length) return null;

  const newCost = route.cost + delta;
  const newLeft = route.preferences.budget - newCost;
  const overBudget = newLeft < 0;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-soft sm:p-8",
        className,
      )}
      aria-label="Stretch your budget"
    >
      {/* Featured-insight backdrop — a whisper, not a shout. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(140% 90% at 100% 0%, color-mix(in oklab, var(--color-teal) 12%, transparent) 0%, transparent 55%), radial-gradient(120% 80% at 0% 100%, color-mix(in oklab, var(--color-sunset) 10%, transparent) 0%, transparent 55%)",
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.18em] text-teal uppercase">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Featured insight
          </p>
          <h3 className="mt-2 font-display text-2xl font-medium tracking-[-0.01em]">
            Stretch your budget
          </h3>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            Toggle any adjustment — the total re-prices instantly. Nothing is booked
            until you say so.
          </p>
        </div>
        {applied.length > 0 && (
          <button
            type="button"
            onClick={() => setApplied([])}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Reset
          </button>
        )}
      </div>

      <ul className="mt-6 space-y-2.5">
        {options.map((option) => (
          <StretchRow
            key={option.id}
            option={option}
            currency={currency}
            active={applied.includes(option.id)}
            onToggle={() =>
              setApplied((current) =>
                current.includes(option.id)
                  ? current.filter((id) => id !== option.id)
                  : [...current, option.id],
              )
            }
          />
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 rounded-3xl border border-border bg-background/80 p-5 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {applied.length ? "Adjusted trip cost" : "Trip cost as planned"}
          </p>
          <p className="mt-1.5 font-display text-3xl font-medium tabular-nums tracking-[-0.02em]">
            <AnimatedCounter
              value={newCost}
              duration={0.45}
              format={(value) => formatCurrency(value, currency)}
            />
          </p>
        </div>
        <p
          className={cn(
            "text-right text-sm font-medium tabular-nums",
            overBudget ? "text-destructive" : "text-emerald",
          )}
        >
          {overBudget
            ? `${formatCurrency(Math.abs(newLeft), currency)} over budget`
            : `${formatCurrency(newLeft, currency)} left`}
        </p>
      </div>

      {applied.length > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Estimates applied to this route only — your saved copy stays as it was
          until you save again.
        </p>
      )}
    </section>
  );
}


function StretchRow({
  option,
  currency,
  active,
  onToggle,
}: {
  option: BudgetStretchOption;
  currency: TripRoute["preferences"]["currency"];
  active: boolean;
  onToggle: () => void;
}) {
  const saves = option.costDelta < 0;
  const Icon = saves ? ArrowDownRight : ArrowUpRight;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        className={cn(
          "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors",
          active
            ? "border-teal/50 bg-teal/8"
            : "border-border bg-card hover:border-teal/30 hover:bg-secondary/50",
        )}
      >
        <span
          className={cn(
            "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
            saves ? "bg-emerald/12 text-emerald" : "bg-sunset/15 text-sunset-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-semibold">{option.label}</span>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                saves ? "text-emerald" : "text-sunset-foreground",
              )}
            >
              {saves ? "−" : "+"}
              {formatCurrency(Math.abs(option.costDelta), currency)}
            </span>
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {option.detail}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground/80 italic">
            Trade-off: {option.tradeoff}
          </span>
        </span>
      </button>
    </li>
  );
}
