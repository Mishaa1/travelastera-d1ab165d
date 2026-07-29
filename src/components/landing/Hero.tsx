import { Link, useNavigate } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useRef } from "react";

import heroImage from "@/assets/hero-satellite.png.asset.json";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { TravelPaths } from "@/components/common/TravelPaths";
import { Wordmark } from "@/components/layout/Wordmark";
import { PlaceSearch } from "@/components/common/PlaceSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useTripDraft } from "@/hooks/useTripDraft";
import { formatCurrency, nightsBetween } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isDiscoveryTrip } from "@/services/tripOptimizer";

export function Hero() {
  const navigate = useNavigate();
  const { preferences, update } = useTripDraft();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);

  const nights = nightsBetween(preferences.startDate, preferences.endDate);
  const discovery = isDiscoveryTrip(preferences);
  const datesReady =
    preferences.dateMode === "flexible"
      ? Boolean(preferences.flexibleMonth) && preferences.flexibleNights >= 2
      : Boolean(preferences.startDate && preferences.endDate);
  const canContinue = Boolean(preferences.startCity.trim()) && datesReady && preferences.budget > 0;

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[oklch(0.14_0.04_250)]">
      {/* Satellite backdrop -------------------------------------------------- */}
      <motion.div style={{ y: imageY }} className="absolute inset-0 -z-10">
        <img
          src={heroImage}
          alt="Satellite view of Europe at night with glowing city lights and travel routes"
          width={1920}
          height={1200}
          fetchPriority="high"
          className="h-[110%] w-full object-cover opacity-95"
        />
        {/* Left-side ink wash for typographic contrast, right stays open. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.14_0.04_250)]/85 via-[oklch(0.14_0.04_250)]/40 to-transparent" />
        {/* Natural fade into the warm parchment page background. */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-background" />
      </motion.div>

      {/* Animated travel paths between glowing city nodes */}
      <TravelPaths className="pointer-events-none absolute inset-x-0 top-16 -z-10 h-[70%] w-full" />

      <div className="mx-auto grid max-w-7xl gap-12 px-5 pt-36 pb-24 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-16 md:px-8 md:pt-52 md:pb-36">
        {/* Editorial copy ------------------------------------------------------ */}
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center gap-x-5 gap-y-3"
          >
            <Wordmark withMark size="lg" className="text-primary-foreground" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-[oklch(0.14_0.04_250)]/40 px-3.5 py-1.5 text-[11px] font-medium tracking-[0.14em] text-primary-foreground/85 uppercase backdrop-blur-sm"
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            Intelligent travel operating system
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 font-display text-[clamp(2.75rem,6.4vw,5rem)] leading-[0.98] font-medium tracking-[-0.03em] text-primary-foreground"
          >
            See how far your{" "}
            <span className="italic text-primary-foreground/90">budget</span> can take you.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 max-w-xl text-lg leading-[1.65] text-primary-foreground/80"
          >
            Tell us your budget, dates and travel style. We'll build the
            journeys worth taking.
          </motion.p>
        </div>

        {/* Conversational search panel ---------------------------------------- */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="relative self-end"
        >
          <div className="surface-editorial rounded-[2rem] p-6 shadow-float backdrop-blur-xl sm:p-8">
            <p className="font-display text-xl leading-snug tracking-[-0.01em] text-foreground">
              I'm travelling from{" "}
              <span className="text-muted-foreground/60">…</span>
            </p>

            <div className="mt-5 space-y-5">
              <div>
                <Label htmlFor="hero-start" className="sr-only">
                  Starting from
                </Label>
                <PlaceSearch
                  id="hero-start"
                  size="lg"
                  icon="plane"
                  value={preferences.startCity}
                  onChange={(value: string) => update("startCity", value)}
                  placeholder="City or airport"
                />
              </div>

              <div className="rule-soft pt-5">
                <p className="font-display text-base leading-snug text-foreground">
                  heading to{" "}
                  <span className="text-muted-foreground/60">
                    {preferences.endCity ? "" : "wherever's best"}
                  </span>
                </p>
                <PlaceSearch
                  className="mt-3"
                  id="hero-end"
                  size="lg"
                  icon="pin"
                  value={preferences.endCity}
                  onChange={(value: string) => update("endCity", value)}
                  placeholder="Leave blank — Astera will discover destinations"
                />
              </div>

              <div className="rule-soft pt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-base leading-snug text-foreground">
                    around these dates
                  </p>
                  <div className="flex gap-0.5 rounded-full bg-secondary p-0.5 text-xs">
                    {(["exact", "flexible"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={preferences.dateMode === mode}
                        onClick={() => update("dateMode", mode)}
                        className={cn(
                          "rounded-full px-3 py-1 font-medium capitalize transition-colors",
                          preferences.dateMode === mode
                            ? "bg-card text-foreground shadow-soft"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {preferences.dateMode === "exact" ? (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Input
                      type="date"
                      aria-label="Leaving"
                      value={preferences.startDate}
                      onChange={(event) => update("startDate", event.target.value)}
                      className="h-12 rounded-2xl"
                    />
                    <Input
                      type="date"
                      aria-label="Returning"
                      value={preferences.endDate}
                      onChange={(event) => update("endDate", event.target.value)}
                      className="h-12 rounded-2xl"
                    />
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Input
                      type="month"
                      aria-label="Month"
                      value={preferences.flexibleMonth}
                      onChange={(event) => update("flexibleMonth", event.target.value)}
                      className="h-12 rounded-2xl"
                    />
                    <Input
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

              <div className="rule-soft pt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-base leading-snug text-foreground">
                    with a budget of
                  </p>
                  <span className="font-display text-2xl font-medium tabular-nums tracking-[-0.01em]">
                    <AnimatedCounter
                      value={preferences.budget}
                      duration={0.4}
                      format={(value) => formatCurrency(value, preferences.currency)}
                    />
                  </span>
                </div>
                <Slider
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

            <Button
              size="xl"
              variant="hero"
              disabled={!canContinue}
              className="mt-8 w-full rounded-full text-base font-semibold shadow-lift"
              onClick={() => navigate({ to: "/plan" })}
            >
              Personalise my trip
              <ArrowRight aria-hidden />
            </Button>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Takes about a minute · {nights} nights</span>
              <Link
                to="/results"
                search={{ sample: true }}
                className="font-medium text-foreground/80 underline-offset-4 hover:underline"
              >
                Try a sample trip →
              </Link>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
              {discovery
                ? "Astera will compare destinations that fit your budget and preferences."
                : `We'll optimise flights, schedule and experiences around ${preferences.endCity.trim()}.`}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
