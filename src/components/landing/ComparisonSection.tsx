import { Check, X } from "lucide-react";

import { AnimatedCounter } from "@/components/common/AnimatedCounter";
import { Reveal } from "@/components/common/Reveal";

const METRICS = [
  { label: "Hours spent planning", traditional: 14, safara: 4, suffix: "", safaraSuffix: " min" },
  { label: "Websites compared", traditional: 27, safara: 1, suffix: "", safaraSuffix: "" },
  { label: "Routes actually evaluated", traditional: 3, safara: 4200, suffix: "", safaraSuffix: "+" },
  { label: "Typical budget overrun", traditional: 22, safara: 0, suffix: "%", safaraSuffix: "%" },
];

const TRADITIONAL = [
  "Pick a destination first, then hope it fits",
  "Twelve browser tabs and a spreadsheet",
  "Prices checked once, never re-checked",
  "No idea what the alternative would have cost",
];

const SAFARA = [
  "Constraints first, destination discovered",
  "One search across every combination",
  "Every leg priced through the same model",
  "Four ranked options with the reasoning shown",
];

export function ComparisonSection() {
  return (
    <section className="py-24 md:py-36">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal>
          <p className="text-xs font-semibold tracking-widest text-sunset uppercase">
            The difference
          </p>
          <h2 className="mt-4 max-w-2xl text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.03] font-semibold">
            Traditional planning vs Astera
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Reveal className="rounded-4xl border border-border bg-card/70 p-7 md:p-9">
            <h3 className="font-display text-xl font-semibold text-muted-foreground">
              Traditional planning
            </h3>
            <ul className="mt-6 space-y-4">
              {TRADITIONAL.map((item) => (
                <li key={item} className="flex gap-3 text-sm">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1} className="rounded-4xl border border-primary/25 bg-card p-7 shadow-float md:p-9">
            <h3 className="font-display text-xl font-semibold text-gradient-dawn">Astera</h3>
            <ul className="mt-6 space-y-4">
              {SAFARA.map((item) => (
                <li key={item} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((metric, index) => (
            <Reveal
              key={metric.label}
              delay={index * 0.08}
              className="rounded-3xl border border-border bg-card p-6"
            >
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {metric.label}
              </dt>
              <dd className="mt-3 flex items-baseline gap-3">
                <span className="font-display text-3xl font-semibold text-gradient-dawn tabular-nums">
                  <AnimatedCounter value={metric.safara} suffix={metric.safaraSuffix} />
                </span>
                <span className="text-sm text-muted-foreground line-through tabular-nums">
                  <AnimatedCounter value={metric.traditional} suffix={metric.suffix} />
                </span>
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
