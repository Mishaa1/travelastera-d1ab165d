import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { SafeProviderImage } from "@/components/common/SafeProviderImage";
import { useDestinationMoodImages } from "@/hooks/useDestinationMoodImages";
import { allocateTripImages, type ImageAsset } from "@/lib/images/imageAllocator";
import { buildJourneyViewModels, type JourneyDayViewModel } from "@/lib/journeyViewModel";
import type { TripRoute } from "@/lib/types";

export function DayOverviewGallery({ route }: { route: TripRoute }) {
  const days = buildJourneyViewModels(route).slice(0, 3);
  const allocation = allocateTripImages(route);
  return (
    <section id="trip-itinerary" className="relative mt-5 scroll-mt-28 rounded-[1.35rem] border border-border/40 bg-white/55 p-4 shadow-[0_20px_55px_-48px_rgba(6,37,48,.4)] sm:p-5">
      <div className="flex items-center justify-between gap-5 px-1 pb-3">
        <p className="text-[10px] font-semibold tracking-[.2em] text-ink uppercase">Your itinerary</p>
        <p className="text-xs font-semibold text-ink/70">{route.itinerary.length} days / {Math.max(0, route.itinerary.length - 1)} nights</p>
      </div>
      <div className="space-y-2">
        {days.map((view) => (
          <DayPreview key={view.dayNumber} route={route} view={view} candidates={allocation.dayPreviews[view.dayNumber] ?? []} />
        ))}
      </div>
      {days.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center text-center sm:-bottom-2">
          <Link to="/trip/$tripId/journey" params={{ tripId: route.id }} search={{ day: days[0]?.dayNumber ?? 1 }} className="pointer-events-auto inline-flex min-w-72 items-center justify-center gap-2 rounded-lg border border-border bg-white px-6 py-3 text-xs font-semibold shadow-soft hover:bg-ink hover:text-white">
            View full day-by-day itinerary <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}

function DayPreview({ route, view, candidates }: { route: TripRoute; view: JourneyDayViewModel; candidates: ImageAsset[] }) {
  const [primaryRendered, setPrimaryRendered] = useState(false);
  const [renderedExtras, setRenderedExtras] = useState<Set<string>>(new Set());
  const hotel = route.stops.find((stop) => stop.name === view.city)?.hotel;
  const country = route.countries[route.stops.findIndex((stop) => stop.name === view.city)] ?? route.countries.at(-1) ?? "";
  const moodFallbacks = useDestinationMoodImages(view.city, country);
  const available = [...candidates, ...moodFallbacks].filter(
    (asset, index, assets) =>
      asset.source !== "placeholder" &&
      assets.findIndex((candidate) => candidate.resolvedUrl === asset.resolvedUrl) === index,
  );
  const primary = available;
  const extras = available.slice(1, 3);
  const recordExtra = (id: string, rendered: boolean) => setRenderedExtras((current) => {
    const next = new Set(current);
    if (rendered) next.add(id); else next.delete(id);
    return next;
  });

  return (
    <Link to="/trip/$tripId/journey" params={{ tripId: route.id }} search={{ day: view.dayNumber }} className="group relative grid min-h-[218px] overflow-hidden rounded-[1.15rem] bg-ink text-white shadow-[0_22px_55px_-45px_rgba(6,37,48,.72)] transition-transform duration-500 hover:-translate-y-0.5 motion-reduce:transform-none lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="flex flex-col justify-between bg-[#062936] p-5 sm:p-6">
        <div>
          <p className="text-[10px] font-semibold tracking-[.18em] text-[#d3a348] uppercase">Day {view.dayNumber}</p>
          <h3 className="mt-4 font-display text-[1.75rem] leading-[1.05] text-white">{view.title}</h3>
          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-white/70">{view.summary}</p>
        </div>
        {hotel && hotel.hotelProvenance?.source !== "demo-fixture" && <div className="mt-4"><p className="text-[10px] font-semibold text-[#d3a348]">Stay</p><p className="mt-1 truncate text-xs text-white/80">{hotel.name}</p></div>}
      </div>
      <div className="relative min-h-[218px] overflow-hidden bg-ink">
        <SafeProviderImage candidates={primary} requestedCity={view.city} alt={`${primary[0]?.placeName ?? view.city} in ${view.city}`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transform-none" loading="eager" placeholder={false} onRenderableChange={(rendered) => setPrimaryRendered(rendered)} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/20 via-transparent to-ink/15" />
      </div>
      {extras.length > 0 && <div className="absolute top-4 right-4 bottom-4 z-10 hidden w-[168px] grid-cols-1 grid-rows-2 gap-1.5 lg:grid">
        {extras.map((asset, index) => <span key={asset.id} className="relative min-h-20 overflow-hidden rounded-xl bg-ink/35">
          <SafeProviderImage candidates={available.slice(index + 1)} requestedCity={view.city} alt={`${asset.placeName ?? view.city} in ${view.city}`} className="absolute inset-0 h-full w-full object-cover" placeholder={false} onRenderableChange={(rendered) => recordExtra(asset.id, rendered)} />
          {index === 1 && primaryRendered && renderedExtras.has(asset.id) && available.length > 3 && <span className="absolute inset-0 grid place-items-center bg-ink/40 font-display text-3xl text-white">+{available.length - 3}</span>}
        </span>)}
      </div>}
    </Link>
  );
}
