import { ArrowDownRight, ArrowUpRight, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { formatCurrency } from "@/lib/format";
import type { BudgetStretchOption, TripRoute } from "@/lib/types";
import { cn } from "@/lib/utils";
import { persistRoute } from "@/lib/storage";
import { applyBudgetStretchOption } from "@/services/tripOptimizer";
import { Button } from "@/components/ui/button";

interface BudgetStretchProps {
  route: TripRoute;
  onRouteChange: (route: TripRoute) => void;
  className?: string;
}

/**
 * "Stretch your budget".
 *
 * Every suggestion has an instant estimate, but the route changes only after
 * the existing optimiser has recalculated the affected trip data.
 */
export function BudgetStretch({ route, onRouteChange, className }: BudgetStretchProps) {
  const [applied, setApplied] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
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

  const applySelection = async () => {
    if (applied.length !== 1) return;
    setApplying(true);
    try {
      const updated = await applyBudgetStretchOption(route, applied[0]);
      const previousDays = route.itinerary.length;
      const previousStops = route.stops.map((stop) => stop.name).join(" → ");
      const previousHotels = route.stops.map((stop) => stop.hotel.name).join(" · ");
      const previousModes = route.legs.map((leg) => leg.mode).join(" · ");
      persistRoute(updated);
      onRouteChange(updated);
      setApplied([]);
      const changes = [
        updated.itinerary.length !== previousDays
          ? `${previousDays} → ${updated.itinerary.length} days`
          : null,
        updated.stops.map((stop) => stop.name).join(" → ") !== previousStops
          ? "route updated"
          : null,
        updated.stops.map((stop) => stop.hotel.name).join(" · ") !== previousHotels
          ? "stays updated"
          : null,
        updated.legs.map((leg) => leg.mode).join(" · ") !== previousModes
          ? "transport updated"
          : null,
        updated.cost !== route.cost
          ? `${formatCurrency(route.cost, currency)} → ${formatCurrency(updated.cost, currency)}`
          : null,
      ].filter((item): item is string => Boolean(item));
      toast.success(changes.length ? `Trip updated: ${changes.join(" · ")}.` : "Trip constraints updated.");
      window.setTimeout(
        () => document.getElementById("trip-itinerary")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        120,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not apply that adjustment.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <section
      className={cn(
        "relative mx-auto max-w-5xl overflow-hidden rounded-[1.5rem] border border-border bg-card p-5 shadow-soft sm:p-6",
        className,
      )}
      id="stretch-budget"
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
          <h3 className="mt-1.5 font-display text-xl font-medium tracking-[-0.01em] sm:text-2xl">
            Stretch your budget
          </h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Preview one adjustment, then apply it to recalculate the real route, stays and itinerary.
          </p>
        </div>
        {applied.length > 0 && (
          <button
            type="button"
            onClick={() => setApplied([])}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:border-aegean hover:bg-aegean hover:text-primary-foreground"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Reset
          </button>
        )}
      </div>

      <ul className="mt-4 grid gap-2.5 lg:grid-cols-2">
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
                  : [option.id],
              )
            }
          />
        ))}
      </ul>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 rounded-2xl border border-border bg-background/80 px-4 py-3.5 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {applied.length ? "Preview trip cost" : "Trip cost as planned"}
          </p>
          <p className="mt-1 font-display text-2xl font-medium tabular-nums tracking-[-0.02em]">
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            This is a preview. Applying it reruns the existing optimiser and replaces these figures with recalculated provider-backed results.
          </p>
          <Button onClick={applySelection} disabled={applying}>
            {applying ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            Apply and update trip
          </Button>
        </div>
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
          "flex h-full w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors",
          active
            ? "border-teal/50 bg-teal/8"
            : "border-border bg-card transition-colors duration-250 hover:border-aegean hover:bg-aegean hover:text-primary-foreground",
        )}
      >
        <span
          className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
            saves ? "bg-emerald/12 text-emerald" : "bg-sunset/15 text-sunset-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-xs font-semibold sm:text-sm">{option.label}</span>
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
