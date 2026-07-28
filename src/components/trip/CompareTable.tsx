import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrency, formatHours } from "@/lib/format";
import type { TripRoute } from "@/lib/types";

interface CompareTableProps {
  routes: TripRoute[];
  onClear: () => void;
}

const ROWS: { label: string; value: (route: TripRoute) => string }[] = [
  { label: "Route", value: (r) => r.stops.map((s) => s.name).join(" → ") },
  { label: "Countries", value: (r) => r.countries.join(", ") },
  { label: "Trip score", value: (r) => `${r.scores.overall}/100` },
  { label: "Estimated cost", value: (r) => formatCurrency(r.cost, r.preferences.currency) },
  {
    label: "Budget left",
    value: (r) =>
      `${r.budgetLeft < 0 ? "−" : ""}${formatCurrency(Math.abs(r.budgetLeft), r.preferences.currency)}`,
  },
  { label: "Time in transit", value: (r) => formatHours(r.journeyHours) },
  { label: "Experience", value: (r) => `${r.scores.experience}` },
  { label: "Nature", value: (r) => `${r.scores.nature}` },
  { label: "Food", value: (r) => `${r.scores.food}` },
  { label: "Weather", value: (r) => `${r.scores.weather}` },
  { label: "Efficiency", value: (r) => `${r.scores.efficiency}` },
  { label: "Transport", value: (r) => r.transportRecommendation },
];

export function CompareTable({ routes, onClear }: CompareTableProps) {
  return (
    <section className="overflow-hidden rounded-4xl border border-border bg-card shadow-soft">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-5">
        <h2 className="truncate font-display text-lg font-semibold">
          Comparing {routes.length} routes
        </h2>
        <Button variant="ghost" size="sm" onClick={onClear} className="shrink-0">
          <X aria-hidden />
          Clear
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Side-by-side comparison of your selected routes</caption>
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th scope="col" className="p-4 text-left font-semibold">
                Metric
              </th>
              {routes.map((route) => (
                <th key={route.id} scope="col" className="p-4 text-left font-semibold">
                  {route.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <th scope="row" className="p-4 text-left font-medium text-muted-foreground">
                  {row.label}
                </th>
                {routes.map((route) => (
                  <td key={route.id} className="p-4">
                    {row.value(route)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
