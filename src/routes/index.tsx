import { createFileRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";

import { Hero } from "@/components/landing/Hero";
import { ReferenceStory } from "@/components/landing/ReferenceStory";
import { PageShell } from "@/components/layout/PageShell";

const TITLE = "Astera — See how far your budget can take you";
const DESCRIPTION =
  "Astera helps you decide where to go by balancing your budget, preferences and the people travelling with you.";

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
    <MotionConfig reducedMotion="user">
      <PageShell landing footer={false}>
        <Hero />
        <ReferenceStory />
      </PageShell>
    </MotionConfig>
  );
}
