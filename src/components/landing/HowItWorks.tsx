import { Cpu, Route, Wallet } from "lucide-react";

import { Reveal } from "@/components/common/Reveal";

const STEPS = [
  {
    Icon: Wallet,
    title: "Tell us the essentials",
    body: "Dates, start city, budget and how you like to travel. Nine inputs, no destination required.",
  },
  {
    Icon: Cpu,
    title: "Astera searches, quietly",
    body: "Thousands of routes priced end to end through transport, accommodation and daily spend — scored against your constraints.",
  },
  {
    Icon: Route,
    title: "One trip, worth taking",
    body: "Four ranked routes with the reasoning behind each. Adjust anything, and the numbers update instantly.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-28 md:px-8 md:py-40">
      <Reveal className="max-w-2xl">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-teal uppercase">
          How it works
        </p>
        <h2 className="mt-5 font-display text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.02] font-medium tracking-[-0.02em]">
          Three inputs in. One optimised trip out.
        </h2>
      </Reveal>

      <ol className="mt-16 grid gap-px overflow-hidden rounded-4xl border border-border bg-border md:grid-cols-3">
        {STEPS.map((step, index) => (
          <Reveal
            as="li"
            key={step.title}
            delay={index * 0.08}
            className="relative bg-card p-8 transition-colors duration-500 hover:bg-secondary/50 md:p-10"
          >
            <div className="flex items-start justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/8 text-primary">
                <step.Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden />
              </span>
              <span className="font-display text-xs font-medium tracking-[0.18em] text-muted-foreground/70 uppercase">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 className="mt-8 font-display text-2xl font-medium tracking-[-0.01em]">
              {step.title}
            </h3>
            <p className="mt-3 text-[15px] leading-[1.65] text-muted-foreground">
              {step.body}
            </p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
