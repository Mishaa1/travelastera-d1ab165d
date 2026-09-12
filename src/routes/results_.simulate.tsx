import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  BedDouble,
  Check,
  Clock3,
  Footprints,
  Gauge,
  MapPinned,
  SlidersHorizontal,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";
import { resultsStore } from "@/lib/storage";
import type { LuxuryLevel, TripRoute } from "@/lib/types";
import { optimiseFurther } from "@/services/tripOptimizer";

export const Route = createFileRoute("/results_/simulate")({
  head: () => ({ meta: [{ title: "Trip simulator — ASTERA" }] }),
  component: TripSimulatorPage,
});

type SimulatorControls = {
  budget: number;
  pace: number;
  walkingKm: number;
  hotelQuality: number;
  stops: number;
};

type RankedRoute = {
  route: TripRoute;
  fit: number;
  walkingKm: number;
  hotelRating: number;
};

const luxuryValue: Record<LuxuryLevel, number> = {
  hostel: 1,
  midscale: 2,
  boutique: 3,
  luxury: 4,
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function routeHotelRating(route: TripRoute) {
  const ratings = route.stops.map((stop) => stop.hotel.rating).filter(Number.isFinite);
  return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
}

function estimatedWalkingKm(route: TripRoute) {
  const places = route.itinerary.reduce(
    (sum, day) => sum + (day.experiences?.length ?? 0) + (day.restaurantDetails ? 1 : 0),
    0,
  );
  return Math.max(2, Math.min(15, (places / Math.max(1, route.itinerary.length)) * 1.8));
}

function rankRoute(route: TripRoute, controls: SimulatorControls): RankedRoute {
  const hotelRating = routeHotelRating(route);
  const walkingKm = estimatedWalkingKm(route);
  const budgetFit = route.cost <= controls.budget
    ? 100 - ((controls.budget - route.cost) / Math.max(controls.budget, 1)) * 20
    : 100 - ((route.cost - controls.budget) / Math.max(controls.budget, 1)) * 120;
  const desiredTravelHours = 4 + (controls.pace / 100) * 16;
  const paceFit = 100 - Math.abs(route.journeyHours - desiredTravelHours) * 5;
  const walkingFit = 100 - Math.abs(walkingKm - controls.walkingKm) * 9;
  const hotelFit = 100 - Math.abs(hotelRating - (controls.hotelQuality + 1)) * 24;
  const stopsFit = 100 - Math.abs(route.stops.length - controls.stops) * 28;
  const fit = clamp(
    budgetFit * 0.3 + paceFit * 0.2 + walkingFit * 0.14 + hotelFit * 0.16 +
      stopsFit * 0.1 + route.scores.overall * 0.1,
  );
  return { route, fit, walkingKm, hotelRating };
}

function distinctProfiles(ranked: RankedRoute[]) {
  if (!ranked.length) return [];
  const used = new Set<string>();
  const take = (items: RankedRoute[]) => {
    const item = items.find((candidate) => !used.has(candidate.route.id));
    if (item) used.add(item.route.id);
    return item;
  };
  return [
    { kind: "recommended", label: "Recommended", note: "Best balance for you", item: take([...ranked].sort((a, b) => b.fit - a.fit)) },
    { kind: "save", label: "Save more", note: "Lower cost option", item: take([...ranked].sort((a, b) => a.route.cost - b.route.cost)) },
    { kind: "comfort", label: "Comfort first", note: "Better stays, less rush", item: take([...ranked].sort((a, b) => b.hotelRating - a.hotelRating || a.route.journeyHours - b.route.journeyHours)) },
  ].filter((profile): profile is { kind: string; label: string; note: string; item: RankedRoute } => Boolean(profile.item));
}

function materialSignature(route: TripRoute) {
  return [
    route.stops.map((stop) => `${stop.name}:${stop.nights}:${stop.hotel.id ?? stop.hotel.name}`).join("|"),
    route.legs.map((leg) => `${leg.from}:${leg.to}:${leg.mode}`).join("|"),
    Math.round(route.cost),
    Math.round(route.journeyHours * 10),
  ].join("::");
}

function TripSimulatorPage() {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<TripRoute[]>([]);
  const [generatingAlternatives, setGeneratingAlternatives] = useState(false);
  const [alternativeMessage, setAlternativeMessage] = useState<string | null>(null);
  const attemptedForRoute = useRef<string | null>(null);
  useEffect(() => setRoutes(resultsStore.get()), []);

  useEffect(() => {
    const source = routes[0];
    if (!source || routes.length >= 3 || attemptedForRoute.current === source.id) return;
    attemptedForRoute.current = source.id;
    let cancelled = false;
    const generate = async () => {
      setGeneratingAlternatives(true);
      setAlternativeMessage(null);
      const collected = [...routes];
      const signatures = new Set(collected.map(materialSignature));
      const goals = ["spend-less", "reduce-travel", "more-luxury", "add-city"] as const;
      for (const goal of goals) {
        if (cancelled || collected.length >= 3) break;
        try {
          const candidate = await optimiseFurther(source, goal);
          const signature = materialSignature(candidate);
          if (!signatures.has(signature)) {
            signatures.add(signature);
            collected.push(candidate);
            if (!cancelled) setRoutes([...collected]);
          }
        } catch {
          // A failed strategy must not discard alternatives already produced.
        }
      }
      if (!cancelled) {
        resultsStore.set(collected);
        setAlternativeMessage(
          collected.length >= 3
            ? null
            : `ASTERA found ${collected.length} materially different valid ${collected.length === 1 ? "route" : "routes"}; the other strategies resolved to the same trip or failed a hard constraint.`,
        );
        setGeneratingAlternatives(false);
      }
    };
    void generate();
    return () => { cancelled = true; };
  }, [routes]);

  const reference = routes[0];
  const initial = useMemo<SimulatorControls>(() => ({
    budget: reference?.preferences.budget ?? 2200,
    pace: reference ? Math.min(100, Math.max(0, ((reference.preferences.maxTravelHours - 4) / 16) * 100)) : 50,
    walkingKm: reference ? Math.round(estimatedWalkingKm(reference)) : 8,
    hotelQuality: reference ? luxuryValue[reference.preferences.luxuryLevel] : 3,
    stops: reference?.stops.length ?? 1,
  }), [reference]);
  const [controls, setControls] = useState<SimulatorControls>(initial);
  useEffect(() => setControls(initial), [initial]);

  const ranked = useMemo(() => routes.map((route) => rankRoute(route, controls)), [routes, controls]);
  const profiles = useMemo(() => distinctProfiles(ranked), [ranked]);

  const choose = (route: TripRoute) => {
    resultsStore.set([route, ...routes.filter((candidate) => candidate.id !== route.id)]);
    toast.success("Trip selected. Your provider-backed itinerary is unchanged and ready to review.");
    void navigate({ to: "/trip/$tripId", params: { tripId: route.id } });
  };

  return (
    <PageShell>
      <main className="min-h-screen bg-[linear-gradient(180deg,rgba(232,247,249,.72),rgba(250,247,240,.92)_34%)] px-5 pt-28 pb-24 md:px-8 md:pt-36">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <Button asChild variant="ghost" className="-ml-3 mb-5"><Link to="/results"><ArrowLeft />Back to recommendations</Link></Button>
              <p className="text-xs font-semibold tracking-[.18em] text-teal uppercase">Live trade-offs</p>
              <h1 className="mt-3 font-display text-4xl font-semibold md:text-6xl">Trip simulator</h1>
              <p className="mt-3 max-w-xl text-muted-foreground">Adjust what matters and see which real recommendation rises to the top. Nothing changes until you choose.</p>
            </div>
            <div className="rounded-2xl border border-teal/20 bg-white/75 px-4 py-3 text-sm shadow-soft backdrop-blur">
              <strong>{routes.length}</strong> provider-backed candidates available
              {generatingAlternatives && <span className="ml-2 text-teal">· Building distinct alternatives…</span>}
            </div>
          </div>

          {!routes.length ? <EmptySimulator /> : (
            <div className="mt-10 grid items-stretch gap-5 xl:grid-cols-[minmax(260px,.82fr)_minmax(0,2.35fr)]">
              <motion.aside initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-border/70 bg-white p-6 shadow-soft">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-teal/10 text-teal"><SlidersHorizontal /></span><div><h2 className="font-semibold">Adjust your priorities</h2><p className="text-xs text-muted-foreground">Hard trip constraints remain protected.</p></div></div>
                <div className="mt-7 space-y-7">
                  <Control label="Budget" value={formatCurrency(controls.budget, reference.preferences.currency)} minLabel={formatCurrency(Math.max(300, Math.round(reference.preferences.budget * .55)), reference.preferences.currency)} maxLabel={formatCurrency(Math.round(reference.preferences.budget * 1.35), reference.preferences.currency)} icon={<WalletCards />} min={Math.max(300, Math.round(reference.preferences.budget * .55))} max={Math.round(reference.preferences.budget * 1.35)} step={25} value={controls.budget} onChange={(budget) => setControls((current) => ({ ...current, budget }))} />
                  <Control label="Pace" value={controls.pace < 35 ? "Relaxed" : controls.pace > 68 ? "Fast-paced" : "Balanced"} minLabel="Relaxed" maxLabel="Fast-paced" icon={<Gauge />} min={0} max={100} value={controls.pace} onChange={(pace) => setControls((current) => ({ ...current, pace }))} />
                  <Control label="Walking per day" value={`${controls.walkingKm} km`} minLabel="2 km" maxLabel="15 km" icon={<Footprints />} min={2} max={15} value={controls.walkingKm} onChange={(walkingKm) => setControls((current) => ({ ...current, walkingKm }))} />
                  <Control label="Hotel quality" value={`${controls.hotelQuality + 1}★ target`} minLabel="2★" maxLabel="5★" icon={<BedDouble />} min={1} max={4} value={controls.hotelQuality} onChange={(hotelQuality) => setControls((current) => ({ ...current, hotelQuality }))} />
                  <Control label="Number of stops" value={`${controls.stops} ${controls.stops === 1 ? "city" : "cities"}`} minLabel="1 city" maxLabel="3+ cities" icon={<MapPinned />} min={1} max={3} value={controls.stops} onChange={(stops) => setControls((current) => ({ ...current, stops }))} />
                </div>
              </motion.aside>

              <section className="grid gap-4 md:grid-cols-3" aria-label="Simulated trip alternatives">
                {profiles.map((profile, index) => <SimulationCard key={profile.item.route.id} {...profile} index={index} controls={controls} onChoose={() => choose(profile.item.route)} />)}
              </section>
            </div>
          )}
          {alternativeMessage && <p role="status" className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-50/80 px-4 py-3 text-sm text-muted-foreground">{alternativeMessage}</p>}
          {routes.length > 0 && <p className="mt-5 text-xs leading-relaxed text-muted-foreground"><strong>How this works:</strong> the simulator re-ranks the provider-backed recommendations already generated for this search. Walking distance is an estimate derived from each day’s grounded places. Prices are not re-quoted until you run a new optimisation.</p>}
        </div>
      </main>
    </PageShell>
  );
}

function Control({ label, value, minLabel, maxLabel, icon, min, max, step = 1, value: sliderValue, onChange }: { label: string; value: string; minLabel: string; maxLabel: string; icon: React.ReactNode; min: number; max: number; step?: number; value: number; onChange: (value: number) => void }) {
  return <div><div className="mb-3 flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-semibold [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-teal">{icon}{label}</span><strong className="text-sm">{value}</strong></div><Slider min={min} max={max} step={step} value={[sliderValue]} onValueChange={([next]) => onChange(next)} aria-label={label}/><div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>{minLabel}</span><span>{maxLabel}</span></div></div>;
}

function SimulationCard({ label, note, item, index, controls, onChoose }: { label: string; note: string; item: RankedRoute; kind: string; index: number; controls: SimulatorControls; onChoose: () => void }) {
  const { route, fit, walkingKm, hotelRating } = item;
  const overBudget = route.cost > controls.budget;
  const accent = index === 1 ? "border-[#e6c8b7]" : "border-teal/35";
  return <motion.article layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .08 }} className={`flex min-h-[520px] flex-col rounded-[26px] border bg-white p-5 shadow-soft ${accent}`}>
    <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{label}</p><p className="text-xs text-muted-foreground">{note}</p></div>{index === 0 && <Sparkles className="h-5 w-5 text-teal" />}</div>
    <div className="mt-7 flex items-end justify-between gap-3"><div><p className="font-display text-3xl font-semibold">{formatCurrency(route.cost, route.preferences.currency)}</p><p className="text-xs text-muted-foreground">Estimated total</p></div><div className="grid h-16 w-16 place-items-center rounded-full border-4 border-teal/25 text-center"><div><strong className="block text-lg leading-none">{fit}</strong><span className="text-[9px] uppercase">Fit score</span></div></div></div>
    <div className="mt-7 space-y-3 text-sm"><Fact icon={<Clock3 />} text={`${route.journeyHours.toFixed(1)}h total transit`} /><Fact icon={<BedDouble />} text={`${route.stops.length} ${route.stops.length === 1 ? "hotel stay" : "hotel stays"} · ${hotelRating ? `${hotelRating.toFixed(1)}★` : "rating unavailable"}`} /><Fact icon={<Footprints />} text={`≈${walkingKm.toFixed(1)} km/day walking`} /><Fact icon={<Check />} text={route.reasoning[0] ?? route.tagline} /></div>
    <div className="mt-auto pt-8"><div className="mb-5 space-y-2"><Bar value={fit} /><Bar value={route.scores.efficiency} muted/><Bar value={route.scores.experience} muted/></div>{overBudget && <p className="mb-3 text-xs font-medium text-destructive">{formatCurrency(route.cost - controls.budget, route.preferences.currency)} above this simulated budget</p>}<Button type="button" variant={index === 0 ? "hero" : "outline"} className="w-full" onClick={onChoose}>Choose this trip</Button></div>
  </motion.article>;
}

function Fact({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="flex items-start gap-2.5 text-muted-foreground [&_svg]:mt-0.5 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-emerald"><span>{icon}</span><span>{text}</span></div>; }
function Bar({ value, muted = false }: { value: number; muted?: boolean }) { return <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><motion.div initial={{ width: 0 }} animate={{ width: `${clamp(value)}%` }} className={`h-full rounded-full ${muted ? "bg-primary/55" : "bg-teal"}`} /></div>; }
function EmptySimulator() { return <div className="mt-10 rounded-[28px] border border-dashed border-border bg-white/70 p-12 text-center"><h2 className="font-display text-2xl font-semibold">Generate recommendations first</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">The simulator compares real recommendations from your latest optimisation. It cannot manufacture alternatives without them.</p><Button asChild variant="hero" className="mt-6"><Link to="/plan">Plan my trip</Link></Button></div>; }
