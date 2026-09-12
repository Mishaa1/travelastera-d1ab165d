import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Clock3, MapPin, Navigation, Plus, Star, Utensils } from "lucide-react";

import { AsteraStory } from "@/components/discover/AsteraStory";
import { buildDayExperiences, type DayExperience } from "@/services/dayExperienceService";
import { cinematicStory } from "@/lib/tripStoryCache";
import type { DayLayoutVariant } from "@/lib/tripItineraryPresentation";
import type { DayPlan, TripPreferences, TripStop } from "@/lib/types";

interface DayExperienceGridProps {
  day: DayPlan;
  stop: TripStop | undefined;
  preferences: TripPreferences;
  variant: DayLayoutVariant;
  fallbackImage: string;
}

const validSource = (source?: string) =>
  source === "google-live" || source === "google-cache" || source === "overpass-live";

function isGrounded(experience: DayExperience) {
  const place = experience.attraction;
  return Boolean(
    place.providerPlaceId &&
    (place.provider === "google" || place.provider === "overpass") &&
    validSource(place.sourceStatus) &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lon),
  );
}

function DestinationImage({
  src,
  fallback,
  alt,
  className,
}: {
  src?: string;
  fallback: string;
  alt: string;
  className: string;
}) {
  const [activeSrc, setActiveSrc] = useState(src || fallback);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <img
      src={activeSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (activeSrc !== fallback) setActiveSrc(fallback);
        else setHidden(true);
      }}
    />
  );
}

function PlaceActions({ experience }: { experience: DayExperience }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-semibold">
      {experience.attraction.providerUrl && (
        <a
          href={experience.attraction.providerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-teal hover:underline"
        >
          <Navigation className="h-3 w-3" aria-hidden /> Open Maps
        </a>
      )}
      <button
        type="button"
        className="inline-flex items-center gap-1 text-foreground/65 hover:text-teal"
      >
        <Plus className="h-3 w-3" aria-hidden /> Add to itinerary
      </button>
    </div>
  );
}

function HeroMoment({
  experience,
  fallbackImage,
}: {
  experience: DayExperience;
  fallbackImage: string;
}) {
  const story = cinematicStory(experience.attraction.city, experience);
  return (
    <article className="group relative min-h-[280px] overflow-hidden rounded-[18px] bg-ink shadow-soft">
      <DestinationImage
        src={experience.attraction.image}
        fallback={fallbackImage}
        alt={`${experience.attraction.name} in ${experience.attraction.city}`}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025] motion-reduce:transform-none"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/25 to-transparent" />
      <span className="absolute top-4 left-4 rounded-full bg-teal px-2.5 py-1 text-[9px] font-semibold tracking-[.14em] text-white uppercase">
        Hero moment
      </span>
      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
        <p className="text-[10px] font-semibold tracking-[.14em] text-white/70 uppercase">
          {experience.label}
        </p>
        <h4 className="mt-1 font-display text-3xl leading-none font-medium">
          {experience.attraction.name}
        </h4>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85">{story}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-white/75">
          {experience.attraction.rating > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 fill-current" aria-hidden />
              {experience.attraction.rating.toFixed(1)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" aria-hidden />
            {experience.label} · {experience.attraction.visitMinutes} min
          </span>
          {experience.attraction.providerUrl && (
            <a
              href={experience.attraction.providerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-white hover:underline"
            >
              View place <ArrowUpRight className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function ActivityCard({
  experience,
  fallbackImage,
  compact = false,
  onOpen,
}: {
  experience: DayExperience;
  fallbackImage: string;
  compact?: boolean;
  onOpen: () => void;
}) {
  return (
    <article
      className={`grid min-w-0 overflow-hidden rounded-2xl border border-border/45 bg-white ${compact ? "grid-cols-[82px_minmax(0,1fr)]" : "grid-cols-[104px_minmax(0,1fr)]"}`}
    >
      <DestinationImage
        src={experience.attraction.image}
        fallback={fallbackImage}
        alt={`${experience.attraction.name} in ${experience.attraction.city}`}
        className="h-full min-h-28 w-full object-cover"
      />
      <div className="min-w-0 p-3">
        <p className="text-[9px] font-semibold tracking-[.14em] text-teal uppercase">
          {experience.label}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-1 text-left font-display text-base leading-tight font-medium hover:text-teal"
        >
          {experience.attraction.name}
        </button>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {experience.hook}
        </p>
        <PlaceActions experience={experience} />
      </div>
    </article>
  );
}

function RestaurantCard({
  restaurant,
  fallbackImage,
}: {
  restaurant: NonNullable<ReturnType<typeof buildDayExperiences>["restaurant"]>;
  fallbackImage: string;
}) {
  return (
    <article className="grid min-w-0 overflow-hidden rounded-2xl border border-border/45 bg-white sm:grid-cols-[130px_minmax(0,1fr)]">
      <DestinationImage
        src={restaurant.image}
        fallback={fallbackImage}
        alt={`${restaurant.name} in ${restaurant.city}`}
        className="h-32 w-full object-cover sm:h-full"
      />
      <div className="min-w-0 p-4">
        <p className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[.14em] text-sunset-foreground uppercase">
          <Utensils className="h-3 w-3" aria-hidden /> Restaurant
        </p>
        <h4 className="mt-1 font-display text-xl font-medium">{restaurant.name}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {restaurant.cuisine} · {restaurant.walkMinutes} min walk
        </p>
        <div className="mt-2 flex items-center gap-3 text-[11px]">
          {restaurant.rating > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 fill-current text-sunset" aria-hidden />
              {restaurant.rating.toFixed(1)}
            </span>
          )}
          {restaurant.providerUrl && (
            <a
              href={restaurant.providerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-teal hover:underline"
            >
              Open Maps
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function DayExperienceGrid({
  day,
  stop,
  preferences,
  variant,
  fallbackImage,
}: DayExperienceGridProps) {
  const [story, setStory] = useState<DayExperience | null>(null);
  const reduceMotion = useReducedMotion();
  const built = useMemo(
    () => buildDayExperiences(day, stop, preferences),
    [day, stop, preferences],
  );
  const grounded = built.slots.filter(isGrounded);
  const hero = grounded.find((item) => item.attraction.image) ?? grounded[0];
  const supporting = grounded
    .filter((item) => item.attraction.providerPlaceId !== hero?.attraction.providerPlaceId)
    .slice(0, 2);
  const restaurant =
    built.restaurant?.providerPlaceId && validSource(built.restaurant.sourceStatus)
      ? built.restaurant
      : null;

  if (!hero)
    return (
      <p className="rounded-2xl border border-border/50 px-4 py-4 text-sm text-muted-foreground">
        No additional live recommendation available for this day.
      </p>
    );

  const reveal = {
    initial: reduceMotion ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduceMotion ? 0 : 0.35 },
  } as const;

  return (
    <motion.div {...reveal} data-day-template={variant}>
      {variant === "template-a" && (
        <div className="grid gap-3 lg:grid-cols-[1.45fr_.75fr]">
          <HeroMoment experience={hero} fallbackImage={fallbackImage} />
          <div className="grid gap-3">
            {supporting.map((item) => (
              <ActivityCard
                key={item.attraction.providerPlaceId}
                experience={item}
                fallbackImage={fallbackImage}
                compact
                onOpen={() => setStory(item)}
              />
            ))}
            {restaurant && <RestaurantCard restaurant={restaurant} fallbackImage={fallbackImage} />}
          </div>
        </div>
      )}
      {variant === "template-b" && (
        <div className="grid gap-3 lg:grid-cols-[.72fr_1.28fr]">
          <div className="border-l border-teal/30 pl-4">
            {[hero, ...supporting].map((item, index) => (
              <div key={item.attraction.providerPlaceId} className="relative pb-4 last:pb-0">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-teal shadow" />
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {index === 0 ? "09:00" : index === 1 ? "12:30" : "16:00"}
                </p>
                <button
                  type="button"
                  onClick={() => setStory(item)}
                  className="mt-1 text-left font-semibold hover:text-teal"
                >
                  {item.attraction.name}
                </button>
                <p className="mt-1 text-xs text-muted-foreground">{item.hook}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3">
            <HeroMoment experience={hero} fallbackImage={fallbackImage} />
            {restaurant && <RestaurantCard restaurant={restaurant} fallbackImage={fallbackImage} />}
          </div>
        </div>
      )}
      {variant === "template-c" && (
        <div className="grid gap-3">
          <HeroMoment experience={hero} fallbackImage={fallbackImage} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {supporting.map((item) => (
              <ActivityCard
                key={item.attraction.providerPlaceId}
                experience={item}
                fallbackImage={fallbackImage}
                onOpen={() => setStory(item)}
              />
            ))}
            {restaurant && <RestaurantCard restaurant={restaurant} fallbackImage={fallbackImage} />}
          </div>
        </div>
      )}
      <AsteraStory experience={story} onOpenChange={(open) => !open && setStory(null)} />
    </motion.div>
  );
}
