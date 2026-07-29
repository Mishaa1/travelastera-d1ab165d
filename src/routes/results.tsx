import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, MapPinned, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { OptimiseGoal, TripRoute } from "@/lib/types";
import {
  SAMPLE_SUMMARY,
  SAMPLE_TRIP_PREFERENCES,
  optimiseFurther,
  optimiseTripWithDeadline,
} from "@/services/tripOptimizer";

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

type RunState = "idle" | "loading" | "done" | "timeout" | "error";

const ROUTE_COUNT_WORD: Record<number, string> = {
  1: "One route",
  2: "Two routes",
  3: "Three routes",
  4: "Four routes",
};

const RANK_LABEL = ["Best overall", "Runner-up", "Third", "Fourth"] as const;



function ResultsPage() {
  const { sample } = Route.useSearch();
  const { preferences, hydrated } = useTripDraft();
  const { toggle, isSaved } = useSavedTrips();

  const [routes, setRoutes] = useState<TripRoute[]>([]);
  const [state, setState] = useState<RunState>("loading");
  const [stage, setStage] = useState(0);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [optimising, setOptimising] = useState<{ routeId: string; goal: OptimiseGoal } | null>(null);
  const [panelRoute, setPanelRoute] = useState<TripRoute | null>(null);
  const runId = useRef(0);

  /**
   * The sample never reads the saved draft, so "Try a sample trip" shows the
   * same trip for everyone — including a first-time visitor with empty storage.
   */
  const activePreferences = useMemo(
    () => (sample ? SAMPLE_TRIP_PREFERENCES : preferences),
    [sample, preferences],
  );

  const loading = state === "loading";

  const run = useCallback(async () => {
    const id = ++runId.current;
    setState("loading");
    setStage(0);
    const ticker = setInterval(
      () => setStage((value) => Math.min(STAGES.length - 1, value + 1)),
      550,
    );
    try {
      const { routes: generated, timedOut } = await optimiseTripWithDeadline({
        preferences: activePreferences,
      });
      if (id !== runId.current) return;
      setRoutes(generated);
      if (generated.length) resultsStore.set(generated);
      setState(timedOut ? "timeout" : "done");
    } catch {
      if (id !== runId.current) return;
      setRoutes([]);
      setState("error");
    } finally {
      clearInterval(ticker);
    }
  }, [activePreferences]);

  // The sample doesn't depend on stored preferences, so it can start immediately.
  useEffect(() => {
    if (!sample && !hydrated) return;
    void run();
  }, [sample, hydrated, run]);


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
                {loading
                  ? "Searching the combinations…"
                  : routes.length
                    ? `${ROUTE_COUNT_WORD[routes.length] ?? `${routes.length} routes`} worth taking.`
                    : "No route cleared your constraints."}
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
                {sample ? (
                  SAMPLE_SUMMARY
                ) : (
                  <>
                    {activePreferences.startCity} → {activePreferences.endCity} ·{" "}
                    {formatDate(activePreferences.startDate)} –{" "}
                    {formatDate(activePreferences.endDate)} · {activePreferences.travellers}{" "}
                    {activePreferences.travellers === 1 ? "traveller" : "travellers"} ·{" "}
                    {formatCurrency(activePreferences.budget, activePreferences.currency)} budget
                  </>
                )}
              </p>
              {sample && (
                <p className="mt-2 text-xs text-muted-foreground">
                  A fixed demo profile — it ignores anything you've planned so the result is the
                  same every time.
                </p>
              )}
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/plan">
                <SlidersHorizontal aria-hidden />
                <span className="hidden sm:inline">{sample ? "Plan mine" : "Adjust"}</span>
              </Link>
            </Button>
          </div>

          {!loading && best && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <DataBadge quality={best.quality} showProvider />
              <span className="text-xs text-muted-foreground">
                Prices are modelled estimates, not live fares. Ranked best first by trip score.
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
          <EmptyState state={state} onRetry={() => void run()} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {routes.map((route, index) => (
              <div key={route.id} className="flex flex-col">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  <span
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full text-[10px]",
                      index === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  {RANK_LABEL[index] ?? `Option ${index + 1}`} · score{" "}
                  {Math.round(route.scores.overall)}
                </p>
                <TripCard
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
              </div>
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

/** Distinguishes "nothing fitted" from "we ran out of time" from "it broke". */
function EmptyState({ state, onRetry }: { state: RunState; onRetry: () => void }) {
  const copy =
    state === "timeout"
      ? {
          title: "That took longer than it should",
          body: "The optimiser hit its time limit before any route was priced. Running it again usually clears it.",
        }
      : state === "error"
        ? {
            title: "The optimiser stopped early",
            body: "Something went wrong while pricing your combinations. Nothing was saved, so it is safe to try again.",
          }
        : {
            title: "Nothing fitted those constraints",
            body: "Widen the budget, add a day or raise the maximum travel time and the engine will have room to work with.",
          };

  return (
    <div className="rounded-4xl border border-dashed border-border bg-card/60 px-6 py-20 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl gradient-sea text-primary-foreground">
        {state === "done" ? (
          <MapPinned className="h-7 w-7" aria-hidden />
        ) : (
          <TriangleAlert className="h-7 w-7" aria-hidden />
        )}
      </span>
      <h2 className="mt-6 font-display text-2xl font-semibold">{copy.title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{copy.body}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="hero" onClick={onRetry}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link to="/plan">Adjust my constraints</Link>
        </Button>
      </div>
    </div>
  );
}

