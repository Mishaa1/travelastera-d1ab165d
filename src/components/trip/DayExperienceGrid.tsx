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
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
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
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-sunset/10 text-sunset-foreground">
              <Utensils className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            </span>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Where to eat
            </p>
          </div>
          <div className="mt-3">
            <RestaurantCard restaurant={restaurant} preferences={preferences} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Also on the shortlist for this day: {day.restaurant}
          </p>
        </div>
      )}

      <AsteraStory experience={story} onOpenChange={(open) => !open && setStory(null)} />
    </>
  );
}

