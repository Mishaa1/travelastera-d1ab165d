import {
  BedDouble,
  CloudSun,
  Compass,
  Gem,
  Layers,
  Navigation,
  PiggyBank,
  TrainFront,
} from "lucide-react";

import { Reveal } from "@/components/common/Reveal";

const FEATURES = [
  {
    Icon: PiggyBank,
    title: "Budget optimisation",
    body: "Every route is priced end to end, so what's left over is a number, not a hope.",
  },
  {
    Icon: Compass,
    title: "Nearby destinations",
    body: "Places two hours away that you'd never have searched for, scored against your interests.",
  },
  {
    Icon: Gem,
    title: "Hidden gems",
    body: "Under-visited cities weighted up when they beat the obvious choice on value.",
  },
  {
    Icon: Layers,
    title: "Trip bundles",
    body: "Multi-city combinations built as one plan instead of four separate bookings.",
  },
  {
    Icon: CloudSun,
    title: "Weather aware",
    body: "Live Open-Meteo forecasts feed the score, plus a rainy-day plan for every day.",
  },
  {
    Icon: BedDouble,
    title: "Accommodation",
    body: "Nightly rates modelled per city and per comfort level, with fewer hotel changes on request.",
  },
  {
    Icon: TrainFront,
    title: "Transport mix",
    body: "Rail, road or air chosen per leg — including a strict no-flights mode.",
  },
  {
    Icon: Navigation,
    title: "Route optimisation",
    body: "Stops ordered so no leg backtracks and total transit stays under your ceiling.",
  },
];

export function FeatureGrid() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-28 md:px-8 md:py-40">
      <Reveal className="max-w-2xl">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-emerald uppercase">
          What the engine considers
        </p>
        <h2 className="mt-5 font-display text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.02] font-medium tracking-[-0.02em]">
          Eight optimisation layers, one answer.
        </h2>
      </Reveal>

      <div className="mt-16 grid gap-px overflow-hidden rounded-4xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, index) => (
          <Reveal key={feature.title} delay={(index % 4) * 0.06}>
            <div className="group h-full bg-card p-7 transition-colors duration-500 hover:bg-secondary/40">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal/8 text-teal transition-transform duration-500 group-hover:-translate-y-0.5">
                <feature.Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden />
              </span>
              <h3 className="mt-6 font-display text-lg font-medium tracking-[-0.01em]">
                {feature.title}
              </h3>
              <p className="mt-2 text-[14px] leading-[1.65] text-muted-foreground">
                {feature.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

