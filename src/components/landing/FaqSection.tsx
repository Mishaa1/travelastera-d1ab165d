import { Reveal } from "@/components/common/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Is this an itinerary planner?",
    a: "No. An itinerary planner assumes you already know where you're going. Astera starts from your constraints — budget, dates, cities you leave from and return to, how far you'll travel — and discovers the destination as an output of the search.",
  },
  {
    q: "Are the prices real?",
    a: "Not yet. Every figure carries an Estimated or Prototype estimate badge and comes from our distance and rate models. The services are built to the Amadeus Self-Service and hotel-partner contracts, so adding API keys switches them to live without touching the UI.",
  },
  {
    q: "Which data is live today?",
    a: "Weather comes from Open-Meteo and geocoding from Nominatim / OpenStreetMap — both live, both free. Maps render through MapLibre GL on OpenStreetMap tiles.",
  },
  {
    q: "Can I avoid flying entirely?",
    a: "Yes. Turn on Avoid flights and every leg is re-planned on rail or road, and the transit-hours score is recalculated against your maximum travel time.",
  },
  {
    q: "Do I need an account?",
    a: "No. Saved trips and your planner draft live in your browser's local storage. Nothing is uploaded and there's nothing to sign up for.",
  },
  {
    q: "How does Optimise further work?",
    a: "Each goal nudges one constraint — budget, transit ceiling, comfort level, interests — and re-runs the full search. You see the recalculated route rather than a hand-edited version of the old one.",
  },
];

export function FaqSection() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-24 md:px-8 md:py-36">
      <Reveal>
        <h2 className="text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.03] font-semibold">
          Questions, answered.
        </h2>
      </Reveal>
      <Reveal delay={0.1} className="mt-10">
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((faq, index) => (
            <AccordionItem key={faq.q} value={`faq-${index}`} className="border-border">
              <AccordionTrigger className="text-left font-display text-lg font-semibold hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}
