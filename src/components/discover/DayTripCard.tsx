import { Bus, Car, Clock3, Ship, Sparkles, TrainFront, Wallet } from "lucide-react";

import { FavouriteButton } from "@/components/discover/FavouriteButton";
import { formatCurrency } from "@/lib/format";
import type { TripPreferences } from "@/lib/types";
import { formatMinutes, type DayTrip } from "@/services/experienceService";

const MODE_ICON = {
  train: TrainFront,
  bus: Bus,
  car: Car,
  boat: Ship,
} as const;

interface DayTripCardProps {
  trip: DayTrip;
  currency: TripPreferences["currency"];
}

/** Nearby place worth visiting, with the practical numbers attached. */
export function DayTripCard({ trip, currency }: DayTripCardProps) {
  const Icon = MODE_ICON[trip.mode];

  return (
    <article className="card-lift group overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div className="relative h-40 overflow-hidden">
        <img
          src={trip.image}
          alt={`${trip.name}, a day trip from ${trip.from}`}
          width={960}
          height={640}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className="rounded-full bg-ink/45 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground backdrop-blur-sm">
            {trip.length} · {trip.difficulty}
          </span>
          <FavouriteButton
            className="size-8"
            item={{
              id: trip.id,
              kind: "daytrip",
              title: trip.name,
              subtitle: `Day trip from ${trip.from}`,
              image: trip.image,
              meta: formatMinutes(trip.travelMinutes),
            }}
          />
        </div>
        <h4 className="absolute inset-x-0 bottom-0 truncate p-4 font-display text-xl font-semibold text-primary-foreground">
          {trip.name}
        </h4>
      </div>

      <div className="space-y-3 p-4">
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="flex items-center gap-1 text-[11px] tracking-wide text-muted-foreground uppercase">
              <Clock3 className="h-3 w-3" aria-hidden /> Each way
            </dt>
            <dd className="font-semibold tabular-nums">{formatMinutes(trip.travelMinutes)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-[11px] tracking-wide text-muted-foreground uppercase">
              <Icon className="h-3 w-3" aria-hidden /> By
            </dt>
            <dd className="font-semibold capitalize">{trip.mode}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-[11px] tracking-wide text-muted-foreground uppercase">
              <Wallet className="h-3 w-3" aria-hidden /> Approx
            </dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(trip.estimatedCost, currency)}</dd>
          </div>
        </dl>

        <p className="flex gap-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          {trip.why}
        </p>
      </div>
    </article>
  );
}
