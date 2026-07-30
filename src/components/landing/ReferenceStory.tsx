import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, HeartHandshake, Lightbulb, Sparkles, Users } from "lucide-react";

import lisbonImage from "@/assets/dest-iberia.jpg";
import villageImage from "@/assets/dest-central.jpg";
import { Reveal } from "@/components/common/Reveal";
import { Button } from "@/components/ui/button";

const LAPTOP_IMAGE =
  "/images/landing/ai-generated-couple-looking-at-their-laptop-on-table-near-a-patio-outdoors-free-photo.png";
const FRIENDS_IMAGE = "/images/landing/%20friends-planning-together.png";
const JOURNEY_IMAGE = "/images/landing/man-hiking-mountain.png";
const SUNSET_FRIENDS = "/images/landing/friends-sunset-beach-mountain.png";
const BEACH_COUPLE = "/images/landing/couple-beach-sunset-golden.png";
const CONTEMPLATIVE_IMAGE = "/images/landing/woman-sunset-beach-mountain.png";

export function ReferenceStory() {
  return (
    <>
      <SecondJob />
      <HardestPart />
      <ContemplativeInterlude />
      <PlanningConversation />
      <IntelligenceBand />
      <MomentumBand />
      <ClosingCta />
    </>
  );
}

function ContemplativeInterlude() {
  return (
    <section className="relative min-h-[420px] overflow-hidden bg-[#07131c] text-white md:min-h-[520px]">
      <motion.img
        src={CONTEMPLATIVE_IMAGE}
        alt="Traveller watching the sunset from a dramatic coastal cliff"
        className="absolute inset-0 h-full w-full object-cover object-[58%_center]"
        initial={{ scale: 1.045 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07131c]/82 via-[#07131c]/32 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#07131c]/36 via-transparent to-[#07131c]/16" />

      <div className="relative mx-auto flex min-h-[420px] max-w-7xl items-center px-6 py-16 md:min-h-[520px] md:px-8">
        <Reveal className="max-w-md md:ml-16">
          <h2 className="font-serif-display text-[clamp(2.6rem,5vw,4.7rem)] leading-[0.96] font-light">
            Somewhere between
            <br />
            your budget and your
            <br />
            bucket list is the trip
            <br />
            <em className="text-[#e4ae56]">worth taking.</em>
          </h2>
        </Reveal>

        <div
          className="absolute right-5 top-1/2 flex -translate-y-1/2 flex-col gap-2 md:right-9"
          aria-hidden
        >
          {[true, false, false, false].map((active, index) => (
            <span
              key={index}
              className={
                active
                  ? "h-2.5 w-2.5 rounded-full bg-teal shadow-[0_0_12px_rgba(45,196,211,.75)]"
                  : "h-2 w-2 rounded-full border border-white/65"
              }
            />
          ))}
        </div>

        <p className="absolute bottom-7 left-6 flex items-center gap-2 text-[10px] text-white/65 md:left-24">
          <span
            className="grid h-4 w-4 place-items-center rounded-full border border-white/55"
            aria-hidden
          >
            ↓
          </span>
          Scroll to explore
        </p>
      </div>
    </section>
  );
}

function SecondJob() {
  return (
    <section className="bg-[#f5f0e7] text-[#071627]" id="how-it-works">
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[.95fr_.9fr_1.05fr]">
        <Reveal className="flex min-h-[430px] flex-col justify-center px-7 py-16 sm:px-12 lg:px-16">
          <Eyebrow>Planning shouldn’t be hard</Eyebrow>
          <h2 className="mt-5 max-w-md font-serif-display text-[clamp(2.6rem,4.5vw,4.4rem)] leading-[.98] font-light">
            Your holiday should not begin with a second job.
          </h2>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-[#334052]">
            We pull flights, stays, activities and local insights together so you can focus on what
            really matters.
          </p>
        </Reveal>

        <Reveal className="relative min-h-[360px] overflow-hidden lg:min-h-[430px]">
          <motion.img
            src={LAPTOP_IMAGE}
            alt="Couple planning a journey together over a laptop"
            className="absolute inset-0 h-full w-full object-cover object-[48%_54%]"
            initial={{ scale: 1.04 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4 }}
          />
        </Reveal>

        <Reveal
          delay={0.08}
          className="flex min-h-[430px] items-center justify-center gap-5 bg-white/45 px-6 py-12"
        >
          <PlanGlance />
          <TripPreview />
        </Reveal>
      </div>
    </section>
  );
}

function PlanGlance() {
  const rows = [
    ["Flights", "€712"],
    ["Stays", "€980"],
    ["Activities", "€420"],
    ["Transport", "€128"],
  ];
  return (
    <div className="w-[48%] max-w-[190px] rotate-[-1deg] rounded-[1.4rem] bg-white p-5 shadow-[0_20px_50px_rgba(8,22,39,.12)]">
      <p className="text-xs font-semibold">Your plan at a glance</p>
      <div className="mt-5 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-[10px]">
            <span className="text-[#526070]">{label}</span>
            <span className="font-semibold">{value}</span>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-5 grid h-20 w-20 place-items-center rounded-full border-[9px] border-[#176f89] border-r-[#e6b15d]">
        <span className="text-sm font-semibold">€2,400</span>
      </div>
    </div>
  );
}

function TripPreview() {
  return (
    <div className="w-[48%] max-w-[190px] translate-y-3 rotate-[1deg] rounded-[1.4rem] bg-[#092334] p-5 text-white shadow-[0_24px_55px_rgba(4,16,26,.28)]">
      <p className="text-[10px] text-white/60">Your trip to</p>
      <p className="font-serif-display text-lg">Lisbon, Portugal</p>
      <p className="mt-1 text-[9px] text-white/55">8 days · 2 travellers</p>
      <img src={lisbonImage} alt="" className="mt-4 h-28 w-full rounded-xl object-cover" />
      <div className="mt-4 flex justify-between text-[10px]">
        <span>Budget overview</span>
        <span className="font-semibold">€160 left</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/12">
        <div className="h-full w-[86%] rounded-full bg-gradient-to-r from-teal to-sunset" />
      </div>
      <div className="mt-4 rounded-full bg-[#116f8c] py-2 text-center text-[10px] font-semibold">
        View full itinerary
      </div>
    </div>
  );
}

function HardestPart() {
  const benefits = [
    [Users, "One plan, everyone involved.", "Collaborate and keep everyone happy."],
    [Lightbulb, "Smart trade-offs, made visible.", "See the impact of every choice."],
    [HeartHandshake, "More time for what matters.", "No more tabs, just anticipation."],
  ] as const;
  return (
    <section className="relative overflow-hidden bg-[#031321] py-16 text-white md:py-20">
      <div className="absolute -top-40 left-1/3 h-80 w-80 rounded-full bg-teal/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-[1.25fr_2fr] md:px-8">
        <Reveal className="md:border-r md:border-white/15 md:pr-14">
          <p className="text-[10px] font-semibold tracking-[.18em] text-white/55 uppercase">
            The hardest part
          </p>
          <h2 className="mt-5 font-serif-display text-[clamp(2.5rem,4vw,4rem)] leading-[1.02] font-light">
            The hardest part of travel is not booking.
          </h2>
          <p className="mt-3 font-serif-display text-2xl text-white/45">
            It is making the right decisions together.
          </p>
        </Reveal>
        <div className="grid gap-8 sm:grid-cols-3">
          {benefits.map(([Icon, title, copy], index) => (
            <Reveal key={title} delay={index * 0.09}>
              <Icon className="h-7 w-7 text-white/80" strokeWidth={1.3} aria-hidden />
              <h3 className="mt-6 font-serif-display text-xl">{title}</h3>
              <p className="mt-3 text-xs leading-relaxed text-white/55">{copy}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanningConversation() {
  const messages = [
    ["👩", "I want beaches and good food 🌊"],
    ["👨", "I’d love nature and quiet places 🌲"],
    ["👩🏽", "Let’s keep it under €2,500 ✨"],
  ];
  return (
    <section className="bg-[#f5f0e7] text-[#071627]">
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[.9fr_.9fr_1.1fr]">
        <Reveal className="flex min-h-[390px] flex-col justify-center px-7 py-14 sm:px-12 lg:px-16">
          <Eyebrow>Planning together</Eyebrow>
          <h2 className="mt-5 font-serif-display text-[clamp(2.6rem,4.4vw,4.25rem)] leading-[.98] font-light">
            Planning should not become one person’s responsibility.
          </h2>
        </Reveal>
        <Reveal className="relative min-h-[360px] overflow-hidden lg:min-h-[390px]">
          <img
            src={FRIENDS_IMAGE}
            alt="Friends planning together around a laptop"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </Reveal>
        <div className="flex min-h-[390px] flex-col justify-center gap-4 px-7 py-12 sm:px-12">
          {messages.map(([avatar, text], index) => (
            <Reveal
              key={text}
              delay={index * 0.12}
              className={
                index === 1
                  ? "ml-auto flex max-w-sm items-center gap-3"
                  : "flex max-w-sm items-center gap-3"
              }
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white shadow-soft">
                {avatar}
              </span>
              <p className="rounded-2xl bg-white px-5 py-3 text-sm shadow-soft">{text}</p>
            </Reveal>
          ))}
          <Reveal
            delay={0.42}
            className="mt-2 rounded-2xl bg-[#0d6c88] px-6 py-4 text-sm font-semibold text-white shadow-lift"
          >
            Got it. I’ll find the perfect balance. <span className="float-right">A ✦</span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function IntelligenceBand() {
  const checks = ["Budget", "Flights", "Stays", "Weather", "Interests", "Pace", "Hidden gems"];
  return (
    <section className="relative overflow-hidden bg-[#06131d] text-white">
      <img
        src={villageImage}
        alt=""
        className="absolute inset-y-0 left-0 h-full w-[42%] object-cover opacity-65"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#06131d]/85 to-[#06131d]" />
      <div className="relative mx-auto grid min-h-[350px] max-w-7xl items-center gap-10 px-6 py-12 md:grid-cols-[1fr_.75fr_.8fr] md:px-8">
        <Reveal className="md:pl-[34%] lg:pl-[26%]">
          <Eyebrow light>AI weighs everything</Eyebrow>
          <h2 className="mt-5 font-serif-display text-4xl font-light lg:text-5xl">
            We weigh the possibilities.
          </h2>
          <p className="mt-4 text-xs text-white/55">
            Thousands of data points. One recommendation.
          </p>
        </Reveal>
        <ul className="space-y-2">
          {checks.map((item, index) => (
            <Reveal
              as="li"
              key={item}
              delay={index * 0.06}
              className="flex items-center gap-3 text-xs"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_12px_4px_rgba(255,255,255,.55)]" />
              <span className="flex-1">{item}</span>
              <Check className="h-4 w-4 text-white/80" aria-hidden />
            </Reveal>
          ))}
        </ul>
        <Reveal
          delay={0.35}
          className="overflow-hidden rounded-2xl border border-white/20 bg-white/[0.08] p-5 backdrop-blur-xl"
        >
          <p className="text-sm">This one won.</p>
          <p className="mt-3 font-serif-display text-2xl">Lisbon, Portugal</p>
          <p className="text-[10px] text-white/55">8 days · 2 travellers</p>
          <div className="mt-4 grid grid-cols-[1fr_95px] gap-3">
            <ul className="space-y-2 text-[10px] text-white/72">
              {["Beautiful beaches", "Great food", "Within budget", "Relaxed pace"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-teal" /> {item}
                </li>
              ))}
            </ul>
            <img src={lisbonImage} alt="" className="h-24 w-full rounded-xl object-cover" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function MomentumBand() {
  const steps = [
    ["01", "Choose the route", "We find the best route within your budget."],
    ["02", "Confirm flights and hotels", "We hold the best options for you."],
    ["03", "Book with confidence", "Everything in one place, fully transparent."],
  ];
  return (
    <section className="relative overflow-hidden bg-[#06131d] text-white">
      <img
        src={JOURNEY_IMAGE}
        alt=""
        className="absolute inset-0 h-full w-[48%] object-cover object-[52%_58%] opacity-60"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-[#06131d]/90 to-[#06131d]" />
      <img
        src={SUNSET_FRIENDS}
        alt=""
        className="absolute inset-y-0 right-0 hidden h-full w-[23%] object-cover object-[63%_center] opacity-80 lg:block"
      />
      <div className="relative mx-auto grid min-h-[320px] max-w-7xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.05fr_1.7fr_.55fr] lg:px-8">
        <Reveal>
          <h2 className="font-serif-display text-[clamp(2.8rem,5vw,4.8rem)] leading-[.95] font-light">
            One decision.
            <br />
            Then momentum.
          </h2>
          <p className="mt-5 max-w-sm text-xs leading-relaxed text-white/65">
            We lock in the best options and keep everything organised, so your trip comes together
            seamlessly.
          </p>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map(([number, title, copy], index) => (
            <Reveal
              key={title}
              delay={index * 0.08}
              className="min-h-48 rounded-2xl border border-white/18 bg-[#0a1c2a]/72 p-5 backdrop-blur-xl"
            >
              <span className="font-serif-display text-3xl text-white/35">{number}</span>
              <h3 className="mt-7 font-serif-display text-lg">{title}</h3>
              <p className="mt-3 text-[10px] leading-relaxed text-white/55">{copy}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section
      className="relative min-h-[340px] overflow-hidden bg-[#f5f0e7] text-[#071627]"
      id="about"
    >
      <img
        src={BEACH_COUPLE}
        alt="Couple watching the sunset on a beach"
        className="absolute inset-y-0 right-0 h-full w-full object-cover object-[62%_58%] md:w-[68%]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#f5f0e7] via-[#f5f0e7]/92 to-transparent" />
      <Reveal className="relative mx-auto max-w-7xl px-6 py-16 md:px-8">
        <Eyebrow>Ready when you are</Eyebrow>
        <h2 className="mt-5 max-w-xl font-serif-display text-[clamp(2.8rem,5vw,4.8rem)] leading-[.98] font-light">
          Less planning. More looking forward to it.
        </h2>
        <p className="mt-5 text-sm text-[#405064]">You dream it. We’ll take care of the rest.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild className="rounded-full bg-[#0d6c88] px-7 text-white">
            <Link to="/plan">Plan my trip</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-[#071627]/30 bg-white/30 px-7"
          >
            <a href="#how-it-works">
              See how it works <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className={`text-[10px] font-semibold tracking-[.18em] uppercase ${
        light ? "text-[#d7bd79]" : "text-[#0d7894]"
      }`}
    >
      {children}
    </p>
  );
}
