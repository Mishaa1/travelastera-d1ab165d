import { Home } from "lucide-react";

import { DataBadge } from "@/components/common/DataBadge";
import { ScoreBar } from "@/components/common/ScoreBar";
import type { NeighbourhoodProfile } from "@/services/experienceService";

/** Explains why the engine parked you in this part of town. */
export function NeighbourhoodPanel({ profile }: { profile: NeighbourhoodProfile }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <Home className="h-3.5 w-3.5" aria-hidden /> Where you'll be based
          </p>
          <h4 className="mt-1 font-display text-xl font-semibold">
            {profile.name}, {profile.city}
          </h4>
        </div>
        <DataBadge quality={profile.quality} />
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{profile.whyStay}</p>

      <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <ScoreBar label="Walkability" value={profile.walkScore} tone="primary" />
        <ScoreBar label="Transit access" value={profile.transitScore} tone="teal" delay={0.05} />
        <ScoreBar label="Food nearby" value={profile.foodScore} tone="sunset" delay={0.1} />
        <ScoreBar label="Feels safe at night" value={profile.safetyScore} tone="emerald" delay={0.15} />
        <ScoreBar label="Nightlife" value={profile.nightlifeScore} tone="primary" delay={0.2} />
        <ScoreBar label="Family friendly" value={profile.familyScore} tone="emerald" delay={0.25} />
      </div>
    </div>
  );
}
