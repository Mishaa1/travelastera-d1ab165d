import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  BedDouble,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Plane,
  Train,
  Car,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buildFlightQuery, searchFlightOffers } from "@/lib/flights/client";
import type { NormalisedFlightOffer } from "@/lib/flights/types";
import { formatCurrency } from "@/lib/format";
import { persistRoute } from "@/lib/storage";
import type { BookingFlightSelection, TripRoute } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BookingStageProps {
  route: TripRoute;
  onRouteChange: (route: TripRoute) => void;
}

export function BookingStage({ route, onRouteChange }: BookingStageProps) {
  const [step, setStep] = useState(1);
  const [offers, setOffers] = useState<NormalisedFlightOffer[]>([]);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [flightMessage, setFlightMessage] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  const usesFlights = route.legs.some((leg) => leg.mode === "flight") && !route.preferences.avoidFlights;
  const groundMode = route.legs.find((leg) => leg.mode !== "flight")?.mode ?? (route.preferences.transport === "car" ? "car" : "train");
  const transportLabel = usesFlights ? "flight" : groundMode === "car" ? "drive" : "train";
  const steps = [`Choose ${transportLabel}`, "Confirm hotels", "Finalize"] as const;
  const query = usesFlights ? buildFlightQuery({
    startCity: route.preferences.startCity,
    destinations: route.stops.map((stop) => stop.name),
    startDate: route.preferences.startDate,
    endDate: route.preferences.endDate,
    travellers: route.preferences.travellers,
  }) : null;
  const queryKey = query
    ? [
        route.id,
        query.origin,
        query.destinations.join(","),
        query.departureDate,
        query.returnDate,
        query.travellers,
      ].join(":")
    : "";

  const estimatedFlightTotal = useMemo(() => {
    const flights = route.legs.filter((leg) => leg.mode === "flight");
    return Math.round(
      (flights.length ? flights : route.legs).reduce((total, leg) => total + leg.cost, 0),
    );
  }, [route.legs]);

  const estimatedChoice = useMemo<BookingFlightSelection>(() => {
    const flightLegs = route.legs.filter((leg) => leg.mode === "flight");
    const first = flightLegs[0] ?? route.legs[0];
    const last = flightLegs[flightLegs.length - 1] ?? route.legs[route.legs.length - 1];
    return {
      id: `estimate-${route.id}`,
      source: "estimate",
      airlineName: usesFlights ? "ASTERA flight estimate" : groundMode === "car" ? "Estimated driving route" : "Estimated rail journey",
      originCode: query?.origin ?? first?.from ?? route.preferences.startCity,
      destinationCode:
        query?.destinations[0] ?? last?.to ?? route.stops[route.stops.length - 1]?.name ?? "Trip",
      durationMinutes: Math.round(
        (flightLegs.length ? flightLegs : route.legs).reduce(
          (total, leg) => total + leg.hours * 60,
          0,
        ),
      ),
      stops: Math.max(0, flightLegs.length - 1),
      baggageSummary: usesFlights
        ? "Confirm baggage with the airline"
        : "Estimated ground-transport option — no live booking provider is connected yet",
      totalAmount: estimatedFlightTotal,
      currency: route.preferences.currency,
    };
  }, [estimatedFlightTotal, groundMode, query, route, usesFlights]);

  const selectedFlight = usesFlights ? route.bookingSelection?.flight ?? estimatedChoice : estimatedChoice;

  const hotelTotal = useMemo(
    () =>
      route.stops.reduce(
        (total, stop) =>
          total +
          (stop.hotel.totalStayPrice ??
            stop.hotel.nightlyFrom *
              stop.nights *
              Math.max(1, Math.ceil(route.preferences.travellers / 2))),
        0,
      ),
    [route.preferences.travellers, route.stops],
  );

  const selectedFlightForTripTotal =
    selectedFlight.currency === route.preferences.currency
      ? selectedFlight.totalAmount
      : estimatedFlightTotal;
  const fullTripTotal = Math.round(route.cost - estimatedFlightTotal + selectedFlightForTripTotal);
  const budgetRemaining = route.preferences.budget - fullTripTotal;
  const directHotelLinks = route.stops.filter((stop) => Boolean(stop.hotel.websiteUrl));

  useEffect(() => {
    if (!usesFlights) {
      setOffers([]);
      setLoadingFlights(false);
      setFlightMessage(
        `${groundMode === "car" ? "Driving" : "Rail"} details are estimated because no live ground-transport booking provider is connected. No flight search was made.`,
      );
      return;
    }
    if (!queryKey || !query) {
      setFlightMessage("Airport codes are unavailable, so the planned flight estimate is shown.");
      return;
    }
    const controller = new AbortController();
    setLoadingFlights(true);
    setFlightMessage("");
    void searchFlightOffers(query, controller.signal).then((lookup) => {
      if (controller.signal.aborted) return;
      const next = lookup.results
        .flatMap((result) => result.offers)
        .sort((a, b) => a.totalAmount - b.totalAmount)
        .slice(0, 3);
      setOffers(next);
      setLoadingFlights(false);
      if (!next.length) {
        setFlightMessage(
          lookup.error ??
            lookup.results.find((result) => result.error)?.error ??
            "No current fares were returned, so the planned flight estimate is shown.",
        );
      }
    });
    return () => controller.abort();
    // The stable key contains every query field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, groundMode, usesFlights]);

  const persistSelection = (flight: BookingFlightSelection) => {
    const next: TripRoute = {
      ...route,
      bookingSelection: {
        flight,
        hotelNamesByStop: Object.fromEntries(route.stops.map((stop) => [stop.id, stop.hotel.name])),
      },
    };
    persistRoute(next);
    onRouteChange(next);
  };

  const selectOffer = (offer: NormalisedFlightOffer) => {
    persistSelection({
      id: offer.offerId,
      source: offer.status === "live" ? "live" : "estimate",
      airlineName: offer.airlineName,
      originCode: offer.originCode,
      destinationCode: offer.destinationCode,
      departureAt: offer.outboundDepartAt,
      arrivalAt: offer.outboundArriveAt,
      durationMinutes: offer.durationMinutes,
      stops: offer.stops,
      baggageSummary: offer.baggageSummary,
      totalAmount: offer.totalAmount,
      currency: offer.currency,
    });
  };

  const continueToBooking = () => {
    setBookingOpen(true);
    setStep(3);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (step === 3) {
      const firstLink = directHotelLinks[0]?.hotel.websiteUrl;
      if (firstLink) window.open(firstLink, "_blank", "noopener,noreferrer");
      else toast.info("No direct provider booking link was supplied for this trip.");
    }
  };

  const makeCheaper = () => {
    document.getElementById("stretch-budget")?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast.info("Choose a cost-saving trade-off, then apply it to update the complete trip.");
  };

  const downloadItinerary = () => {
    const content = [
      route.title,
      `${route.preferences.startDate} – ${route.preferences.endDate}`,
      "",
      ...route.itinerary.flatMap((day) => [
        `Day ${day.day} — ${day.city}`,
        `Morning: ${day.morning}`,
        `Afternoon: ${day.afternoon}`,
        `Evening: ${day.evening}`,
        `Restaurant: ${day.restaurant}`,
        "",
      ]),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${route.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-itinerary.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <motion.section
        ref={sectionRef}
        initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.99 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: reduceMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
        className="mt-7 scroll-mt-28 overflow-hidden rounded-[1.75rem] bg-ink px-5 py-8 text-white shadow-lift sm:px-7 lg:px-8"
        aria-labelledby="ready-to-book"
      >
        <div className="grid gap-7 lg:grid-cols-[1.35fr_.65fr] lg:items-stretch">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-teal uppercase">
              One final step
            </p>
            <h2
              id="ready-to-book"
              className="mt-2 font-display text-[clamp(2rem,3vw,3rem)] leading-none font-medium tracking-[-0.03em]"
            >
              Ready to make it real?
            </h2>
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-white/65">
              Your route is decided. Confirm the bookings that bring it together—ASTERA never
              handles payment.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-[11px] text-white/75">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-teal" /> Best available options
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-teal" /> Provider checkout
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-teal" /> No ASTERA payment claim
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="hero" onClick={() => setBookingOpen((current) => !current)}>
                {bookingOpen ? "Hide booking choices" : `Review ${transportLabel} & hotels`}
              </Button>
              <Button
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white hover:text-ink"
                onClick={makeCheaper}
              >
                <Sparkles aria-hidden /> Make this trip cheaper
              </Button>
            </div>
          </div>
          <aside className="rounded-[1.25rem] border border-white/10 bg-white/[.07] p-5 backdrop-blur-sm">
            <p className="text-[9px] font-semibold tracking-[.16em] text-teal uppercase">
              Trip summary
            </p>
            <h3 className="mt-2 font-display text-xl">{route.title}</h3>
            <p className="mt-1 text-[11px] text-white/55">
              {route.itinerary.length} days · {route.stops.length}{" "}
              {route.stops.length === 1 ? "city" : "cities"} · {route.preferences.travellers}{" "}
              travellers
            </p>
            <div className="mt-5 border-t border-white/12 pt-4">
              <p className="text-[9px] tracking-[.14em] text-white/45 uppercase">From</p>
              <p className="mt-1 font-display text-4xl">
                {formatCurrency(fullTripTotal, route.preferences.currency)}
              </p>
              <p className={cn("mt-1 text-xs", budgetRemaining >= 0 ? "text-teal" : "text-sunset")}>
                {formatCurrency(Math.abs(budgetRemaining), route.preferences.currency)}{" "}
                {budgetRemaining >= 0 ? "remaining" : "over budget"}
              </p>
            </div>
            <Button variant="hero" className="mt-5 w-full" onClick={continueToBooking}>
              Continue to booking
            </Button>
          </aside>
        </div>

        {bookingOpen && (
          <div className="mt-8 grid gap-6 border-t border-white/15 pt-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-4xl bg-background p-5 text-foreground sm:p-7">
              <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Booking steps">
                {steps.map((label, index) => {
                  const number = index + 1;
                  return (
                    <li key={label}>
                      <button
                        type="button"
                        onClick={() => setStep(number)}
                        className={cn(
                          "w-full border-b-2 px-2 py-3 text-left text-sm transition-colors",
                          step === number
                            ? "border-primary font-semibold text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/40",
                        )}
                      >
                        <span className="block text-xs">Step {number}</span>
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ol>

              {step === 1 && (
                <div>
                  <h3 className="font-display text-2xl font-medium">Choose your {transportLabel}</h3>
                  {loadingFlights && (
                    <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Checking current prices…
                    </p>
                  )}
                  {!loadingFlights && offers.length === 0 && (
                    <FlightChoice
                      flight={estimatedChoice}
                      selected={selectedFlight.id === estimatedChoice.id}
                      bestValue
                      onSelect={() => persistSelection(estimatedChoice)}
                    />
                  )}
                  {flightMessage && (
                    <p className="mt-4 text-sm text-muted-foreground">{flightMessage}</p>
                  )}
                  {route.bookingSelection?.flight &&
                    route.bookingSelection.flight.id !== estimatedChoice.id &&
                    !offers.some(
                      (offer) => offer.offerId === route.bookingSelection?.flight?.id,
                    ) && (
                      <FlightChoice
                        flight={route.bookingSelection.flight}
                        selected
                        onSelect={() => persistSelection(route.bookingSelection!.flight!)}
                      />
                    )}
                  {offers.map((offer, index) => (
                    <FlightChoice
                      key={offer.offerId}
                      flight={{
                        id: offer.offerId,
                        source: offer.status === "live" ? "live" : "estimate",
                        airlineName: offer.airlineName,
                        originCode: offer.originCode,
                        destinationCode: offer.destinationCode,
                        departureAt: offer.outboundDepartAt,
                        arrivalAt: offer.outboundArriveAt,
                        durationMinutes: offer.durationMinutes,
                        stops: offer.stops,
                        baggageSummary: offer.baggageSummary,
                        totalAmount: offer.totalAmount,
                        currency: offer.currency,
                      }}
                      selected={selectedFlight.id === offer.offerId}
                      bestValue={index === 0}
                      onSelect={() => selectOffer(offer)}
                    />
                  ))}
                  <Button className="mt-7" onClick={() => setStep(2)}>
                    Confirm {transportLabel}
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h3 className="font-display text-2xl font-medium">Confirm your stays</h3>
                  <div className="mt-6 space-y-6">
                    {route.stops.map((stop) => {
                      const total =
                        stop.hotel.totalStayPrice ??
                        stop.hotel.nightlyFrom *
                          stop.nights *
                          Math.max(1, Math.ceil(route.preferences.travellers / 2));
                      return (
                        <article
                          key={stop.id}
                          className={`grid overflow-hidden rounded-3xl bg-card shadow-soft ${stop.hotel.imageUrl && stop.hotel.hotelProvenance?.source !== "demo-fixture" ? "sm:grid-cols-[180px_1fr]" : "grid-cols-1"}`}
                        >
                          {stop.hotel.hotelProvenance?.source !== "demo-fixture" &&
                            stop.hotel.imageUrl && (
                              <img
                                src={stop.hotel.imageUrl}
                                alt={`${stop.hotel.name} in ${stop.name}`}
                                className="h-44 w-full object-cover sm:h-full"
                              />
                            )}
                          <div className="p-5">
                            <p className="text-sm text-muted-foreground">
                              {stop.name} · {stop.nights} nights
                            </p>
                            <h4 className="mt-1 font-display text-xl font-medium">
                              {stop.hotel.name}
                            </h4>
                            <p className="mt-1 text-sm">
                              {stop.hotel.rating}★ ·{" "}
                              {formatCurrency(stop.hotel.nightlyFrom, route.preferences.currency)} /
                              night
                            </p>
                            <p className="mt-2 font-semibold">
                              {formatCurrency(total, route.preferences.currency)} total
                            </p>
                            <details className="mt-4 text-sm text-muted-foreground">
                              <summary className="cursor-pointer font-medium">Room details</summary>
                              <p className="mt-2">
                                {stop.hotel.roomType ?? stop.hotel.style} ·{" "}
                                {stop.hotel.boardType ?? "Board not specified"} ·{" "}
                                {stop.hotel.hotelProvenance?.source === "hotelbeds-live"
                                  ? "Live availability"
                                  : stop.hotel.hotelProvenance?.source === "hotelbeds-cache"
                                    ? "Cached availability — may be outdated"
                                    : "Demo inventory — not bookable"}
                              </p>
                            </details>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`hotels near ${stop.hotel.area}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
                            >
                              Change hotel · View alternatives
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            </a>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <Button className="mt-7" onClick={() => setStep(3)}>
                    Confirm hotels
                  </Button>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h3 className="font-display text-2xl font-medium">Finalize your trip</h3>
                  <BookingTotals
                    route={route}
                    flight={selectedFlight}
                    hotelTotal={hotelTotal}
                    fullTripTotal={fullTripTotal}
                    budgetRemaining={budgetRemaining}
                  />

                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <BookingAction
                      icon={usesFlights ? <Plane aria-hidden /> : groundMode === "car" ? <Car aria-hidden /> : <Train aria-hidden />}
                      title={`Book ${transportLabel}`}
                      href={usesFlights ? selectedFlight.bookingUrl : undefined}
                      unavailable={usesFlights
                        ? "This fare has no direct checkout link. Book it with the airline or your preferred flight site using the details above."
                        : `This is an estimated ${transportLabel} option. ASTERA does not yet have a live ground-transport booking link.`}
                    />
                    {route.stops.map((stop) => (
                      <BookingAction
                        key={stop.id}
                        icon={<BedDouble aria-hidden />}
                        title={
                          stop.hotel.hotelProvenance?.source === "demo-fixture"
                            ? "Demo hotel — not bookable"
                            : `Book ${stop.hotel.name}`
                        }
                        href={stop.hotel.websiteUrl}
                        unavailable="The hotel provider did not supply a direct booking URL. Use View alternatives to continue."
                      />
                    ))}
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button size="lg" variant="hero" onClick={continueToBooking}>
                      Continue to booking
                      <ExternalLink aria-hidden />
                    </Button>
                    <Button variant="outline" onClick={makeCheaper}>
                      <Sparkles aria-hidden />
                      Make this trip cheaper
                    </Button>
                    <Button variant="ghost" onClick={downloadItinerary}>
                      <Download aria-hidden />
                      Download itinerary
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <aside className="h-fit rounded-4xl bg-sand p-6 text-foreground shadow-soft lg:sticky lg:top-28">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-teal uppercase">
                Your final checklist
              </p>
              <h3 className="mt-2 font-display text-2xl font-medium">Everything in one place</h3>
              <BookingTotals
                route={route}
                flight={selectedFlight}
                hotelTotal={hotelTotal}
                fullTripTotal={fullTripTotal}
                budgetRemaining={budgetRemaining}
                compact
              />
              <BookingChecklist />
              <Button variant="hero" size="lg" className="mt-7 w-full" onClick={continueToBooking}>
                Continue to booking
              </Button>
              <Button
                variant="ghost"
                className="mt-2 w-full"
                onClick={makeCheaper}
              >
                <Sparkles aria-hidden />
                Make this trip cheaper
              </Button>
            </aside>
          </div>
        )}
      </motion.section>

      <div className="fixed inset-x-4 bottom-20 z-40 md:hidden">
        <Button variant="hero" size="lg" className="w-full shadow-lift" onClick={continueToBooking}>
          Continue to booking — {formatCurrency(fullTripTotal, route.preferences.currency)}{" "}
          estimated
        </Button>
      </div>
    </>
  );
}

function FlightChoice({
  flight,
  selected,
  bestValue,
  onSelect,
}: {
  flight: BookingFlightSelection;
  selected: boolean;
  bestValue?: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={cn(
        "mt-4 w-full rounded-3xl bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-0.5",
        selected && "ring-2 ring-primary",
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-left" aria-pressed={selected}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{flight.airlineName}</p>
              {bestValue && (
                <span className="rounded-full bg-emerald/12 px-2 py-1 text-[10px] font-semibold text-emerald uppercase">
                  Best value
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {flight.source === "live" ? "Live price" : "Estimated price"}
              </span>
            </div>
            <p className="mt-2 text-sm">
              {flight.originCode} → {flight.destinationCode}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {flight.departureAt && flight.arrivalAt
                ? `${formatDateTime(flight.departureAt)} → ${formatTime(flight.arrivalAt)} · `
                : ""}
              {formatDuration(flight.durationMinutes)} ·{" "}
              {flight.stops === 0 ? "Direct" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-semibold">
              {flight.currency} {flight.totalAmount}
            </p>
            {selected && (
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald">
                <Check className="h-3.5 w-3.5" aria-hidden /> Selected
              </span>
            )}
          </div>
        </div>
      </button>
      <details className="mt-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium">Journey and fare details</summary>
        <p className="mt-2">
          {flight.baggageSummary ?? "Additional journey details were not specified."}
        </p>
      </details>
    </article>
  );
}

function BookingTotals({
  route,
  flight,
  hotelTotal,
  fullTripTotal,
  budgetRemaining,
  compact = false,
}: {
  route: TripRoute;
  flight: BookingFlightSelection;
  hotelTotal: number;
  fullTripTotal: number;
  budgetRemaining: number;
  compact?: boolean;
}) {
  const currency = route.preferences.currency;
  const transportLabel = route.legs.some((leg) => leg.mode === "flight") && !route.preferences.avoidFlights
    ? "flight"
    : route.legs.some((leg) => leg.mode === "car")
      ? "drive"
      : "train";
  return (
    <dl
      className={cn(
        "mt-6 grid gap-4",
        !compact && "rounded-3xl bg-secondary/45 p-6 sm:grid-cols-2",
      )}
    >
      <SummaryRow
        label={`Selected ${transportLabel}`}
        value={`${flight.airlineName} · ${flight.currency} ${flight.totalAmount}`}
      />
      <SummaryRow
        label="Selected hotels"
        value={`${route.stops.map((stop) => stop.hotel.name).join(" · ")} — ${formatCurrency(hotelTotal, currency)}`}
      />
      <SummaryRow
        label="Full trip estimate"
        value={formatCurrency(fullTripTotal, currency)}
        strong
      />
      <SummaryRow
        label={budgetRemaining >= 0 ? "Budget remaining" : "Over budget"}
        value={formatCurrency(Math.abs(budgetRemaining), currency)}
        strong
      />
    </dl>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="border-b border-border/60 pb-3 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-sm", strong && "font-display text-lg font-semibold")}>
        {value}
      </dd>
    </div>
  );
}

function BookingChecklist() {
  const items = ["Transport chosen", "Hotels selected", "Budget checked", "Itinerary ready"];
  return (
    <ol className="mt-7 space-y-3" aria-label="Trip booking readiness">
      {items.map((label) => (
        <li key={label} className="flex items-center gap-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald" aria-hidden />
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function BookingAction({
  icon,
  title,
  href,
  unavailable,
}: {
  icon: React.ReactNode;
  title: string;
  href?: string;
  unavailable: string;
}) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </div>
      {href ? (
        <Button asChild variant="outline" size="sm" className="mt-4">
          <a href={href} target="_blank" rel="noopener noreferrer">
            Open booking site
            <ExternalLink aria-hidden />
          </a>
        </Button>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{unavailable}</p>
      )}
    </div>
  );
}

function formatDuration(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
