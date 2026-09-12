import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { FlaskConical, Heart, MapPinned, Meh, SlidersHorizontal, ThumbsDown, TriangleAlert, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DataBadge } from "@/components/common/DataBadge";
import { PageShell } from "@/components/layout/PageShell";
import { FlightOffers } from "@/components/trip/FlightOffers";
import { OptimisePanel } from "@/components/trip/OptimisePanel";
import { BeyondDestination } from "@/components/trip/BeyondDestination";

import { TripCard } from "@/components/trip/TripCard";
import { OptimisationJourney, optimisationStageIndex } from "@/components/trip/OptimisationJourney";
import { CompareTable } from "@/components/trip/CompareTable";
import { Button } from "@/components/ui/button";
import { useSavedTrips } from "@/hooks/useSavedTrips";
import { useTripDraft } from "@/hooks/useTripDraft";
import { resultsStore } from "@/lib/storage";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OptimiseGoal, TripRoute } from "@/lib/types";
import type { GroupVote, SharedTripView } from "@/lib/collaboration/types";
import { routeGroupInsight } from "@/lib/collaboration/aggregate";
import { collaborationApi } from "@/services/collaborationService";
import {
  SAMPLE_SUMMARY,
  SAMPLE_TRIP_PREFERENCES,
  optimiseFurther,
  optimiseTripWithDeadline,
  type OptimisationProgress,
} from "@/services/tripOptimizer";

const TITLE = "Your optimised routes — Astera";
const DESCRIPTION =
  "Four AI-optimised routes ranked by trip score, cost, transit time and how well each one matches your interests.";

export const Route = createFileRoute("/results")({
  validateSearch: (search: Record<string, unknown>) => ({
    sample: search.sample === true || search.sample === "true" ? true : undefined,
    group: typeof search.group === "string" && search.group ? search.group : undefined,
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

type RunState = "idle" | "loading" | "done" | "timeout" | "error";

const ROUTE_COUNT_WORD: Record<number, string> = {
  1: "One route",
  2: "Two routes",
  3: "Three routes",
  4: "Four routes",
};

function materialRouteSignature(route: TripRoute) {
  return [
    route.stops.map((stop) => `${stop.name.toLowerCase()}:${stop.nights}:${stop.hotel.id ?? stop.hotel.name}`).join("|"),
    route.legs.map((leg) => `${leg.from.toLowerCase()}:${leg.to.toLowerCase()}:${leg.mode}`).join("|"),
    Math.round(route.cost),
    Math.round(route.journeyHours * 10),
  ].join("::");
}

function sameFinalDestination(left: TripRoute, right: TripRoute) {
  return left.stops.at(-1)?.name.trim().toLowerCase() === right.stops.at(-1)?.name.trim().toLowerCase();
}

function ResultsPage() {
  const { sample, group } = Route.useSearch();
  const { preferences, hydrated } = useTripDraft();
  const { toggle, isSaved } = useSavedTrips();

  const [routes, setRoutes] = useState<TripRoute[]>([]);
  const [state, setState] = useState<RunState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<OptimisationProgress>({ stage: "preferences" });
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [optimising, setOptimising] = useState<{ routeId: string; goal: OptimiseGoal } | null>(
    null,
  );
  const [panelRoute, setPanelRoute] = useState<TripRoute | null>(null);
  const runId = useRef(0);
  const [sharedTrip, setSharedTrip] = useState<SharedTripView | null>(null);
  const [groupLoaded, setGroupLoaded] = useState(!group);
  const [voterId, setVoterId] = useState("");

  useEffect(() => {
    if (!group) { setSharedTrip(null); setGroupLoaded(true); return; }
    setGroupLoaded(false);
    collaborationApi.get(group).then((trip) => { setSharedTrip(trip); setVoterId(trip.travellers[0]?.id ?? ""); }).catch((error: Error) => toast.error(error.message)).finally(() => setGroupLoaded(true));
  }, [group]);

  /**
   * The sample never reads the saved draft, so "Try a sample trip" shows the
   * same trip for everyone — including a first-time visitor with empty storage.
   */
  const activePreferences = useMemo(
    () => sample ? SAMPLE_TRIP_PREFERENCES : sharedTrip?.profile.combinedPreferences ?? preferences,
    [sample, preferences, sharedTrip],
  );

  const loading = state === "loading";

  const run = useCallback(async () => {
    const id = ++runId.current;
    setState("loading");
    setErrorMessage(null);
    setProgress({ stage: "preferences" });
    try {
      const { routes: generated, timedOut } = await optimiseTripWithDeadline({
        preferences: activePreferences,
        onProgress: (next) => setProgress((current) =>
          optimisationStageIndex(next.stage) >= optimisationStageIndex(current.stage)
            ? {
                ...current,
                ...next,
                stage: next.stage,
                counts: { ...current.counts, ...next.counts },
                providers: { ...current.providers, ...next.providers },
                candidates: next.candidates ?? current.candidates,
              }
            : {
                ...current,
                counts: { ...current.counts, ...next.counts },
                providers: { ...current.providers, ...next.providers },
                candidates: next.candidates ?? current.candidates,
              },
        ),
      });
      if (id !== runId.current) return;
      const collected = [...generated];
      setRoutes(collected);
      if (collected.length) resultsStore.set(collected);
      setState(timedOut ? "timeout" : "done");

      // Show the first valid answer immediately, then build a genuinely
      // different second recommendation in the background when deduplication
      // left only one. Hard constraints and the requested final destination
      // remain protected by optimiseFurther/optimiseTrip.
      if (!timedOut && collected.length === 1) {
        const signatures = new Set(collected.map(materialRouteSignature));
        const alternativeGoals: OptimiseGoal[] = ["spend-less", "reduce-travel", "more-luxury", "more-nature"];
        for (const goal of alternativeGoals) {
          if (id !== runId.current || collected.length >= 2) break;
          try {
            const candidate = await optimiseFurther(collected[0], goal);
            const candidateSignature = materialRouteSignature(candidate);
            if (sameFinalDestination(candidate, collected[0]) && !signatures.has(candidateSignature)) {
              signatures.add(candidateSignature);
              collected.push(candidate);
              setRoutes([...collected]);
              resultsStore.set([...collected]);
            }
          } catch {
            // Keep the valid winner visible while another strategy is tried.
          }
        }
      }
    } catch (error) {
      if (id !== runId.current) return;
      setRoutes([]);
      setErrorMessage(error instanceof Error ? error.message : "Unknown live-data failure");
      setState("error");
    }
  }, [activePreferences]);

  // The sample doesn't depend on stored preferences, so it can start immediately.
  useEffect(() => {
    if (!groupLoaded || (!sample && !hydrated)) return;
    void run();
  }, [sample, hydrated, groupLoaded, run]);

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
          <AnimatePresence mode="wait"><OptimisationJourney progress={progress} /></AnimatePresence>
        ) : routes.length === 0 ? (
          <EmptyState state={state} errorMessage={errorMessage} onRetry={() => void run()} />
        ) : (
          <>
            {import.meta.env.DEV &&
              routes.some(
                (route) =>
                  !route.provenance?.planner.active || route.provenance?.pois?.status !== "active",
              ) && (
                <div
                  role="alert"
                  className="mb-6 rounded-2xl border border-destructive/35 bg-destructive/8 p-4 text-sm"
                >
                  <p className="font-semibold">Development integration failure</p>
                  <p className="mt-1 text-muted-foreground">
                    The real LLM planner or POI provider was not active for every result. Open each
                    card’s development provenance for the exact provider and fallback details.
                  </p>
                </div>
              )}
            {routes.some((route) => route.provenance?.fallbackUsed) && (
              <div
                role="status"
                className="mb-6 rounded-2xl border border-amber-500/35 bg-amber-50/80 p-4 text-sm text-ink"
              >
                <p className="font-semibold">Demo Mode</p>
                <p className="mt-1 text-muted-foreground">
                  {routes.some(
                    (route) =>
                      route.provenance?.hotelbeds?.source === "demo-fixture" &&
                      route.provenance.hotelbeds.quotaExceeded,
                  )
                    ? "Hotel availability is shown in demo mode because the provider’s test quota is temporarily exhausted. These rooms and prices are not bookable."
                    : "One or more live travel providers are unavailable, so clearly labelled demo data is being used for those parts of the trip. Live sources remain in use everywhere else."}
                </p>
              </div>
            )}
            {routes.some((route) => route.provenance?.planner.mode === "heuristic") && (
              <div
                role="status"
                className="mb-6 rounded-2xl border border-teal/30 bg-teal/8 p-4 text-sm"
              >
                <p className="font-semibold">Planned with ASTERA’s rules engine</p>
                <p className="mt-1 text-muted-foreground">
                  The AI planner is temporarily unavailable. These recommendations still respect
                  your constraints and are priced using the available travel providers.
                </p>
              </div>
            )}
            {routes.every((route) => route.cost > activePreferences.budget) && (
              <div role="status" className="mb-6 rounded-2xl border border-amber-500/35 bg-amber-50/85 p-4 text-sm text-ink">
                <p className="font-semibold">The closest valid trips are above your target budget</p>
                <p className="mt-1 text-muted-foreground">
                  ASTERA kept the nearest options visible instead of hiding them. Each card shows
                  the gap and the main cost driver. Try nearby dates to request fresh provider
                  prices—cheaper dates are only suggested when real availability confirms them.
                </p>
              </div>
            )}
            {sharedTrip && <div className="mb-6 rounded-3xl border border-teal/25 bg-teal/8 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 font-display text-xl font-semibold"><Users className="h-5 w-5 text-teal" aria-hidden/>Planned for the whole group</p><p className="mt-1 text-sm text-muted-foreground">{sharedTrip.profile.submittedCount} of {sharedTrip.travellers.length} travellers submitted preferences. Hard constraints use the strictest submitted limit.</p></div><label className="text-xs font-semibold uppercase">Voting as <select value={voterId} onChange={(e)=>setVoterId(e.target.value)} className="ml-2 h-9 rounded-xl border border-border bg-background px-3 normal-case">{sharedTrip.travellers.map((traveller)=><option key={traveller.id} value={traveller.id}>{traveller.name}</option>)}</select></label></div>
              {sharedTrip.profile.conflictingPreferences.length > 0 && <p className="mt-3 text-sm"><strong>Still to resolve:</strong> {sharedTrip.profile.conflictingPreferences.join(" · ")}</p>}
            </div>}
            <BeyondDestination routes={routes} destination={activePreferences.endCity} />
            {best && (
              <div className="mb-8">
                <FlightOffers route={best} enabled={!best.preferences.avoidFlights} />
              </div>
            )}
            <div className="mb-8 flex flex-col justify-between gap-4 rounded-[28px] border border-teal/25 bg-[linear-gradient(115deg,rgba(0,151,167,.10),rgba(255,255,255,.92))] p-6 shadow-soft sm:flex-row sm:items-center">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal text-white"><FlaskConical className="h-5 w-5" aria-hidden /></span>
                <div><p className="font-display text-xl font-semibold">See the trade-offs live</p><p className="mt-1 max-w-xl text-sm text-muted-foreground">Adjust budget, pace, walking, stay quality and stops. ASTERA will show which real recommendation fits best.</p></div>
              </div>
              <Button asChild variant="hero" className="shrink-0"><Link to="/results/simulate">Open trip simulator</Link></Button>
            </div>
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
                    {route.title} · score {Math.round(route.scores.overall)}
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
                  {sharedTrip && group && (
                    <GroupRoutePanel
                      route={route}
                      trip={sharedTrip}
                      voterId={voterId}
                      onVote={async (value) => {
                        if (!voterId) return;
                        try {
                          const next = await collaborationApi.vote(group, voterId, route.id, value);
                          setSharedTrip(next);
                          toast.success("Vote saved");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Could not save vote");
                        }
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
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

function GroupRoutePanel({ route, trip, voterId, onVote }: { route: TripRoute; trip: SharedTripView; voterId: string; onVote: (value: GroupVote) => Promise<void> }) {
  const insight = routeGroupInsight(route, trip, trip.profile);
  const selected = trip.votes[`${route.id}:${voterId}`]?.value;
  const votes: Array<{ value: GroupVote; label: string; icon: React.ReactNode }> = [
    { value: "love", label: "Love it", icon: <Heart className="h-4 w-4" aria-hidden/> },
    { value: "okay", label: "Okay", icon: <Meh className="h-4 w-4" aria-hidden/> },
    { value: "not-for-me", label: "Not for me", icon: <ThumbsDown className="h-4 w-4" aria-hidden/> },
  ];
  return <section className="-mt-5 rounded-b-[24px] border border-t-0 border-border bg-card px-6 pt-8 pb-5 shadow-soft">
    <div className="flex items-center justify-between gap-3"><p className="font-display text-xl font-semibold">Group fit: {insight.groupFit}%</p>{insight.suitsBest.length>0&&<p className="text-xs text-muted-foreground">Suits {insight.suitsBest.join(", ")} best</p>}</div>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{insight.whyItWorks}</p>
    {insight.keyCompromises.length>0&&<p className="mt-2 text-xs"><strong>Compromise:</strong> {insight.keyCompromises.join(" · ")}</p>}
    {insight.unresolvedConflicts.length>0&&<p className="mt-1 text-xs text-muted-foreground"><strong>Unresolved:</strong> {insight.unresolvedConflicts.join(" · ")}</p>}
    <div className="mt-4 flex flex-wrap gap-2">{votes.map((vote)=><Button key={vote.value} type="button" size="sm" variant={selected===vote.value?"default":"outline"} onClick={()=>void onVote(vote.value)}>{vote.icon}{vote.label}</Button>)}</div>
  </section>;
}

/** Distinguishes "nothing fitted" from "we ran out of time" from "it broke". */
function EmptyState({
  state,
  errorMessage,
  onRetry,
}: {
  state: RunState;
  errorMessage?: string | null;
  onRetry: () => void;
}) {
  const rateLimited = /free daily request limit|rate limit/i.test(errorMessage ?? "");
  const copy =
    state === "timeout"
      ? {
          title: "That took longer than it should",
          body: "The optimiser hit its time limit before any route was priced. Running it again usually clears it.",
        }
      : state === "error"
        ? {
            title: "The optimiser stopped early",
            body:
              errorMessage ??
              "Something went wrong while pricing your combinations. Nothing was saved, so it is safe to try again.",
          }
        : {
            title: "No structurally valid route was returned",
            body: "This is not necessarily a budget problem. The destination, trip length, travel-time ceiling or required live place data may have prevented a valid itinerary.",
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
        <Button variant="hero" onClick={onRetry} disabled={rateLimited}>
          {rateLimited ? "Daily planner limit reached" : "Try again"}
        </Button>
        <Button asChild variant="outline">
          <Link to="/plan">Adjust my constraints</Link>
        </Button>
      </div>
    </div>
  );
}
