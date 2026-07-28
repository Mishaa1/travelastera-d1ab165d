import { Link, useNavigate } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import { useMemo, useRef } from "react";

import heroImage from "@/assets/hero-coast.jpg";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { RouteSketch } from "@/components/map/RouteSketch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CITIES } from "@/data/cities";
import { useTripDraft } from "@/hooks/useTripDraft";
import { formatCurrency, nightsBetween } from "@/lib/format";

export function Hero() {
  const navigate = useNavigate();
  const { preferences, update } = useTripDraft();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);

  const nights = nightsBetween(preferences.startDate, preferences.endDate);

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
        <motion.span
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2 rounded-full surface-glass px-4 py-1.5 text-xs font-semibold tracking-wide text-foreground uppercase"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          AI travel optimiser · not another itinerary planner
        </motion.span>

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

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="mt-9 flex flex-col gap-3 sm:flex-row"
        >
          <Button asChild variant="hero" size="xl">
            <Link to="/plan">
              Find trips within my budget
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="glass" size="xl">
            <Link to="/results" search={{ sample: true }}>
              Try a sample trip
            </Link>
          </Button>
        </motion.div>

        {/* Interactive search widget — the background route reacts as you move it. */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
          className="mt-14 rounded-4xl surface-glass p-5 shadow-float sm:p-7"
        >
          <div className="grid gap-5 md:grid-cols-[1.1fr_1fr_1fr_auto] md:items-end">
            <div className="min-w-0">
              <Label htmlFor="hero-start" className="text-xs font-semibold tracking-wide uppercase">
                Starting from
              </Label>
              <div className="relative mt-2">
                <MapPin
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="hero-start"
                  value={preferences.startCity}
                  onChange={(event) => update("startCity", event.target.value)}
                  className="h-12 rounded-2xl pl-9"
                  placeholder="London"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:col-span-1">
              <div>
                <Label htmlFor="hero-from" className="text-xs font-semibold tracking-wide uppercase">
                  From
                </Label>
                <Input
                  id="hero-from"
                  type="date"
                  value={preferences.startDate}
                  onChange={(event) => update("startDate", event.target.value)}
                  className="mt-2 h-12 rounded-2xl"
                />
              </div>
              <div>
                <Label htmlFor="hero-to" className="text-xs font-semibold tracking-wide uppercase">
                  To
                </Label>
                <Input
                  id="hero-to"
                  type="date"
                  value={preferences.endDate}
                  onChange={(event) => update("endDate", event.target.value)}
                  className="mt-2 h-12 rounded-2xl"
                />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="hero-budget" className="text-xs font-semibold tracking-wide uppercase">
                  Total budget
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
                className="mt-4"
                min={400}
                max={9000}
                step={100}
                value={[preferences.budget]}
                onValueChange={([value]) => update("budget", value)}
                aria-label="Total budget"
              />
            </div>

            <Button
              size="lg"
              variant="hero"
              className="w-full md:w-auto"
              onClick={() => navigate({ to: "/results" })}
            >
              Optimise
              <ArrowRight aria-hidden />
            </Button>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            {nights} nights · route preview across{" "}
            <span className="font-semibold text-foreground">{previewStops.length} candidate stops</span>{" "}
            · all figures are estimates until you connect live providers.
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}
