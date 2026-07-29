import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, MapPinned, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DataBadge } from "@/components/common/DataBadge";
import { PageShell } from "@/components/layout/PageShell";
import { OptimisePanel } from "@/components/trip/OptimisePanel";
import { TripCard } from "@/components/trip/TripCard";
import { TripCardSkeleton } from "@/components/trip/TripCardSkeleton";
import { CompareTable } from "@/components/trip/CompareTable";
import { Button } from "@/components/ui/button";
import { useSavedTrips } from "@/hooks/useSavedTrips";
import { useTripDraft } from "@/hooks/useTripDraft";
import { resultsStore } from "@/lib/storage";
import { formatCurrency, formatDate } from "@/lib/format";
import type { OptimiseGoal, TripRoute } from "@/lib/types";
import { SAMPLE_PREFERENCES, optimiseFurther, optimiseTrip } from "@/services/tripOptimizer";

const TITLE = "Your optimised routes — Astera";
const DESCRIPTION =
  "Four AI-optimised routes ranked by trip score, cost, transit time and how well each one matches your interests.";

export const Route = createFileRoute("/results")({
  validateSearch: (search: Record<string, unknown>) => ({
    sample: search.sample === true || search.sample === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: ResultsPage,
});

const STAGES = [
  "Reading your constraints",
  "Pricing 4,200 city combinations",
  "Checking weather and transit windows",
  "Ranking the survivors",
];

function ResultsPage() {
  const { sample } = Route.useSearch();
  const { preferences, hydrated } = useTripDraft();
  const { toggle, isSaved } = useSavedTrips();

  const [routes, setRoutes] = useState<TripRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(0);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [optimising, setOptimising] = useState<{ routeId: string; goal: OptimiseGoal } | null>(null);
  const [panelRoute, setPanelRoute] = useState<TripRoute | null>(null);
  const runId = useRef(0);

  const activePreferences = useMemo(
    () => (sample ? SAMPLE_PREFERENCES : preferences),
    [sample, preferences],
  );

  const run = useCallback(async () => {
    const id = ++runId.current;
    setLoading(true);
    setStage(0);
    const ticker = setInterval(() => setStage((value) => Math.min(STAGES.length - 1, value + 1)), 550);
    try {
      const generated = await optimiseTrip({ preferences: activePreferences });
      if (id !== runId.current) return;
      setRoutes(generated);
      resultsStore.set(generated);
    } catch {
      toast.error("The optimiser could not complete. Try adjusting your constraints.");
    } finally {
      clearInterval(ticker);
      if (id === runId.current) setLoading(false);
    }
  }, [activePreferences]);

  useEffect(() => {
    if (!hydrated) return;
    void run();
  }, [hydrated, run]);

  const handleOptimise = async (route: TripRoute, goal: OptimiseGoal) => {
    setOptimising({ routeId: route.id, goal });
    try {
      const improved = await optimiseFurther(route, goal);
      const next = routes.map((item) => (item.id === route.id ? improved : item));
      setRoutes(next);
      resultsStore.set(next);
      setPanelRoute(improved);
      toast.success(`Recalculated for “${goal.replace("-", " ")}”.`);
    } catch {
      toast.error("Could not recalculate that route.");
    } finally {
      setOptimising(null);
    }
  };

  const toggleCompare = (route: TripRoute) => {
    setCompareIds((current) =>
      current.includes(route.id)
        ? current.filter((id) => id !== route.id)
        : current.length >= 3
          ? current
          : [...current, route.id],
    );
  };

  const compared = routes.filter((route) => compareIds.includes(route.id));
  const best = routes[0];

  return (
    <PageShell>
      <div className="gradient-canvas">
        <div className="mx-auto max-w-7xl px-5 pt-28 pb-8 md:px-8 md:pt-40">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-widest text-teal uppercase">
                {sample ? "Sample optimisation" : "Your optimisation"}
              </p>
              <h1 className="mt-3 font-display text-[clamp(2rem,5vw,3.6rem)] leading-[1.02] font-semibold">
                {loading ? "Searching the combinations…" : "Four routes worth taking."}
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
                {activePreferences.startCity} → {activePreferences.endCity} ·{" "}
                {formatDate(activePreferences.startDate)} – {formatDate(activePreferences.endDate)} ·{" "}
                {activePreferences.travellers} travellers ·{" "}
                {formatCurrency(activePreferences.budget, activePreferences.currency)} budget
              </p>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/plan">
                <SlidersHorizontal aria-hidden />
                <span className="hidden sm:inline">Adjust</span>
              </Link>
            </Button>
          </div>

          {!loading && best && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <DataBadge quality={best.quality} showProvider />
              <span className="text-xs text-muted-foreground">
                No figure here is a live fare. Connect provider keys to switch these to live pricing.
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 pb-24 md:px-8">
        {loading ? (
          <div>
            <div className="flex items-center gap-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
              <Loader2 className="h-5 w-5 animate-spin text-teal" aria-hidden />
              <AnimatePresence mode="wait">
                <motion.p
                  key={stage}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-sm font-medium"
                >
                  {STAGES[stage]}
                </motion.p>
              </AnimatePresence>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <TripCardSkeleton key={index} />
              ))}
            </div>
          </div>
        ) : routes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {routes.map((route, index) => (
              <TripCard
                key={route.id}
                route={route}
                index={index}
                saved={isSaved(route.id)}
                compared={compareIds.includes(route.id)}
                onSave={(item) => {
                  const added = toggle(item);
                  toast.success(added ? "Saved to your trips" : "Removed from saved");
                }}
                onCompare={toggleCompare}
                onOptimise={(item) => setPanelRoute(item)}
              />
            ))}
          </div>
        )}

        <AnimatePresence>
          {panelRoute && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="mt-8"
            >
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPanelRoute(null)}
                  className="absolute top-4 right-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-background"
                  aria-label="Close optimise panel"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
                <OptimisePanel
                  busy={optimising?.routeId === panelRoute.id}
                  activeGoal={optimising?.goal}
                  onSelect={(goal) => void handleOptimise(panelRoute, goal)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {compared.length >= 2 && (
          <div className="mt-10">
            <CompareTable routes={compared} onClear={() => setCompareIds([])} />
          </div>
        )}
      </div>
    </PageShell>
  );
}

function EmptyState() {
  return (
    <div className="rounded-4xl border border-dashed border-border bg-card/60 px-6 py-20 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl gradient-sea text-primary-foreground">
        <MapPinned className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-6 font-display text-2xl font-semibold">Nothing fitted those constraints</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        Widen the budget, add a day or raise the maximum travel time and the engine will have room
        to work with.
      </p>
      <Button asChild variant="hero" className="mt-8">
        <Link to="/plan">Adjust my constraints</Link>
      </Button>
    </div>
  );
}
