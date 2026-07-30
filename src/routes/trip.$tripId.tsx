import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useInView, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Brain,
  Check,
  CloudRain,
  ExternalLink,
  Luggage,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DataBadge } from "@/components/common/DataBadge";
import { Reveal } from "@/components/common/Reveal";
import { ScoreBar } from "@/components/common/ScoreBar";
import { ScoreBreakdown } from "@/components/trip/ScoreBreakdown";
import { BudgetStretch } from "@/components/trip/BudgetStretch";
import { BookingStage } from "@/components/trip/BookingStage";
import { ScoreRing } from "@/components/common/ScoreRing";
import { PageShell } from "@/components/layout/PageShell";
import { RouteMap } from "@/components/map/RouteMap";
import { DayExperienceGrid } from "@/components/trip/DayExperienceGrid";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSavedTrips } from "@/hooks/useSavedTrips";
import { findRouteById } from "@/lib/storage";
import { formatCurrency, formatHours } from "@/lib/format";
import type { TripRoute, TripStop } from "@/lib/types";

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
  component: TripDetailPage,
});

function TripDetailPage() {
  const { tripId } = Route.useParams();
  const { toggle, isSaved } = useSavedTrips();
  const [route, setRoute] = useState<TripRoute | null>(null);
  const [ready, setReady] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setRoute(findRouteById(tripId) ?? null);
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
  const breakdown = [
    { label: "Transport", value: route.costBreakdown.transport, tone: "bg-primary" },
    { label: "Accommodation", value: route.costBreakdown.accommodation, tone: "bg-teal" },
    { label: "Food", value: route.costBreakdown.food, tone: "bg-sunset" },
    { label: "Activities", value: route.costBreakdown.activities, tone: "bg-emerald" },
    { label: "Buffer", value: route.costBreakdown.buffer, tone: "bg-muted-foreground" },
  ];

  return (
    <PageShell>
      {/* Hero — more editorial prominence -------------------------------- */}
      <header className="relative h-[72svh] min-h-[560px] max-h-[860px] overflow-hidden">
        <img
          src={route.image}
          alt={route.stops.map((stop) => stop.name).join(", ")}
          width={1920}
          height={1200}
          className="h-full w-full scale-[1.02] object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/38 to-ink/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/55 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-5 pb-9 md:px-8 md:pb-12">
          <Button
            asChild
            variant="glass"
            size="sm"
            className="mb-5 border-white/20 bg-white/10 backdrop-blur-xl"
          >
            <Link to="/results">
              <ArrowLeft aria-hidden />
              All routes
            </Link>
          </Button>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
            <div className="min-w-0">
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] text-primary-foreground/85 uppercase backdrop-blur-xl">
                Curated for you · {route.countries.join(" · ")}
              </p>
              <h1 className="mt-4 max-w-4xl font-display text-[clamp(3.4rem,8vw,6.5rem)] leading-[0.88] font-medium tracking-[-0.045em] text-primary-foreground">
                {route.title}
              </h1>
              <p className="mt-4 max-w-2xl font-display text-lg leading-relaxed text-primary-foreground/85 md:text-xl">
                {getTripSummary(route)}
              </p>
              <dl className="mt-7 flex w-fit max-w-full flex-wrap gap-x-8 gap-y-4 rounded-2xl border border-white/15 bg-ink/25 px-5 py-4 shadow-2xl backdrop-blur-xl">
                <HeroStat label="Trip length" value={`${route.itinerary.length} days`} />
                <HeroStat label="Estimated total" value={formatCurrency(route.cost, currency)} />
                <HeroStat
                  label={route.budgetLeft < 0 ? "Over budget" : "Budget left"}
                  value={formatCurrency(Math.abs(route.budgetLeft), currency)}
                  tone={route.budgetLeft < 0 ? "warn" : "good"}
                />
              </dl>
            </div>
            <ScoreRing value={route.scores.overall} size={88} className="shrink-0" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        {/* Emotional reveal ------------------------------------------------ */}
        <section aria-labelledby="trip-reveal-heading">
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
                transition={{ duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : 0.12 }}
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
                <RevealStat label="Estimated total" value={formatCurrency(route.cost, currency)} />
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
                  <ScoreBar label="Weather" value={route.scores.weather} tone="teal" delay={0.15} />
                </div>
              </div>
              <ScoreBreakdown factors={route.scoreFactors ?? []} overall={route.scores.overall} />
            </div>
          </details>
        </section>

        {/* Why this route — reasoning as elegant callouts ------------------- */}
        <Reveal className="mt-12 py-6 text-center md:py-8">
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

        {/* Stretch your budget — featured band --------------------------- */}
        <Reveal className="mt-14">
          <BudgetStretch route={route} />
        </Reveal>

        {/* Map -------------------------------------------------------------- */}
        <Reveal className="mt-16 grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-10">
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
        <Reveal className="mt-16">
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
        <Reveal className="mt-14 grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-10">
          <div className="lg:pt-4">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-teal uppercase">
              Where you’ll stay
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
                  <img
                    src={stop.hotel.imageUrl ?? route.image}
                    alt={`${stop.hotel.name} in ${stop.hotel.area}`}
                    className="h-64 w-full object-cover transition-transform duration-700 group-hover:scale-[1.055] motion-reduce:transform-none md:h-72"
                    loading="lazy"
                  />
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
                    <a
                      href={
                        stop.hotel.websiteUrl ??
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${stop.hotel.name}, ${stop.hotel.area}`,
                        )}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-ink"
                    >
                      Book hotel
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
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
                        {stop.weather.tempC}°C · {stop.weather.summary} · {stop.weather.rainChance}%
                        chance of rain
                      </p>
                      <p>Nearby day trips: {stop.dayTrips.join(" · ")}</p>
                      {stop.hotel.quality.source === "mock" && (
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

        {/* Timeline — immersive day-by-day --------------------------------- */}
        <Reveal className="mt-14 grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-10">
          <div className="lg:pt-4">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-teal uppercase">
              The days you’ll remember
            </p>
            <h2 className="mt-4 font-display text-3xl leading-[1.02] font-medium tracking-[-0.025em]">
              Your story, day by day
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Curated experiences, local flavour and enough room for the moments you cannot
              schedule.
            </p>
          </div>
          <ol className="min-w-0 space-y-3">
            {route.itinerary.map((day) => (
              <li key={day.day}>
                <details
                  className="group/day overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/75 p-6 shadow-[0_18px_45px_-32px_rgba(6,37,48,0.42)] backdrop-blur-lg transition-shadow hover:shadow-soft sm:p-7"
                  open={day.day === 1}
                >
                  <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                        Day {day.day} · {day.city}
                      </p>
                      <motion.h3
                        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.5,
                          delay: reduceMotion ? 0 : day.day === 1 ? 0.08 : 0,
                        }}
                        className="mt-1 font-display text-2xl font-medium tracking-[-0.01em]"
                      >
                        {getDayTitle(day.day, day.city, day.morning)}
                      </motion.h3>
                      <motion.p
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.5,
                          delay: reduceMotion ? 0 : day.day === 1 ? 0.24 : 0.05,
                        }}
                        className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground"
                      >
                        {getDayMood(day.day, day.city)}
                      </motion.p>
                    </div>
                    <span className="text-sm font-medium text-teal group-open/day:hidden">
                      Explore
                    </span>
                    <span className="hidden text-sm text-muted-foreground group-open/day:inline">
                      Close
                    </span>
                  </summary>
                  <div className="pt-2">
                    <DayExperienceGrid
                      day={day}
                      stop={route.stops.find((stop) => stop.name === day.city)}
                      preferences={route.preferences}
                    />

                    <div className="mt-8 flex items-start gap-2.5 text-sm text-muted-foreground">
                      <CloudRain className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                      <span>
                        <span className="font-medium text-foreground">If it rains: </span>
                        {day.rainyDayAlternative}
                      </span>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal className="relative left-1/2 mt-14 w-screen -translate-x-1/2 overflow-hidden bg-[#e9e2d6]">
          <div className="relative min-h-[320px] md:min-h-[390px]">
            <img
              src={route.image}
              alt={`A memorable view from ${route.countries.join(" and ")}`}
              className="absolute inset-y-0 left-0 h-full w-full object-cover md:w-[62%]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-ink/25 md:bg-gradient-to-r md:from-transparent md:via-[#e9e2d6]/75 md:to-[#e9e2d6]" />
            <div className="relative mx-auto flex min-h-[320px] max-w-6xl items-center justify-center px-5 py-14 md:min-h-[390px] md:justify-end md:px-8">
              <div className="max-w-xl rounded-[2rem] border border-white/25 bg-ink/45 p-7 text-white shadow-2xl backdrop-blur-md md:w-[52%] md:border-0 md:bg-transparent md:p-0 md:text-foreground md:shadow-none md:backdrop-blur-none">
                <span aria-hidden className="font-display text-7xl leading-none text-teal/80">
                  “
                </span>
                <blockquote className="-mt-5 font-display text-[clamp(2rem,4vw,3.7rem)] leading-[1.05] tracking-[-0.03em]">
                  The best journeys leave enough room for the unexpected.
                </blockquote>
                <p className="mt-5 text-xs font-medium tracking-[0.16em] text-white/75 uppercase md:text-teal">
                  Your itinerary, with space to make it yours
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Packing ----------------------------------------------------------- */}
        <Reveal className="mt-16 rounded-4xl bg-sand/60 p-6 md:p-10">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-card text-teal">
              <Luggage className="h-5 w-5" strokeWidth={1.6} aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Before you leave
              </p>
              <h2 className="font-display text-2xl font-medium tracking-[-0.01em]">Packing list</h2>
            </div>
          </div>
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {route.packingList.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 rounded-2xl bg-card/60 px-3 py-2 text-sm text-foreground/85"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <BookingStage route={route} onRouteChange={setRoute} />
      </div>
    </PageShell>
  );
}

function JourneyProgression({ stops }: { stops: TripStop[] }) {
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
      className="relative mt-6 overflow-hidden rounded-4xl border border-border shadow-soft"
    >
      <RouteMap
        points={stops.map((stop) => ({
          lat: stop.lat,
          lon: stop.lon,
          name: stop.name,
        }))}
        className="h-[440px] w-full"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/10 to-transparent" />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
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
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
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
