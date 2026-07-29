import { Footprints, Sparkles, Star, UtensilsCrossed } from "lucide-react";

import { ExperienceImage } from "@/components/common/ExperienceImage";
import { FavouriteButton } from "@/components/discover/FavouriteButton";

import {
  DIET_LABEL,
  priceLevelLabel,
  type Restaurant,
} from "@/services/experienceService";
import type { TripPreferences } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RestaurantCardProps {
  restaurant: Restaurant;
  preferences: TripPreferences;
}

/** Restaurant pick with visible dietary compatibility. */
export function RestaurantCard({ restaurant, preferences }: RestaurantCardProps) {
  const wanted = preferences.diets ?? [];

  return (
    <article className="card-lift group flex gap-4 overflow-hidden rounded-3xl border border-border bg-card p-3 shadow-soft">
      <ExperienceImage
        src={restaurant.image}
        alt={`${restaurant.name}, ${restaurant.cuisine} in ${restaurant.city}`}
        width={320}
        height={320}
        ratioClassName="h-28 w-28 shrink-0 rounded-2xl sm:h-32 sm:w-32"
      />


      <div className="min-w-0 flex-1 space-y-2 py-1 pr-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="truncate font-display text-lg font-semibold">{restaurant.name}</h4>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
                {restaurant.cuisine}
              </span>
              <span aria-label={`Price level ${restaurant.priceLevel} of 4`}>
                {priceLevelLabel(restaurant.priceLevel)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-current text-sunset" aria-hidden />
                {restaurant.rating.toFixed(1)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Footprints className="h-3.5 w-3.5" aria-hidden />
                {restaurant.walkMinutes} min from {restaurant.area}
              </span>
            </p>
          </div>
          <FavouriteButton
            variant="inline"
            item={{
              id: restaurant.id,
              kind: "restaurant",
              title: restaurant.name,
              subtitle: `${restaurant.cuisine} · ${restaurant.city}`,
              image: restaurant.image,
              meta: priceLevelLabel(restaurant.priceLevel),
            }}
          />
        </div>

        <p className="text-sm">
          <span className="text-muted-foreground">Order: </span>
          {restaurant.signatureDish}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {restaurant.diets.map((diet) => {
            const matched = wanted.includes(diet);
            return (
              <span
                key={diet}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  matched
                    ? "bg-emerald/15 text-emerald"
                    : "border border-border text-muted-foreground",
                )}
              >
                {DIET_LABEL[diet]}
              </span>
            );
          })}
        </div>

        <p className="flex gap-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          {restaurant.why}
        </p>
      </div>
    </article>
  );
}
