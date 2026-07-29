import { Star } from "lucide-react";

import { Reveal } from "@/components/common/Reveal";

const TESTIMONIALS = [
  {
    quote:
      "I had £1,400 and three weeks off. Astera came back with Kraków, Ljubljana and Split — I'd never have put those three together, and I came home with £180 left.",
    name: "Amara O.",
    detail: "Manchester → Central Europe",
  },
  {
    quote:
      "The no-flights setting is the whole reason I use it. It rebuilt the entire route on rail and only added four hours across ten days.",
    name: "Jonas W.",
    detail: "Berlin → Adriatic coast",
  },
  {
    quote:
      "What sold me was the reasoning panel. It tells you why it picked Bologna over Florence, with the numbers. No other tool does that.",
    name: "Priya S.",
    detail: "Dublin → Northern Italy",
  },
];

export function Testimonials() {
  return (
    <section className="bg-sand/60 py-24 md:py-36">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal>
          <h2 className="max-w-2xl text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.03] font-semibold">
            Trips people wouldn't have found alone.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((item, index) => (
            <Reveal key={item.name} delay={index * 0.1}>
              <figure className="card-lift flex h-full flex-col rounded-4xl border border-border bg-card p-7">
                <div className="flex gap-1" aria-label="Five out of five">
                  {Array.from({ length: 5 }).map((_, star) => (
                    <Star key={star} className="h-4 w-4 fill-sunset text-sunset" aria-hidden />
                  ))}
                </div>
                <blockquote className="mt-5 flex-1 text-[15px] leading-relaxed">
                  “{item.quote}”
                </blockquote>
                <figcaption className="mt-6 border-t border-border pt-4">
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.detail}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Illustrative testimonials from a prototype product.
        </p>
      </div>
    </section>
  );
}
