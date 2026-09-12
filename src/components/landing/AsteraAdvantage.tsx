import { motion, useReducedMotion } from "motion/react";
import {
  BadgeCheck,
  BookOpenCheck,
  BrainCircuit,
  BriefcaseBusiness,
  ClipboardList,
  GitCompareArrows,
  Heart,
  Info,
  Navigation,
  Route,
  ScanSearch,
  Sparkles,
} from "lucide-react";

const ADVANTAGES = [
  { icon: BriefcaseBusiness, title: "Constraint-guaranteed", copy: "Every plan respects your budget, dates and must-haves." },
  { icon: BrainCircuit, title: "AI trip optimiser", copy: "We evaluate real combinations to find the strongest fit." },
  { icon: Heart, title: "Live trade-offs", copy: "See the impact of every change before you decide." },
  { icon: Info, title: "Explained, always", copy: "Clear reasons behind every recommendation you can trust." },
  { icon: Navigation, title: "Journey companion", copy: "Day-by-day guidance grounded in your chosen trip." },
  { icon: BadgeCheck, title: "Book confidently", copy: "Clear provider options, prices and honest availability." },
] as const;

const JOURNEY = [
  { icon: ClipboardList, title: "Tell us what you want", copy: "Share your preferences and constraints" },
  { icon: ScanSearch, title: "We explore", copy: "Evaluate the real possibilities" },
  { icon: GitCompareArrows, title: "We compare", copy: "Analyse trade-offs and rank options" },
  { icon: BrainCircuit, title: "We explain", copy: "Clear reasons behind every choice" },
  { icon: Route, title: "You travel", copy: "Follow your journey day by day" },
  { icon: BookOpenCheck, title: "You remember", copy: "Keep the story of the trip together" },
] as const;

export function AsteraAdvantage() {
  const reduceMotion = useReducedMotion();
  return (
    <section className="relative z-10 bg-[#e7f4f6]/80 px-4 py-5 sm:px-6 sm:py-6">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.18 }}
        transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-[92rem] rounded-[28px] border border-[#cfe1e3] bg-[linear-gradient(135deg,rgba(239,248,248,.98),rgba(247,248,243,.94))] px-5 py-7 shadow-[0_18px_55px_rgba(12,43,55,.10),inset_0_1px_rgba(255,255,255,.8)] sm:px-7 lg:px-10 lg:py-8"
      >
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-teal">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span className="text-[11px] font-semibold tracking-[.18em] uppercase">Why ASTERA</span>
          </div>
          <h2 className="mt-1.5 font-serif-display text-3xl font-light tracking-[-.02em] text-ink sm:text-[2.15rem]">The ASTERA advantage</h2>
          <p className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">We don’t just show options. We find the right one.</p>
        </div>

        <div className="mt-6 grid gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {ADVANTAGES.map(({ icon: Icon, title, copy }, index) => (
            <motion.article
              key={title}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: reduceMotion ? 0 : index * 0.055 }}
              className="relative px-3 text-center xl:[&:not(:last-child)]:after:absolute xl:[&:not(:last-child)]:after:top-8 xl:[&:not(:last-child)]:after:right-0 xl:[&:not(:last-child)]:after:h-20 xl:[&:not(:last-child)]:after:w-px xl:[&:not(:last-child)]:after:bg-border"
            >
              <span className="mx-auto grid h-13 w-13 place-items-center rounded-full border border-teal/20 bg-white/75 text-teal shadow-sm backdrop-blur">
                <Icon className="h-6 w-6 stroke-[1.7]" aria-hidden />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-teal">{title}</h3>
              <p className="mx-auto mt-1.5 max-w-44 text-[11px] leading-relaxed text-muted-foreground">{copy}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-7 border-t border-border/75 pt-6">
          <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {JOURNEY.map(({ icon: Icon, title, copy }, index) => (
              <li key={title} className="relative flex items-start gap-3 xl:pr-7">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-teal/20 bg-white/65 text-teal">
                  <Icon className="h-4 w-4 stroke-[1.8]" aria-hidden />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-xs font-semibold text-ink">{title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{copy}</p>
                </div>
                {index < JOURNEY.length - 1 && <span aria-hidden className="absolute top-3 -right-1 hidden text-xl text-teal/55 xl:block">→</span>}
              </li>
            ))}
          </ol>
        </div>
      </motion.div>
    </section>
  );
}
