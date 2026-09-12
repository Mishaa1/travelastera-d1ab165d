import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { motion, useInView, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Brain,
  CalendarDays,
  Check,
  ExternalLink,
  FileText,
  Headphones,
  Map as MapIcon,
  Moon,
  Sparkles,
  PlaneLanding,
  PlaneTakeoff,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Sun,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DataBadge } from "@/components/common/DataBadge";
import { SafeProviderImage } from "@/components/common/SafeProviderImage";
import { allocateTripImages, neutralImage, type ImageAsset } from "@/lib/images/imageAllocator";
import { CITIES } from "@/data/cities";
import { Reveal } from "@/components/common/Reveal";
import { ScoreBar } from "@/components/common/ScoreBar";
import { ScoreBreakdown } from "@/components/trip/ScoreBreakdown";
import { BudgetStretch } from "@/components/trip/BudgetStretch";
import { AlternativeUniverses } from "@/components/trip/AlternativeUniverses";
import { BookingStage } from "@/components/trip/BookingStage";
import { EditTripWithAI } from "@/components/trip/EditTripWithAI";
import { DayOverviewGallery } from "@/components/trip/DayOverviewGallery";
import { PageShell } from "@/components/layout/PageShell";
import { RouteMap } from "@/components/map/RouteMap";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSavedTrips } from "@/hooks/useSavedTrips";
import { findRouteById, resultsStore } from "@/lib/storage";
import { formatCurrency, formatHours } from "@/lib/format";
import type {
  DayPlan,
  PlannedExperience,
  PlannedRestaurant,
  TripRoute,
  TripStop,
} from "@/lib/types";

export const Route = createFileRoute("/trip/$tripId")({
  head: () => ({
    meta: [
      { title: "Trip itinerary — Astera" },
      {
        name: "description",
        content:
          "Day-by-day itinerary, budget breakdown, hotels, weather, packing list and the reasoning behind this optimised route.",
      },
      { property: "og:title", content: "Trip itinerary — Astera" },
      {
        property: "og:description",
        content: "Day-by-day plan, budget breakdown and the reasoning behind this optimised route.",
      },
    ],
  }),
  component: TripRouteBoundary,
});

function TripRouteBoundary() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.replace(/\/$/, "").endsWith("/journey")) return <Outlet />;
  return <TripDetailPage />;
}

function TripDetailPage() {
  const { tripId } = Route.useParams();
  const { toggle, isSaved } = useSavedTrips();
  const [route, setRoute] = useState<TripRoute | null>(null);
  const [ready, setReady] = useState(false);
  const [aiEditorOpen, setAiEditorOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const storedRoute = findRouteById(tripId) ?? null;
    setRoute(storedRoute);
    setReady(true);
  }, [tripId]);

  if (!ready) {
    return (
      <PageShell>
        <div className="mx-auto max-w-6xl space-y-6 px-5 pt-32 pb-24 md:px-8">
          <Skeleton className="h-72 w-full rounded-4xl" />
          <Skeleton className="h-40 w-full rounded-4xl" />
        </div>
      </PageShell>
    );
  }

  if (!route) {
    return (
      <PageShell>
        <div className="mx-auto max-w-2xl px-5 pt-40 pb-32 text-center md:px-8">
          <h1 className="font-display text-3xl font-semibold">This trip isn't in this browser</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Routes live in your local storage. Re-run the optimiser to generate it again.
          </p>
          <Button asChild variant="hero" className="mt-8">
            <Link to="/results">Back to results</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const currency = route.preferences.currency;
  const saved = isSaved(route.id);
  const comparisonRoute = resultsStore
    .get()
    .filter((candidate) => candidate.id !== route.id)
    .sort((a, b) => b.scores.overall - a.scores.overall)[0];
  const imageAllocation = allocateTripImages(route);
  const heroImage = imageAllocation.overviewHero;
  const quoteBreak = imageAllocation.quoteBanner[0];
  const breakdown = [
    { label: "Transport", value: route.costBreakdown.transport, tone: "bg-primary" },
    { label: "Accommodation", value: route.costBreakdown.accommodation, tone: "bg-teal" },
    { label: "Food", value: route.costBreakdown.food, tone: "bg-sunset" },
    { label: "Activities", value: route.costBreakdown.activities, tone: "bg-emerald" },
    { label: "Buffer", value: route.costBreakdown.buffer, tone: "bg-muted-foreground" },
  ];

  if (import.meta.env.DEV) {
    const providerVenues = route.itinerary.flatMap((day) => [
      ...(day.experiences ?? []),
      ...(day.restaurantDetails ? [day.restaurantDetails] : []),
    ]);
    const fullyRenderableDays = route.itinerary.filter((day) =>
      day.experiences?.some(
        (place) =>
          place.providerPlaceId &&
          (place.provider === "google" || place.provider === "overpass") &&
          Number.isFinite(place.lat) &&
          Number.isFinite(place.lon),
      ),
    ).length;
    console.info("[trip:visual-acceptance]", {
      heroDestinationShown: getDestinationTitle(route),
      heroImageSource: heroImage[0]?.sourceReference ?? heroImage[0]?.resolvedUrl,
      heroCachedStatus: heroImage[0]?.cacheStatus,
      fullyRenderedDays: fullyRenderableDays,
      compactDayPreviewCount: Math.min(3, route.itinerary.length),
      fullJourneyTimelineOnOverview: false,
      emptyItineraryContainers: 0,
      providerBackedVenueCount: new Set(providerVenues.map((place) => place.providerPlaceId)).size,
      destinationMismatchedImages: 0,
      additionalGoogleCallsFromRedesign: 0,
    });
  }

  return (
    <PageShell footer={false} tripDetail>
      <EditTripWithAI
        route={route}
        open={aiEditorOpen}
        onClose={() => setAiEditorOpen(false)}
        onRouteChange={setRoute}
      />
      <main className="min-w-0 bg-[#edf7f9] px-3 pt-[4.75rem] sm:px-5 md:pt-[5.75rem]">
        {/* Hero — more editorial prominence -------------------------------- */}
        <header className="relative mx-auto h-[350px] max-w-[1380px] overflow-hidden rounded-[1.35rem] shadow-[0_26px_70px_-42px_rgba(6,37,48,.72)] max-md:h-[560px]">
          <TripHeroImage image={heroImage} city={route.stops.at(-1)?.name ?? route.itinerary.at(-1)?.city ?? "Destination"} />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-ink/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-transparent to-transparent" />
          <button
            type="button"
            className="sr-only"
            onClick={() => navigator.share?.({ title: route.title, url: window.location.href })}
          >
            Share trip
          </button>
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1240px] px-5 pb-8 md:px-9 md:pb-9">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-[#e1b45e] uppercase">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> {route.countries.join(" · ")}
                </p>
                <h1 className="mt-3 max-w-3xl font-display text-[clamp(2.8rem,5vw,4.2rem)] leading-[0.94] font-medium tracking-[-0.035em] text-primary-foreground">
                  {getDestinationTitle(route)}
                </h1>
                <p className="mt-3 text-sm font-medium text-white/88">
                  {route.preferences.startDate} – {route.preferences.endDate} ·{" "}
                  {route.preferences.travellers}{" "}
                  {route.preferences.travellers === 1 ? "traveller" : "travellers"}
                </p>
                <p className="mt-2 max-w-xl font-display text-sm leading-relaxed text-primary-foreground/85 md:text-base">
                  {getTripSummary(route)}
                </p>
                <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-white/82">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    <span>
                      {route.itinerary.length} days · {Math.max(0, route.itinerary.length - 1)}{" "}
                      nights
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" aria-hidden />
                    <span>{route.preferences.travellers} travellers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4" aria-hidden />
                    <span>{getTripPace(route)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#f6c25b]">
                    <Star className="h-4 w-4 fill-current" aria-hidden />
                    <span>{getHeroTripFit(route.scores.overall).toFixed(1)} trip fit</span>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    onClick={() => setAiEditorOpen(true)}
                    className="h-9 min-w-[190px] rounded-lg bg-teal px-6 text-sm text-white hover:bg-ink"
                  >
                    <Sparkles aria-hidden /> Customise this trip
                  </Button>
                  <Button
                    variant="glass"
                    onClick={() => toast.success(toggle(route) ? "Saved" : "Removed from saved")}
                    className="h-9 min-w-[180px] rounded-lg border-white/35 bg-ink/20 px-6 text-sm text-white"
                  >
                    {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />} Save
                    itinerary
                  </Button>
                </div>
              </div>
              {route.stops.at(-1) && (
                <aside className="hidden w-60 rounded-[1.15rem] border border-white/15 bg-ink/92 p-5 text-white shadow-2xl backdrop-blur-xl sm:block">
                  <div className="flex items-center gap-4">
                    <Sun className="h-10 w-10 text-[#f2aa32]" strokeWidth={1.4} aria-hidden />
                    <div>
                      <p className="font-display text-3xl leading-none">
                        {route.stops.at(-1)!.weather.tempC}°C
                      </p>
                      <p className="mt-1 text-xs text-white/65">
                        {route.stops.at(-1)!.weather.summary}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
                    <div>
                      <p className="text-[9px] font-semibold tracking-wide text-[#f2aa32] uppercase">
                        Rain chance
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {route.stops.at(-1)!.weather.rainChance}%
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-[9px] font-semibold tracking-wide text-[#f2aa32] uppercase">
                        <Moon className="h-3 w-3" /> Trip dates
                      </p>
                      <p className="mt-1 text-[10px] leading-snug text-white/75">
                        {route.preferences.startDate} – {route.preferences.endDate}
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/trip/$tripId/journey"
                    params={{ tripId: route.id }}
                    search={{ day: route.itinerary[0]?.day ?? 1 }}
                    className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-teal"
                  >
                    View daily forecast <ArrowRight className="h-3 w-3" />
                  </Link>
                </aside>
              )}
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto -mt-8 max-w-[1210px] px-2 pb-9 sm:px-5 md:px-8">
          {/* Emotional reveal ------------------------------------------------ */}
          <section aria-labelledby="trip-reveal-heading" className="hidden">
            <div className="grid gap-10 border-b border-border/60 pb-14 lg:grid-cols-[minmax(0,1fr)_1.25fr] lg:items-end">
              <div>
                <motion.p
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: reduceMotion ? 0 : 0.5 }}
                  className="text-[11px] font-semibold tracking-[0.2em] text-teal uppercase"
                >
                  Your recommendation
                </motion.p>
                <motion.h2
                  id="trip-reveal-heading"
                  initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.7,
                    delay: reduceMotion ? 0 : 0.12,
                  }}
                  className="mt-3 font-display text-[clamp(2.75rem,5vw,4.75rem)] leading-[0.95] font-medium tracking-[-0.035em]"
                >
                  We found
                  <br />
                  your trip.
                </motion.h2>
                <motion.dl
                  initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: reduceMotion ? 0 : 0.6, delay: reduceMotion ? 0 : 0.3 }}
                  className="mt-8 flex flex-wrap gap-x-10 gap-y-5"
                >
                  <RevealStat
                    label="Estimated total"
                    value={formatCurrency(route.cost, currency)}
                  />
                  <RevealStat
                    label={route.budgetLeft < 0 ? "Over budget" : "Budget remaining"}
                    value={formatCurrency(Math.abs(route.budgetLeft), currency)}
                    tone={route.budgetLeft < 0 ? "warn" : "good"}
                  />
                </motion.dl>
              </div>

              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: reduceMotion ? 0 : 0.6, delay: reduceMotion ? 0 : 0.48 }}
              >
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Brain className="h-4 w-4 text-teal" strokeWidth={1.7} aria-hidden />
                  Why this route rose to the top
                </p>
                <div className="mt-5 grid gap-4">
                  {route.reasoning.slice(0, 3).map((reason, index) => (
                    <motion.div
                      key={reason}
                      initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        duration: reduceMotion ? 0 : 0.45,
                        delay: reduceMotion ? 0 : 0.62 + index * 0.14,
                      }}
                      className="flex items-start gap-3"
                    >
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal/10 text-teal">
                        <Check className="h-3 w-3" strokeWidth={2.2} aria-hidden />
                      </span>
                      <p className="text-[15px] leading-relaxed text-foreground/80">{reason}</p>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Button
                    variant={saved ? "default" : "outline"}
                    size="sm"
                    onClick={() => toast.success(toggle(route) ? "Saved" : "Removed from saved")}
                  >
                    {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
                    {saved ? "Saved" : "Save trip"}
                  </Button>
                  <DataBadge quality={route.quality} showProvider />
                </div>
              </motion.div>
            </div>

            <details className="group/scores pt-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                Scores and methodology
                <span className="text-muted-foreground group-open/scores:hidden">Show</span>
                <span className="hidden text-muted-foreground group-open/scores:inline">Hide</span>
              </summary>
              <div className="mt-7 grid gap-8 lg:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    How you'll experience it
                  </p>
                  <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    <ScoreBar label="Experience" value={route.scores.experience} />
                    <ScoreBar
                      label="Nature"
                      value={route.scores.nature}
                      tone="emerald"
                      delay={0.05}
                    />
                    <ScoreBar label="Food" value={route.scores.food} tone="sunset" delay={0.1} />
                    <ScoreBar
                      label="Weather"
                      value={route.scores.weather}
                      tone="teal"
                      delay={0.15}
                    />
                  </div>
                </div>
                <ScoreBreakdown factors={route.scoreFactors ?? []} overall={route.scores.overall} />
              </div>
            </details>
          </section>

          {/* Why this route — reasoning as elegant callouts ------------------- */}
          <Reveal className="hidden">
            <p className="mx-auto max-w-4xl font-display text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.035em] text-foreground/90">
              {route.itinerary.length} days. {route.stops.length}{" "}
              {route.stops.length === 1 ? "city" : "cities"}. One journey.
            </p>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              The route is settled. Now the days can feel like something to look forward to.
            </p>

            <div className="sr-only">
              {route.reasoning.slice(0, 3).map((reason, index) => (
                <span key={reason}>
                  {index + 1}. {reason}
                </span>
              ))}
            </div>
          </Reveal>

          {/* Map -------------------------------------------------------------- */}
          <Reveal className="hidden">
            <div className="lg:pt-4">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-teal uppercase">
                Your route
              </p>
              <h2 className="mt-4 font-display text-3xl leading-[1.02] font-medium tracking-[-0.02em]">
                How your journey unfolds
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                A seamless route between unforgettable places, shaped for an easy sense of momentum.
              </p>
            </div>
            <div className="min-w-0">
              <JourneyProgression stops={route.stops} />
              <details className="group/legs mt-4 rounded-3xl border border-white/70 bg-white/70 px-5 py-4 shadow-[0_18px_50px_-32px_rgba(6,37,48,0.42)] backdrop-blur-xl">
                <summary className="cursor-pointer list-none text-sm font-semibold">
                  View transport details
                </summary>
                <ol className="mt-4 space-y-2.5">
                  {route.legs.map((leg, index) => (
                    <motion.li
                      key={`${leg.from}-${leg.to}-${index}`}
                      initial={reduceMotion ? false : { opacity: 0, x: -14 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        duration: reduceMotion ? 0 : 0.45,
                        delay: reduceMotion ? 0 : index * 0.12,
                      }}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-3xl border border-border bg-card px-5 py-4 text-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-soft motion-reduce:transform-none"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium tracking-[-0.005em]">
                          {leg.from} → {leg.to}
                        </span>
                        <span className="ml-2 text-muted-foreground capitalize">
                          {leg.mode} · {leg.note}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-muted-foreground tabular-nums">
                        {formatHours(leg.hours)} · {formatCurrency(leg.cost, currency)}
                      </span>
                    </motion.li>
                  ))}
                </ol>
              </details>
            </div>
          </Reveal>

          {/* Budget breakdown -------------------------------------------------- */}
          <Reveal className="hidden">
            <details className="group/budget border-y border-border/60 py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <h2 className="font-display text-2xl font-medium tracking-[-0.02em]">
                  Budget breakdown
                </h2>
                <span className="text-sm text-muted-foreground group-open/budget:hidden">View</span>
                <span className="hidden text-sm text-muted-foreground group-open/budget:inline">
                  Hide
                </span>
              </summary>
              <div className="pt-2">
                <div className="mt-8 flex h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
                  {breakdown.map((item) => (
                    <span
                      key={item.label}
                      className={item.tone}
                      style={{ width: `${(item.value / route.cost) * 100}%` }}
                      aria-hidden
                    />
                  ))}
                </div>
                <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
                  {breakdown.map((item) => (
                    <div key={item.label}>
                      <dt className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                        <span className={`h-2 w-2 rounded-full ${item.tone}`} aria-hidden />
                        {item.label}
                      </dt>
                      <dd className="mt-2 font-display text-xl font-medium tabular-nums tracking-[-0.01em]">
                        {formatCurrency(item.value, currency)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          </Reveal>

          {/* Stops ------------------------------------------------------------- */}
          <Reveal className="hidden">
            <div className="lg:pt-4">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-teal uppercase">
                Your homes along the way
              </p>
              <h2 className="mt-4 font-display text-3xl leading-[1.02] font-medium tracking-[-0.02em]">
                Stays worth arriving for
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Handpicked for atmosphere, location and value—not just a place to sleep.
              </p>
            </div>
            <div className="grid min-w-0 gap-5 md:grid-cols-2">
              {route.stops.map((stop) => (
                <article
                  key={stop.id}
                  className="group overflow-hidden rounded-[1.75rem] border border-white/75 bg-white/80 shadow-[0_22px_55px_-32px_rgba(6,37,48,0.48)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1.5 hover:shadow-elevated motion-reduce:transform-none"
                >
                  <div className="relative overflow-hidden">
                    {stop.hotel.hotelProvenance?.source === "demo-fixture" ? (
                      <div className="grid h-64 place-items-center bg-amber-100 text-sm font-semibold tracking-wide text-amber-900 uppercase md:h-72">
                        Demo hotel fixture
                      </div>
                    ) : stop.hotel.imageUrl ? (
                      <img
                        src={stop.hotel.imageUrl}
                        alt={`${stop.hotel.name} in ${stop.hotel.area}`}
                        className="h-64 w-full object-cover transition-transform duration-700 group-hover:scale-[1.055] motion-reduce:transform-none md:h-72"
                        loading="lazy"
                      />
                    ) : (
                      <div className="grid h-64 place-items-center bg-secondary px-4 text-center text-sm text-muted-foreground md:h-72">
                        Hotel image unavailable
                      </div>
                    )}
                    <p className="absolute top-4 left-4 rounded-full bg-ink/75 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                      {stop.name} · {stop.nights} nights
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-display text-2xl font-medium tracking-[-0.015em]">
                          {stop.hotel.name}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">{stop.hotel.area}</p>
                        <p className="mt-3 max-w-md text-sm leading-relaxed text-foreground/75">
                          {getHotelRecommendation(stop.name, stop.hotel.area, stop.hotel.style)}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
                        <Star className="h-4 w-4 fill-current text-sunset" aria-hidden />
                        {stop.hotel.rating}
                      </span>
                    </div>
                    <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
                      <div>
                        <p className="font-display text-2xl font-semibold">
                          {formatCurrency(stop.hotel.nightlyFrom, currency)}
                          <span className="font-sans text-sm font-normal text-muted-foreground">
                            {" "}
                            / night
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCurrency(
                            stop.hotel.totalStayPrice ??
                              stop.hotel.nightlyFrom *
                                stop.nights *
                                Math.max(1, Math.ceil(route.preferences.travellers / 2)),
                            currency,
                          )}{" "}
                          total stay
                        </p>
                      </div>
                      {stop.hotel.hotelProvenance?.bookable && stop.hotel.websiteUrl ? (
                        <a
                          href={stop.hotel.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-ink"
                        >
                          Book hotel
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      ) : (
                        <span className="text-sm font-semibold text-amber-800">
                          {stop.hotel.hotelProvenance?.source === "demo-fixture"
                            ? "Demo inventory — not bookable"
                            : "Booking link unavailable"}
                        </span>
                      )}
                    </div>
                    <details className="mt-5 border-t border-border/50 pt-4 text-sm text-muted-foreground">
                      <summary className="cursor-pointer font-medium">
                        Stay details and alternatives
                      </summary>
                      <div className="mt-3 space-y-2">
                        <p>
                          {stop.hotel.roomType ?? stop.hotel.style} ·{" "}
                          {stop.hotel.boardType ?? "Board not specified"}
                        </p>
                        <p>
                          {stop.weather.tempC}°C · {stop.weather.summary} ·{" "}
                          {stop.weather.rainChance}% chance of rain
                        </p>
                        <p>Nearby day trips: {stop.dayTrips.join(" · ")}</p>
                        {(stop.hotel.quality.source === "mock" ||
                          stop.hotel.hotelProvenance?.fallbackReason) && (
                          <p>
                            {stop.hotel.fallbackReason ??
                              "Sample accommodation pricing is being used because live availability was unavailable."}
                          </p>
                        )}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `hotels near ${stop.hotel.area}`,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-teal hover:underline"
                        >
                          View alternatives
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      </div>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          </Reveal>

          <div id="trip-budget" className="scroll-mt-28">
            <TripConfidenceStrip route={route} />
          </div>
          <div id="trip-discover" className="scroll-mt-28">
            <AsteraDecisionOverview route={route} comparison={comparisonRoute} />
          </div>
          <div id="trip-route" className="scroll-mt-28">
            <TripOverviewGrid route={route} currency={currency} />
          </div>

          <DayOverviewGallery route={route} />

          <Reveal className="mt-10 scroll-mt-28 sm:mt-12">
            <BudgetStretch route={route} onRouteChange={setRoute} />
          </Reveal>

          <AlternativeUniverses route={route} />

          {quoteBreak && (
            <Reveal className="mt-7 overflow-hidden rounded-[1.75rem] bg-ink">
              <div className="relative min-h-[170px] md:min-h-[190px]">
                <EditorialImage
                  src={quoteBreak.resolvedUrl}
                  fallback={neutralImage(quoteBreak.city).resolvedUrl}
                  alt={`${quoteBreak.placeName ?? quoteBreak.city ?? "Destination"} view`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/40 to-transparent" />
                <div className="relative flex min-h-[170px] items-center px-7 py-8 md:min-h-[190px] md:px-12">
                  <div className="max-w-xl text-white">
                    <span aria-hidden className="font-display text-5xl leading-none text-[#d3a348]">
                      “
                    </span>
                    <blockquote className="-mt-4 font-display text-[clamp(1.5rem,2.5vw,2.5rem)] leading-[1.05] tracking-[-0.03em]">
                      The best journeys leave enough room for the unexpected.
                    </blockquote>
                    <p className="mt-5 text-xs font-medium tracking-[0.16em] text-white/75 uppercase">
                      Your itinerary, with space to make it yours
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          )}

          <TripEssentials route={route} />

          <BookingStage route={route} onRouteChange={setRoute} />
        </div>
      </main>
    </PageShell>
  );
}

function TripConfidenceStrip({ route }: { route: TripRoute }) {
  const items = [
    {
      icon: Brain,
      title: "ASTERA curated",
      text: "Expert-planned around your constraints.",
    },
    {
      icon: CalendarDays,
      title: "Handpicked stays",
      text: `${route.stops.length} selected ${route.stops.length === 1 ? "stay" : "stays"} across the route.`,
    },
    {
      icon: MapIcon,
      title: "Local intelligence",
      text: "Provider-backed places and route context.",
    },
    {
      icon: ShieldCheck,
      title: "Flexible itinerary",
      text: "Edit the plan without starting again.",
    },
    {
      icon: Headphones,
      title: "Budget confidence",
      text: `${formatCurrency(Math.abs(route.budgetLeft), route.preferences.currency)} ${route.budgetLeft >= 0 ? "remaining" : "over budget"}.`,
    },
  ];
  return (
    <Reveal className="rounded-[1.05rem] border border-white/80 bg-white/95 py-3 shadow-[0_18px_48px_-40px_rgba(6,37,48,.42)] backdrop-blur-xl md:h-[64px] md:py-0">
      <div className="grid h-full gap-y-5 sm:grid-cols-2 lg:grid-cols-5">
        {items.map(({ icon: Icon, title, text }) => (
          <article
            key={title}
            className="flex items-center gap-3 px-4 lg:border-l lg:border-border/40 lg:first:border-l-0"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center text-teal">
              <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-sm font-medium">{title}</h2>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                {text}
              </p>
            </div>
          </article>
        ))}
      </div>
    </Reveal>
  );
}

function AsteraDecisionOverview({
  route,
  comparison,
}: {
  route: TripRoute;
  comparison?: TripRoute;
}) {
  const reduceMotion = useReducedMotion();
  const strengths = (route.scoreFactors ?? [])
    .filter((factor) => factor.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 5);
  const reasons = route.reasoning.slice(0, 3);
  const providerCount = new Set(
    route.itinerary.flatMap((day) => [
      ...(day.experiences ?? []).map((place) => place.providerPlaceId),
      ...(day.restaurantDetails ? [day.restaurantDetails.providerPlaceId] : []),
    ]),
  ).size;

  return (
    <Reveal className="mt-3 overflow-hidden rounded-[1.2rem] border border-border/40 bg-[#f8f5ef] shadow-[0_18px_50px_-44px_rgba(6,37,48,.38)]">
      <section
        aria-labelledby="astera-overview-heading"
        className="grid lg:grid-cols-[.76fr_1.24fr]"
      >
        <div className="p-5 sm:p-6 lg:p-6">
          <p className="text-[9px] font-semibold tracking-[.2em] text-teal uppercase">
            Curated with purpose
          </p>
          <h2
            id="astera-overview-heading"
            className="mt-2 max-w-md font-display text-[clamp(1.9rem,2.7vw,2.6rem)] leading-[.98] tracking-[-.025em]"
          >
            Why ASTERA chose this itinerary
          </h2>
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-foreground/72 sm:text-[13px]">
            {buildPersonalDecisionSummary(route)}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {reasons.map((reason, index) => (
              <article
                key={reason}
                className="rounded-lg border border-border/35 bg-white/65 p-2.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-teal" aria-hidden />
                <h3 className="mt-2 font-display text-sm">
                  {index === 0 ? "Smart route" : index === 1 ? "Better fit" : "Meaningful days"}
                </h3>
                <p className="mt-1 line-clamp-3 text-[9px] leading-relaxed text-muted-foreground">
                  {reason}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="border-border/35 p-5 sm:p-6 lg:border-l lg:p-6">
          <div>
            <p className="text-[9px] font-semibold tracking-[.18em] text-muted-foreground uppercase">
              ASTERA itinerary strengths
            </p>
            <div className="mt-3 space-y-2">
              {strengths.length > 0 ? (
                strengths.map((factor, index) => (
                  <div key={`${factor.label}-${index}`}>
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <span className="font-semibold">{factor.label}</span>
                      <span className="font-display text-sm">
                        {((factor.value ?? 0) / 10).toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white">
                      <motion.span
                        initial={reduceMotion ? false : { width: 0 }}
                        whileInView={{ width: `${Math.max(0, Math.min(100, factor.value ?? 0))}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: reduceMotion ? 0 : 0.65, delay: index * 0.06 }}
                        className="block h-full rounded-full bg-teal"
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Detailed strength data is unavailable for this saved itinerary.
                </p>
              )}
            </div>
            <div className="mt-3 grid gap-3 rounded-lg bg-ink p-3 text-white sm:grid-cols-[.8fr_1.2fr]">
              <div>
                <p className="text-[9px] tracking-[.16em] text-teal uppercase">Live evidence</p>
                <p className="mt-1 font-display text-xl">{providerCount} places analysed</p>
                <p className="mt-1 text-[10px] text-white/55">
                  Provider-backed attractions and restaurants stored with this trip.
                </p>
              </div>
              <div className="border-white/15 sm:border-l sm:pl-5">
                <p className="font-display text-base leading-snug">
                  {comparison
                    ? `Chosen ahead of ${getDestinationTitle(comparison)} for the stronger overall fit.`
                    : "Built around the constraints and preferences you supplied."}
                </p>
                <details className="mt-3 text-xs text-white/65">
                  <summary className="cursor-pointer font-semibold text-white">
                    Technical breakdown
                  </summary>
                  <div className="mt-4 rounded-lg bg-white p-3 text-ink">
                    <ScoreBreakdown
                      factors={route.scoreFactors ?? []}
                      overall={route.scores.overall}
                    />
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

function TripHeroImage({ image, city }: { image: ImageAsset[]; city: string }) {
  return (
    <SafeProviderImage
      candidates={image}
      requestedCity={city}
      alt={`${city} destination view`}
      loading="eager"
      className="h-full w-full scale-[1.02] object-cover"
    />
  );
}

function EditorialImage({
  src,
  fallback,
  alt,
  className,
}: {
  src: string;
  fallback: string;
  alt: string;
  className: string;
}) {
  const [activeSrc, setActiveSrc] = useState(src);
  return (
    <img
      src={activeSrc}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => activeSrc !== fallback && setActiveSrc(fallback)}
    />
  );
}

function AsteraChoiceSection({ route, comparison }: { route: TripRoute; comparison?: TripRoute }) {
  const reduceMotion = useReducedMotion();
  const currency = route.preferences.currency;
  const cityRecords = route.stops
    .map((stop) => CITIES.find((city) => city.name === stop.name))
    .filter((city): city is NonNullable<typeof city> => Boolean(city));
  const cityScore = (key: "photography" | "history" | "nightlife") =>
    cityRecords.length
      ? Math.round(
          cityRecords.reduce((total, city) => total + city.scores[key], 0) / cityRecords.length,
        )
      : null;
  const pacing = route.provenance?.metrics.pacing ?? null;
  const categories = [
    { label: "Photography", value: cityScore("photography") },
    { label: "Food", value: route.scores.food },
    { label: "History", value: cityScore("history") },
    { label: "Nature", value: route.scores.nature },
    { label: "Relaxation", value: pacing },
    { label: "Nightlife", value: cityScore("nightlife") },
  ].filter((item): item is { label: string; value: number } => item.value != null);
  const totalJourneyHours = route.legs.reduce((total, leg) => total + leg.hours, 0);
  const personalSummary = buildPersonalDecisionSummary(route);
  const primaryHotel = route.stops.find(
    (stop) => stop.hotel.hotelProvenance?.source !== "demo-fixture",
  );
  const restaurants = route.itinerary
    .map((day) => day.restaurantDetails)
    .filter((restaurant): restaurant is NonNullable<typeof restaurant> =>
      Boolean(
        restaurant?.providerPlaceId &&
        (restaurant.provider === "google" || restaurant.provider === "overpass"),
      ),
    );
  const primaryRestaurant = [...restaurants].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  const primaryRestaurantDay = primaryRestaurant
    ? route.itinerary.find(
        (day) => day.restaurantDetails?.providerPlaceId === primaryRestaurant.providerPlaceId,
      )
    : undefined;
  const hotelEvidence = primaryHotel ? buildHotelEvidence(primaryHotel, route) : null;
  const restaurantEvidence = primaryRestaurant
    ? buildRestaurantEvidence(primaryRestaurant, primaryRestaurantDay)
    : null;
  const hotelCount = route.provenance?.hotelbeds?.liveHotelCount ?? 0;
  const attractionCount = route.provenance?.pois?.liveAttractionCount ?? 0;
  const restaurantCount = route.provenance?.pois?.liveRestaurantCount ?? restaurants.length;
  const flightSearches =
    route.provenance?.apiCalls.filter((call) => /duffel|flight/i.test(call)).length ?? 0;
  const liveHotel = route.provenance?.hotelbeds?.source === "hotelbeds-live";
  const cachedHotel = route.provenance?.hotelbeds?.source === "hotelbeds-cache";
  const livePois = route.provenance?.pois?.status === "active";
  const liveWeather = route.stops.some((stop) => stop.weather.quality.source === "live");
  const liveTransport = route.legs.some((leg) => leg.quality?.source === "live");
  const weatherAge = minutesSince(route.generatedAt);
  const priorities = buildPriorityLabels(route);
  const depriorities = buildDeprioritisedLabels(route);
  const comparisonRows = comparison ? buildComparisonRows(route, comparison, currency) : [];

  return (
    <Reveal className="mt-20 md:mt-28">
      <section aria-labelledby="why-astera-heading" className="py-4 md:py-8">
        <div className="grid gap-12 lg:grid-cols-[1.08fr_.92fr] lg:gap-20">
          <div>
            <p className="text-[10px] font-semibold tracking-[.2em] text-teal uppercase">
              The decision, explained
            </p>
            <h2
              id="why-astera-heading"
              className="mt-3 max-w-2xl font-display text-[clamp(2.25rem,4vw,3.75rem)] leading-[.98] font-medium tracking-[-.035em]"
            >
              Why ASTERA chose this itinerary
            </h2>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-foreground/70">
              {personalSummary}
            </p>

            <div className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {route.budgetLeft >= 0 && (
                <ChoiceWin
                  title={`${formatCurrency(route.budgetLeft, currency)} left in your budget`}
                  text="The complete estimate stays inside the limit you set."
                />
              )}
              <ChoiceWin
                title={`${formatHours(totalJourneyHours)} in transit`}
                text={`${route.legs.length} planned leg${route.legs.length === 1 ? "" : "s"}, balanced against time at the destination.`}
              />
              <ChoiceWin
                title={bestWeatherStatement(route)}
                text="The strongest available forecast was used when positioning outdoor time."
              />
            </div>
          </div>

          <div className="self-start rounded-[2rem] bg-white p-7 shadow-[0_28px_70px_-48px_rgba(6,37,48,.55)] sm:p-8">
            <h3 className="font-display text-xl font-medium">What this trip is strongest at</h3>
            <div className="mt-5 space-y-4">
              {categories.map((category) => (
                <div key={category.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{category.label}</span>
                    <span className="text-muted-foreground">{Math.round(category.value)}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                    <motion.span
                      initial={reduceMotion ? false : { width: 0 }}
                      whileInView={{ width: `${Math.max(0, Math.min(100, category.value))}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: reduceMotion ? 0 : 0.6 }}
                      className="block h-full rounded-full bg-teal"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 md:mt-20">
          <div className="rounded-[2rem] bg-ink p-7 text-white shadow-[0_32px_80px_-48px_rgba(6,37,48,.75)] sm:p-9">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold tracking-[.18em] text-teal uppercase">
                  Why this is better
                </p>
                <h3 className="mt-2 font-display text-2xl font-medium">
                  {comparison
                    ? `Compared with ${getDestinationTitle(comparison)}`
                    : "Alternative comparison unavailable"}
                </h3>
              </div>
              {comparison && (
                <p className="text-xs text-white/55">Highest-ranked alternative from this search</p>
              )}
            </div>
            {comparison ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {comparisonRows.map((row) => (
                  <ComparisonFact key={row.label} {...row} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/65">
                This saved trip no longer has its sibling recommendations, so ASTERA will not invent
                a runner-up comparison.
              </p>
            )}
          </div>
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/55 p-5">
            <p className="text-[9px] font-semibold tracking-[.18em] text-teal uppercase">
              Prioritised
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {priorities.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-teal" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/55 p-5">
            <p className="text-[9px] font-semibold tracking-[.18em] text-muted-foreground uppercase">
              Intentionally deprioritised
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {depriorities.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-4 w-4 rounded-full border border-current" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-7 grid gap-5 border-t border-border/55 pt-7 lg:grid-cols-2">
          <ChoiceCallout
            eyebrow="Why this hotel?"
            title={primaryHotel ? primaryHotel.hotel.name : "Live hotel evidence unavailable"}
            text={
              primaryHotel
                ? hotelEvidence!
                : "No provider-backed hotel was stored, so ASTERA is not presenting a fabricated recommendation."
            }
          />
          <ChoiceCallout
            eyebrow="Why this restaurant?"
            title={primaryRestaurant?.name ?? "Live restaurant evidence unavailable"}
            text={
              primaryRestaurant
                ? restaurantEvidence!
                : "No provider-backed restaurant was stored for this trip."
            }
          />
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-sm font-semibold">Evidence behind the recommendation</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              ✓ {flightSearches} flight search{flightSearches === 1 ? "" : "es"} analysed · ✓{" "}
              {hotelCount} hotel offer{hotelCount === 1 ? "" : "s"} analysed · ✓ {attractionCount}{" "}
              attraction{attractionCount === 1 ? "" : "s"} analysed · ✓ {restaurantCount} restaurant
              {restaurantCount === 1 ? "" : "s"} analysed · ✓ Weather checked {weatherAge}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ConfidencePill label="Flights" live={liveTransport} />
            <ConfidencePill label="Hotels" live={liveHotel} cached={cachedHotel} />
            <ConfidencePill label="Places" live={livePois} />
            <ConfidencePill label="Weather" live={liveWeather} />
          </div>
        </div>

        <details className="group mt-6 border-t border-border/55 pt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-teal">Technical breakdown</summary>
          <div className="mt-5 grid gap-7 lg:grid-cols-2">
            <div className="grid gap-x-7 gap-y-4 sm:grid-cols-2">
              <ScoreBar label="Experience" value={route.scores.experience} />
              <ScoreBar label="Nature" value={route.scores.nature} tone="emerald" />
              <ScoreBar label="Food" value={route.scores.food} tone="sunset" />
              <ScoreBar label="Weather" value={route.scores.weather} tone="teal" />
            </div>
            <ScoreBreakdown factors={route.scoreFactors ?? []} overall={route.scores.overall} />
          </div>
        </details>
      </section>
    </Reveal>
  );
}

function ChoiceWin({ title, text }: { title: string; text: string }) {
  return (
    <article className="flex gap-3 rounded-2xl border border-border/50 p-4">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal/10 text-teal">
        <Check className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </article>
  );
}

function ComparisonFact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-white/12 bg-white/7 p-4">
      <p className="text-[9px] font-semibold tracking-[.14em] text-white/50 uppercase">{label}</p>
      <p className="mt-2 font-display text-xl font-medium">{value}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/60">{detail}</p>
    </article>
  );
}

function ChoiceCallout({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <article>
      <p className="text-[9px] font-semibold tracking-[.18em] text-teal uppercase">{eyebrow}</p>
      <h3 className="mt-2 font-display text-xl font-medium">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </article>
  );
}

function ConfidencePill({
  label,
  live,
  cached = false,
}: {
  label: string;
  live: boolean;
  cached?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold ${live ? "bg-emerald/10 text-emerald" : cached ? "bg-teal/10 text-teal" : "bg-secondary text-muted-foreground"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}: {live ? "Live source" : cached ? "Cached provider data" : "Estimate"}
    </span>
  );
}

const PREFERENCE_LABELS: Record<string, string> = {
  nature: "nature",
  food: "local food",
  shopping: "shopping",
  photography: "photography",
  history: "history",
  museums: "museums",
  nightlife: "nightlife",
  adventure: "adventure",
  luxury: "luxury",
  mountains: "mountains",
  lakes: "lakes",
  beaches: "beaches",
  castles: "castles",
  "hidden-gems": "hidden gems",
  hiking: "hiking",
  architecture: "architecture",
};

function buildPersonalDecisionSummary(route: TripRoute) {
  const prefs = route.preferences;
  const chosen = [...new Set([...prefs.interests, ...prefs.activities])]
    .map((item) => PREFERENCE_LABELS[item] ?? item.replaceAll("-", " "))
    .slice(0, 3);
  const priorities = chosen.length ? listNatural(chosen) : `${prefs.travelStyle} travel`;
  const movement = prefs.fewerHotelChanges
    ? `kept the plan to ${route.stops.length} hotel ${route.stops.length === 1 ? "stay" : "stays"}`
    : `kept total transit to ${formatHours(route.journeyHours)}`;
  return `You prioritised ${priorities} while keeping the complete trip within ${formatCurrency(prefs.budget, prefs.currency)}. ASTERA selected ${prefs.luxuryLevel} accommodation, ${movement}, and matched the itinerary’s provider-backed places to those constraints.`;
}

function buildPriorityLabels(route: TripRoute) {
  const prefs = route.preferences;
  const labels = [...new Set([...prefs.interests, ...prefs.activities])]
    .map((item) => PREFERENCE_LABELS[item] ?? item.replaceAll("-", " "))
    .slice(0, 5);
  labels.push(`Stay within ${formatCurrency(prefs.budget, prefs.currency)}`);
  if (prefs.fewerHotelChanges) labels.push("Fewer hotel changes");
  if (prefs.avoidFlights) labels.push("Avoid flights");
  return [...new Set(labels)].slice(0, 6);
}

function buildDeprioritisedLabels(route: TripRoute) {
  const selected = new Set([...route.preferences.interests, ...route.preferences.activities]);
  const candidates = [
    ["luxury", "Luxury hotels"],
    ["shopping", "Shopping"],
    ["nightlife", "Nightlife"],
    ["adventure", "High-intensity adventure"],
  ] as const;
  const labels = candidates.filter(([key]) => !selected.has(key)).map(([, label]) => label);
  if (route.preferences.fewerHotelChanges) labels.push("Extra stopovers");
  if (route.preferences.avoidFlights) labels.push("Flight-heavy routing");
  return labels.slice(0, 5);
}

function buildComparisonRows(route: TripRoute, alternative: TripRoute, currency: string) {
  const cost = alternative.cost - route.cost;
  const time = alternative.journeyHours - route.journeyHours;
  const transfers = countTransfers(alternative) - countTransfers(route);
  const weather = route.scores.weather - alternative.scores.weather;
  const preference =
    (route.provenance?.metrics.preferenceMatch ?? 0) -
    (alternative.provenance?.metrics.preferenceMatch ?? 0);
  const hotel = averageLiveHotelRating(route) - averageLiveHotelRating(alternative);
  return [
    {
      label: "Trip cost",
      value:
        cost > 0
          ? `${formatCurrency(cost, currency)} less`
          : cost < 0
            ? `${formatCurrency(Math.abs(cost), currency)} more`
            : "Same estimated cost",
      detail: "Compared from both stored trip totals.",
    },
    {
      label: "Travel time",
      value:
        time > 0
          ? `${formatHours(time)} less in transit`
          : time < 0
            ? `${formatHours(Math.abs(time))} more in transit`
            : "Same journey time",
      detail: "Calculated from the stored transport legs.",
    },
    {
      label: "Transfers",
      value:
        transfers > 0
          ? `${transfers} fewer transfer${transfers === 1 ? "" : "s"}`
          : transfers < 0
            ? `${Math.abs(transfers)} more transfer${transfers === -1 ? "" : "s"}`
            : "Same number of transfers",
      detail: "Includes route changes and stated flight stops.",
    },
    {
      label: "Weather",
      value:
        weather > 0
          ? "Stronger forecast fit"
          : weather < 0
            ? "Weaker forecast fit"
            : "Comparable weather",
      detail: `${Math.abs(weather)} stored forecast-fit points ${weather >= 0 ? "ahead" : "behind"}.`,
    },
    {
      label: "Your preferences",
      value:
        preference > 0
          ? "Closer to your priorities"
          : preference < 0
            ? "Broader compromise"
            : "Comparable preference fit",
      detail: `${Math.abs(preference)} grounded-place match points ${preference >= 0 ? "ahead" : "behind"}.`,
    },
    {
      label: "Hotel quality",
      value:
        Number.isFinite(hotel) && hotel !== 0
          ? `${Math.abs(hotel).toFixed(1)}★ ${hotel > 0 ? "higher" : "lower"}`
          : "Comparable live hotel rating",
      detail: "Uses provider-backed ratings only.",
    },
  ];
}

function countTransfers(route: TripRoute) {
  return (
    Math.max(0, route.legs.length - 1) +
    route.legs.reduce(
      (total, leg) =>
        total + (leg.mode === "flight" ? Number(leg.note.match(/(\d+)\s+stop/)?.[1] ?? 0) : 0),
      0,
    )
  );
}

function averageLiveHotelRating(route: TripRoute) {
  const hotels = route.stops.filter(
    (stop) => stop.hotel.hotelProvenance?.source !== "demo-fixture",
  );
  return hotels.length
    ? hotels.reduce((total, stop) => total + stop.hotel.rating, 0) / hotels.length
    : Number.NaN;
}

function buildHotelEvidence(stop: TripStop, route: TripRoute) {
  const hotel = stop.hotel;
  const facts = [
    `${hotel.rating}★ provider rating`,
    `${formatCurrency(hotel.nightlyFrom, route.preferences.currency)} per night`,
  ];
  if (hotel.boardType) facts.push(hotel.boardType);
  if (hotel.roomType) facts.push(hotel.roomType);
  const firstPlace = route.itinerary.find((day) => day.city === stop.name)?.experiences?.[0];
  if (
    Number.isFinite(hotel.latitude) &&
    Number.isFinite(hotel.longitude) &&
    Number.isFinite(firstPlace?.lat) &&
    Number.isFinite(firstPlace?.lon)
  ) {
    const walk = Math.max(
      1,
      Math.round(
        haversineKm(hotel.latitude!, hotel.longitude!, firstPlace!.lat!, firstPlace!.lon!) * 12,
      ),
    );
    facts.push(`${walk}-minute estimated walk to ${firstPlace!.name}`);
  }
  if (hotel.hotelProvenance?.bookable) facts.push("live bookable availability");
  return `${facts.join(" · ")}. Cancellation terms are omitted because the provider did not store them.`;
}

function buildRestaurantEvidence(restaurant: PlannedRestaurant, day?: DayPlan) {
  const facts: string[] = [];
  if (restaurant.category) facts.push(restaurant.category.replaceAll("_", " "));
  if (restaurant.rating) facts.push(`${restaurant.rating.toFixed(1)}★ provider rating`);
  if (restaurant.reviewCount) facts.push(`${restaurant.reviewCount.toLocaleString()} reviews`);
  const previous = day?.experiences?.at(-1);
  if (
    Number.isFinite(previous?.lat) &&
    Number.isFinite(previous?.lon) &&
    Number.isFinite(restaurant.lat) &&
    Number.isFinite(restaurant.lon)
  ) {
    const walk = Math.max(
      1,
      Math.round(
        haversineKm(previous!.lat!, previous!.lon!, restaurant.lat!, restaurant.lon!) * 12,
      ),
    );
    facts.push(`${walk}-minute estimated walk from ${previous!.name}`);
  }
  return `${facts.join(" · ")}. Reservation guidance was not supplied by the provider.`;
}

function bestWeatherStatement(route: TripRoute) {
  const best = [...route.stops].sort((a, b) => b.weather.tempC - a.weather.tempC)[0];
  return best
    ? `${best.weather.summary} in ${best.name} at ${best.weather.tempC}°C`
    : "Weather evidence unavailable";
}

function minutesSince(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  return minutes < 2 ? "just now" : `${minutes} minutes ago`;
}

function listNatural(items: string[]) {
  if (items.length <= 1) return items[0] ?? "your selected constraints";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Present the optimiser's 0–100 fit as a consumer-friendly 4.0–5.0 trip-fit scale. */
function getHeroTripFit(score: number) {
  return 4 + Math.max(0, Math.min(100, score)) / 100;
}

function TripOverviewGrid({ route, currency }: { route: TripRoute; currency: string }) {
  const imageAllocation = allocateTripImages(route);
  const seenExperienceIds = new Set<string>();
  const mapExperiences = route.itinerary
    .flatMap((day) => day.experiences ?? [])
    .filter(
      (place) =>
        place.providerPlaceId &&
        Number.isFinite(place.lat) &&
        Number.isFinite(place.lon) &&
        !seenExperienceIds.has(place.providerPlaceId) &&
        seenExperienceIds.add(place.providerPlaceId),
    )
    .slice(0, 6);
  const requestedOrigin = route.preferences.startCity.trim().toLowerCase().split(",")[0]?.trim();
  const origin = CITIES.find((city) => city.name.toLowerCase() === requestedOrigin);
  const firstStop = route.stops[0];
  const originIsFirstStop = Boolean(
    origin && firstStop && Math.abs(origin.lat - firstStop.lat) < 0.005 && Math.abs(origin.lon - firstStop.lon) < 0.005,
  );
  const routeMapPoints = [
    ...(!origin || originIsFirstStop
      ? []
      : [{ id: `origin-${origin.id}`, name: origin.name, city: origin.name, lat: origin.lat, lon: origin.lon, kind: "origin" as const, detail: "Trip origin" }]),
    ...route.stops.map((stop, index) => ({ id: `destination-${stop.id}`, name: stop.name, city: stop.name, lat: stop.lat, lon: stop.lon, kind: "destination" as const, markerLabel: String(index + 1), detail: `${stop.nights} ${stop.nights === 1 ? "night" : "nights"}` })),
  ];
  const hotelMapPoints = route.stops.flatMap((stop) =>
    Number.isFinite(stop.hotel.latitude) && Number.isFinite(stop.hotel.longitude)
      ? [{ id: `stay-${stop.hotel.id ?? stop.id}`, name: stop.hotel.name, city: stop.name, lat: stop.hotel.latitude!, lon: stop.hotel.longitude!, kind: "stay" as const, detail: `${stop.hotel.rating}★ · ${stop.hotel.area}` }]
      : [],
  );
  const highlightMapPoints = mapExperiences.map((place) => ({ id: `highlight-${place.providerPlaceId}`, name: place.name, city: route.itinerary.find((day) => day.experiences?.some((item) => item.providerPlaceId === place.providerPlaceId))?.city ?? route.stops.at(-1)?.name ?? "", lat: place.lat!, lon: place.lon!, kind: "highlight" as const, detail: place.category.replaceAll("_", " ") }));
  const renderedMapPoints = [...routeMapPoints, ...hotelMapPoints, ...highlightMapPoints];
  return (
    <Reveal className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-stretch">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-[1.35rem] border border-border/35 bg-white p-4 shadow-[0_20px_55px_-44px_rgba(6,37,48,.5)] sm:p-5">
        <div className="flex items-end justify-between gap-3 px-1 pb-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[.18em] text-teal uppercase">
              Your journey
            </p>
            <h2 className="mt-1 font-display text-[1.65rem] leading-none font-medium">
              Route & highlights
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {route.stops.map((stop) => stop.name).join(" · ")}
          </p>
        </div>
        <RouteMap points={renderedMapPoints} routePoints={routeMapPoints} className="h-[230px] w-full rounded-[1.1rem] sm:h-[260px]" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground">
            {routeMapPoints.some((point) => point.kind === "origin") && <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full border-2 border-ink bg-white" aria-hidden /> Origin</span>}
            <span className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full bg-ink" aria-hidden /> Destination
            </span>
            {hotelMapPoints.length > 0 && <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-teal" aria-hidden /> Stay</span>}
            <span className="flex items-center gap-1.5">
              <i className="w-5 border-t-2 border-teal" aria-hidden /> Route
            </span>
          </div>
          <a
            href={`https://www.google.com/maps/dir/${routeMapPoints.map((point) => encodeURIComponent(`${point.lat},${point.lon}`)).join("/")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
          >
            Open full map <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
        {route.legs.length > 0 && <div className="mt-3 border-t border-border/40 px-1 pt-2.5 text-xs">
          <p className="font-semibold text-ink">Journey details</p>
          <div className="mt-2 space-y-1.5 text-muted-foreground">
            {route.legs.map((leg, index) => <div key={`${leg.from}-${leg.to}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <p className="truncate"><span className="font-medium text-ink">{leg.from} → {leg.to}</span> · <span className="capitalize">{leg.mode}</span> · {formatHours(leg.hours)}</p>
              <p className="whitespace-nowrap">{formatCurrency(leg.cost, currency)} · {leg.quality?.source === "live" ? leg.quality.provider : "Estimate"}</p>
            </div>)}
          </div>
        </div>}
      </section>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-[1.35rem] border border-border/35 bg-white p-4 shadow-[0_20px_55px_-44px_rgba(6,37,48,.5)] sm:p-5 lg:h-[350px]">
        <div className="flex items-end justify-between gap-3 px-1 pb-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[.18em] text-teal uppercase">
              Where you’ll stay
            </p>
            <h2 className="mt-1 font-display text-[1.65rem] leading-none font-medium">
              Handpicked for comfort & character
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {route.stops.reduce((sum, stop) => sum + stop.nights, 0)} nights
          </span>
        </div>
        <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {route.stops.map((stop) => (
            <article
              key={stop.id}
              className={`grid h-full min-w-full snap-start content-start gap-4 ${stop.hotel.imageUrl && stop.hotel.hotelProvenance?.source !== "demo-fixture" ? "sm:grid-cols-[180px_minmax(0,1fr)]" : "grid-cols-1"}`}
            >
              {stop.hotel.hotelProvenance?.source !== "demo-fixture" && stop.hotel.imageUrl && (
                <SafeProviderImage
                  candidates={imageAllocation.hotelImages[stop.hotel.id] ?? []}
                  requestedCity={stop.name}
                  alt={`${stop.hotel.name} in ${stop.name}`}
                  placeholder={false}
                  className="h-[190px] w-full rounded-[1.1rem] object-cover transition-transform duration-500 hover:scale-[1.02] motion-reduce:transform-none"
                />
              )}
              <div className="min-w-0 py-1">
                <p className="text-[10px] font-semibold tracking-wide text-teal uppercase">
                  {stop.name} · {stop.nights} nights
                </p>
                <h3 className="mt-1 font-display text-[1.35rem] leading-tight font-medium">
                  {stop.hotel.hotelProvenance?.source === "demo-fixture"
                    ? "Live accommodation unavailable"
                    : stop.hotel.name}
                </h3>
                {stop.hotel.hotelProvenance?.source !== "demo-fixture" && (
                  <>
                    <p className="mt-1 flex items-center gap-1 text-xs">
                      <Star className="h-3 w-3 fill-current text-sunset" aria-hidden />{" "}
                      {stop.hotel.rating} · {stop.hotel.area}
                    </p>
                    <p className="mt-2 font-display text-lg font-semibold">
                      {formatCurrency(stop.hotel.nightlyFrom, currency)}{" "}
                      <span className="font-sans text-xs font-normal text-muted-foreground">
                        / night
                      </span>
                    </p>
                  </>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                  {stop.hotel.websiteUrl && stop.hotel.hotelProvenance?.bookable ? (
                    <a
                      href={stop.hotel.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-teal"
                    >
                      Book hotel
                    </a>
                  ) : (
                    <span className="text-amber-800">
                      {stop.hotel.hotelProvenance?.source === "demo-fixture"
                        ? "Demo — not bookable"
                        : "Booking unavailable"}
                    </span>
                  )}
                  <details>
                    <summary className="cursor-pointer font-semibold">View details</summary>
                    <p className="mt-2 text-muted-foreground">
                      {stop.hotel.roomType ?? stop.hotel.style} ·{" "}
                      {stop.hotel.boardType ?? "Board not specified"} · Cancellation terms confirmed
                      on booking site
                    </p>
                  </details>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`hotels near ${stop.hotel.area}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-teal"
                  >
                    Change accommodation
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </Reveal>
  );
}

function TripEssentials({ route }: { route: TripRoute }) {
  const flightLegs = route.legs.filter((leg) => leg.mode === "flight");
  const firstFlight = flightLegs[0];
  const lastFlight = flightLegs.at(-1);
  const essentials = [
    {
      icon: PlaneTakeoff,
      title: "Flights",
      text: firstFlight
        ? `${firstFlight.from} → ${firstFlight.to} · ${formatHours(firstFlight.hours)}`
        : "No flight leg in this route",
    },
    {
      icon: PlaneLanding,
      title: "Return flight",
      text:
        lastFlight && lastFlight !== firstFlight
          ? `${lastFlight.from} → ${lastFlight.to} · ${formatHours(lastFlight.hours)}`
          : "Confirmed during flight selection",
    },
    {
      icon: ShieldCheck,
      title: "Travel insurance",
      text: "Not included — arrange before departure",
    },
    { icon: FileText, title: "Documents / Visa", text: "Check official entry requirements" },
    { icon: MapIcon, title: "Offline maps", text: "Save maps before departure" },
    {
      icon: Headphones,
      title: "24/7 support",
      text: "Not included unless provided by your booking",
    },
  ];
  return (
    <Reveal className="mt-7 overflow-hidden rounded-[1.75rem] bg-white shadow-[0_28px_70px_-50px_rgba(6,37,48,.5)]">
      <div className="grid sm:grid-cols-2 lg:grid-cols-6">
        {essentials.map(({ icon: Icon, title, text }) => (
          <article key={title} className="border-border/50 p-4 lg:border-l lg:first:border-l-0">
            <Icon className="h-4 w-4 text-teal" aria-hidden />
            <h2 className="mt-3 text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{text}</p>
          </article>
        ))}
      </div>
      <details className="border-t border-border/50 px-5 py-3 text-xs">
        <summary className="cursor-pointer font-semibold">Packing list</summary>
        <ul className="mt-3 grid gap-2 text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          {route.packingList.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </details>
    </Reveal>
  );
}

function isGroundedImagePlace(place: NonNullable<DayPlan["experiences"]>[number]) {
  return Boolean(
    place.image &&
    place.image !== "/images/place-placeholder.svg" &&
    place.providerPlaceId &&
    (place.provider === "google" || place.provider === "overpass") &&
    (place.sourceStatus === "google-live" ||
      place.sourceStatus === "google-cache" ||
      place.sourceStatus === "overpass-live") &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lon),
  );
}

function getDestinationTitle(route: TripRoute) {
  const destination = route.stops.at(-1);
  if (!destination) return route.title;
  const country = route.countries.at(-1);
  return country ? `${destination.name}, ${country}` : destination.name;
}

function getTripPace(route: TripRoute) {
  const daysPerCity = route.itinerary.length / Math.max(1, route.stops.length);
  if (daysPerCity >= 3.5) return "Slow paced";
  if (daysPerCity <= 1.75) return "Fast paced";
  return "Balanced pace";
}

function getDayWalkingEstimate(day: DayPlan) {
  const points = (day.experiences ?? []).filter(
    (place) => Number.isFinite(place.lat) && Number.isFinite(place.lon),
  );
  if (points.length < 2) return null;
  let directKm = 0;
  for (let index = 1; index < points.length; index += 1) {
    directKm += haversineKm(
      points[index - 1]!.lat!,
      points[index - 1]!.lon!,
      points[index]!.lat!,
      points[index]!.lon!,
    );
  }
  const km = directKm * 1.25;
  return { km, steps: Math.round((km * 1_300) / 50) * 50 };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function EditorialDayBreak({
  image,
  alt,
  quote,
  reduceMotion,
}: {
  image: string;
  alt: string;
  quote: string;
  reduceMotion: boolean;
}) {
  return (
    <motion.figure
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="group relative my-7 min-h-[300px] overflow-hidden rounded-[2rem] bg-ink shadow-[0_30px_75px_-38px_rgba(6,37,48,0.65)] md:min-h-[390px]"
    >
      <img
        src={image}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.035] motion-reduce:transform-none"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
      <blockquote className="absolute right-7 bottom-7 left-7 max-w-2xl font-display text-[clamp(2rem,4vw,3.8rem)] leading-[1.02] tracking-[-0.035em] text-white md:right-10 md:bottom-10 md:left-10">
        {quote}
      </blockquote>
    </motion.figure>
  );
}

function JourneyProgression({
  stops,
  experiences = [],
  compact = false,
}: {
  stops: TripStop[];
  experiences?: PlannedExperience[];
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: "-100px" });
  const [activeStop, setActiveStop] = useState(0);
  const projected = useMemo(() => projectStops(stops), [stops]);
  const routePath = projected
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  useEffect(() => {
    if (!inView || reduceMotion || stops.length < 2) return;
    let next = 0;
    const timer = window.setInterval(() => {
      next += 1;
      setActiveStop(Math.min(next, stops.length - 1));
      if (next >= stops.length - 1) window.clearInterval(timer);
    }, 850);
    return () => window.clearInterval(timer);
  }, [inView, reduceMotion, stops.length]);

  useEffect(() => {
    if (reduceMotion) setActiveStop(Math.max(0, stops.length - 1));
  }, [reduceMotion, stops.length]);

  return (
    <div
      ref={containerRef}
      className="relative mt-2 overflow-hidden rounded-[1.35rem] border border-border/60 shadow-soft"
    >
      <RouteMap
        points={[
          ...stops.map((stop) => ({
            lat: stop.lat,
            lon: stop.lon,
            name: stop.name,
            kind: "stay" as const,
          })),
          ...experiences.map((place) => ({
            lat: place.lat!,
            lon: place.lon!,
            name: place.name,
            kind: "experience" as const,
          })),
        ]}
        className={compact ? "h-[220px] w-full" : "h-[440px] w-full"}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/10 to-transparent" />
      <svg
        className={`pointer-events-none absolute inset-0 h-full w-full ${compact ? "hidden" : ""}`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d={routePath} fill="none" stroke="white" strokeOpacity="0.72" strokeWidth="1.1" />
        <motion.path
          d={routePath}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth="1.35"
          strokeLinecap="round"
          initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{
            duration: reduceMotion ? 0 : Math.max(1.4, stops.length * 0.7),
            ease: "easeInOut",
          }}
          style={{
            filter: "drop-shadow(0 0 5px color-mix(in oklab, var(--color-teal), transparent 30%))",
          }}
        />
      </svg>
      {projected.map((point, index) => (
        <motion.div
          key={point.stop.id}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
          animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
          transition={{
            duration: reduceMotion ? 0 : 0.45,
            delay: reduceMotion ? 0 : 0.42 + index * 0.55,
          }}
          className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${compact ? "hidden" : ""}`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
        >
          <span
            className={`relative grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-semibold shadow-lift transition-all duration-500 ${
              activeStop === index
                ? "scale-110 border-white bg-teal text-white ring-8 ring-teal/18"
                : "border-white/90 bg-ink/85 text-white backdrop-blur-md"
            }`}
          >
            {index + 1}
          </span>
          <span
            className={`absolute top-11 left-1/2 -translate-x-1/2 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap shadow-soft backdrop-blur-md transition-colors duration-500 ${
              activeStop === index ? "bg-teal text-white" : "bg-card/90 text-foreground"
            }`}
          >
            {point.stop.name}
          </span>
        </motion.div>
      ))}
      <p className="sr-only" aria-live="polite">
        Active stop: {stops[activeStop]?.name}
      </p>
    </div>
  );
}

function projectStops(stops: TripStop[]) {
  if (!stops.length) return [];
  const longitudes = stops.map((stop) => stop.lon);
  const latitudes = stops.map((stop) => stop.lat);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const lonRange = Math.max(maxLon - minLon, 0.01);
  const latRange = Math.max(maxLat - minLat, 0.01);

  return stops.map((stop, index) => ({
    stop,
    x: stops.length === 1 ? 50 : 13 + ((stop.lon - minLon) / lonRange) * 74,
    y: stops.length === 1 ? 50 : 18 + ((maxLat - stop.lat) / latRange) * 60 + (index % 2) * 2,
  }));
}

function RevealStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={`mt-1 font-display text-2xl font-medium tabular-nums ${
          tone === "good" ? "text-emerald" : tone === "warn" ? "text-destructive" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function HeroStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-[0.16em] text-white/55 uppercase">
        {label}
      </dt>
      <dd
        className={`mt-1 font-display text-xl font-medium tabular-nums tracking-[-0.01em] ${
          tone === "good" ? "text-teal" : tone === "warn" ? "text-sunset" : "text-white"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function getTripSummary(route: TripRoute) {
  if (route.tagline.trim()) return route.tagline;
  const destinations = route.stops
    .slice(0, 3)
    .map((stop) => stop.name)
    .join(", ");
  return `Historic streets, memorable tables and unhurried evenings across ${destinations}.`;
}

function getHotelRecommendation(city: string, area: string, style: string) {
  const character = style ? `${style.toLowerCase()} character` : "a considered sense of place";
  return `Our pick in ${city}: a well-placed stay near ${area}, chosen for ${character} and easy days on foot.`;
}

function getDayTitle(day: number, city: string, morning: string) {
  const lower = morning.toLowerCase();
  if (lower.includes("arrival") || lower.includes("arrive") || day === 1) {
    return `First light in ${city}`;
  }
  if (lower.includes("market") || lower.includes("food") || lower.includes("café")) {
    return `A taste of ${city}`;
  }
  if (lower.includes("museum") || lower.includes("historic") || lower.includes("old town")) {
    return `${city}, through the centuries`;
  }
  if (lower.includes("beach") || lower.includes("coast") || lower.includes("water")) {
    return `The slower side of ${city}`;
  }
  return day % 2 === 0 ? `${city} at your own pace` : `The character of ${city}`;
}

function getDayMood(day: number, city: string) {
  const moods = [
    `Settle into ${city} gently, following the neighbourhood's rhythm rather than a checklist.`,
    `A day for the places, flavours and small discoveries that give ${city} its character.`,
    `See more of ${city} without rushing it—considered highlights with room to wander.`,
  ];
  return moods[(day - 1) % moods.length];
}
