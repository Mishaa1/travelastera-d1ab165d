import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Clock3,
  Map as MapIcon,
  Navigation,
  ReceiptText,
  Search,
  Share2,
  Sparkles,
  Sun,
  Sunset,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";

import { EditTripWithAI } from "@/components/trip/EditTripWithAI";
import { TripPulseDay } from "@/components/trip/TripPulseDay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buildJourneyDayViewModel, calculateDayWalking } from "@/lib/journeyViewModel";
import { findRouteById } from "@/lib/storage";
import { getItineraryPhase } from "@/lib/tripItineraryPresentation";
import type { TripRoute } from "@/lib/types";

export const Route = createFileRoute("/trip/$tripId/journey")({
  validateSearch: (search: Record<string, unknown>) => ({
    day: Math.max(1, Number(search.day) || 1),
  }),
  head: () => ({
    meta: [
      { title: "Journey — ASTERA" },
      { name: "description", content: "Your day-by-day ASTERA travel companion." },
    ],
  }),
  component: JourneyPage,
});

function JourneyPage() {
  const { tripId } = Route.useParams();
  const { day: requestedDay } = Route.useSearch();
  const [route, setRoute] = useState<TripRoute | null>(null);
  const [ready, setReady] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    setRoute(findRouteById(tripId) ?? null);
    setReady(true);
  }, [tripId]);

  if (!ready)
    return (
      <div className="min-h-screen bg-[#f8f4ee]">
        <div className="mx-auto max-w-[1600px] space-y-5 px-5 py-8">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-[620px] rounded-[2rem]" />
        </div>
      </div>
    );

  if (!route)
    return (
      <div className="min-h-screen bg-[#f8f4ee]">
        <div className="mx-auto max-w-xl px-5 pt-40 pb-28 text-center">
          <h1 className="font-display text-4xl">This journey is not in this browser</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Return to Results or Saved Trips and open the itinerary again.
          </p>
          <Button asChild className="mt-7">
            <Link to="/results">Back to results</Link>
          </Button>
        </div>
      </div>
    );

  const view = buildJourneyDayViewModel(route, requestedDay);
  if (!view) return null;
  const index = route.itinerary.findIndex((day) => day.day === view.dayNumber);
  const previous = route.itinerary[index - 1];
  const next = route.itinerary[index + 1];
  const phase = getItineraryPhase(route.itinerary, index);
  const walking = calculateDayWalking(view.day);

  if (import.meta.env.DEV) {
    console.info("[journey:provenance]", {
      tripId: route.id,
      selectedDay: view.dayNumber,
      heroPlaceId: view.heroMoment?.providerPlaceId ?? null,
      timelineStopCount: view.orderedStops.length,
      contextualPoiCount: view.contextualPois.length,
      moodImageCount: view.moodImages.length,
      providerCallsCausedByJourney: 0,
    });
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f8f4ee] text-ink">
      <EditTripWithAI
        route={route}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onRouteChange={setRoute}
      />
      <div className="mx-auto min-h-screen max-w-[1600px] px-3 py-3 sm:px-5 sm:py-5 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-5 xl:grid-cols-[270px_minmax(0,1fr)] xl:gap-7">
        <JourneySidebar route={route} selectedDay={view.dayNumber} />

        <main className="min-w-0 rounded-[1.8rem] bg-white/72 p-3 shadow-[0_28px_80px_-58px_rgba(6,37,48,.5)] backdrop-blur-xl sm:p-4 xl:p-5">
          <header className="mb-2 px-2 py-2 sm:px-3 sm:py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Link
                  to="/trip/$tripId"
                  params={{ tripId: route.id }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-teal"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Trip Overview
                </Link>
                <p className="mt-3 text-[10px] font-semibold tracking-[.18em] text-teal uppercase">
                  {phase} · Day {view.dayNumber} · {view.city}
                </p>
                <h1 className="mt-1 font-display text-3xl leading-tight">{view.title}</h1>
                <p className="mt-1 font-display text-lg italic text-sunset-foreground/75">
                  {view.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigator.share?.({ title: view.title, url: window.location.href })
                  }
                >
                  <Share2 aria-hidden /> Share today
                </Button>
                <Button size="sm" className="bg-ink text-white" onClick={() => setAiOpen(true)}>
                  <Sparkles aria-hidden /> Edit with AI
                </Button>
              </div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {route.itinerary.map((day) => (
                <Link
                  key={day.day}
                  to="/trip/$tripId/journey"
                  params={{ tripId: route.id }}
                  search={{ day: day.day }}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${day.day === view.dayNumber ? "bg-ink text-white" : "bg-secondary"}`}
                >
                  Day {day.day}
                </Link>
              ))}
            </div>
          </header>

          <section id="journey-day" aria-label={`Day ${view.dayNumber} itinerary`}>
            <TripPulseDay
              key={view.dayNumber}
              day={view.day}
              stop={view.stop}
              preferences={route.preferences}
              title={view.title}
              mood={view.summary}
              phase={phase}
              walking={walking}
              showMood
              cityDays={route.itinerary.filter((day) => day.city === view.city)}
              dailyTotalPerPerson={route.cost / Math.max(1, route.itinerary.length) / Math.max(1, route.preferences.travellers)}
              hideHeader
            />
          </section>

          <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Journey days">
            {previous ? (
              <Link
                to="/trip/$tripId/journey"
                params={{ tripId: route.id }}
                search={{ day: previous.day }}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-3 text-sm font-semibold hover:bg-ink hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" /> Day {previous.day}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                to="/trip/$tripId/journey"
                params={{ tripId: route.id }}
                search={{ day: next.day }}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal"
              >
                Day {next.day} <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                to="/trip/$tripId"
                params={{ tripId: route.id }}
                className="text-sm font-semibold text-teal"
              >
                Back to Trip Overview <ArrowRight className="ml-1 inline h-4 w-4" />
              </Link>
            )}
          </nav>
        </main>
      </div>
    </div>
  );
}

function JourneySidebar({ route, selectedDay }: { route: TripRoute; selectedDay: number }) {
  const [daysOpen, setDaysOpen] = useState(false);
  const weather = route.stops.find((stop) =>
    route.itinerary.find((day) => day.day === selectedDay && day.city === stop.name),
  )?.weather;
  const destinationTitle = route.stops.map((stop) => stop.name).join(" & ");
  const formatShortDate = (value: string) =>
    new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
      new Date(`${value}T12:00:00`),
    );
  const mapUrl = `https://www.google.com/maps/dir/${route.stops.map((stop) => `${stop.lat},${stop.lon}`).join("/")}`;
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-5 flex max-h-[calc(100vh-2.5rem)] min-h-[calc(100vh-2.5rem)] flex-col overflow-y-auto px-3 py-4">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 font-display text-[1.7rem] tracking-[.08em] text-ink"
          aria-label="ASTERA home"
        >
          <span className="text-[1.55rem] text-[#b78324]">✣</span>
          <span className="inline-flex flex-col leading-none">
            <span>ASTERA</span>
            <span className="mt-1 text-center font-serif-display text-[8px] font-light italic tracking-[.16em] text-ink/50">by Mehrmah labs</span>
          </span>
        </Link>
        <h2 className="mt-7 px-3 font-display text-[1.55rem] leading-tight">{destinationTitle}</h2>
        <div className="relative mt-2 px-3">
          <button
            type="button"
            aria-expanded={daysOpen}
            aria-controls="journey-day-links"
            onClick={() => setDaysOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-xl py-1 text-left text-sm text-ink/75 hover:text-ink"
          >
            <span>{formatShortDate(route.preferences.startDate)} – {formatShortDate(route.preferences.endDate)}</span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${daysOpen ? "rotate-180" : ""}`} />
          </button>
          {daysOpen && (
            <div
              id="journey-day-links"
              className="absolute top-full right-1 left-1 z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-[#e6ddd2] bg-white p-2 shadow-[0_22px_55px_-28px_rgba(6,37,48,.35)]"
            >
              {route.itinerary.map((day) => (
                <Link
                  key={day.day}
                  to="/trip/$tripId/journey"
                  params={{ tripId: route.id }}
                  search={{ day: day.day }}
                  onClick={() => setDaysOpen(false)}
                  aria-current={day.day === selectedDay ? "page" : undefined}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${day.day === selectedDay ? "bg-[#eee6dc] font-semibold text-ink" : "text-ink/75 hover:bg-secondary hover:text-ink"}`}
                >
                  <span>Day {day.day}</span>
                  <span className="max-w-28 truncate text-xs text-muted-foreground">{day.city}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <nav className="mt-8 space-y-2" aria-label="Journey shortcuts">
          <a
            href="#journey-day"
            className="flex items-center gap-4 rounded-[1.25rem] bg-[#eee6dc] px-5 py-4 text-base font-semibold"
          >
            <CalendarDays className="h-5 w-5" /> Itinerary
          </a>
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 rounded-[1.25rem] px-5 py-4 text-base font-medium hover:bg-ink hover:text-white"
          >
            <MapIcon className="h-5 w-5" /> Map
          </a>
          <Link
            to="/trip/$tripId"
            params={{ tripId: route.id }}
            hash="ready-to-book"
            className="flex items-center gap-4 rounded-[1.25rem] px-5 py-4 text-base font-medium hover:bg-ink hover:text-white"
          >
            <ReceiptText className="h-5 w-5" /> Bookings
          </Link>
          <Link
            to="/trip/$tripId"
            params={{ tripId: route.id }}
            hash="trip-discover"
            className="flex items-center gap-4 rounded-[1.25rem] px-5 py-4 text-base font-medium hover:bg-ink hover:text-white"
          >
            <Search className="h-5 w-5" /> Discover
          </Link>
          <Link
            to="/trip/$tripId"
            params={{ tripId: route.id }}
            hash="trip-budget"
            className="flex items-center gap-4 rounded-[1.25rem] px-5 py-4 text-base font-medium hover:bg-ink hover:text-white"
          >
            <WalletCards className="h-5 w-5" /> Budget
          </Link>
        </nav>

        <section className="mt-9 rounded-[1.6rem] border border-[#e9e1d7] bg-white/62 p-5 shadow-[0_18px_45px_-40px_rgba(6,37,48,.35)]">
          <p className="flex items-center gap-2 font-display text-xl">
            <span className="text-[#c68b2b]">⌁</span> Trip Pulse
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Live travel insights</p>
          <dl className="mt-5 space-y-6 border-t border-border/45 pt-6">
            <div className="grid grid-cols-[40px_1fr] items-center gap-3">
              <Sun className="h-8 w-8 stroke-[1.4] text-[#ef9b15]" />
              <div>
                <dt className="text-xs font-medium">Weather</dt>
                <dd className="text-lg font-semibold">
                  {weather?.quality.source !== "mock" ? `${weather?.tempC}°C` : "Unavailable"}
                </dd>
                <p className="text-xs text-muted-foreground">{weather?.quality.source !== "mock" ? weather?.summary : "No live forecast"}</p>
              </div>
            </div>
            <div className="grid grid-cols-[40px_1fr] items-center gap-3">
              <UsersRound className="h-8 w-8 stroke-[1.4] text-[#2c9a68]" />
              <div>
                <dt className="text-xs font-medium">Crowd level</dt>
                <dd className="text-lg font-semibold">Not available</dd>
                <p className="text-xs text-muted-foreground">No live crowd source</p>
              </div>
            </div>
            <div className="grid grid-cols-[40px_1fr] items-center gap-3">
              <Sunset className="h-8 w-8 stroke-[1.4] text-[#e88816]" />
              <div>
                <dt className="text-xs font-medium">Rain chance</dt>
                <dd className="text-lg font-semibold">{weather?.quality.source !== "mock" ? `${weather?.rainChance}%` : "Unavailable"}</dd>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
            </div>
          </dl>
          <a href="#journey-day" className="mt-7 flex items-center justify-center gap-2 rounded-full bg-[#f1eee9] px-4 py-3 text-xs font-semibold hover:bg-ink hover:text-white">
            <Clock3 className="h-4 w-4" /> View full timeline
          </a>
        </section>
        <section className="mt-auto rounded-[1.5rem] border border-teal/15 bg-[#edf6fb] p-5 shadow-[0_18px_45px_-38px_rgba(6,37,48,.35)]">
          <p className="flex items-center gap-2 text-xs font-semibold text-teal">
            <Sparkles className="h-3.5 w-3.5" /> ASTERA note
          </p>
          <p className="mt-3 text-xs leading-relaxed text-foreground/70">
            {route.reasoning[0] ?? "Follow the day in order to keep transfers simple."}
          </p>
        </section>
      </div>
    </aside>
  );
}
