import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowRight,
  Bookmark,
  Check,
  BookmarkCheck,
  ChevronDown,
  ExternalLink,
  GitCompare,
  PiggyBank,
  Sparkles,
  Timer,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";

import { DataBadge } from "@/components/common/DataBadge";
import { ScoreBar } from "@/components/common/ScoreBar";
import { ScoreRing } from "@/components/common/ScoreRing";
import { ScoreBreakdown } from "@/components/trip/ScoreBreakdown";
import { RouteSketch } from "@/components/map/RouteSketch";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatHours } from "@/lib/format";
import type { TripRoute } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TripCardProps {
  route: TripRoute;
  index?: number;
  saved?: boolean;
  compared?: boolean;
  onSave?: (route: TripRoute) => void;
  onCompare?: (route: TripRoute) => void;
  onOptimise?: (route: TripRoute) => void;
}

export function TripCard({
  route,
  index = 0,
  saved,
  compared,
  onSave,
  onCompare,
  onOptimise,
}: TripCardProps) {
  const currency = route.preferences.currency;
  const overBudget = route.budgetLeft < 0;
  const hotel = route.stops[0].hotel;
  const hotelTotal =
    hotel.totalStayPrice ??
    hotel.nightlyFrom *
      route.stops[0].nights *
      Math.max(1, Math.ceil(route.preferences.travellers / 2));
  const hotelUrl =
    hotel.websiteUrl ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel.name}, ${hotel.area}`)}`;

  /** The single biggest saving available, teased here and detailed on the itinerary. */
  const topSaving = useMemo(
    () =>
      [...(route.stretchOptions ?? [])]
        .filter((option) => option.costDelta < 0)
        .sort((a, b) => a.costDelta - b.costDelta)[0],
    [route.stretchOptions],
  );

  /** Editorial badge derived from the route's own numbers — purely presentational. */
  const badge = useMemo(() => {
    const ratio = route.cost > 0 ? route.budgetLeft / route.cost : 0;
    if (ratio > 0.18) return { label: "Best Value", tone: "emerald" as const };
    if (route.scores.nature >= 80) return { label: "Hidden Gem", tone: "gold" as const };
    if (route.scores.efficiency >= 82) return { label: "Effortless", tone: "teal" as const };
    return { label: "Balanced", tone: "gold" as const };
  }, [route.budgetLeft, route.cost, route.scores.efficiency, route.scores.nature]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="card-lift group overflow-hidden rounded-[24px] border border-border bg-card shadow-soft"
    >
      <div className="relative h-64 overflow-hidden sm:h-80">
        <img
          src={route.image}
          alt={`${route.stops.map((s) => s.name).join(", ")}`}
          width={1280}
          height={960}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/15 to-transparent" />
        <div className="pointer-events-none absolute inset-0 text-primary-foreground/60">
          <RouteSketch points={route.stops} />
        </div>

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.1em] uppercase backdrop-blur-sm",
                badge.tone === "emerald" && "bg-emerald/85 text-emerald-foreground",
                badge.tone === "gold" && "bg-gold/90 text-ink",
                badge.tone === "teal" && "bg-teal/85 text-teal-foreground",
              )}
            >
              {badge.label}
            </span>
          </div>
          <span className="rounded-full bg-ink/45 px-3 py-1 text-[11px] font-semibold text-primary-foreground backdrop-blur-sm">
            {route.countries.join(" · ")}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-widest text-primary-foreground/75 uppercase">
              {route.tagline}
            </p>
            <h3 className="mt-1 truncate font-serif-display text-3xl font-light text-primary-foreground">
              {route.title}
            </h3>
          </div>
          <ScoreRing value={route.scores.overall} size={64} className="shrink-0" />
        </div>
      </div>

      <div className="space-y-7 p-6 sm:p-8">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
          {route.stops.map((stop, stopIndex) => (
            <li key={stop.id} className="flex items-center gap-2">
              <span>{stop.name}</span>
              <span className="text-xs text-muted-foreground">{stop.nights}n</span>
              {stopIndex < route.stops.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              )}
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-2 gap-8 border-y border-border/60 py-5">
          <Metric
            icon={<Wallet className="h-4 w-4" aria-hidden />}
            label="Estimated cost"
            value={formatCurrency(route.cost, currency)}
          />
          <Metric
            icon={<Sparkles className="h-4 w-4" aria-hidden />}
            label={overBudget ? "Over budget" : "Budget left"}
            value={formatCurrency(Math.abs(route.budgetLeft), currency)}
            tone={overBudget ? "warn" : "good"}
          />
        </div>

        {route.reasoning.length > 0 && (
          <div>
            <p className="font-serif-display text-xl leading-snug">Why ASTERA picked this</p>
            <ul className="mt-4 space-y-3">
              {route.reasoning.slice(0, 3).map((reason) => (
                <li key={reason} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="overflow-hidden rounded-3xl bg-secondary/55">
          <div className="grid sm:grid-cols-[148px_minmax(0,1fr)]">
            <img
              src={hotel.imageUrl ?? route.image}
              alt={`${hotel.name} in ${hotel.area}`}
              className="h-40 w-full object-cover sm:h-full"
              loading="lazy"
            />
            <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="mt-1 font-display text-lg font-semibold">{hotel.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {hotel.area} · {hotel.rating}★
                  </p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Detail label="Per night" value={formatCurrency(hotel.nightlyFrom, currency)} />
                <Detail label="Total stay" value={formatCurrency(hotelTotal, currency)} />
              </dl>
              {hotel.quality.source === "mock" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {hotel.fallbackReason ??
                    "Hotelbeds was unavailable or returned no availability, so sample accommodation pricing is being used."}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <a
                  href={hotelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-ink"
                >
                  Book hotel
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`hotels near ${hotel.area}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  View 12 more hotels
                </a>
              </div>
            </div>
          </div>
        </div>

        <details className="group/details border-t border-border/60 pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
            Trip details
            <ChevronDown
              className="h-4 w-4 transition-transform group-open/details:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="mt-5 space-y-6">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="In transit" value={formatHours(route.journeyHours)} />
              <Detail label="Transport" value={route.transportRecommendation} />
              <Detail
                label="Weather"
                value={`${route.stops[0].weather.tempC}°C · ${route.stops[0].weather.summary}`}
              />
              <Detail label="Nearby" value={route.stops[0].dayTrips.slice(0, 2).join(", ")} />
            </dl>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <ScoreBar label="Experience" value={route.scores.experience} />
              <ScoreBar label="Nature" value={route.scores.nature} tone="emerald" />
              <ScoreBar label="Food" value={route.scores.food} tone="sunset" />
              <ScoreBar label="Weather" value={route.scores.weather} tone="teal" />
            </div>
            {route.scoreFactors?.length > 0 && (
              <ScoreBreakdown
                factors={route.scoreFactors}
                overall={route.scores.overall}
                className="border-0 bg-transparent p-0"
              />
            )}
            {topSaving && (
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <PiggyBank className="mt-0.5 h-4 w-4 shrink-0 text-emerald" aria-hidden />
                Save {formatCurrency(Math.abs(topSaving.costDelta), currency)} by{" "}
                {topSaving.label.toLowerCase()}.
              </p>
            )}
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="hero" className="flex-1 min-w-36">
            <Link to="/trip/$tripId" params={{ tripId: route.id }}>
              View itinerary
            </Link>
          </Button>
          {onOptimise && (
            <Button variant="outline" onClick={() => onOptimise(route)}>
              Optimise further
            </Button>
          )}
          {onSave && (
            <Button
              variant="glass"
              size="icon"
              aria-label={saved ? `Remove ${route.title} from saved` : `Save ${route.title}`}
              aria-pressed={saved}
              onClick={() => onSave(route)}
            >
              {saved ? <BookmarkCheck className="text-emerald" /> : <Bookmark />}
            </Button>
          )}
          {onCompare && (
            <Button
              variant={compared ? "default" : "glass"}
              size="icon"
              aria-label={`Compare ${route.title}`}
              aria-pressed={compared}
              onClick={() => onCompare(route)}
            >
              <GitCompare />
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function Metric({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <div>
      <span
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase",
          tone === "good" && "text-emerald",
          tone === "warn" && "text-destructive",
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <p className="mt-1 font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 truncate">{value}</dd>
    </div>
  );
}
