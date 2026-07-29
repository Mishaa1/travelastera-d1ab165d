import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Brain,
  CloudRain,
  Luggage,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { DataBadge } from "@/components/common/DataBadge";
import { Reveal } from "@/components/common/Reveal";
import { ScoreBar } from "@/components/common/ScoreBar";
import { ScoreBreakdown } from "@/components/trip/ScoreBreakdown";
import { BudgetStretch } from "@/components/trip/BudgetStretch";
import { ScoreRing } from "@/components/common/ScoreRing";
import { PageShell } from "@/components/layout/PageShell";
import { RouteMap } from "@/components/map/RouteMap";
import { DayExperienceGrid } from "@/components/trip/DayExperienceGrid";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSavedTrips } from "@/hooks/useSavedTrips";
import { findRouteById } from "@/lib/storage";
import { formatCurrency, formatHours } from "@/lib/format";
import type { TripRoute } from "@/lib/types";

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
      <header className="relative h-[62vh] min-h-96 overflow-hidden">
        <img
          src={route.image}
          alt={route.stops.map((stop) => stop.name).join(", ")}
          width={1920}
          height={1200}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/45 to-ink/25" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-5 pb-10 md:px-8 md:pb-14">
          <Button asChild variant="glass" size="sm" className="mb-6">
            <Link to="/results">
              <ArrowLeft aria-hidden />
              All routes
            </Link>
          </Button>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-primary-foreground/70 uppercase">
                {route.countries.join(" · ")}
              </p>
              <h1 className="mt-3 font-display text-[clamp(2.25rem,5.8vw,4rem)] leading-[0.98] font-medium tracking-[-0.02em] text-primary-foreground">
                {route.stops.map((stop) => stop.name).join(" → ")}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/80">
                {route.tagline}
              </p>
            </div>
            <ScoreRing value={route.scores.overall} size={88} className="shrink-0" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <div className="flex flex-wrap items-center gap-3">
          <DataBadge quality={route.quality} showProvider />
          <Button
            variant={saved ? "default" : "outline"}
            size="sm"
            onClick={() => toast.success(toggle(route) ? "Saved" : "Removed from saved")}
          >
            {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
            {saved ? "Saved" : "Save trip"}
          </Button>
        </div>

        <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Estimated cost" value={route.cost} currency={currency} />
          <Stat
            label={route.budgetLeft < 0 ? "Over budget" : "Budget left"}
            value={Math.abs(route.budgetLeft)}
            currency={currency}
            tone={route.budgetLeft < 0 ? "warn" : "good"}
          />
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <dt className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Time in transit
            </dt>
            <dd className="mt-2 font-display text-2xl font-medium tracking-[-0.01em]">
              {formatHours(route.journeyHours)}
            </dd>
          </div>
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <dt className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Transport
            </dt>
            <dd className="mt-2 text-sm leading-snug">{route.transportRecommendation}</dd>
          </div>
        </dl>

        {/* Why this route — reasoning as elegant callouts ------------------- */}
        <Reveal className="mt-16">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-teal uppercase">
            The reasoning
          </p>
          <h2 className="mt-4 flex items-center gap-2.5 font-display text-3xl font-medium tracking-[-0.02em]">
            <Brain className="h-6 w-6 text-teal" strokeWidth={1.6} aria-hidden />
            Why the engine chose this route
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {route.reasoning.map((reason, index) => (
              <div
                key={reason}
                className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-soft transition-colors duration-500 hover:border-primary/25"
              >
                <span className="font-display text-4xl font-medium tracking-[-0.02em] text-muted-foreground/25">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-3 text-[15px] leading-[1.65]">{reason}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                How you'll experience it
              </p>
              <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <ScoreBar label="Experience" value={route.scores.experience} />
                <ScoreBar label="Nature" value={route.scores.nature} tone="emerald" delay={0.05} />
                <ScoreBar label="Food" value={route.scores.food} tone="sunset" delay={0.1} />
                <ScoreBar label="Weather" value={route.scores.weather} tone="teal" delay={0.15} />
              </div>
            </div>
            <ScoreBreakdown
              factors={route.scoreFactors ?? []}
              overall={route.scores.overall}
            />
          </div>
        </Reveal>

        {/* Stretch your budget — featured band --------------------------- */}
        <Reveal className="mt-16">
          <BudgetStretch route={route} />
        </Reveal>




        {/* Map -------------------------------------------------------------- */}
        <Reveal className="mt-12">
          <h2 className="font-display text-2xl font-semibold">The route</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Interactive map — MapLibre GL on OpenStreetMap tiles.
          </p>
          <div className="mt-5 overflow-hidden rounded-4xl border border-border shadow-soft">
            <RouteMap
              points={route.stops.map((stop) => ({ lat: stop.lat, lon: stop.lon, name: stop.name }))}
              className="h-[380px] w-full"
            />
          </div>
          <ol className="mt-5 space-y-3">
            {route.legs.map((leg, index) => (
              <li
                key={`${leg.from}-${leg.to}-${index}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-3xl border border-border bg-card p-4 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="font-semibold">
                    {leg.from} → {leg.to}
                  </span>
                  <span className="ml-2 text-muted-foreground capitalize">
                    {leg.mode} · {leg.note}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  {formatHours(leg.hours)} · {formatCurrency(leg.cost, currency)}
                </span>
              </li>
            ))}
          </ol>
        </Reveal>

        {/* Budget breakdown -------------------------------------------------- */}
        <Reveal className="mt-12 rounded-4xl border border-border bg-card p-6 shadow-soft md:p-9">
          <h2 className="font-display text-2xl font-semibold">Budget breakdown</h2>
          <div className="mt-6 flex h-3 w-full overflow-hidden rounded-full">
            {breakdown.map((item) => (
              <span
                key={item.label}
                className={item.tone}
                style={{ width: `${(item.value / route.cost) * 100}%` }}
                aria-hidden
              />
            ))}
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {breakdown.map((item) => (
              <div key={item.label}>
                <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {item.label}
                </dt>
                <dd className="mt-1 font-display text-lg font-semibold tabular-nums">
                  {formatCurrency(item.value, currency)}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        {/* Stops ------------------------------------------------------------- */}
        <Reveal className="mt-12">
          <h2 className="font-display text-2xl font-semibold">Where you stay</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {route.stops.map((stop) => (
              <div key={stop.id} className="card-lift rounded-4xl border border-border bg-card p-6">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-xl font-semibold">{stop.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {stop.country} · {stop.nights} nights
                    </p>
                  </div>
                  <DataBadge quality={stop.weather.quality} className="shrink-0" />
                </div>

                <p className="mt-4 text-sm">
                  <span className="font-semibold">{stop.hotel.name}</span> · {stop.hotel.area}
                  <span className="block text-muted-foreground">
                    {stop.hotel.style} · {formatCurrency(stop.hotel.nightlyFrom, currency)} / night ·{" "}
                    {stop.hotel.rating}★
                  </span>
                </p>
                <div className="mt-3">
                  <DataBadge quality={stop.hotel.quality} />
                </div>

                <p className="mt-4 text-sm text-muted-foreground">
                  Weather: {stop.weather.tempC}°C · {stop.weather.summary} · {stop.weather.rainChance}%
                  chance of rain
                </p>

                <p className="mt-3 text-sm">
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Nearby day trips
                  </span>
                  <span className="mt-1 block">{stop.dayTrips.join(" · ")}</span>
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Timeline ---------------------------------------------------------- */}
        <Reveal className="mt-12">
          <h2 className="font-display text-2xl font-semibold">Day by day</h2>
          <ol className="relative mt-6 space-y-5 border-l border-border pl-6 md:pl-8">
            {route.itinerary.map((day) => (
              <li key={day.day} className="relative">
                <span
                  className="absolute top-6 -left-[31px] grid h-6 w-6 place-items-center rounded-full gradient-sea text-[10px] font-bold text-primary-foreground md:-left-[39px]"
                  aria-hidden
                >
                  {day.day}
                </span>
                <div className="card-lift rounded-4xl border border-border bg-card p-6">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                    <h3 className="truncate font-display text-lg font-semibold">
                      Day {day.day} · {day.city}
                    </h3>
                    {day.transportNote && (
                      <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold capitalize">
                        {day.transportNote}
                      </span>
                    )}
                  </div>
                  <DayExperienceGrid
                    day={day}
                    stop={route.stops.find((stop) => stop.name === day.city)}
                    preferences={route.preferences}
                  />

                  <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                    <CloudRain className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
                    If it rains: {day.rainyDayAlternative}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        {/* Packing ----------------------------------------------------------- */}
        <Reveal className="mt-12 rounded-4xl border border-border bg-sand/70 p-6 md:p-9">
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Luggage className="h-5 w-5 text-teal" aria-hidden />
            Packing list
          </h2>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {route.packingList.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </PageShell>
  );
}

function Stat({
  label,
  value,
  currency,
  tone = "neutral",
}: {
  label: string;
  value: number;
  currency: "EUR" | "USD" | "GBP";
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd
        className={`mt-2 font-display text-2xl font-semibold tabular-nums ${
          tone === "good" ? "text-emerald" : tone === "warn" ? "text-destructive" : ""
        }`}
      >
        <AnimatedCounter value={value} format={(v) => formatCurrency(v, currency)} />
      </dd>
    </div>
  );
}

