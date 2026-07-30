import { Cpu, Route, Wallet } from "lucide-react";

import { Reveal } from "@/components/common/Reveal";

const STEPS = [
  {
    Icon: Wallet,
    title: "Tell us the essentials",
    body: "The budget, the dates and the people. Constraints—not a destination and not a finished itinerary.",
  },
  {
    Icon: Cpu,
    title: "ASTERA weighs the possibilities",
    body: "Routes, stays, travel time, weather and shared preferences are considered together, quietly.",
  },
  {
    Icon: Route,
    title: "Get the trip worth taking",
    body: "A clear recommendation, the reasons it won and a practical path from decision to booking.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
      <Reveal className="max-w-2xl">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-teal uppercase">
          How little you have to do
        </p>
        <h2 className="mt-5 font-display text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.02] font-medium tracking-[-0.02em]">
          You bring the essentials. ASTERA carries the decisions.
        </h2>
      </Reveal>

      <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-14">
        {STEPS.map((step, index) => (
          <Reveal as="li" key={step.title} delay={index * 0.08} className="group relative">
            <div className="flex items-start justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/8 text-primary">
                <step.Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden />
              </span>
              <span className="font-display text-xs font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 className="mt-8 font-display text-2xl font-medium tracking-[-0.01em]">
              {step.title}
            </h3>
            <p className="mt-3 text-[15px] leading-[1.65] text-muted-foreground">{step.body}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
