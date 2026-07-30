import { useEffect, useState } from "react";
import { Info, Loader2, Plane, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildFlightQuery, searchFlightOffers, type FlightLookup } from "@/lib/flights/client";
import type { TripRoute } from "@/lib/types";

/**
 * Live flight check for the top-ranked route.
 *
 * One request per route id — rerenders never retrigger it — and any failure
 * visibly leaves the estimated price in place.
 */
export function FlightOffers({ route, enabled }: { route: TripRoute; enabled: boolean }) {
  const [lookup, setLookup] = useState<FlightLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const query = buildFlightQuery({
    startCity: route.preferences.startCity,
    destinations: route.stops.map((stop) => stop.name),
    startDate: route.preferences.startDate,
    endDate: route.preferences.endDate,
    travellers: route.preferences.travellers,
  });

  const key = enabled && query ? `${attempt}:${route.id}:${query.destinations.join(",")}` : "";

  useEffect(() => {
    if (!key || !query) return;
    const controller = new AbortController();
    setLoading(true);
    void searchFlightOffers(query, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setLookup(result);
      setLoading(false);
    });
    return () => controller.abort();
    // Do not use a ref request guard here: React Strict Mode intentionally
    // remounts effects in development and aborts the first request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!enabled) return null;

  const offers = (lookup?.results ?? [])
    .flatMap((result) => result.offers)
    .sort((a, b) => a.totalAmount - b.totalAmount)
    .slice(0, 3);
  const providerError =
    lookup?.error ?? (lookup?.results ?? []).find((result) => result.error)?.error;

  return (
    <section
      className="rounded-4xl bg-card p-6 shadow-soft sm:p-9"
      aria-labelledby="available-flight-offers"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="available-flight-offers"
            className="flex items-center gap-2 font-display text-2xl font-semibold"
          >
            <Plane className="h-5 w-5 text-teal" aria-hidden />
            Available flight offers
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The three strongest options for this trip.
          </p>
        </div>
        {loading ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Checking flight options
          </span>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setAttempt((value) => value + 1)}>
            <RotateCcw aria-hidden />
            Retry
          </Button>
        )}
      </div>

      {!query && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-sunset/30 bg-sunset/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Live flight offers could not be checked because the origin or destination has no
            recognised airport code. Estimated flight prices are being used.
          </p>
        </div>
      )}

      {query && !loading && offers.length === 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-sunset/30 bg-sunset/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {lookup && !lookup.configured
              ? "Duffel is not connected. Estimated flight prices are being used."
              : (providerError ??
                "Duffel returned no offers for these dates. Estimated flight prices are being used.")}
          </p>
        </div>
      )}

      {offers.length > 0 && (
        <>
          <ul className="mt-7 divide-y divide-border/60">
            {offers.map((offer, index) => (
              <li
                key={offer.offerId}
                className="grid gap-5 py-6 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">
                      {offer.airlineName} · {offer.originCode} → {offer.destinationCode}
                    </p>
                    {index === 0 && (
                      <span className="rounded-full bg-emerald/12 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-emerald uppercase">
                        Best value
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {new Date(offer.outboundDepartAt).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" → "}
                    {new Date(offer.outboundArriveAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {Math.floor(offer.durationMinutes / 60)}h {offer.durationMinutes % 60}m{" · "}
                    {offer.stops === 0
                      ? "Direct"
                      : `${offer.stops} stop${offer.stops > 1 ? "s" : ""}`}
                  </p>
                  <details className="group/fare mt-3 text-xs text-muted-foreground">
                    <summary className="cursor-pointer list-none font-medium hover:text-foreground">
                      Fare details
                    </summary>
                    <p className="mt-2">
                      {offer.cabin} · {offer.baggageSummary ?? "Baggage not specified"} ·{" "}
                      {offer.status === "test" ? "Duffel test offer" : "Duffel live offer"}
                    </p>
                  </details>
                </div>
                <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                  <p className="font-display text-xl font-semibold tabular-nums">
                    {offer.currency} {offer.totalAmount}
                  </p>
                  <Button asChild variant="hero" size="sm" className="mt-0 sm:mt-3">
                    <a
                      href={`https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${offer.originCode} to ${offer.destinationCode} on ${route.preferences.startDate}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Book flight
                    </a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-7 text-xs text-muted-foreground">
            {offers[0].status === "test"
              ? "Duffel test fares are indicative; booking opens a live flight search."
              : `Live fares checked at ${new Date(offers[0].checkedAt).toLocaleTimeString()}.`}
          </p>
        </>
      )}
    </section>
  );
}
