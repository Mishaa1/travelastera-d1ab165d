import { useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, BadgeCheck, ChartNoAxesCombined, Check, Compass, Database, Plane } from "lucide-react";
import { useRef } from "react";

import heroImage from "@/assets/hero-satellite.png";
import coastImage from "@/assets/dest-aegean.jpg";
import centralImage from "@/assets/dest-central.jpg";
import cityImage from "@/assets/dest-iberia.jpg";
import mountainImage from "@/assets/dest-alps.jpg";
import nordicImage from "@/assets/dest-nordic.jpg";
import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { PlaceSearch } from "@/components/common/PlaceSearch";
import { TravelPaths } from "@/components/common/TravelPaths";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useTripDraft } from "@/hooks/useTripDraft";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const STYLES = ["relaxed", "balanced", "adventure"] as const;

const HERO_DESTINATIONS = [
  { label: "Lisbon", value: "Lisbon, Portugal", image: cityImage },
  { label: "Santorini", value: "Santorini, Greece", image: coastImage },
  { label: "Interlaken", value: "Interlaken, Switzerland", image: mountainImage },
  { label: "Norway", value: "Bergen, Norway", image: nordicImage },
  { label: "Central Europe", value: "Prague, Czechia", image: centralImage },
] as const;

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
      className="relative min-h-[600px] overflow-hidden bg-[#020916] text-white lg:min-h-[630px]"
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

      <div className="relative mx-auto grid min-h-[600px] max-w-7xl items-center gap-8 px-5 pt-20 pb-8 md:px-8 lg:min-h-[630px] lg:grid-cols-[1.05fr_.75fr] lg:gap-16 lg:pt-16">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl"
        >
          <h1 className="font-serif-display text-[clamp(3.25rem,6vw,5.25rem)] leading-[0.9] font-light tracking-[-0.035em]">
            See how far
            <br />
            your <em className="text-[#e9b45d]">budget</em> can
            <br />
            take you.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/76">
            The travel intelligence OS that turns your budget into the right trip.
          </p>

          <div className="mt-4 max-w-[42rem] rounded-2xl border border-white/10 bg-[#03101f]/45 px-3.5 py-2.5 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-white/72">
              <div className="flex -space-x-2" aria-hidden>
                {["👩", "👨", "👩🏽", "👨🏾"].map((person, index) => (
                  <span key={index} className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#081423] bg-white text-xs">{person}</span>
                ))}
              </div>
              <span className="tracking-[.08em] text-[#e9b45d]" aria-label="Five gold stars">★★★★★</span>
              <span>Decision-first planning for the whole group</span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 divide-x divide-white/12 border-t border-white/10 pt-2.5">
              {[
                { icon: BadgeCheck, title: "Constraints", copy: "Protected" },
                { icon: ChartNoAxesCombined, title: "Fit score", copy: "Explained" },
                { icon: Database, title: "Provider data", copy: "Clearly sourced" },
              ].map(({ icon: Icon, title, copy }) => (
                <div key={title} className="flex min-w-0 items-center gap-2 px-2 first:pl-0 last:pr-0">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal/15 text-teal"><Icon className="h-3.5 w-3.5" aria-hidden /></span>
                  <span className="min-w-0"><strong className="block truncate text-[11px] text-white">{title}</strong><span className="block truncate text-[10px] text-white/52">{copy}</span></span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex max-w-[42rem] gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
            {HERO_DESTINATIONS.map((destination) => (
              <motion.button
                key={destination.value}
                type="button"
                onClick={() => update("endCity", destination.value)}
                whileHover={reduceMotion ? undefined : { y: -4 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "group relative h-20 min-w-32 overflow-hidden rounded-xl border text-left shadow-2xl sm:h-24 lg:min-w-0",
                  preferences.endCity === destination.value
                    ? "border-[#e9b45d] ring-2 ring-[#e9b45d]/35"
                    : "border-white/15",
                )}
                aria-label={`Plan a trip to ${destination.value}`}
                aria-pressed={preferences.endCity === destination.value}
              >
                <img
                  src={destination.image}
                  alt={`${destination.label} travel possibility`}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <span className="absolute right-2 bottom-2 left-2 truncate text-xs font-semibold sm:text-sm">{destination.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : 0.15 }}
          className="rounded-[1.65rem] border border-white/30 bg-white/[0.17] p-4.5 shadow-[0_35px_90px_rgba(0,0,0,.4),inset_0_1px_rgba(255,255,255,.22)] backdrop-blur-2xl sm:p-5"
        >
          <h2 className="font-display text-lg font-semibold">Where do you want to go?</h2>
          <p className="mt-1 text-xs text-white/65">
            Tell us your budget and travel style. We’ll handle the rest.
          </p>

          <div className="mt-4 rounded-2xl bg-white p-1 text-foreground shadow-soft">
            <PlaceSearch
              id="hero-destination"
              icon="plane"
              value={preferences.endCity}
              onChange={(value: string) => update("endCity", value)}
              placeholder="Lisbon, Portugal"
              className="border-0 bg-transparent shadow-none"
            />
          </div>

          <div className="mt-4">
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
              className="mt-3"
              aria-label="Total trip budget"
            />
            <div className="mt-2 flex justify-between text-[10px] text-white/48">
              <span>€400</span>
              <span>€9,000+</span>
            </div>
          </div>

          <fieldset className="mt-3">
            <legend className="text-xs text-white/65">Travel style</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {STYLES.map((style) => {
                const selected = preferences.travelStyle === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => update("travelStyle", style)}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-xs capitalize transition-all",
                      selected
                        ? "border-white/70 bg-white/18 text-white shadow-soft"
                        : "border-white/12 bg-white/[0.06] text-white/62 hover:bg-white/12",
                    )}
                    aria-pressed={selected}
                  >
                    {style === "relaxed" ? "☼" : style === "balanced" ? "◉" : "♢"}
                    <span className="mt-1 block">{style}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Button
            size="lg"
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#0d789b] via-[#167f9c] to-[#d87851] text-white shadow-lift hover:-translate-y-0.5"
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
