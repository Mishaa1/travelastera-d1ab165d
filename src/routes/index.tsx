import { createFileRoute, Link } from "@tanstack/react-router";

import { PageShell } from "@/components/layout/PageShell";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Testimonials } from "@/components/landing/Testimonials";
import { Reveal } from "@/components/common/Reveal";
import { Button } from "@/components/ui/button";

const TITLE = "Safara — See how far your budget can take you";
const DESCRIPTION =
  "Safara is an AI travel optimiser. Give it your budget, dates, cities and interests and it searches thousands of route combinations to build your best possible trip.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <PageShell>
      <Hero />
      <HowItWorks />
      <ComparisonSection />
      <FeatureGrid />
      <Testimonials />
      <FaqSection />

      <section className="px-5 pb-24 md:px-8 md:pb-36">
        <Reveal className="mx-auto max-w-6xl overflow-hidden rounded-4xl gradient-dawn p-10 text-center shadow-lift md:p-20">
          <h2 className="mx-auto max-w-2xl text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.03] font-semibold text-primary-foreground">
            Give it your constraints. Get back the trip worth taking.
          </h2>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild variant="glass" size="xl">
              <Link to="/plan">Start optimising</Link>
            </Button>
            <Button asChild variant="glass" size="xl">
              <Link to="/results" search={{ sample: true }}>
                Try a sample trip
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}
