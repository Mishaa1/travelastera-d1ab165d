import { motion, useReducedMotion } from "motion/react";
import {
  BedDouble,
  CalendarDays,
  Check,
  CloudSun,
  Map,
  MapPin,
  MessageCircle,
  Plane,
  Search,
  Sparkles,
  Table2,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

import lisbonImage from "@/assets/dest-iberia.jpg";
import { Reveal } from "@/components/common/Reveal";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const PLANNING_IMAGE =
  "/images/landing/ai-generated-couple-looking-at-their-laptop-on-table-near-a-patio-outdoors-free-photo.jpg";
const PLANNING_IMAGE_MOBILE =
  "/images/landing/couple-looking-at-their-laptop-on-table-near-a-patio-outdoors-free-photo%20(1).jpg";

const TRADITIONAL_PANELS = [
  {
    id: "flights",
    title: "Flights",
    domain: "farefinder.com",
    Icon: Plane,
    className:
      "-left-[5%] top-3 w-[78%] -rotate-2 lg:-left-[4%] lg:top-[7%] lg:w-[72%] lg:-rotate-4",
    content: (
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-secondary px-2.5 py-2">
          <span className="font-medium">London → Lisbon</span>
          <span className="font-semibold">€186</span>
        </div>
        <div className="flex items-center justify-between px-2.5 text-muted-foreground">
          <span>07:10 · 2h 45m</span>
          <span>1 stop</span>
        </div>
      </div>
    ),
  },
  {
    id: "hotels",
    title: "Hotels",
    domain: "stays.com",
    Icon: BedDouble,
    className:
      "-right-[7%] top-[18%] w-[69%] rotate-2 lg:-right-[6%] lg:top-[14%] lg:w-[65%] lg:rotate-3",
    content: (
      <div className="grid grid-cols-[3.25rem_1fr] gap-2.5">
        <div className="rounded-lg bg-sand" />
        <div>
          <p className="font-medium">Central boutique stay</p>
          <p className="mt-1 text-muted-foreground">8.7 · “Excellent”</p>
          <p className="mt-2 font-semibold">€142 / night</p>
        </div>
      </div>
    ),
  },
  {
    id: "weather",
    title: "Weather",
    domain: "forecast.app",
    Icon: CloudSun,
    className:
      "-left-[2%] top-[39%] w-[59%] rotate-2 lg:-left-[1%] lg:top-[36%] lg:w-[55%] lg:rotate-3",
    content: (
      <div className="flex items-end justify-between">
        <div>
          <p className="font-display text-2xl font-semibold">22°C</p>
          <p className="text-muted-foreground">But rain on Thursday</p>
        </div>
        <CloudSun className="h-8 w-8 text-sunset" strokeWidth={1.5} aria-hidden />
      </div>
    ),
  },
  {
    id: "research",
    title: "Travel research",
    domain: "reddit.com · tiktok",
    Icon: MessageCircle,
    className:
      "-right-[5%] top-[45%] w-[68%] -rotate-2 lg:-right-[7%] lg:top-[43%] lg:w-[66%] lg:-rotate-4",
    content: (
      <div className="space-y-2">
        <p className="rounded-lg bg-secondary px-2.5 py-2">
          “Is Lisbon still worth it in October?” <span className="text-destructive">r/travel</span>
        </p>
        <div className="flex gap-2 text-muted-foreground">
          <span>♡ 4.2k</span>
          <span>327 replies</span>
          <span>Save</span>
        </div>
      </div>
    ),
  },
  {
    id: "map",
    title: "Maps",
    domain: "maps.example",
    Icon: Map,
    className:
      "-left-[7%] bottom-[4%] w-[63%] -rotate-2 lg:-left-[5%] lg:bottom-[3%] lg:w-[61%] lg:-rotate-4",
    content: <TraditionalMap />,
  },
  {
    id: "sheet",
    title: "trip_budget_final_v4",
    domain: "spreadsheet",
    Icon: Table2,
    className:
      "-right-[8%] bottom-0 w-[72%] rotate-2 lg:-right-[6%] lg:-bottom-[1%] lg:w-[69%] lg:rotate-3",
    content: (
      <div className="overflow-hidden rounded-lg border border-border">
        {[
          ["Flights", "€372", "?"],
          ["Hotel", "€994", "8.7"],
          ["Food", "€420", "—"],
        ].map(([label, cost, note]) => (
          <div
            key={label}
            className="grid grid-cols-[1fr_.7fr_.4fr] border-b border-border px-2 py-1.5 last:border-0"
          >
            <span>{label}</span>
            <span>{cost}</span>
            <span className="text-destructive">{note}</span>
          </div>
        ))}
      </div>
    ),
  },
] as const;

export function ComparisonSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-labelledby="comparison-heading" className="overflow-hidden py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid items-end gap-9 lg:grid-cols-[.9fr_1.1fr]">
          <Reveal>
            <p className="text-xs font-semibold tracking-widest text-sunset uppercase">
              The reality of planning
            </p>
            <h2
              id="comparison-heading"
              className="mt-4 text-[clamp(2rem,4.5vw,3.6rem)] leading-[1.03] font-semibold"
            >
              Your holiday should not begin with a second job.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Flights, hotels, maps, messages, recommendations and prices that change while everyone
              is still deciding. ASTERA turns the noise into one shared answer.
            </p>
          </Reveal>
          <Reveal
            delay={0.08}
            className="relative h-72 overflow-hidden rounded-[2rem] shadow-float md:h-80"
          >
            <picture>
              <source media="(max-width: 640px)" srcSet={PLANNING_IMAGE_MOBILE} />
              <motion.img
                src={PLANNING_IMAGE}
                alt="Couple planning a journey together over a laptop"
                className="absolute inset-0 h-full w-full object-cover object-[58%_45%]"
                loading="lazy"
                initial={reduceMotion ? false : { scale: 1.04 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: reduceMotion ? 0 : 1.4, ease: EASE }}
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-t from-ink/20 to-transparent ring-1 ring-inset ring-white/20" />
          </Reveal>
        </div>

        <div className="relative mt-10 grid items-stretch gap-6 lg:grid-cols-2">
          <Reveal
            as="article"
            className="group overflow-hidden rounded-4xl border border-border bg-card/65 shadow-soft"
          >
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5 md:px-8">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-destructive uppercase">
                  Fragmented
                </p>
                <h3 className="mt-1 font-display text-xl font-semibold">Planning the usual way</h3>
              </div>
              <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-300 group-hover:bg-accent group-hover:text-accent-foreground">
                12 tabs open
              </span>
            </div>

            <div className="relative min-h-[31rem] overflow-hidden bg-secondary/60 p-5 sm:min-h-[35rem] md:p-7">
              <div
                className="absolute inset-0 opacity-45"
                aria-hidden
                style={{
                  backgroundImage:
                    "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
              {TRADITIONAL_PANELS.map((panel, index) => (
                <motion.div
                  key={panel.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.45,
                    delay: reduceMotion ? 0 : 0.08 + index * 0.07,
                    ease: EASE,
                  }}
                  whileHover={reduceMotion ? undefined : { y: -5, rotate: 0, zIndex: 20 }}
                  className={cn(
                    "absolute rounded-2xl border border-border bg-card shadow-lift",
                    panel.className,
                  )}
                >
                  <BrowserPanel
                    title={panel.title}
                    domain={panel.domain}
                    icon={<panel.Icon className="h-3.5 w-3.5" aria-hidden />}
                  >
                    {panel.content}
                  </BrowserPanel>
                </motion.div>
              ))}
              <div className="absolute inset-x-5 bottom-5 z-30 rounded-2xl bg-accent px-4 py-3 text-center text-sm font-medium text-accent-foreground shadow-float md:inset-x-7">
                You still have to decide which option actually fits.
              </div>
            </div>
          </Reveal>

          <DecisionFlow reduceMotion={Boolean(reduceMotion)} />

          <Reveal
            as="article"
            delay={0.1}
            className="group overflow-hidden rounded-4xl border border-primary/20 bg-card shadow-float"
          >
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5 md:px-8">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-teal uppercase">
                  Unified
                </p>
                <h3 className="mt-1 font-display text-xl font-semibold">Planning with ASTERA</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/12 px-3 py-1.5 text-xs font-semibold text-teal transition-colors duration-300 group-hover:bg-accent group-hover:text-accent-foreground">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                One answer
              </span>
            </div>

            <div className="min-h-[31rem] border-t border-white/10 bg-[oklch(0.25_0.045_230/0.92)] p-5 shadow-[inset_0_1px_0_oklch(1_0_0/0.08)] backdrop-blur-xl sm:min-h-[35rem] sm:p-7 md:p-8">
              <AsteraInputs reduceMotion={Boolean(reduceMotion)} />
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: reduceMotion ? 0 : 0.6,
                  delay: reduceMotion ? 0 : 0.28,
                  ease: EASE,
                }}
                className="mt-5"
              >
                <RecommendationCard />
              </motion.div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function BrowserPanel({
  title,
  domain,
  icon,
  children,
}: {
  title: string;
  domain: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 rounded-full bg-destructive/65" />
          <span className="h-1.5 w-1.5 rounded-full bg-sunset/70" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald/65" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[9px] text-muted-foreground sm:text-[10px]">
          {icon}
          <span className="truncate">{domain}</span>
        </div>
      </div>
      <div className="p-3 text-[10px] leading-snug sm:text-[11px]">
        <p className="mb-2 text-[9px] font-semibold tracking-[0.13em] text-muted-foreground uppercase">
          {title}
        </p>
        {children}
      </div>
    </>
  );
}

function DecisionFlow({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div
      className="pointer-events-none absolute top-[48%] left-1/2 z-40 hidden h-16 w-20 -translate-x-1/2 -translate-y-1/2 lg:block"
      aria-hidden
    >
      <svg viewBox="0 0 80 64" className="h-full w-full overflow-visible">
        <motion.path
          d="M4 32 C24 32 25 12 42 12 C58 12 56 32 76 32"
          fill="none"
          stroke="var(--color-teal)"
          strokeLinecap="round"
          strokeWidth="2"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 0.9 }}
          viewport={{ once: true }}
          transition={{
            duration: reduceMotion ? 0 : 1.1,
            delay: reduceMotion ? 0 : 0.5,
            ease: EASE,
          }}
          style={{ filter: "drop-shadow(0 0 7px var(--color-teal))" }}
        />
        <motion.circle
          cx="76"
          cy="32"
          r="4"
          fill="var(--color-card)"
          stroke="var(--color-teal)"
          strokeWidth="2"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{
            duration: reduceMotion ? 0 : 0.35,
            delay: reduceMotion ? 0 : 1.35,
            ease: EASE,
          }}
        />
      </svg>
    </div>
  );
}

function TraditionalMap() {
  return (
    <div
      className="relative h-20 overflow-hidden rounded-lg bg-[oklch(0.91_0.025_190)]"
      aria-label="Map with several disconnected saved places"
      role="img"
    >
      <svg viewBox="0 0 220 80" className="absolute inset-0 h-full w-full" aria-hidden>
        <path
          d="M-10 61 C30 34 53 71 91 42 S149 18 230 34"
          fill="none"
          stroke="var(--color-card)"
          strokeWidth="9"
        />
        <path
          d="M-10 61 C30 34 53 71 91 42 S149 18 230 34"
          fill="none"
          stroke="var(--color-primary)"
          strokeDasharray="3 5"
          strokeWidth="1.5"
        />
      </svg>
      {[
        ["18%", "48%"],
        ["50%", "35%"],
        ["76%", "22%"],
      ].map(([left, top]) => (
        <MapPin
          key={`${left}-${top}`}
          className="absolute h-4 w-4 text-destructive"
          style={{ left, top }}
          fill="currentColor"
          aria-hidden
        />
      ))}
    </div>
  );
}

function AsteraInputs({ reduceMotion }: { reduceMotion: boolean }) {
  const inputs = [
    { label: "Origin", value: "London", Icon: MapPin },
    { label: "Dates", value: "12–19 Oct", Icon: CalendarDays },
    { label: "Budget", value: "€2,400", Icon: Wallet },
  ] as const;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: reduceMotion ? 0 : 0.5, ease: EASE }}
      className="rounded-2xl border border-white/12 bg-white/8 p-3 shadow-soft backdrop-blur"
      aria-label="Example ASTERA trip constraints"
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        {inputs.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/8 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wider text-white/55 uppercase">
              <Icon className="h-3 w-3" aria-hidden />
              {label}
            </p>
            <p className="mt-1 text-xs font-semibold text-white">{value}</p>
          </div>
        ))}
        <button
          type="button"
          aria-label="Find my best trip"
          className="grid min-h-11 place-items-center rounded-xl bg-teal px-4 text-teal-foreground shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground"
        >
          <Search className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </motion.div>
  );
}

function RecommendationCard() {
  return (
    <div className="overflow-hidden rounded-3xl bg-card shadow-lift">
      <div className="relative h-36 overflow-hidden sm:h-40">
        <img
          src={lisbonImage}
          alt="Lisbon waterfront and terracotta rooftops"
          width={1280}
          height={960}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
          <div className="text-white">
            <p className="text-[9px] font-semibold tracking-[0.16em] text-white/70 uppercase">
              Best match
            </p>
            <h4 className="mt-0.5 font-display text-2xl font-semibold">Lisbon, Portugal</h4>
          </div>
          <span className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-soft">
            92 match
          </span>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-3 gap-2.5">
          <ResultMetric icon={<Wallet />} label="Total estimate" value="€2,180" />
          <ResultMetric icon={<CloudSun />} label="Weather" value="22°C · Sunny" />
          <ResultMetric icon={<Plane />} label="Flight" value="2h 45m · Direct" />
        </div>

        <div className="mt-4 grid gap-3.5 sm:grid-cols-[1fr_.82fr]">
          <div className="rounded-2xl border border-border bg-secondary/55 p-3.5">
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-card text-primary shadow-soft">
                <BedDouble className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Hotel
                </p>
                <p className="mt-1 text-xs font-semibold">Casa Alfama</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Boutique townhouse · 4.7</p>
              </div>
            </div>
          </div>
          <AsteraMap />
        </div>

        <div className="mt-4 rounded-2xl bg-primary p-4 text-primary-foreground transition-colors duration-300 hover:bg-accent sm:p-5">
          <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] uppercase">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Why ASTERA picked this
          </p>
          <ul className="mt-3 grid gap-x-4 gap-y-2.5 text-[10px] font-medium sm:grid-cols-2 sm:text-[11px]">
            {[
              "Under budget",
              "Direct flight",
              "Warm weather",
              "Matches your interests",
              "Walkable city",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/12">
                  <Check className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                </span>
                <span className="text-primary-foreground/85">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ResultMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border p-2.5">
      <div className="flex items-center gap-1 text-primary [&_svg]:h-3 [&_svg]:w-3">
        {icon}
        <span className="truncate text-[8px] font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
      </div>
      <p className="mt-1.5 truncate text-[10px] font-semibold tabular-nums sm:text-[11px]">
        {value}
      </p>
    </div>
  );
}

function AsteraMap() {
  return (
    <div
      className="relative min-h-20 overflow-hidden rounded-2xl bg-[oklch(0.91_0.025_190)]"
      role="img"
      aria-label="Map preview showing a short route through central Lisbon"
    >
      <svg viewBox="0 0 180 90" className="absolute inset-0 h-full w-full" aria-hidden>
        <path
          d="M-5 74 C35 58 43 21 82 35 S122 82 185 28"
          fill="none"
          stroke="var(--color-card)"
          strokeWidth="12"
        />
        <path
          d="M-5 74 C35 58 43 21 82 35 S122 82 185 28"
          fill="none"
          stroke="var(--color-teal)"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <circle cx="81" cy="35" r="6" fill="var(--color-primary)" />
        <circle cx="81" cy="35" r="2.5" fill="var(--color-card)" />
      </svg>
      <span className="absolute right-2 bottom-2 rounded-full bg-card px-2 py-1 text-[8px] font-semibold shadow-soft">
        Alfama · Baixa
      </span>
    </div>
  );
}
