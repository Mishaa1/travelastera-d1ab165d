import { useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Check, Compass, Plane } from "lucide-react";
import { useRef } from "react";

import heroImage from "@/assets/hero-satellite.png";
import coastImage from "@/assets/dest-aegean.jpg";
import cityImage from "@/assets/dest-iberia.jpg";
import mountainImage from "@/assets/dest-alps.jpg";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { PlaceSearch } from "@/components/common/PlaceSearch";
import { TravelPaths } from "@/components/common/TravelPaths";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useTripDraft } from "@/hooks/useTripDraft";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const PACE: { id: string; label: string; hours: number; fewerHotels: boolean }[] = [
  { id: "relaxed", label: "Relaxed", hours: 8, fewerHotels: true },
  { id: "balanced", label: "Balanced", hours: 14, fewerHotels: false },
  { id: "adventure", label: "Adventure", hours: 26, fewerHotels: false },
];

export function Hero() {
  const navigate = useNavigate();
  const { preferences, update } = useTripDraft();
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "7%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.02, 1.075]);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[760px] overflow-hidden bg-[#020916] text-white lg:min-h-[820px]"
    >
      <motion.div
        style={reduceMotion ? undefined : { y: imageY, scale: imageScale }}
        className="absolute inset-0 origin-center"
      >
        <img
          src={heroImage}
          alt="Earth at night with Europe illuminated"
          width={1672}
          height={941}
          fetchPriority="high"
          className="h-[108%] w-full object-cover object-[57%_40%] brightness-[1.3] contrast-[1.12] saturate-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#020916] via-[#020916]/35 to-[#020916]/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020916]/45 via-transparent to-[#020916]/25" />
      </motion.div>
      <TravelPaths className="pointer-events-none absolute inset-0 h-full w-full opacity-35" />

      <div className="relative mx-auto grid min-h-[760px] max-w-7xl items-center gap-12 px-5 pt-28 pb-16 md:px-8 lg:min-h-[820px] lg:grid-cols-[1.05fr_.75fr] lg:gap-24 lg:pt-24">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl"
        >
          <h1 className="font-serif-display text-[clamp(3.7rem,7vw,6.2rem)] leading-[0.88] font-light tracking-[-0.035em]">
            See how far
            <br />
            your <em className="text-[#e9b45d]">budget</em> can
            <br />
            take you.
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-white/76">
            AI trip planning that balances your dreams with your budget.
          </p>

          <div className="mt-8 flex items-center gap-3 text-xs text-white/68">
            <div className="flex -space-x-2" aria-hidden>
              {["👩", "👨", "👩🏽", "👨🏾"].map((person, index) => (
                <span
                  key={index}
                  className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#081423] bg-white text-sm"
                >
                  {person}
                </span>
              ))}
            </div>
            <span>One calm answer for the whole group</span>
          </div>

          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
            {[
              ["Portugal", cityImage],
              ["The Aegean", coastImage],
              ["The Alps", mountainImage],
            ].map(([label, image], index) => (
              <motion.div
                key={label}
                whileHover={reduceMotion ? undefined : { y: -4 }}
                transition={{ duration: 0.3 }}
                className="group relative h-28 overflow-hidden rounded-2xl border border-white/15 shadow-2xl sm:h-32"
              >
                <img
                  src={image}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <span className="absolute bottom-3 left-3 text-sm font-semibold">{label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : 0.15 }}
          className="rounded-[1.8rem] border border-white/30 bg-white/[0.17] p-6 shadow-[0_35px_90px_rgba(0,0,0,.4),inset_0_1px_rgba(255,255,255,.22)] backdrop-blur-2xl sm:p-7"
        >
          <h2 className="font-display text-lg font-semibold">Where do you want to go?</h2>
          <p className="mt-1 text-xs text-white/65">
            Tell us your budget and travel style. We’ll handle the rest.
          </p>

          <div className="mt-6 rounded-2xl bg-white p-1 text-foreground shadow-soft">
            <PlaceSearch
              id="hero-destination"
              icon="plane"
              value={preferences.endCity}
              onChange={(value: string) => update("endCity", value)}
              placeholder="Lisbon, Portugal"
              className="border-0 bg-transparent shadow-none"
            />
          </div>

          <div className="mt-6">
            <p className="text-xs text-white/65">Total budget</p>
            <p className="mt-1 font-display text-3xl font-semibold">
              <AnimatedCounter
                value={preferences.budget}
                duration={0.35}
                format={(value) => formatCurrency(value, preferences.currency)}
              />
            </p>
            <Slider
              min={400}
              max={9000}
              step={100}
              value={[preferences.budget]}
              onValueChange={([value]) => update("budget", value)}
              className="mt-4"
              aria-label="Total trip budget"
            />
            <div className="mt-2 flex justify-between text-[10px] text-white/48">
              <span>€400</span>
              <span>€9,000+</span>
            </div>
          </div>

          <fieldset className="mt-5">
            <legend className="text-xs text-white/65">Travel style</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PACE.map((pace) => {
                const selected = preferences.maxTravelHours === pace.hours;
                return (
                  <button
                    key={pace.id}
                    type="button"
                    onClick={() => {
                      update("maxTravelHours", pace.hours);
                      update("fewerHotelChanges", pace.fewerHotels);
                    }}
                    className={cn(
                      "rounded-xl border px-2 py-3 text-xs capitalize transition-all",
                      selected
                        ? "border-white/70 bg-white/18 text-white shadow-soft"
                        : "border-white/12 bg-white/[0.06] text-white/62 hover:bg-white/12",
                    )}
                    aria-pressed={selected}
                  >
                    {pace.id === "relaxed" ? "☼" : pace.id === "balanced" ? "◉" : "♢"}
                    <span className="mt-1 block">{pace.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button
            size="lg"
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#0d789b] via-[#167f9c] to-[#d87851] text-white shadow-lift hover:-translate-y-0.5"
            onClick={() => navigate({ to: "/plan" })}
          >
            Discover possibilities
            <ArrowRight aria-hidden />
          </Button>
          <p className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/58">
            <Check className="h-3 w-3" aria-hidden /> Free to plan · No credit card
            <Compass className="h-3 w-3" aria-hidden />
          </p>
        </motion.div>
      </div>
    </section>
  );
}
