import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFavourites } from "@/hooks/useFavourites";
import type { FavouriteItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FavouriteButtonProps {
  item: Omit<FavouriteItem, "savedAt">;
  className?: string;
  variant?: "overlay" | "inline";
}

/** Bookmarks any experience so it survives a page reload. */
export function FavouriteButton({ item, className, variant = "overlay" }: FavouriteButtonProps) {
  const { toggle, isFavourite } = useFavourites();
  const saved = isFavourite(item.id);

  return (
    <Button
      type="button"
      size="icon"
      variant={variant === "overlay" ? "glass" : "outline"}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${item.title} from favourites` : `Add ${item.title} to favourites`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(item);
      }}
      className={cn("rounded-full", className)}
    >
      <Heart className={cn("transition-colors", saved && "fill-destructive text-destructive")} />
    </Button>
  );
}
