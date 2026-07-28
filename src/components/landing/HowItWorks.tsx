import { ArrowDown, Cpu, Route, Wallet } from "lucide-react";

import { Reveal } from "@/components/common/Reveal";

const STEPS = [
  {
    Icon: Wallet,
    title: "Tell us your budget",
    body: "Dates, start and end city, how you like to move and what you actually enjoy. Nine inputs, no destination required.",
  },
  {
    Icon: Cpu,
    title: "AI searches thousands of combinations",
    body: "Every city pairing is priced through transport, accommodation and daily-spend models, then scored against your constraints.",
  },
  {
    Icon: Route,
    title: "Receive your best trip",
    body: "Four routes, ranked. Costs, transit hours, weather and what's left in your account — with the reasoning behind each one.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-36">
      <Reveal>
        <p className="text-xs font-semibold tracking-widest text-teal uppercase">How it works</p>
        <h2 className="mt-4 max-w-2xl text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.03] font-semibold">
          Three inputs in. One optimised trip out.
        </h2>
      </Reveal>

      <ol className="mt-14 grid gap-6 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <Reveal as="li" key={step.title} delay={index * 0.1} className="relative">
            <div className="card-lift h-full rounded-4xl border border-border bg-card p-7 shadow-soft">
              <span className="grid h-12 w-12 place-items-center rounded-2xl gradient-sea text-primary-foreground">
                <step.Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="mt-6 block font-display text-5xl font-semibold text-muted-foreground/25">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-xl font-semibold">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
            {index < STEPS.length - 1 && (
              <ArrowDown
                className="mx-auto mt-4 h-5 w-5 text-muted-foreground md:hidden"
                aria-hidden
              />
            )}
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
