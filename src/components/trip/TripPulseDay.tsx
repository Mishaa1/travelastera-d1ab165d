import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Bookmark,
  BookmarkCheck,
  Bell,
  BellRing,
  Footprints,
  Heart,
  Lightbulb,
  Navigation,
  Sparkles,
  Star,
  Utensils,
  WalletCards,
} from "lucide-react";

import { buildDayExperiences, type DayExperience } from "@/services/dayExperienceService";
import { useDestinationMoodImages } from "@/hooks/useDestinationMoodImages";
import { cachedEditorialText, cinematicStory } from "@/lib/tripStoryCache";
import type { DayPlan, TripPreferences, TripStop } from "@/lib/types";

type Walking = { steps: number; km: number } | null;

interface Props {
  day: DayPlan;
  stop: TripStop | undefined;
  preferences: TripPreferences;
  title: string;
  mood: string;
  phase: string;
  walking: Walking;
  showMood: boolean;
  cityDays: DayPlan[];
  dailyTotalPerPerson?: number;
  hideHeader?: boolean;
}

const validSource = (source?: string) =>
  source === "google-live" || source === "google-cache" || source === "overpass-live";

const grounded = (item: DayExperience) =>
  Boolean(
    item.attraction.providerPlaceId &&
    item.attraction.provider &&
    validSource(item.attraction.sourceStatus) &&
    Number.isFinite(item.attraction.lat) &&
    Number.isFinite(item.attraction.lon),
  );

const realImage = (src?: string) =>
  Boolean(src && !src.includes("place-placeholder") && !src.startsWith("data:"));

function SafeImage({ src, fallbacks = [], alt, className }: { src?: string; fallbacks?: string[]; alt: string; className: string }) {
  const sources = [src, ...fallbacks].filter(
    (value, index, values): value is string => Boolean(realImage(value)) && values.indexOf(value) === index,
  );
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [src, fallbacks.join("|")]);
  const selected = sources[index];
  if (!selected) return null;
  return <img src={selected} alt={alt} className={className} onError={() => setIndex((value) => value + 1)} />;
}

function storyChips(items: DayExperience[]) {
  const chips = new Set<string>();
  items.forEach(({ attraction, slot }) => {
    if (slot === "morning") chips.add("Morning light");
    if (slot === "evening") chips.add("Evening mood");
    if (attraction.category === "food" || attraction.category === "market")
      chips.add("Local flavour");
    if (attraction.category === "viewpoint") chips.add("Best photo");
    if (attraction.category === "nature") chips.add("Slow moment");
    if (attraction.rating >= 4.5) chips.add("Local favourite");
  });
  return [...chips].slice(0, 6);
}

function DestinationMood({
  city,
  country,
  days,
  dayNumber,
  excludedImages,
}: {
  city: string;
  country: string;
  days: DayPlan[];
  dayNumber: number;
  excludedImages: Set<string>;
}) {
  const [wikimediaImages, setWikimediaImages] = useState<
    Array<{ src: string; pageUrl: string; fileId: string; title: string; creator?: string; license?: string; role: string; relevanceScore: number }>
  >([]);
  const allImages = (() => {
    const seen = new Set<string>();
    return days
      .flatMap((day) => day.experiences ?? [])
      .filter((place) =>
        Boolean(
          place.providerPlaceId &&
          (place.provider === "google" || place.provider === "overpass") &&
          validSource(place.sourceStatus) &&
          realImage(place.image),
        ),
      )
      .filter((place) => {
        if (!place.image || seen.has(place.image)) return false;
        seen.add(place.image);
        return true;
      });
  })();
  const unusedProviderImages = allImages.filter((place) => !excludedImages.has(place.image!));

  useEffect(() => {
    if (unusedProviderImages.length >= 4) return;
    const controller = new AbortController();
    fetch(`/api/images/mood?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { images: [] }))
      .then((payload) => setWikimediaImages(Array.isArray(payload.images) ? payload.images : []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [city, country, unusedProviderImages.length]);

  type MoodRole = "cityscape" | "street" | "scenic" | "lifestyle";
  const moodRole = (category: string, name: string): MoodRole => {
    const text = `${category} ${name}`.toLowerCase();
    if (/market|food|cafe|restaurant|square|plaza/.test(text)) return "lifestyle";
    if (/park|nature|view|river|beach|coast|garden/.test(text)) return "scenic";
    if (/street|quarter|neighbou?rhood|lane|old town/.test(text)) return "street";
    return "cityscape";
  };
  const providerPool = unusedProviderImages
    .map((place) => ({
      ...place,
      src: place.image!,
      pageUrl: place.providerUrl,
      title: place.name,
      source: place.provider,
      role: moodRole(place.category, place.name),
    }))
    .filter(
      (place, index, places) =>
        places.findIndex((candidate) => candidate.src === place.src) === index,
    );
  const wikimediaPool = wikimediaImages
    .filter((image) => !excludedImages.has(image.src))
    .map((image) => ({
      ...image,
      image: image.src,
      name: image.title,
      category: image.role,
      providerPlaceId: `wikimedia:${image.fileId}`,
      provider: "wikimedia",
      source: "wikimedia",
    }));
  const roles: MoodRole[] = ["cityscape", "street", "scenic", "lifestyle"];
  const images = roles.flatMap((role) => {
    const cached = providerPool.filter((image) => image.role === role);
    const providerPick = cached.length ? cached[(dayNumber - 1) % cached.length] : undefined;
    return providerPick ? [providerPick] : wikimediaPool.filter((image) => image.role === role).slice(0, 1);
  });

  const moodWords = (() => {
    const categories = new Set(images.map((place) => place.category.toLowerCase()));
    const words: string[] = [];
    if ([...categories].some((value) => /food|restaurant|market|cafe/.test(value)))
      words.push("local tables");
    if ([...categories].some((value) => /museum|gallery|art/.test(value)))
      words.push("art and stories");
    if ([...categories].some((value) => /music|night/.test(value))) words.push("after-dark rhythm");
    if ([...categories].some((value) => /park|nature|view/.test(value))) words.push("open-air moments");
    if ([...categories].some((value) => /landmark|historic|church|architecture/.test(value)))
      words.push("streets with history");
    return (words.length ? words : ["streets", "local character", "changing light"])
      .slice(0, 3)
      .join(", ");
  })();

  if (images.length === 0) return null;
  const collageClass =
    images.length === 1
      ? "grid-cols-1"
      : images.length === 2
        ? "grid-cols-2"
        : "grid-cols-2 grid-rows-2";

  return (
    <section className="overflow-hidden rounded-[20px] border border-border/55 bg-white p-5 shadow-[0_20px_55px_-42px_rgba(6,37,48,.45)]">
      <p className="flex items-center gap-2 font-display text-xl">
        <span className="text-[#e5a12a]">✨</span> Destination Mood
      </p>
        <div className={`mt-4 grid gap-2 ${collageClass}`}>
          {images.map((item, index) => (
            <a
              key={item.providerPlaceId}
              href={item.pageUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`View the source for this ${city} mood image`}
              className={`group relative overflow-hidden rounded-xl bg-secondary ${images.length === 1 ? "aspect-[1.45]" : images.length === 3 && index === 0 ? "row-span-2 min-h-48" : "aspect-[.95]"}`}
            >
              <SafeImage
                src={item.src}
                alt={`${item.name} in ${city}`}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transform-none"
              />
            </a>
          ))}
        </div>
        <p className="mt-4 font-display text-sm leading-relaxed text-ink/75">
          {moodWords.charAt(0).toUpperCase() + moodWords.slice(1)} — the atmosphere of {city}.
        </p>
    </section>
  );
}

export function TripPulseDay({
  day,
  stop,
  preferences,
  title,
  mood,
  phase,
  walking,
  showMood,
  cityDays,
  dailyTotalPerPerson,
  hideHeader = false,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [reminderSet, setReminderSet] = useState(false);
  const moodFallbacks = useDestinationMoodImages(day.city, stop?.country ?? "");
  const fallbackUrls = moodFallbacks.map((image) => image.resolvedUrl);
  const built = useMemo(
    () => buildDayExperiences(day, stop, preferences),
    [day, stop, preferences],
  );
  const places = built.slots.filter(grounded);
  const providerImageIds = new Set(
    (day.experiences ?? [])
      .filter((place) => realImage(place.image))
      .map((place) => place.providerPlaceId),
  );
  const hero = places.find((item) => providerImageIds.has(item.attraction.providerPlaceId!));
  const supporting = places.filter(
    (item) => item.attraction.providerPlaceId !== hero?.attraction.providerPlaceId,
  );
  const restaurant =
    built.restaurant?.providerPlaceId && validSource(built.restaurant.sourceStatus)
      ? built.restaurant
      : null;
  const chips = storyChips(places);

  if (!hero) {
    return (
      <div className="rounded-2xl bg-white px-5 py-4 text-sm text-muted-foreground">
        No additional live recommendation available for Day {day.day}.
      </div>
    );
  }

  const note = cachedEditorialText(day.city, `note:${day.day}`, () => {
    const weather =
      stop?.weather.quality.source !== "mock"
        ? `${stop?.weather.tempC}°C and ${stop?.weather.summary.toLowerCase()}`
        : null;
    return `${hero.label} begins with ${hero.attraction.name}.${weather ? ` The current forecast is ${weather}.` : ""} ${day.transportNote ?? "Keep the day flexible around the places already mapped here."}`;
  });
  const memory = cachedEditorialText(
    day.city,
    `memory:${day.day}:${hero.attraction.providerPlaceId}`,
    () =>
      `You’ll probably remember the moment ${hero.attraction.name} made ${day.city} feel like yours.`,
  );
  const secret = supporting[0];
  const heroProviderId = hero.attraction.providerPlaceId;
  const carouselPlaces = cityDays
    // Reuse the complete already-grounded city pool. Current-day supporting
    // places are useful recommendations too; only the dominant hero is
    // excluded so the carousel is not needlessly sparse on short trips.
    .flatMap((candidate) => buildDayExperiences(candidate, stop, preferences).slots)
    .filter(grounded)
    .filter((item) => realImage(item.attraction.image))
    .filter((item, index, items) =>
      Boolean(
        item.attraction.providerPlaceId !== heroProviderId &&
        items.findIndex(
          (candidate) => candidate.attraction.providerPlaceId === item.attraction.providerPlaceId,
        ) === index &&
        items.findIndex(
          (candidate) => candidate.attraction.image === item.attraction.image,
        ) === index,
      ),
    )
    .slice(0, 8);
  const usedStoryImages = new Set(
    [...places, ...carouselPlaces]
      .map((item) => item?.attraction.image)
      .filter((image): image is string => Boolean(image)),
  );
  const memoryPlace = cityDays
    .flatMap((candidate) => candidate.experiences ?? [])
    .find((place) => realImage(place.image) && !usedStoryImages.has(place.image!));
  const excludedMoodImages = new Set(
    [...usedStoryImages, ...(memoryPlace?.image ? [memoryPlace.image] : [])],
  );
  const estimatedWalkMinutes = walking
    ? Math.max(4, Math.round((walking.km * 12) / Math.max(1, places.length)))
    : null;
  const restaurantHasProviderImage = realImage(day.restaurantDetails?.image);

  const toggleSaved = (id: string) =>
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: reduceMotion ? 0 : 0.55 }}
      className="min-w-0 py-2 sm:py-4"
    >
      {!hideHeader && (
        <header className="mb-6 flex flex-wrap items-end justify-between gap-5 px-2">
          <div>
            <p className="text-[10px] font-semibold tracking-[.2em] text-teal uppercase">
              {phase} · Day {day.day} · {day.city}
            </p>
            <h3 className="mt-2 font-display text-[clamp(2rem,4vw,3.5rem)] leading-none">
              {title}
            </h3>
            <p className="mt-3 font-display text-xl italic text-sunset-foreground/75">{mood}</p>
          </div>
          {walking && (
            <p className="text-xs text-muted-foreground">
              ≈ {walking.steps.toLocaleString()} steps · {walking.km.toFixed(1)} km
            </p>
          )}
        </header>
      )}

      <section className="group relative min-h-[420px] overflow-hidden rounded-[22px] bg-ink shadow-soft sm:min-h-[520px]">
        <SafeImage
          src={hero.attraction.image}
          fallbacks={fallbackUrls}
          alt={`${hero.attraction.name} in ${day.city}`}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] group-hover:scale-[1.025] motion-reduce:transform-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/15 to-transparent" />
        <div className="absolute top-5 left-5 rounded-full bg-white/14 px-3 py-1.5 text-[10px] font-semibold tracking-[.14em] text-white uppercase backdrop-blur-md">
          Hero moment
        </div>
        <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-9">
          <p className="text-xs font-medium text-white/70">
            {hero.label} · {hero.attraction.visitMinutes} min
          </p>
          <h4 className="mt-2 font-display text-[clamp(2.2rem,5vw,4.6rem)] leading-none">
            {hero.attraction.name}
          </h4>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
            {cinematicStory(day.city, hero)}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleSaved(hero.attraction.providerPlaceId!)}
              className="inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-xs font-semibold backdrop-blur-md hover:bg-white hover:text-ink"
            >
              {savedIds.has(hero.attraction.providerPlaceId!) ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
              {savedIds.has(hero.attraction.providerPlaceId!) ? "Saved" : "Save"}
            </button>
            {hero.attraction.providerUrl && (
              <a
                href={hero.attraction.providerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-xs font-semibold backdrop-blur-md hover:bg-white hover:text-ink"
              >
                <Navigation className="h-4 w-4" /> Map
              </a>
            )}
            <button
              type="button"
              onClick={() => setReminderSet((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full bg-white/14 px-4 py-2 text-xs font-semibold backdrop-blur-md hover:bg-white hover:text-ink"
            >
              {reminderSet ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {reminderSet ? "Reminder added" : "Add reminder"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-7 px-1">
        <div className="flex items-center justify-between gap-4">
          <h4 className="font-display text-xl">People are loving today</h4>
          <span className="text-xs text-muted-foreground">Provider-backed picks</span>
        </div>
        {carouselPlaces.length > 0 ? (
          <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-3">
            {carouselPlaces.map((item, index) => (
              <a
                key={item.attraction.providerPlaceId}
                href={item.attraction.providerUrl}
                target="_blank"
                rel="noreferrer"
                className="group relative min-h-52 w-44 shrink-0 snap-start overflow-hidden rounded-2xl bg-secondary shadow-[0_16px_38px_-28px_rgba(6,37,48,.65)]"
              >
                <SafeImage
                  src={item.attraction.image}
                  fallbacks={fallbackUrls.length ? [fallbackUrls[index % fallbackUrls.length], ...fallbackUrls] : []}
                  alt={item.attraction.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transform-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <p className="font-display text-lg leading-tight">{item.attraction.name}</p>
                  {item.attraction.rating > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-white/75">
                      <Star className="h-3 w-3 fill-current" /> {item.attraction.rating.toFixed(1)}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-white px-5 py-4 text-sm text-muted-foreground">
            No additional provider-backed recommendations are available beyond today’s route.
          </p>
        )}
      </section>

      <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_270px]">
        <section className="min-w-0">
          <h4 className="px-1 font-display text-2xl">Today, in motion</h4>
          <div className="relative mt-6">
            <span
              className="absolute top-2 bottom-2 left-[78px] hidden w-px bg-teal/25 sm:block"
              aria-hidden
            />
            {places.map((item, index) => (
              <div key={item.attraction.providerPlaceId}>
                {(() => {
                  const hasProviderImage = providerImageIds.has(item.attraction.providerPlaceId!);
                  return (
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        duration: reduceMotion ? 0 : 0.4,
                        delay: reduceMotion ? 0 : index * 0.08,
                      }}
                      className="relative grid gap-3 pb-5 sm:grid-cols-[64px_1fr] sm:gap-8"
                    >
                      <div className="pt-3 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground">
                          {item.slot === "morning"
                            ? "09:00"
                            : item.slot === "afternoon"
                              ? "13:00"
                              : "18:00"}
                        </p>
                        {estimatedWalkMinutes && (
                          <p className="mt-2">≈ {estimatedWalkMinutes} min walk</p>
                        )}
                      </div>
                      <span className="absolute top-5 left-[74px] hidden h-2.5 w-2.5 rounded-full border-2 border-[#f7f3ed] bg-teal sm:block" />
                      <article
                        className={`grid min-w-0 gap-4 rounded-[20px] bg-white p-3 shadow-[0_18px_48px_-38px_rgba(6,37,48,.55)] sm:items-center ${hasProviderImage ? "sm:grid-cols-[120px_minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_auto]"}`}
                      >
                        {hasProviderImage && (
                          <SafeImage
                            src={item.attraction.image}
                            fallbacks={fallbackUrls}
                            alt={item.attraction.name}
                            className="h-28 w-full rounded-2xl object-cover"
                          />
                        )}
                        <div className="min-w-0 py-1">
                          <p className="text-[9px] font-semibold tracking-[.14em] text-teal uppercase">
                            {item.tags[0]}
                          </p>
                          <h5 className="mt-1 font-display text-xl">{item.attraction.name}</h5>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {item.hook}
                          </p>
                        </div>
                        <div className="flex gap-2 sm:flex-col">
                          {item.attraction.providerUrl && (
                            <a
                              href={item.attraction.providerUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${item.attraction.name} on the map`}
                              className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-ink hover:text-white"
                            >
                              <Navigation className="h-4 w-4" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleSaved(item.attraction.providerPlaceId!)}
                            aria-label={`${savedIds.has(item.attraction.providerPlaceId!) ? "Remove" : "Save"} ${item.attraction.name}`}
                            className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-ink hover:text-white"
                          >
                            {savedIds.has(item.attraction.providerPlaceId!) ? (
                              <BookmarkCheck className="h-4 w-4" />
                            ) : (
                              <Bookmark className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </article>
                    </motion.div>
                  );
                })()}
                {index === 0 && secret && (
                  <div className="mb-5 ml-0 rounded-[20px] bg-[#fff4e5] p-5 sm:ml-24">
                    <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[.12em] text-sunset-foreground uppercase">
                      <Sparkles className="h-3 w-3" /> Local secret
                    </p>
                    <p className="mt-2 text-sm">
                      Look out for {secret.attraction.name} nearby — {secret.hook}
                    </p>
                  </div>
                )}
                {index === 1 && (
                  <div className="mb-5 ml-0 rounded-[20px] border border-teal/15 bg-[#edf7f7] p-5 sm:ml-24">
                    <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[.12em] text-teal uppercase">
                      <Lightbulb className="h-3.5 w-3.5" /> ASTERA note
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{note}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {restaurant && (
            <div
              className={`mt-2 ml-0 grid overflow-hidden rounded-[20px] bg-white shadow-[0_18px_48px_-38px_rgba(6,37,48,.55)] sm:ml-24 ${restaurantHasProviderImage ? "sm:grid-cols-[130px_1fr]" : "grid-cols-1"}`}
            >
              {restaurantHasProviderImage && (
                <SafeImage
                  src={day.restaurantDetails?.image}
                  fallbacks={fallbackUrls}
                  alt={restaurant.name}
                  className="h-40 w-full object-cover sm:h-full"
                />
              )}
              <div className="p-4">
                <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[.12em] text-teal uppercase">
                  <Utensils className="h-3 w-3" /> Local table
                </p>
                <h5 className="mt-2 font-display text-xl">{restaurant.name}</h5>
                <p className="mt-1 text-xs text-muted-foreground">
                  {restaurant.cuisine} · {restaurant.walkMinutes} min walk
                </p>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">
          {showMood && (
            <DestinationMood
              city={day.city}
              country={stop?.country ?? ""}
              days={cityDays}
              dayNumber={day.day}
              excludedImages={excludedMoodImages}
            />
          )}
          {chips.length > 0 && (
            <section className="rounded-[20px] border border-border/55 bg-white p-5 shadow-[0_20px_55px_-44px_rgba(6,37,48,.38)]">
              <h4 className="flex items-center gap-2 font-display text-lg"><span className="text-[#e5a12a]">✨</span> Story chips</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-secondary px-3 py-1.5 text-[10px] font-medium"
                  >
                    <span aria-hidden>{chip === "Morning light" ? "🌤️" : chip === "Evening mood" ? "🌅" : chip === "Local flavour" ? "☕" : chip === "Best photo" ? "📷" : chip === "Slow moment" ? "🌿" : "✨"}</span> {chip}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs font-medium text-ink/70">→ &nbsp;More chips</p>
            </section>
          )}
          {supporting.length > 1 && (
            <section className="rounded-[20px] border border-border/55 bg-white p-5 shadow-[0_20px_55px_-44px_rgba(6,37,48,.38)]">
              <p className="flex items-center gap-2 font-display text-lg">
                <Footprints className="h-4 w-4 text-teal" /> On the way
              </p>
              <div className="relative mt-5 space-y-5 border-l border-dashed border-ink/30 pl-5">
                {supporting.slice(0, 3).map((item, itemIndex) => (
                  <div
                    key={item.attraction.providerPlaceId}
                    className="relative"
                  >
                    <span className="absolute top-1 -left-[24px] h-2 w-2 rounded-full bg-ink ring-4 ring-white" />
                    <p className="font-semibold text-sm"><span aria-hidden>{itemIndex === 0 ? "🌿" : itemIndex === 1 ? "☕" : "🎨"}</span> {item.attraction.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {item.hook || item.attraction.location}
                    </p>
                  </div>
                ))}
              </div>
              {supporting[0]?.attraction.providerUrl && <a href={supporting[0].attraction.providerUrl} target="_blank" rel="noreferrer" className="mt-5 block text-xs font-medium text-ink/70">→ &nbsp;See on map</a>}
            </section>
          )}
          <section className="overflow-hidden rounded-[20px] border border-border/55 bg-white p-5 shadow-[0_20px_55px_-42px_rgba(6,37,48,.45)]">
            <h4 className="font-display text-xl">Today’s Memory</h4>
            <SafeImage src={memoryPlace?.image} fallbacks={fallbackUrls} alt={`${memoryPlace?.name ?? day.city} in ${day.city}`} className="mt-4 aspect-[1.55] w-full rounded-2xl object-cover" />
            <blockquote className="mt-4 text-sm leading-relaxed text-ink/75">{memory}</blockquote>
            <button type="button" onClick={() => toggleSaved(memoryPlace?.providerPlaceId ?? hero.attraction.providerPlaceId!)} className="mt-5 flex items-center gap-2 text-xs font-medium text-ink/70 hover:text-teal">
              <Heart className="h-4 w-4" /> Save this memory
            </button>
          </section>
          {dailyTotalPerPerson != null && (
            <section className="flex items-center justify-center gap-3 rounded-[20px] border border-border/55 bg-white px-5 py-4 shadow-[0_20px_55px_-44px_rgba(6,37,48,.35)]">
              <WalletCards className="h-5 w-5 text-ink/65" />
              <div><p className="text-[10px] text-muted-foreground">Daily total</p><p className="font-semibold">{new Intl.NumberFormat("en", { style: "currency", currency: preferences.currency, maximumFractionDigits: 0 }).format(dailyTotalPerPerson)} / person</p></div>
            </section>
          )}
        </aside>
      </div>

      <dl className="mt-4 grid overflow-hidden rounded-[20px] border border-border/50 bg-white text-center shadow-[0_18px_45px_-38px_rgba(6,37,48,.45)] sm:grid-cols-2 lg:grid-cols-4">
        {walking && (
          <div className="border-b border-border/50 p-4 sm:border-r lg:border-b-0">
            <dt className="text-[10px] font-semibold tracking-[.12em] text-muted-foreground uppercase">
              Walking today
            </dt>
            <dd className="mt-1 font-display text-lg">{walking.km.toFixed(1)} km</dd>
          </div>
        )}
        <div className="border-b border-border/50 p-4 lg:border-r lg:border-b-0">
          <dt className="text-[10px] font-semibold tracking-[.12em] text-muted-foreground uppercase">
            Live places
          </dt>
          <dd className="mt-1 font-display text-lg">{places.length}</dd>
        </div>
        <div className="border-b border-border/50 p-4 sm:border-r sm:border-b-0">
          <dt className="text-[10px] font-semibold tracking-[.12em] text-muted-foreground uppercase">
            Local tables
          </dt>
          <dd className="mt-1 font-display text-lg">{restaurant ? 1 : 0}</dd>
        </div>
        <div className="p-4">
          <dt className="text-[10px] font-semibold tracking-[.12em] text-muted-foreground uppercase">
            Forecast
          </dt>
          <dd className="mt-1 font-display text-lg">
            {stop?.weather.quality.source !== "mock"
              ? `${stop?.weather.tempC}°C · ${stop?.weather.summary}`
              : "Not available"}
          </dd>
        </div>
      </dl>
    </motion.article>
  );
}
