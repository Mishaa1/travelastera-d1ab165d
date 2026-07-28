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
    <section className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-36">
      <Reveal>
        <p className="text-xs font-semibold tracking-widest text-emerald uppercase">
          What the engine considers
        </p>
        <h2 className="mt-4 max-w-2xl text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.03] font-semibold">
          Eight optimisation layers, one answer.
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, index) => (
          <Reveal key={feature.title} delay={(index % 4) * 0.07}>
            <div className="card-lift h-full rounded-3xl border border-border bg-card p-6">
              <feature.Icon className="h-6 w-6 text-teal" aria-hidden />
              <h3 className="mt-5 font-display text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
