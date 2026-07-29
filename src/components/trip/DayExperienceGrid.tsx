import { useMemo, useState } from "react";
import { Utensils } from "lucide-react";

import { AttractionCard } from "@/components/discover/AttractionCard";
import { AsteraStory } from "@/components/discover/AsteraStory";
import { RestaurantCard } from "@/components/discover/RestaurantCard";
import { buildDayExperiences, type DayExperience } from "@/services/dayExperienceService";
import type { DayPlan, TripPreferences, TripStop } from "@/lib/types";

interface DayExperienceGridProps {
  day: DayPlan;
  stop: TripStop | undefined;
  preferences: TripPreferences;
}

/**
 * The three period cards for one itinerary day, plus the day's table.
 * Composed entirely from the existing Attraction / Restaurant cards.
 */
export function DayExperienceGrid({ day, stop, preferences }: DayExperienceGridProps) {
  const [story, setStory] = useState<DayExperience | null>(null);
  const { slots, restaurant } = useMemo(
    () => buildDayExperiences(day, stop, preferences),
    [day, stop, preferences],
  );

  if (!slots.length) {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[day.morning, day.afternoon, day.evening].map((text, index) => (
          <p key={index} className="rounded-2xl bg-secondary/60 p-4 text-sm leading-relaxed">
            {text}
          </p>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {slots.map((experience, index) => (
          <AttractionCard
            key={experience.slot}
            attraction={experience.attraction}
            index={index}
            eyebrow={experience.label}
            hook={experience.hook}
            tags={experience.tags}
            variant="compact"
            onOpen={() => setStory(experience)}
            className="h-full"
          />
        ))}
      </div>

      {restaurant && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            <Utensils className="h-3.5 w-3.5 text-sunset" aria-hidden />
            Where to eat
          </p>
          <div className="mt-2">
            <RestaurantCard restaurant={restaurant} preferences={preferences} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Also on the shortlist for this day: {day.restaurant}
          </p>

        </div>
      )}

      <AsteraStory experience={story} onOpenChange={(open) => !open && setStory(null)} />
    </>
  );
}
