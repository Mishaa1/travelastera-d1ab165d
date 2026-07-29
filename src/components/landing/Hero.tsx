import { Link, useNavigate } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useMemo, useRef } from "react";

import heroImage from "@/assets/hero-coast.jpg";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { Wordmark } from "@/components/layout/Wordmark";
import { PlaceSearch } from "@/components/common/PlaceSearch";
import { RouteSketch } from "@/components/map/RouteSketch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CITIES } from "@/data/cities";
import { useTripDraft } from "@/hooks/useTripDraft";
import { formatCurrency, nightsBetween } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isDiscoveryTrip } from "@/services/tripOptimizer";

export function Hero() {
  const navigate = useNavigate();
  const { preferences, update } = useTripDraft();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);

  const nights = nightsBetween(preferences.startDate, preferences.endDate);
  const discovery = isDiscoveryTrip(preferences);
  const datesReady =
    preferences.dateMode === "flexible"
      ? Boolean(preferences.flexibleMonth) && preferences.flexibleNights >= 2
      : Boolean(preferences.startDate && preferences.endDate);
  const canContinue = Boolean(preferences.startCity.trim()) && datesReady && preferences.budget > 0;


  /** The preview route reacts to budget and trip length — the engine in miniature. */
  const previewStops = useMemo(() => {
    const affordable = CITIES.filter(
      (city) => city.dailyIndex <= 42 + preferences.budget / (Math.max(3, nights) * 1.5),
    );
    const pool = affordable.length >= 3 ? affordable : CITIES;
    const count = Math.min(5, Math.max(2, Math.round(preferences.budget / 900) + 1));
    const step = Math.max(1, Math.floor(pool.length / count));
    return Array.from({ length: count }, (_, i) => pool[(i * step) % pool.length]);
  }, [preferences.budget, nights]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      <motion.div style={{ y: imageY }} className="absolute inset-0 -z-10">
        <img
          src={heroImage}
          alt="Coastal road winding along Mediterranean cliffs at sunset"
          width={1920}
          height={1200}
          fetchPriority="high"
          className="h-[115%] w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/45 to-background" />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 -z-10 text-primary-foreground/35">
        <RouteSketch key={previewStops.map((s) => s.id).join()} points={previewStops} />
      </div>

      <motion.div
        style={{ y: contentY }}
        className="mx-auto max-w-7xl px-5 pt-32 pb-16 md:px-8 md:pt-48 md:pb-28"
      >
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-center gap-x-5 gap-y-3"
        >
          <Wordmark withMark size="lg" className="text-primary-foreground" />
          <span className="inline-flex items-center gap-2 rounded-full surface-glass px-4 py-1.5 text-xs font-semibold tracking-wide text-foreground uppercase">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            AI travel optimiser · not another itinerary planner
          </span>
        </motion.div>


        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-4xl text-[clamp(2.6rem,7vw,5.2rem)] leading-[0.95] font-semibold text-primary-foreground"
        >
          See how far your budget can take you.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-xl text-lg leading-relaxed text-primary-foreground/85"
        >
          Stop comparing hundreds of websites. We'll build your best possible trip
          automatically — from your budget, your dates and the way you like to travel.
        </motion.p>

        {/* Four fields only — everything else is asked in the planner. */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 rounded-4xl surface-glass p-5 shadow-float sm:p-7"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="min-w-0">
              <Label htmlFor="hero-start" className="text-xs font-semibold tracking-wide uppercase">
                Starting from
              </Label>
              <PlaceSearch
                className="mt-2"
                id="hero-start"
                size="lg"
                icon="plane"
                value={preferences.startCity}
                onChange={(value: string) => update("startCity", value)}
                placeholder="City or airport"
              />
            </div>

            <div className="min-w-0">
              <Label htmlFor="hero-end" className="text-xs font-semibold tracking-wide uppercase">
                End city · optional
              </Label>
              <PlaceSearch
                className="mt-2"
                id="hero-end"
                size="lg"
                icon="pin"
                value={preferences.endCity}
                onChange={(value: string) => update("endCity", value)}
                placeholder="Leave blank and ASTERA will discover destinations"
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-semibold tracking-wide uppercase">Dates</Label>
                <div className="flex gap-1 rounded-full border border-border/60 bg-background/60 p-0.5">
                  {(["exact", "flexible"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={preferences.dateMode === mode}
                      onClick={() => update("dateMode", mode)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors",
                        preferences.dateMode === mode
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {preferences.dateMode === "exact" ? (
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Input
                    id="hero-from"
                    type="date"
                    aria-label="Leaving"
                    value={preferences.startDate}
                    onChange={(event) => update("startDate", event.target.value)}
                    className="h-12 rounded-2xl"
                  />
                  <Input
                    id="hero-to"
                    type="date"
                    aria-label="Returning"
                    value={preferences.endDate}
                    onChange={(event) => update("endDate", event.target.value)}
                    className="h-12 rounded-2xl"
                  />
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Input
                    id="hero-month"
                    type="month"
                    aria-label="Month"
                    value={preferences.flexibleMonth}
                    onChange={(event) => update("flexibleMonth", event.target.value)}
                    className="h-12 rounded-2xl"
                  />
                  <Input
                    id="hero-nights"
                    type="number"
                    min={2}
                    max={30}
                    aria-label="Nights"
                    value={preferences.flexibleNights}
                    onChange={(event) =>
                      update("flexibleNights", Math.max(2, Math.min(30, Number(event.target.value) || 7)))
                    }
                    className="h-12 rounded-2xl"
                  />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="hero-budget" className="text-xs font-semibold tracking-wide uppercase">
                  Total trip budget
                </Label>
                <span className="font-display text-lg font-semibold tabular-nums">
                  <AnimatedCounter
                    value={preferences.budget}
                    duration={0.4}
                    format={(value) => formatCurrency(value, preferences.currency)}
                  />
                </span>
              </div>
              <Slider
                id="hero-budget"
                className="mt-5"
                min={400}
                max={9000}
                step={100}
                value={[preferences.budget]}
                onValueChange={([value]) => update("budget", value)}
                aria-label="Total trip budget"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              variant="hero"
              disabled={!canContinue}
              className="w-full sm:w-auto"
              onClick={() => navigate({ to: "/plan" })}
            >
              Personalise my trip
              <ArrowRight aria-hidden />
            </Button>
            <Button asChild size="lg" variant="glass" className="w-full sm:w-auto">
              <Link to="/results" search={{ sample: true }}>
                Try a sample trip
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground sm:ml-2">
              Takes about one minute · {nights} nights
            </p>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {discovery
              ? "ASTERA will compare destinations that fit your budget and preferences."
              : `Destination-specific: we optimise flights, schedule, experiences and budget around ${preferences.endCity.trim()}.`}
          </p>
        </motion.div>

      </motion.div>
    </section>
  );
}
