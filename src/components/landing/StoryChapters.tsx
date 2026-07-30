import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BedDouble,
  Check,
  CloudSun,
  Compass,
  Plane,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import lisbonImage from "@/assets/dest-iberia.jpg";
import { Reveal } from "@/components/common/Reveal";

const SHARED_PLANNING_IMAGE = "/images/landing/%20friends-planning-together.jpg";
const MOMENTUM_IMAGE = "/images/landing/travelling-train-station.jpg";

export function HumanCost() {
  const reduceMotion = useReducedMotion();
  const lines = [
    "The hardest part of travel",
    "is not booking.",
    "It is making the right decisions together.",
  ];

  return (
    <section className="relative overflow-hidden bg-[oklch(0.16_0.04_250)] py-24 text-primary-foreground md:py-36">
      <motion.div
        className="pointer-events-none absolute -top-40 -right-24 h-[34rem] w-[34rem] rounded-full bg-teal/10 blur-[110px]"
        animate={
          reduceMotion ? undefined : { x: [0, -34, 0], y: [0, 24, 0], opacity: [0.45, 0.7, 0.45] }
        }
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-5 md:px-8">
        <p className="max-w-5xl font-serif-display text-[clamp(2.7rem,6vw,5.4rem)] leading-[1.03] font-light tracking-[-0.025em]">
          {lines.map((line, index) => (
            <motion.span
              key={line}
              className={index === 2 ? "block text-primary-foreground/50" : "block"}
              initial={reduceMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: reduceMotion ? 0 : 0.7, delay: index * 0.13 }}
            >
              {line}
            </motion.span>
          ))}
        </p>

        <div className="mt-20 grid gap-5 md:grid-cols-3">
          {[
            "One person plans. Everyone else says, “I don’t mind.”",
            "Four travellers. Eight opinions. Zero decisions.",
            "Days of research. Still wondering whether you chose the right trip.",
          ].map((statement, index) => (
            <Reveal key={statement} delay={index * 0.1}>
              <p className="h-full rounded-3xl border border-white/10 bg-white/[0.055] p-6 font-display text-2xl leading-snug text-primary-foreground/85 shadow-soft backdrop-blur-md">
                {statement}
              </p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16 max-w-2xl">
          <p className="text-xl leading-relaxed text-primary-foreground/66">
            Nobody is doing it wrong. Planning simply asks one person to hold too many moving parts
            at once. You no longer have to carry the whole trip in your head.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function PlanningTogether() {
  const reduceMotion = useReducedMotion();
  const conversation = [
    ["👩", "I really want beaches.", "mr-auto"],
    ["👨", "I don’t want us to spend €2,500.", "ml-auto"],
    ["👧", "And I want amazing food.", "mr-auto ml-8"],
  ] as const;

  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="grid items-end gap-8 md:grid-cols-[1.15fr_.85fr]">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.18em] text-teal uppercase">
              Planning together
            </p>
            <h2 className="mt-5 font-serif-display text-[clamp(2.6rem,5.5vw,4.8rem)] leading-[1.02] font-light">
              Planning should not become one person’s responsibility.
            </h2>
          </Reveal>
          <Reveal
            delay={0.08}
            className="relative h-64 overflow-hidden rounded-[2rem] shadow-float md:h-80"
          >
            <motion.img
              src={SHARED_PLANNING_IMAGE}
              alt="Group of friends making travel plans together around a laptop"
              className="h-full w-full object-cover object-[68%_center]"
              loading="lazy"
              initial={reduceMotion ? false : { scale: 1.045 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: reduceMotion ? 0 : 1.4, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/20" />
          </Reveal>
        </div>

        <div className="relative mx-auto mt-14 max-w-4xl">
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal/10 blur-3xl"
            aria-hidden
          />
          <div className="relative space-y-4">
            {conversation.map(([avatar, message, alignment], index) => (
              <motion.div
                key={message}
                initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.985 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: reduceMotion ? 0 : 0.55,
                  delay: reduceMotion ? 0 : index * 0.32,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`flex max-w-xl items-end gap-3 ${alignment}`}
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card text-xl shadow-soft"
                  aria-hidden
                >
                  {avatar}
                </span>
                <p className="rounded-[1.5rem] rounded-bl-md border border-white/70 bg-card/82 px-6 py-4 font-serif-display text-2xl shadow-soft backdrop-blur-xl">
                  “{message}”
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.985 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{
            duration: reduceMotion ? 0 : 0.7,
            delay: reduceMotion ? 0 : 1.05,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="relative mx-auto mt-8 max-w-3xl rounded-4xl border border-primary/20 bg-primary/88 p-8 text-primary-foreground shadow-lift backdrop-blur-xl md:-mt-2 md:p-10"
        >
          <div
            className="pointer-events-none absolute -inset-5 -z-10 rounded-[3rem] bg-teal/12 blur-2xl"
            aria-hidden
          />
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-teal uppercase">
            <Sparkles className="h-4 w-4" aria-hidden /> ASTERA found the shared answer
          </p>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h3 className="font-serif-display text-4xl font-light">Lisbon</h3>
              <p className="mt-2 text-primary-foreground/70">
                Beaches nearby, brilliant food and comfortably under budget.
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {["Beaches", "Under budget", "Incredible food", "Walkable"].map((reason) => (
                <li key={reason} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-teal" aria-hidden /> {reason}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function IntelligenceMoment() {
  const reduceMotion = useReducedMotion();
  const reasons = [
    ["Budget", Wallet],
    ["Flights", Plane],
    ["Hotels", BedDouble],
    ["Weather", CloudSun],
    ["Interests", Users],
    ["Pace", Compass],
  ] as const;

  return (
    <section className="overflow-hidden bg-card py-20 md:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 md:px-8 lg:grid-cols-[1.1fr_.9fr]">
        <Reveal className="relative min-h-[34rem] overflow-hidden rounded-[2.5rem] shadow-lift">
          <img
            src={lisbonImage}
            alt="Lisbon waterfront and terracotta rooftops"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-8 text-white md:p-12">
            <p className="text-xs font-semibold tracking-[0.17em] text-white/65 uppercase">
              The recommendation
            </p>
            <h3 className="mt-3 font-serif-display text-5xl font-light">Lisbon, Portugal</h3>
            <p className="mt-4 max-w-lg text-white/72">
              A city break that feels generous without asking the group to compromise on what
              matters.
            </p>
          </div>
        </Reveal>

        <div>
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.18em] text-teal uppercase">
              Show the intelligence
            </p>
            <h2 className="mt-5 font-serif-display text-[clamp(2.6rem,5vw,4.5rem)] leading-[1.02] font-light">
              ASTERA is weighing the possibilities.
            </h2>
            <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
              Looking at the whole journey, not one search result at a time.
            </p>
          </Reveal>

          <ul className="mt-10 space-y-1">
            {reasons.map(([reason, Icon], index) => (
              <motion.li
                key={reason}
                initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: reduceMotion ? 0 : 0.42,
                  delay: reduceMotion ? 0 : 0.16 + index * 0.16,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex items-center gap-4 border-b border-border/60 py-4 text-sm"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-teal/10 text-teal">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="flex-1">{reason}</span>
                <Check className="h-4 w-4 text-emerald" aria-hidden />
              </motion.li>
            ))}
          </ul>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: reduceMotion ? 0 : 0.7,
              delay: reduceMotion ? 0 : 1.2,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative mt-8 overflow-hidden rounded-3xl border border-teal/20 bg-teal/8 p-6 shadow-soft"
          >
            <div
              className="pointer-events-none absolute -top-16 right-0 h-36 w-36 rounded-full bg-teal/20 blur-3xl"
              aria-hidden
            />
            <p className="relative text-xs font-semibold tracking-[0.16em] text-teal uppercase">
              Recommendation ready
            </p>
            <p className="relative mt-2 font-serif-display text-4xl font-light">This one won.</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function BookingJourney() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-[oklch(0.19_0.04_250)] py-24 text-primary-foreground md:py-32">
      <motion.img
        src={MOMENTUM_IMAGE}
        alt="Travellers moving toward a waiting train at golden hour"
        className="absolute inset-0 h-full w-full object-cover object-center opacity-55"
        loading="lazy"
        initial={reduceMotion ? false : { scale: 1.055 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: reduceMotion ? 0 : 1.8, ease: [0.22, 1, 0.36, 1] }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.16_0.04_250/0.97)] via-[oklch(0.17_0.04_250/0.88)] to-[oklch(0.17_0.04_250/0.48)]" />
      <div className="relative mx-auto max-w-6xl px-5 md:px-8">
        <Reveal className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-teal uppercase">
            From decision to booking
          </p>
          <h2 className="mt-5 font-serif-display text-[clamp(2.6rem,5.5vw,4.8rem)] leading-[1.02] font-light">
            One decision. Then momentum.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-primary-foreground/65">
            See the full trip cost, compare the strongest options and continue to real booking sites
            with confidence. ASTERA does not process payment.
          </p>
        </Reveal>

        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            ["01", "Choose the route", "Understand why this trip fits before committing."],
            [
              "02",
              "Confirm flights and hotels",
              "See best-value options and the complete cost in one place.",
            ],
            [
              "03",
              "Book with confidence",
              "Continue to available provider or hotel links without another round of research.",
            ],
          ].map(([number, title, copy], index) => (
            <Reveal
              as="li"
              key={title}
              delay={index * 0.1}
              className="relative rounded-3xl border border-white/15 bg-[oklch(0.28_0.04_230/0.46)] p-6 shadow-soft backdrop-blur-xl"
            >
              <span className="font-serif-display text-6xl text-primary-foreground/16">
                {number}
              </span>
              <h3 className="mt-5 font-display text-2xl font-medium">{title}</h3>
              <p className="mt-3 leading-relaxed text-primary-foreground/60">{copy}</p>
              {index < 2 && (
                <ArrowRight
                  className="absolute top-5 -right-6 hidden text-teal/45 md:block"
                  aria-hidden
                />
              )}
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
