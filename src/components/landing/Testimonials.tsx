import { motion, useReducedMotion } from "motion/react";

import { Reveal } from "@/components/common/Reveal";

const SOCIAL_IMAGE =
  "/images/landing/sunset-adventure-mountain-top-friends-enjoying-breathtaking-view.webp";

const TESTIMONIALS = [
  {
    quote: "We planned the trip without arguing—and both felt like it was ours.",
    name: "Maya & Theo",
    detail: "Illustrative couple",
  },
  {
    quote: "For once, I did not have to organise everything or chase everyone for an answer.",
    name: "Sofia",
    detail: "Illustrative group organiser",
  },
  {
    quote:
      "It turned weeks of research into one evening—and found a trip none of us would have chosen alone.",
    name: "Daniel & friends",
    detail: "Illustrative group trip",
  },
];

export function Testimonials() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="surface-aegean py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid items-end gap-8 md:grid-cols-[1fr_.7fr]">
          <Reveal>
            <div className="meander mb-8 max-w-[220px] text-primary-foreground" aria-hidden />
            <h2 className="max-w-2xl font-serif-display text-[clamp(2.2rem,4.8vw,3.6rem)] leading-[1.05] font-light text-primary-foreground">
              Less organising. More looking forward to it.
            </h2>
          </Reveal>
          <Reveal
            delay={0.08}
            className="relative h-48 overflow-hidden rounded-[2rem] shadow-float md:h-60"
          >
            <motion.img
              src={SOCIAL_IMAGE}
              alt="Friends sharing a sunset view from a mountain"
              className="h-full w-full object-cover object-[52%_55%]"
              loading="lazy"
              initial={reduceMotion ? false : { scale: 1.05 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: reduceMotion ? 0 : 1.5, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/35 to-transparent ring-1 ring-inset ring-white/15" />
          </Reveal>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((item, index) => (
            <Reveal key={item.name} delay={index * 0.1}>
              <figure className="hover-lift flex h-full flex-col rounded-[24px] border border-primary-foreground/10 bg-primary-foreground/[0.075] p-8 shadow-soft backdrop-blur-xl">
                <span className="font-serif-display text-5xl leading-none text-teal/70" aria-hidden>
                  “
                </span>
                <blockquote className="mt-3 flex-1 font-serif-display text-2xl leading-snug text-primary-foreground/85">
                  {item.quote}
                </blockquote>
                <figcaption className="mt-6 border-t border-primary-foreground/15 pt-4">
                  <span className="block text-sm font-semibold text-primary-foreground">
                    {item.name}
                  </span>
                  <span className="block text-xs text-primary-foreground/60">{item.detail}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-xs text-primary-foreground/55">
          Illustrative stories representing the planning outcomes ASTERA is designed to create.
        </p>
      </div>
    </section>
  );
}
