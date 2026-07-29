import { useEffect, useRef, useState } from "react";
import { Loader2, Plane, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildFlightQuery, searchFlightOffers, type FlightLookup } from "@/lib/flights/client";
import type { TripRoute } from "@/lib/types";

/**
 * Live flight check for the top-ranked route.
 *
 * One request per route id — rerenders never retrigger it — and any failure
 * quietly leaves the estimated price in place.
 */
export function FlightOffers({ route, enabled }: { route: TripRoute; enabled: boolean }) {
  const [lookup, setLookup] = useState<FlightLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lastKey = useRef<string>("");

  const query = buildFlightQuery({
    startCity: route.preferences.startCity,
    destinations: route.stops.map((stop) => stop.name),
    startDate: route.preferences.startDate,
    endDate: route.preferences.endDate,
    travellers: route.preferences.travellers,
  });

  const key = enabled && query ? `${attempt}:${route.id}:${query.destinations.join(",")}` : "";

  useEffect(() => {
    if (!key || !query || lastKey.current === key) return;
    lastKey.current = key;
    const controller = new AbortController();
    setLoading(true);
    void searchFlightOffers(query, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setLookup(result);
      setLoading(false);
    });
    return () => controller.abort();
    // `key` already encodes every input that should trigger a new search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!enabled || !query) return null;

  const offers = (lookup?.results ?? []).flatMap((result) => result.offers).slice(0, 5);

  return (
    <div className="rounded-4xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Plane className="h-4 w-4 text-teal" aria-hidden />
          Flight check
        </h3>
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

      {!loading && offers.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {lookup && !lookup.configured
            ? "No live flight provider connected — the route uses Astera's estimated flight price."
            : "No offers came back for these dates, so the estimated flight price still applies."}
        </p>
      )}

      {offers.length > 0 && (
        <>
          <ul className="mt-4 space-y-3">
            {offers.map((offer) => (
              <li
                key={offer.offerId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-3xl border border-border bg-background p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {offer.airlineName} · {offer.originCode} → {offer.destinationCode}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
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
                    {offer.stops === 0 ? "Direct" : `${offer.stops} stop${offer.stops > 1 ? "s" : ""}`}
                    {" · "}
                    {Math.floor(offer.durationMinutes / 60)}h {offer.durationMinutes % 60}m
                    {offer.baggageSummary ? ` · ${offer.baggageSummary}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-semibold tabular-nums">
                    {offer.currency} {offer.totalAmount}
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    {offer.status === "test" ? "Duffel test data" : "Live flight price"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Test-mode results validate the integration — they are not bookable production fares.
            Last checked {new Date(offers[0].checkedAt).toLocaleTimeString()}.
          </p>
        </>
      )}
    </div>
  );
}
