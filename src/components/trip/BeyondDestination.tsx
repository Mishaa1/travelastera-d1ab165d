import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock3, Compass, Hotel, MapPinned, Sparkles, Wallet } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import type { TripRoute } from "@/lib/types";

export function BeyondDestination({ routes, destination }: { routes: TripRoute[]; destination: string }) {
  const seen = new Set<string>();
  const candidates = routes.filter((route) => {
    const context = route.regionalDiscovery;
    if (!context) return false;
    const key = `${context.family}:${context.addedDestinations[0]?.name.toLocaleLowerCase("en") ?? destination.toLocaleLowerCase("en")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
  if (!destination || !candidates.length) return null;
  const expanded = candidates.filter((route) => route.regionalDiscovery?.family !== "destination-only");

  return (
    <section className="mb-10 rounded-[32px] border border-teal/20 bg-[linear-gradient(145deg,rgba(255,255,255,.96),rgba(224,246,248,.62))] p-5 shadow-soft sm:p-7" aria-labelledby="beyond-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[.16em] text-teal uppercase"><Compass className="h-4 w-4" aria-hidden /> Regional discovery</p>
          <h2 id="beyond-heading" className="mt-2 font-serif-display text-3xl font-light sm:text-4xl">Beyond {destination}</h2>
          <p className="mt-2 text-sm text-muted-foreground">You asked for {destination}. ASTERA verified nearby possibilities, asked the planner to rank them, then priced and validated the strongest routes.</p>
        </div>
        <p className="max-w-sm text-sm font-medium text-ink/75">
          {expanded.length ? `${expanded.length} regional ${expanded.length === 1 ? "possibility" : "possibilities"} survived every hard constraint.` : `${destination} works best on its own for these dates and constraints.`}
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {candidates.map((route, index) => {
          const context = route.regionalDiscovery!;
          const place = context.addedDestinations[0];
          const routeLabel = place ? `${destination} + ${place.name}` : `${destination} only`;
          const aiReason = route.reasoning.find((reason) => reason.startsWith("AI planner:"));
          const regionalDays = place
            ? route.itinerary.filter((day) => day.city.toLocaleLowerCase("en") === place.name.toLocaleLowerCase("en"))
            : [];
          return (
            <Link
              key={route.id}
              to="/trip/$tripId"
              params={{ tripId: route.id }}
              className="group flex min-h-[310px] flex-col rounded-[22px] border border-border/70 bg-white p-5 shadow-[0_12px_34px_rgba(8,31,45,.07)] transition duration-300 hover:-translate-y-2 hover:border-teal/45 hover:bg-ink hover:text-white"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-teal/10 text-teal group-hover:bg-white/10 group-hover:text-white"><MapPinned className="h-5 w-5" aria-hidden /></span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold tracking-wide text-ink uppercase group-hover:bg-white/12 group-hover:text-white">{index === 0 ? "Recommended" : context.destinationType.replaceAll("-", " ")}</span>
              </div>
              <h3 className="mt-5 font-serif-display text-2xl leading-tight">{routeLabel}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground group-hover:text-white/70">{aiReason?.replace(/^AI planner:\s*/, "") ?? context.primaryBenefit}</p>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
                <Metric icon={<Clock3 />} label="Extra travel" value={context.travelMinutesAdded ? `+${context.travelMinutesAdded} min` : "None"} />
                <Metric icon={<Wallet />} label="Estimated" value={formatCurrency(route.cost, route.preferences.currency)} />
                <Metric icon={<Hotel />} label="Nights" value={route.stops.map((stop) => `${stop.name} ${stop.nights}n`).join(" · ")} />
                <Metric icon={<Sparkles />} label="Fit" value={`${Math.round(route.scores.overall)}/100`} />
              </dl>
              {place && (
                <p className="mt-4 rounded-xl bg-teal/8 px-3 py-2 text-xs font-medium text-ink group-hover:bg-white/10 group-hover:text-white">
                  {regionalDays.length
                    ? `${regionalDays.map((day) => `Day ${day.day}`).join(", ")} in ${place.name} · ${regionalDays.reduce((sum, day) => sum + (day.experiences?.length ?? 0), 0)} live places`
                    : `No provider-grounded ${place.name} day was available; this candidate is not selectable.`}
                </p>
              )}
              <div className="mt-5 border-t border-border/60 pt-4 group-hover:border-white/15">
                <p className="text-[11px] font-semibold tracking-wide uppercase">Main trade-off</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground group-hover:text-white/70">{context.tradeOff}</p>
              </div>
              <span className="mt-auto flex items-center justify-between pt-5 text-sm font-semibold text-teal group-hover:text-white">View itinerary <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="min-w-0"><dt className="flex items-center gap-1 text-muted-foreground group-hover:text-white/60">{<span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>}{label}</dt><dd className="mt-1 truncate font-semibold">{value}</dd></div>;
}
