import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Clock3, Eye, Hotel, Sparkles, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { SafeProviderImage } from "@/components/common/SafeProviderImage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDestinationMoodImages } from "@/hooks/useDestinationMoodImages";
import { allocateTripImages, type ImageAsset } from "@/lib/images/imageAllocator";
import { formatCurrency, formatHours } from "@/lib/format";
import { resultsStore } from "@/lib/storage";
import type { OptimiseGoal, TripRoute } from "@/lib/types";
import { optimiseFurther } from "@/services/tripOptimizer";

interface Props {
  route: TripRoute;
}

type Strategy = {
  route: TripRoute;
  label: string;
  subtitle: string;
  bullets: string[];
  image: ImageAsset | null;
};

const goals: OptimiseGoal[] = [
  "spend-less",
  "reduce-travel",
  "more-luxury",
  "more-nature",
  "avoid-flights",
];

const normalise = (value?: string) => value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";

function sameDestination(candidate: TripRoute, route: TripRoute) {
  return normalise(candidate.stops.at(-1)?.name) === normalise(route.stops.at(-1)?.name);
}

function signature(route: TripRoute) {
  return [
    route.stops.map((stop) => `${normalise(stop.name)}:${stop.nights}:${stop.hotel.id ?? stop.hotel.name}`).join("|"),
    route.legs.map((leg) => `${normalise(leg.from)}:${normalise(leg.to)}:${leg.mode}`).join("|"),
    Math.round(route.cost),
    Math.round(route.journeyHours * 10),
  ].join("::");
}

function hotelRating(route: TripRoute) {
  const ratings = route.stops.map((stop) => stop.hotel.rating).filter(Number.isFinite);
  return ratings.length ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length : null;
}

function transferCount(route: TripRoute) {
  const measured = route.provenance?.metrics.transferCount;
  return measured ?? Math.max(0, route.legs.length - 1);
}

function livePlaceCount(route: TripRoute) {
  return route.itinerary.reduce(
    (total, day) => total + (day.experiences?.length ?? 0) + (day.restaurantDetails ? 1 : 0),
    0,
  );
}

function strategyCopy(route: TripRoute, selected: boolean) {
  const text = `${route.title} ${route.tagline}`.toLowerCase();
  const rating = hotelRating(route);
  const places = livePlaceCount(route);
  const transfers = transferCount(route);
  const budgetLine = route.budgetLeft >= 0
    ? `${formatCurrency(route.budgetLeft, route.preferences.currency)} budget room`
    : `${formatCurrency(Math.abs(route.budgetLeft), route.preferences.currency)} over target`;

  // Explicit optimisation goals must win over broad score heuristics. Without
  // this ordering, a strong food score renamed every generated alternative.
  if (/spend less|cheapest|lower cost/.test(text)) return {
    label: "Spend Less", subtitle: "The leanest valid version of this trip.",
    bullets: [budgetLine, `${route.stops.length} curated ${route.stops.length === 1 ? "stay" : "stays"}`, `${places} grounded places`],
  };
  if (/reduce travel|fastest|fewer changes/.test(text)) return {
    label: "Fastest Journey", subtitle: "Less transit. More time there.",
    bullets: [`${formatHours(route.journeyHours)} total transit`, `${transfers} route ${transfers === 1 ? "change" : "changes"}`, `Efficiency ${Math.round(route.scores.efficiency)}/100`],
  };
  if (/more luxury|comfort|luxury/.test(text)) return {
    label: "Comfort First", subtitle: "Better stays and a calmer rhythm.",
    bullets: [rating ? `${rating.toFixed(1)} average stay rating` : "Stay quality prioritised", `${transfers} route ${transfers === 1 ? "change" : "changes"}`, budgetLine],
  };
  if (/more nature|scenic|hidden/.test(text)) return {
    label: "Hidden Gems", subtitle: "A slower route beyond the obvious.",
    bullets: [`Nature fit ${Math.round(route.scores.nature)}/100`, `${places} grounded places`, `${formatHours(route.journeyHours)} total transit`],
  };
  if (/avoid flights|rail/.test(text)) return {
    label: "Rail-First Route", subtitle: "Fewer flights and a more grounded journey.",
    bullets: [`${formatHours(route.journeyHours)} total transit`, `${transfers} route ${transfers === 1 ? "change" : "changes"}`, budgetLine],
  };
  if (selected) return {
    label: "Best Overall", subtitle: "The strongest balance across your priorities.",
    bullets: [budgetLine, `${route.stops.length} curated ${route.stops.length === 1 ? "stay" : "stays"}`, `${places} grounded places`],
  };

  if (/food/.test(text) || route.scores.food >= Math.max(route.scores.nature, route.scores.efficiency)) {
    return {
      label: "Foodie’s Route",
      subtitle: "Local flavour leads the way.",
      bullets: [`Food fit ${Math.round(route.scores.food)}/100`, `${places} grounded places`, budgetLine],
    };
  }
  if (/fast|travel/.test(text)) {
    return {
      label: "Fastest Journey",
      subtitle: "Less transit. More time there.",
      bullets: [`${formatHours(route.journeyHours)} total transit`, `${transfers} route ${transfers === 1 ? "change" : "changes"}`, `Efficiency ${Math.round(route.scores.efficiency)}/100`],
    };
  }
  if (/cheap|value|spend/.test(text)) {
    return {
      label: "Best Value",
      subtitle: "Maximum experience within your budget.",
      bullets: [budgetLine, `${route.stops.length} curated ${route.stops.length === 1 ? "stay" : "stays"}`, `${places} grounded places`],
    };
  }
  if (/nature|scenic|hidden/.test(text) || route.scores.nature > route.scores.efficiency) {
    return {
      label: "Hidden Gems",
      subtitle: "A slower route beyond the obvious.",
      bullets: [`Nature fit ${Math.round(route.scores.nature)}/100`, `${places} grounded places`, `${formatHours(route.journeyHours)} total transit`],
    };
  }
  return {
    label: route.title || "Best Overall",
    subtitle: route.tagline || "The strongest measured balance.",
    bullets: [`Overall fit ${Math.round(route.scores.overall)}/100`, budgetLine, `${places} grounded places`],
  };
}

const UNIQUE_LABELS = ["Best Value", "Fastest Journey", "Comfort First", "Hidden Gems", "Foodie’s Route"];

function uniqueStrategyCopy(candidate: TripRoute, currentId: string, used: Set<string>) {
  const copy = strategyCopy(candidate, candidate.id === currentId);
  if (!used.has(copy.label)) {
    used.add(copy.label);
    return copy;
  }
  const ranked = [
    { label: "Fastest Journey", value: -candidate.journeyHours },
    { label: "Comfort First", value: hotelRating(candidate) ?? -1 },
    { label: "Hidden Gems", value: candidate.scores.nature },
    { label: "Foodie’s Route", value: candidate.scores.food },
    { label: "Best Value", value: -candidate.cost },
  ].sort((a, b) => b.value - a.value);
  const label = ranked.find((item) => !used.has(item.label))?.label
    ?? UNIQUE_LABELS.find((item) => !used.has(item))
    ?? `Alternative ${used.size + 1}`;
  used.add(label);
  return { ...copy, label, subtitle: `A distinct ${label.toLowerCase()} trade-off.` };
}

function embeddedImages(route: TripRoute) {
  const allocation = allocateTripImages(route);
  return [
    ...Object.values(allocation.dayPreviews).flat(),
    ...Object.values(allocation.hotelImages).flat(),
  ].filter((image) => image.source !== "placeholder");
}

function delta(value: number, suffix = "") {
  if (Math.abs(value) < 0.05) return `Same${suffix ? ` ${suffix}` : ""}`;
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}${suffix}`;
}

export function AlternativeUniverses({ route }: Props) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [routes, setRoutes] = useState<TripRoute[]>([]);
  const [selected, setSelected] = useState<TripRoute | null>(null);
  const [generating, setGenerating] = useState(false);
  const attempted = useRef<string | null>(null);
  const destination = route.stops.at(-1)?.name ?? route.itinerary.at(-1)?.city ?? "";
  const country = route.countries.at(-1) ?? "";
  const moodImages = useDestinationMoodImages(destination, country);

  useEffect(() => {
    const stored = resultsStore.get();
    const sameTrip = stored.filter((candidate) => sameDestination(candidate, route));
    const ordered = [route, ...sameTrip.filter((candidate) => candidate.id !== route.id)];
    const seen = new Set<string>();
    setRoutes(ordered.filter((candidate) => {
      const key = signature(candidate);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5));
  }, [route]);

  useEffect(() => {
    if (routes.length >= 3 || attempted.current === route.id) return;
    attempted.current = route.id;
    let active = true;
    const generate = async () => {
      setGenerating(true);
      const allStored = resultsStore.get();
      const collected = [...routes];
      const signatures = new Set(collected.map(signature));
      for (const goal of goals) {
        if (!active || collected.length >= 4) break;
        try {
          const candidate = await optimiseFurther(route, goal);
          const key = signature(candidate);
          if (sameDestination(candidate, route) && !signatures.has(key)) {
            signatures.add(key);
            collected.push(candidate);
            // Persist before exposing the card. Previously the card became
            // clickable first, so fast navigation could not resolve its trip ID.
            const latest = resultsStore.get();
            resultsStore.set([
              ...latest.filter((item) => item.id !== candidate.id),
              candidate,
            ]);
            if (active) setRoutes([...collected]);
          }
        } catch {
          // Preserve every valid alternative already produced.
        }
      }
      if (!active) return;
      const merged = [...allStored];
      collected.forEach((candidate) => {
        if (!merged.some((item) => item.id === candidate.id)) merged.push(candidate);
      });
      resultsStore.set(merged);
      setGenerating(false);
    };
    void generate();
    return () => { active = false; };
  }, [route, routes]);

  const strategies = useMemo(() => {
    const used = new Set<string>();
    const usedLabels = new Set<string>();
    const imagePool = [...routes.flatMap(embeddedImages), ...moodImages].filter(
      (image, index, images) => images.findIndex((candidate) => candidate.resolvedUrl === image.resolvedUrl) === index,
    );
    return routes.slice(0, 5).map((candidate): Strategy => {
      const copy = uniqueStrategyCopy(candidate, route.id, usedLabels);
      const own = embeddedImages(candidate).find((image) => !used.has(image.resolvedUrl));
      const image = own ?? imagePool.find((candidateImage) => !used.has(candidateImage.resolvedUrl)) ?? null;
      if (image) used.add(image.resolvedUrl);
      return { route: candidate, ...copy, image };
    });
  }, [moodImages, route.id, routes]);

  const switchRoute = (candidate: TripRoute) => {
    const stored = resultsStore.get();
    resultsStore.set([candidate, ...stored.filter((item) => item.id !== candidate.id)]);
    setSelected(null);
    toast.success("Alternative selected. Your trip is ready to review.");
    void navigate({ to: "/trip/$tripId", params: { tripId: candidate.id } });
  };

  const openDetailedRoute = (candidate: TripRoute) => {
    const stored = resultsStore.get();
    if (!stored.some((item) => item.id === candidate.id)) resultsStore.set([...stored, candidate]);
    setSelected(null);
    void navigate({ to: "/trip/$tripId/journey", params: { tripId: candidate.id } });
  };

  return (
    <section className="mt-10 scroll-mt-28" aria-labelledby="alternative-universes-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[.2em] text-teal uppercase">
            <Sparkles className="h-3.5 w-3.5" /> Different trade-offs
          </p>
          <h2 id="alternative-universes-title" className="mt-2 font-display text-[clamp(2.1rem,4vw,3.8rem)] leading-none tracking-[-.035em]">
            Alternative Universes
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Different optimisation strategies. Same destination. You choose.
          </p>
        </div>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          ASTERA compared materially different valid plans and kept the strongest trade-offs—not renamed duplicates.
        </p>
      </div>

      <div className="-mx-5 mt-7 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 lg:gap-7 xl:gap-8">
        {strategies.map((strategy, index) => {
          const isCurrent = strategy.route.id === route.id;
          return (
            <motion.button
              key={strategy.route.id}
              type="button"
              onClick={() => setSelected(strategy.route)}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : index * 0.07 }}
              whileHover={reduceMotion ? undefined : { y: -8 }}
              className={`group flex w-[82vw] max-w-[340px] shrink-0 snap-start flex-col overflow-hidden rounded-[20px] border bg-white text-left shadow-[0_24px_65px_-46px_rgba(6,37,48,.55)] transition-[border-color,box-shadow] sm:w-auto sm:max-w-none ${isCurrent ? "border-[#1f6fe5] ring-2 ring-[#1f6fe5]/15" : "border-border/55 hover:border-teal/35"}`}
              aria-label={`Compare ${strategy.label}`}
            >
              <div className="relative aspect-video overflow-hidden bg-[linear-gradient(145deg,#dfeff1,#e9e3d8)]">
                {strategy.image && (
                  <SafeProviderImage
                    candidates={[strategy.image, ...moodImages]}
                    requestedCity={destination}
                    alt={`${destination} — ${strategy.label}`}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.045] motion-reduce:transform-none"
                    placeholder={false}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" />
                {isCurrent && <span className="absolute top-4 left-4 rounded-full bg-white px-3 py-1.5 text-[9px] font-bold tracking-[.12em] text-[#1f6fe5] uppercase shadow-sm">Recommended</span>}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-2xl leading-tight">{strategy.label}</h3>
                    <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted-foreground">{strategy.subtitle}</p>
                  </div>
                  <motion.span
                    initial={reduceMotion ? false : { scale: .86, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[5px] border-teal/20 bg-white font-display text-lg font-semibold text-ink"
                    aria-label={`Score ${Math.round(strategy.route.scores.overall)}`}
                  >
                    {Math.round(strategy.route.scores.overall)}
                  </motion.span>
                </div>
                <p className="mt-5 font-display text-[2rem] leading-none">
                  {formatCurrency(strategy.route.cost, strategy.route.preferences.currency)}
                </p>
                <ul className="mt-5 space-y-2.5 text-xs text-ink/75">
                  {strategy.bullets.map((bullet) => <li key={bullet} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald" />{bullet}</li>)}
                </ul>
                <span className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-teal/30 px-4 py-3 text-xs font-semibold text-teal transition-colors group-hover:bg-[#174f86] group-hover:text-white">
                  View itinerary <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {generating && (
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal" /> Exploring another materially different strategy…
        </p>
      )}
      {!generating && strategies.length < 3 && (
        <p className="mt-1 text-xs text-muted-foreground">
          ASTERA found {strategies.length} materially distinct valid {strategies.length === 1 ? "plan" : "plans"}; duplicate outcomes were not shown.
        </p>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <AnimatePresence>
          {selected && (
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-[24px] border-white/70 bg-[#fbfaf7] p-0 shadow-[0_40px_100px_-35px_rgba(6,37,48,.7)]">
              <div className="bg-ink px-7 py-7 text-white sm:px-9">
                <DialogHeader>
                  <p className="text-[10px] font-semibold tracking-[.18em] text-[#d3a348] uppercase">Compare the trade-off</p>
                  <DialogTitle className="mt-2 font-display text-3xl font-medium">{strategies.find((item) => item.route.id === selected.id)?.label ?? strategyCopy(selected, selected.id === route.id).label}</DialogTitle>
                  <DialogDescription className="mt-2 text-white/65">Nothing changes until you confirm this itinerary.</DialogDescription>
                </DialogHeader>
              </div>
              <div className="p-7 sm:p-9">
                <div className="mb-6 overflow-hidden rounded-2xl border border-border/55 bg-white">
                  <div className="grid grid-cols-[1.25fr_1fr_1fr] bg-secondary/55 px-4 py-2.5 text-[10px] font-bold tracking-[.1em] text-muted-foreground uppercase">
                    <span>Measure</span><span>Current</span><span>This option</span>
                  </div>
                  <CompareRow label="Total price" current={formatCurrency(route.cost, route.preferences.currency)} alternative={formatCurrency(selected.cost, selected.preferences.currency)} />
                  <CompareRow label="Time in transit" current={formatHours(route.journeyHours)} alternative={formatHours(selected.journeyHours)} />
                  <CompareRow label="Route changes" current={String(transferCount(route))} alternative={String(transferCount(selected))} />
                  <CompareRow label="Average hotel" current={hotelRating(route)?.toFixed(1) ?? "Not measured"} alternative={hotelRating(selected)?.toFixed(1) ?? "Not measured"} />
                  <CompareRow label="Cities / stops" current={String(route.stops.length)} alternative={String(selected.stops.length)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ComparisonMetric icon={<WalletCards />} label="Price difference" value={formatCurrency(selected.cost - route.cost, route.preferences.currency)} />
                  <ComparisonMetric icon={<Clock3 />} label="Transit difference" value={delta(selected.journeyHours - route.journeyHours, "h")} />
                  <ComparisonMetric icon={<Hotel />} label="Hotel quality difference" value={hotelRating(selected) != null && hotelRating(route) != null ? delta(hotelRating(selected)! - hotelRating(route)!, "★") : "Not measured"} />
                  <ComparisonMetric icon={<Sparkles />} label="Experience score difference" value={delta(selected.scores.experience - route.scores.experience, " points")} />
                </div>
                <div className="mt-6 rounded-2xl bg-white p-5 shadow-[0_18px_45px_-38px_rgba(6,37,48,.5)]">
                  <p className="text-[10px] font-semibold tracking-[.14em] text-teal uppercase">Why ASTERA generated it</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink/75">{selected.reasoning[0] ?? selected.tagline}</p>
                </div>
                <div className="mt-6">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold tracking-[.14em] text-teal uppercase">Itinerary preview</p>
                      <h3 className="mt-1 font-display text-2xl">How this trip unfolds</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">{selected.itinerary.length} days · {selected.stops.length} {selected.stops.length === 1 ? "city" : "cities"}</p>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-border/55 bg-white">
                    {selected.itinerary.slice(0, 4).map((day) => {
                      const places = [
                        ...(day.experiences ?? []).map((place) => place.name),
                        ...(day.restaurantDetails ? [day.restaurantDetails.name] : []),
                      ];
                      return (
                        <div key={day.day} className="grid gap-2 border-b border-border/45 px-4 py-3 last:border-b-0 sm:grid-cols-[70px_120px_minmax(0,1fr)] sm:items-center">
                          <p className="text-[10px] font-bold tracking-[.12em] text-[#b78324] uppercase">Day {day.day}</p>
                          <p className="font-display text-base">{day.city}</p>
                          <p className="line-clamp-1 text-xs text-muted-foreground">{places.length ? places.join(" · ") : "Live places will be confirmed in the full itinerary"}</p>
                        </div>
                      );
                    })}
                    {selected.itinerary.length > 4 && <p className="px-4 py-3 text-center text-xs font-semibold text-teal">+ {selected.itinerary.length - 4} more days in the full itinerary</p>}
                  </div>
                </div>
                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setSelected(null)} className="rounded-xl px-5 py-3 text-sm font-semibold text-ink/65 hover:bg-secondary">Keep current trip</button>
                  <button type="button" onClick={() => openDetailedRoute(selected)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#174f86]/25 bg-white px-5 py-3 text-sm font-semibold text-[#174f86] hover:bg-secondary">
                    <Eye className="h-4 w-4" /> Open detailed itinerary
                  </button>
                  <button type="button" disabled={selected.id === route.id} onClick={() => switchRoute(selected)} className="rounded-xl bg-[#174f86] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ink disabled:cursor-default disabled:opacity-45">
                    {selected.id === route.id ? "Current itinerary" : "Use this itinerary"}
                  </button>
                </div>
              </div>
            </DialogContent>
          )}
        </AnimatePresence>
      </Dialog>
    </section>
  );
}

function CompareRow({ label, current, alternative }: { label: string; current: string; alternative: string }) {
  return (
    <div className="grid grid-cols-[1.25fr_1fr_1fr] border-t border-border/45 px-4 py-3 text-xs sm:text-sm">
      <span className="font-semibold text-ink">{label}</span>
      <span className="text-muted-foreground">{current}</span>
      <span className="font-semibold text-teal">{alternative}</span>
    </div>
  );
}

function ComparisonMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/55 bg-white p-4">
      <span className="text-teal">{icon}</span>
      <p className="mt-3 text-[10px] font-semibold tracking-[.12em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
    </div>
  );
}
