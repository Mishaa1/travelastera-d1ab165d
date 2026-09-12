import { memo, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Brain, Check, CircleEllipsis, Compass, Hotel, MapPin, Plane, Scale, Sparkles, Utensils } from "lucide-react";
import type { OptimisationCandidateProgress, OptimisationProgress, OptimisationStage } from "@/services/tripOptimizer";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS: Array<{ id: OptimisationStage; label: string; detail: string; icon: typeof Brain; count?: keyof NonNullable<OptimisationProgress["counts"]> }> = [
  { id: "preferences", label: "Understanding your preferences", detail: "Reading your dates, budget and hard constraints", icon: Brain },
  { id: "destinations", label: "Exploring destination combinations", detail: "Testing routes that can genuinely fit", icon: Compass, count: "candidateRoutes" },
  { id: "flights", label: "Comparing flight options", detail: "Checking viable transport between stops", icon: Plane, count: "flightsAnalysed" },
  { id: "hotels", label: "Evaluating hotels", detail: "Balancing location, quality and trip cost", icon: Hotel, count: "hotelsConsidered" },
  { id: "attractions", label: "Ranking attractions", detail: "Grounding each day in real places", icon: MapPin, count: "attractionsRanked" },
  { id: "restaurants", label: "Matching restaurants", detail: "Finding food that suits the itinerary", icon: Utensils, count: "restaurantsMatched" },
  { id: "tradeoffs", label: "Balancing trade-offs", detail: "Comparing cost, pace, comfort and fit", icon: Scale, count: "candidatesScored" },
  { id: "selection", label: "Selecting the best itinerary", detail: "Turning the strongest options into clear recommendations", icon: Sparkles },
];

export const optimisationStageIndex = (stage: OptimisationStage) => STEPS.findIndex((step) => step.id === stage);

const ProviderPill = ({ label, value, tone = "teal" }: { label: string; value: string; tone?: "teal" | "amber" }) => <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-3"><p className="text-[10px] font-semibold tracking-[.14em] text-muted-foreground uppercase">{label}</p><p className={cn("mt-1 text-sm font-semibold", tone === "amber" ? "text-amber-700" : "text-teal")}>{value}</p></div>;

const RouteCard = ({ candidate, currency }: { candidate: OptimisationCandidateProgress; currency: "EUR" | "USD" | "GBP" }) => <article className={cn("min-w-[230px] rounded-2xl border bg-white p-4 shadow-[0_12px_30px_rgba(15,30,45,.06)]", candidate.status === "selected" ? "border-teal/50 ring-1 ring-teal/15" : "border-border/70")}>
  <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold tracking-[.14em] text-teal uppercase">{candidate.status === "selected" ? "Recommended" : "In consideration"}</p>{candidate.score != null && <span className="font-serif-display text-xl">{candidate.score}</span>}</div>
  <p className="mt-2 font-semibold leading-snug">{candidate.route.join(" → ")}</p>
  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{candidate.reason}</p>
  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
    {candidate.totalCost != null && <span><b>{formatCurrency(candidate.totalCost, currency)}</b><small className="block text-muted-foreground">total</small></span>}
    {candidate.transitHours != null && <span><b>{candidate.transitHours}h</b><small className="block text-muted-foreground">transit</small></span>}
    {candidate.transfers != null && <span><b>{candidate.transfers}</b><small className="block text-muted-foreground">transfers</small></span>}
    {candidate.hotelRating != null && candidate.hotelRating > 0 && <span><b>{candidate.hotelRating.toFixed(1)}</b><small className="block text-muted-foreground">stay rating</small></span>}
  </div>
</article>;

function StoryPanel({ progress }: { progress: OptimisationProgress }) {
  const p = progress.preferences;
  const candidates = progress.candidates ?? [];
  const leading = [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const currency = p?.currency ?? "EUR";
  const provider = progress.providers;
  const places = progress.stage === "restaurants" ? leading?.topRestaurants : leading?.topAttractions;
  const notices = useMemo(() => {
    const items: string[] = [];
    if (leading?.budgetLeft != null && leading.budgetLeft >= 0) items.push(`${formatCurrency(leading.budgetLeft, currency)} remains inside the budget.`);
    if (leading?.transitHours != null && p?.maxTravelHours) items.push(`${leading.transitHours}h in transit against your ${p.maxTravelHours}h ceiling.`);
    if (provider?.hotels?.status === "cached") items.push("Cached Hotelbeds availability is keeping the hotel comparison moving.");
    if (provider?.hotels?.status === "demo") items.push("Hotel availability is labelled demo inventory, not a live booking offer.");
    return items;
  }, [currency, leading, p?.maxTravelHours, provider?.hotels?.status]);

  return <motion.div key={progress.stage} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 px-6 py-7 sm:px-8 sm:py-9">
    <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold tracking-[.18em] text-teal uppercase">Live optimisation story</p><h3 className="mt-2 font-serif-display text-3xl leading-tight">{STEPS[optimisationStageIndex(progress.stage)]?.label}</h3></div><span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">Live</span></div>

    {progress.stage === "preferences" && p && <div className="mt-7 grid gap-6 md:grid-cols-2"><div><p className="text-sm font-semibold">Your priorities</p><div className="mt-3 flex flex-wrap gap-2">{p.interests.map((interest) => <span key={interest} className="rounded-full bg-secondary px-3 py-1.5 text-xs capitalize">{interest} · high</span>)}{p.activities.filter((a) => !p.interests.includes(a as never)).slice(0,4).map((activity) => <span key={activity} className="rounded-full bg-secondary px-3 py-1.5 text-xs capitalize">{activity.replace("-", " ")}</span>)}</div><dl className="mt-5 grid grid-cols-2 gap-3"><ProviderPill label="Pace" value={p.fewerHotelChanges ? "Calm" : "Balanced"}/><ProviderPill label="Budget ceiling" value={formatCurrency(p.budget, p.currency)}/><ProviderPill label="Travellers" value={String(p.travellers)}/><ProviderPill label="Transport" value={p.avoidFlights ? "No flights" : p.transport}/></dl></div><div className="rounded-2xl bg-ink p-5 text-white"><p className="text-xs font-semibold tracking-widest text-white/55 uppercase">Hard constraints</p><ul className="mt-4 space-y-2 text-sm"><li>{p.startCity} departure</li>{p.endCity && <li>{p.endCity} destination</li>}<li>{p.startDate} – {p.endDate}</li><li>Maximum {formatCurrency(p.budget, p.currency)}</li>{p.diets.map((diet) => <li key={diet} className="capitalize">{diet}</li>)}{p.notes && <li className="text-white/75">{p.notes}</li>}</ul><p className="mt-5 border-t border-white/15 pt-4 text-xs text-white/65">ASTERA never averages away hard constraints.</p></div></div>}

    {progress.stage === "destinations" && <div className="mt-7"><div className="flex gap-3 overflow-x-auto pb-3">{candidates.map((candidate) => <RouteCard key={candidate.id} candidate={candidate} currency={currency}/>)}</div>{!candidates.length && <Skeleton />}</div>}

    {progress.stage === "flights" && <div className="mt-7 space-y-5"><div className="grid gap-3 sm:grid-cols-3"><ProviderPill label="Flight source" value={provider?.flights?.detail ?? "Searching…"} tone={provider?.flights?.status === "estimated" ? "amber" : "teal"}/><ProviderPill label="Offers used" value={provider?.flights ? String(provider.flights.count) : "Searching…"}/><ProviderPill label="Status" value={provider?.flights?.status ?? "Searching"} tone={provider?.flights?.status === "estimated" ? "amber" : "teal"}/></div>{candidates.length ? <div className="flex gap-3 overflow-x-auto pb-2">{candidates.slice(0,3).map((candidate) => <RouteCard key={candidate.id} candidate={candidate} currency={currency}/>)}</div> : <Skeleton />}</div>}

    {progress.stage === "hotels" && <div className="mt-7 grid gap-5 md:grid-cols-[1fr_.72fr]"><div className="rounded-3xl bg-secondary/70 p-6"><p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Current leading stay</p><h4 className="mt-3 font-serif-display text-2xl">{leading?.hotelName ?? "Evaluating available stays…"}</h4>{leading?.hotelRating != null && leading.hotelRating > 0 && <p className="mt-2 text-sm">★ {leading.hotelRating.toFixed(1)}</p>}<div className="mt-5 flex gap-6 text-sm">{leading?.hotelNightly != null && <span><b>{formatCurrency(leading.hotelNightly, currency)}</b><small className="block text-muted-foreground">per night</small></span>}{leading?.hotelTotal != null && <span><b>{formatCurrency(leading.hotelTotal, currency)}</b><small className="block text-muted-foreground">complete stay</small></span>}</div></div><div className="space-y-3"><ProviderPill label="Hotel source" value={provider?.hotels?.detail ?? "Searching…"} tone={provider?.hotels?.status === "demo" || provider?.hotels?.status === "unavailable" ? "amber" : "teal"}/><ProviderPill label="Availability" value={provider?.hotels?.status ?? "Searching"}/></div></div>}

    {(progress.stage === "attractions" || progress.stage === "restaurants") && <div className="mt-7"><div className="flex items-center justify-between"><p className="text-sm font-semibold">{progress.stage === "restaurants" ? "Leading restaurant matches" : "Leading place matches"}</p><span className="text-xs text-muted-foreground">{progress.stage === "restaurants" ? provider?.restaurants?.detail : provider?.attractions?.detail}</span></div>{places?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-3">{places.map((place) => <article key={place.name} className="rounded-2xl border border-border/70 bg-white p-4"><p className="font-serif-display text-lg leading-tight">{place.name}</p><p className="mt-2 text-xs capitalize text-muted-foreground">{place.category || "Provider-backed place"}</p><p className="mt-4 text-xs font-semibold text-teal">{place.rating ? `★ ${place.rating} · ` : ""}{place.source.replaceAll("-", " ")}</p></article>)}</div> : <div className="mt-4 rounded-2xl bg-secondary/60 p-6 text-sm text-muted-foreground">{progress.stage === "restaurants" && provider?.restaurants?.status === "unavailable" ? "Live restaurant data unavailable." : "Waiting for provider-backed matches…"}</div>}</div>}

    {(progress.stage === "tradeoffs" || progress.stage === "selection") && <div className="mt-7"><div className="flex gap-3 overflow-x-auto pb-3">{candidates.slice(0,4).map((candidate) => <RouteCard key={candidate.id} candidate={candidate} currency={currency}/>)}</div>{progress.stage === "selection" && leading && <motion.div initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 rounded-3xl bg-ink p-6 text-white"><p className="text-xs font-semibold tracking-widest text-teal uppercase">Best itinerary found</p><p className="mt-3 font-serif-display text-3xl">{leading.route.join(" → ")}</p><div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/75">{leading.totalCost != null && <span>{formatCurrency(leading.totalCost, currency)} estimated</span>}{leading.budgetLeft != null && <span>{formatCurrency(leading.budgetLeft, currency)} remaining</span>}{leading.attractionCount != null && <span>{leading.attractionCount} provider-backed attractions</span>}</div><p className="mt-5 text-sm text-white/55">Preparing your journey…</p></motion.div>}</div>}

    {notices.length > 0 && <div className="mt-7 border-t border-border pt-5"><p className="text-[10px] font-semibold tracking-[.16em] text-coral uppercase">ASTERA noticed</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{notices[0]}</p></div>}
  </motion.div>;
}

const Skeleton = () => <div className="grid grid-cols-3 gap-3" aria-label="Provider search in progress">{[0,1,2].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-secondary" />)}</div>;
const MemoStoryPanel = memo(StoryPanel);

export function OptimisationJourney({ progress }: { progress: OptimisationProgress }) {
  const reduceMotion = useReducedMotion();
  const activeIndex = Math.max(0, optimisationStageIndex(progress.stage));
  return <motion.section initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }} className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-soft" aria-live="polite" aria-label="AI optimisation progress">
    <div className="grid lg:grid-cols-[.7fr_1.3fr]">
      <div className="relative overflow-hidden bg-ink px-7 py-8 text-primary-foreground sm:px-9"><motion.div aria-hidden className="absolute -top-20 -left-16 h-64 w-64 rounded-full bg-teal/20 blur-3xl" animate={reduceMotion ? undefined : { x: [0, 24, 0], y: [0, 14, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}/><p className="relative text-[11px] font-semibold tracking-[.2em] text-white/60 uppercase">ASTERA is thinking</p><h2 className="relative mt-3 font-serif-display text-3xl leading-tight">{STEPS[activeIndex].label}</h2><p className="relative mt-2 text-sm text-white/65">{STEPS[activeIndex].detail}</p><div className="relative mt-6 h-1 overflow-hidden rounded-full bg-white/12"><motion.div className="h-full rounded-full bg-teal" animate={{ width: `${((activeIndex + 1) / STEPS.length) * 100}%` }} transition={reduceMotion ? { duration: 0 } : { duration: .28 }}/></div><p className="relative mt-2 text-xs text-white/50">Stage {activeIndex + 1} of {STEPS.length}</p>
        <ol className="relative mt-6">{STEPS.map((step,index) => { const done=index<activeIndex; const active=index===activeIndex; const Icon=step.icon; const count=step.count ? progress.counts?.[step.count] : undefined; return <li key={step.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-1.5"><span className={cn("grid h-8 w-8 place-items-center rounded-full border",done&&"border-teal bg-teal",active&&"border-teal bg-teal/15",!done&&!active&&"border-white/15 text-white/35")}>{done?<Check className="h-4 w-4"/>:active?<motion.span animate={reduceMotion?undefined:{scale:[1,1.12,1]}} transition={{repeat:Infinity,duration:1.4}}><Icon className="h-4 w-4"/></motion.span>:<Icon className="h-4 w-4"/>}</span><span className={cn("text-xs",active?"font-semibold text-white":done?"text-white/75":"text-white/35")}>{step.label}</span>{index<=activeIndex&&step.count&&<span className="text-[10px] text-white/45">{typeof count==="number"?count:<CircleEllipsis className="h-3.5 w-3.5 animate-pulse"/>}</span>}</li>})}</ol>
      </div><MemoStoryPanel progress={progress}/>
    </div>
  </motion.section>;
}
