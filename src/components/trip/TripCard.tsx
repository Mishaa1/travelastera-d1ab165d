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
import { SafeProviderImage } from "@/components/common/SafeProviderImage";
import { ScoreBar } from "@/components/common/ScoreBar";
import { ScoreRing } from "@/components/common/ScoreRing";
import { ScoreBreakdown } from "@/components/trip/ScoreBreakdown";
import { RouteSketch } from "@/components/map/RouteSketch";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatHours } from "@/lib/format";
import { allocateTripImages } from "@/lib/images/imageAllocator";
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
  const hotelBookable = Boolean(hotel.hotelProvenance?.bookable && hotel.websiteUrl);
  const imageAllocation = allocateTripImages(route);
  const destinationCity = route.stops.at(-1)?.name ?? route.itinerary.at(-1)?.city ?? "Destination";

  /** The single biggest saving available, teased here and detailed on the itinerary. */
  const topSaving = useMemo(
    () =>
      [...(route.stretchOptions ?? [])]
        .filter((option) => option.costDelta < 0)
        .sort((a, b) => a.costDelta - b.costDelta)[0],
    [route.stretchOptions],
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="card-lift group overflow-hidden rounded-[24px] border border-border bg-card shadow-soft"
    >
      <div className="relative h-64 overflow-hidden sm:h-80">
        <SafeProviderImage
          candidates={imageAllocation.overviewHero}
          requestedCity={destinationCity}
          alt={`${destinationCity} destination view`}
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
                "bg-teal/85 text-teal-foreground",
              )}
            >
              {route.title}
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
            {hotel.hotelProvenance?.source === "demo-fixture" ? (
              <div className="grid h-40 place-items-center bg-amber-100 px-5 text-center text-xs font-semibold tracking-wide text-amber-900 uppercase sm:h-full">
                Demo hotel fixture
              </div>
            ) : (
              <SafeProviderImage
                candidates={imageAllocation.hotelImages[hotel.id] ?? []}
                requestedCity={route.stops[0].name}
                alt={`${hotel.name} in ${hotel.area}`}
                className="h-40 w-full object-cover sm:h-full"
                loading="lazy"
                placeholder={false}
              />
            )}
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
              {(hotel.quality.source === "mock" || hotel.hotelProvenance?.fallbackReason) && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {hotel.fallbackReason ??
                    "Hotelbeds was unavailable or returned no availability, so sample accommodation pricing is being used."}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-4">
                {hotelBookable ? (
                  <a
                    href={hotel.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-ink"
                  >
                    Book hotel
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                ) : (
                  <span className="text-sm font-semibold text-amber-800">
                    {hotel.hotelProvenance?.source === "demo-fixture"
                      ? "Demo inventory — not bookable"
                      : "Booking link unavailable"}
                  </span>
                )}
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

        {route.provenance?.pois?.fallbackMessage && (
          <p role="status" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {route.provenance.pois.fallbackMessage}
          </p>
        )}

        {import.meta.env.DEV && route.provenance && (
          <details className="rounded-2xl border border-amber-500/35 bg-amber-50/70 p-4 text-xs text-ink">
            <summary className="cursor-pointer font-semibold">Development provenance</summary>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <Detail
                label="Planner source"
                value={`${route.provenance.planner.provider} / ${route.provenance.planner.model}`}
              />
              <Detail
                label="Planner mode"
                value={route.provenance.planner.mode === "heuristic" ? "Heuristic fallback" : "LLM"}
              />
              <Detail
                label="OpenRouter HTTP status"
                value={String(route.provenance.planner.httpStatus ?? "No response")}
              />
              <Detail
                label="Configured model"
                value={route.provenance.planner.configuredModel ?? route.provenance.planner.model}
              />
              <Detail label="Actual model" value={route.provenance.planner.model} />
              <Detail
                label="Planner parse success"
                value={route.provenance.planner.parseSuccess ? "Yes" : "No"}
              />
              <Detail
                label="Flight source"
                value={route.provenance.apiCalls.includes("Duffel offers") ? "Duffel" : "Estimate"}
              />
              <Detail
                label="Hotel source"
                value={`${route.provenance.hotelbeds?.source ?? "unknown"} · HTTP ${
                  route.provenance.hotelbeds?.status ?? "none"
                }`}
              />
              <Detail
                label="Quota exceeded"
                value={route.provenance.hotelbeds?.quotaExceeded ? "Yes" : "No"}
              />
              <Detail
                label="Cache age"
                value={
                  route.provenance.hotelbeds?.cacheAgeMs == null
                    ? "None"
                    : `${Math.round(route.provenance.hotelbeds.cacheAgeMs / 60_000)} minutes`
                }
              />
              <Detail
                label="Live availability"
                value={route.provenance.hotelbeds?.liveAvailability ? "Yes" : "No"}
              />
              <Detail
                label="Bookable"
                value={route.provenance.hotelbeds?.bookable ? "Yes" : "No"}
              />
              <Detail
                label="POI source"
                value={`${route.provenance.pois?.provider ?? "Inactive"} · ${
                  route.provenance.pois?.status ?? "error"
                }`}
              />
              <Detail
                label="POI primary provider"
                value={route.provenance.pois?.source ?? "unavailable"}
              />
              <Detail
                label="Attractions"
                value={`${route.provenance.pois?.categories?.attractions.source ?? "unavailable"}, ${route.provenance.pois?.categories?.attractions.count ?? 0}`}
              />
              <Detail
                label="Restaurants"
                value={`${route.provenance.pois?.categories?.restaurants.source ?? "unavailable"}, ${route.provenance.pois?.categories?.restaurants.count ?? 0}${
                  route.provenance.pois?.categories?.restaurants.unavailableReason
                    ? ` · ${route.provenance.pois.categories.restaurants.unavailableReason}`
                    : ""
                }`}
              />
              <Detail
                label="Partial POI result"
                value={route.provenance.pois?.partial ? "Yes" : "No"}
              />
              <Detail
                label="Google Places enabled"
                value={route.provenance.pois?.google?.enabled ? "Yes" : "No"}
              />
              <Detail
                label="Google HTTP status"
                value={String(route.provenance.pois?.google?.httpStatus ?? "No response")}
              />
              <Detail
                label="Google calls this itinerary"
                value={String(route.provenance.pois?.google?.callsThisItinerary ?? 0)}
              />
              <Detail
                label="Google calls this hour"
                value={String(route.provenance.pois?.google?.callsThisHour ?? 0)}
              />
              <Detail
                label="Google calls today"
                value={String(route.provenance.pois?.google?.callsToday ?? 0)}
              />
              <Detail
                label="Google calls this month"
                value={String(route.provenance.pois?.google?.callsThisMonth ?? 0)}
              />
              <Detail
                label="Google monthly limit"
                value={String(route.provenance.pois?.google?.configuredMonthlyLimit ?? 0)}
              />
              <Detail
                label="Google daily limit"
                value={String(route.provenance.pois?.google?.configuredDailyLimit ?? 0)}
              />
              <Detail
                label="Google hourly limit"
                value={String(route.provenance.pois?.google?.configuredHourlyLimit ?? 0)}
              />
              <Detail
                label="Remaining monthly allowance"
                value={String(route.provenance.pois?.google?.remainingMonthlyAllowance ?? 0)}
              />
              <Detail
                label="Google cache hits / misses"
                value={`${route.provenance.pois?.google?.cacheHits ?? 0} / ${route.provenance.pois?.google?.cacheMisses ?? 0}`}
              />
              <Detail
                label="Attraction / restaurant calls"
                value={`${route.provenance.pois?.google?.attractionSearchCalls ?? 0} / ${route.provenance.pois?.google?.restaurantSearchCalls ?? 0}`}
              />
              <Detail
                label="Details / photo calls"
                value={`${route.provenance.pois?.google?.detailsCalls ?? 0} / ${route.provenance.pois?.google?.photoCalls ?? 0}`}
              />
              <Detail
                label="Google quota blocked"
                value={route.provenance.pois?.google?.quotaBlocked ? "Yes" : "No"}
              />
              <Detail
                label="Quota block reason"
                value={route.provenance.pois?.google?.quotaBlockReason ?? "None"}
              />
              <Detail
                label="POI fallback provider"
                value={route.provenance.pois?.fallbackProvider ?? "None"}
              />
              <Detail label="Provider IDs present" value={String(route.provenance.poiIds.length)} />
              <Detail
                label="Live hotel count"
                value={String(route.provenance.hotelbeds?.liveHotelCount ?? 0)}
              />
              <Detail
                label="Live attraction count"
                value={String(route.provenance.pois?.liveAttractionCount ?? 0)}
              />
              <Detail
                label="Live restaurant count"
                value={String(route.provenance.pois?.liveRestaurantCount ?? 0)}
              />
              <Detail
                label="Fallback data used"
                value={route.provenance.fallbackUsed ? "Yes" : "No"}
              />
              <Detail label="API calls" value={route.provenance.apiCalls.join(", ")} />
            </dl>
            {route.provenance.hotelbeds?.fallbackReason && (
              <p className="mt-3 text-amber-800">
                Hotel fallback reason: {route.provenance.hotelbeds.fallbackReason}
              </p>
            )}
            {route.provenance.planner.failureReason && (
              <p className="mt-3 text-amber-800">
                LLM fallback reason: {route.provenance.planner.failureReason}
              </p>
            )}
            <p className="mt-3 break-words">
              POI IDs: {route.provenance.poiIds.join(", ") || "None"}
            </p>
            <div className="mt-3 space-y-2">
              {route.itinerary.map((day) => (
                <div key={day.day} className="rounded-xl bg-white/70 p-3">
                  <p className="font-semibold">Day {day.day}</p>
                  <p>Attractions displayed: {day.poiProvenance?.attractionsDisplayed ?? 0}</p>
                  <p>Restaurants displayed: {day.poiProvenance?.restaurantsDisplayed ?? 0}</p>
                  <p>Google IDs: {day.poiProvenance?.googleIds.join(", ") || "None"}</p>
                  <p>Overpass IDs: {day.poiProvenance?.overpassIds.join(", ") || "None"}</p>
                  <p>Generated names rejected: {day.poiProvenance?.generatedNamesRejected ?? 0}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 font-semibold">Score inputs used</p>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-white/75 p-3">
              {JSON.stringify(route.provenance.metrics, null, 2)}
            </pre>
            {route.provenance.fallbackReasons.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-4 text-destructive">
                {route.provenance.fallbackReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </details>
        )}

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
