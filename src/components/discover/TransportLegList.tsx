import { Car, Leaf, Luggage, Plane, TrainFront } from "lucide-react";

import { DataBadge } from "@/components/common/DataBadge";
import { formatCurrency } from "@/lib/format";
import type { RouteLeg, TripPreferences } from "@/lib/types";
import { describeLeg } from "@/services/experienceService";

const MODE_ICON = { flight: Plane, train: TrainFront, car: Car } as const;

interface TransportLegListProps {
  legs: RouteLeg[];
  preferences: TripPreferences;
}

/** Leg-by-leg transport with operator, changes, luggage and carbon. */
export function TransportLegList({ legs, preferences }: TransportLegListProps) {
  return (
    <ol className="space-y-3">
      {legs.map((leg, index) => {
        const detail = describeLeg(leg, preferences.travellers);
        const Icon = MODE_ICON[leg.mode];

        return (
          <li
            key={`${leg.from}-${leg.to}-${index}`}
            className="rounded-3xl border border-border bg-card p-4 shadow-soft"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  <Icon className="h-4 w-4 text-primary" aria-hidden />
                  {leg.from} → {leg.to}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {detail.airline ? `${detail.airline} · ` : ""}
                  {detail.serviceName}
                </p>
              </div>
              <p className="font-display text-lg font-semibold tabular-nums">
                {formatCurrency(detail.price, preferences.currency)}
              </p>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Cell label="Duration" value={detail.durationLabel} />
              <Cell label="Changes" value={detail.stopsLabel} />
              <Cell label="Luggage" value={detail.baggageLabel} icon={<Luggage className="h-3 w-3" />} />
              <Cell
                label="Estimated CO₂"
                value={`${detail.co2Kg} kg for the group`}
                icon={<Leaf className="h-3 w-3" />}
              />
            </dl>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{leg.note}</p>
              <DataBadge quality={detail.quality} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Cell({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}
