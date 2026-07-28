import { useCallback, useEffect, useState } from "react";

import { favouritesStore, subscribeToStorage } from "@/lib/storage";
import type { FavouriteItem } from "@/lib/types";

/** Local bookmarks for attractions, restaurants and day trips. */
export function useFavourites() {
  const [items, setItems] = useState<FavouriteItem[]>([]);

  useEffect(() => {
    setItems(favouritesStore.all());
    return subscribeToStorage(() => setItems(favouritesStore.all()));
  }, []);

  const toggle = useCallback((item: Omit<FavouriteItem, "savedAt">) => {
    const wasSaved = favouritesStore.has(item.id);
    setItems(favouritesStore.toggle(item));
    return !wasSaved;
  }, []);

  const remove = useCallback((id: string) => setItems(favouritesStore.remove(id)), []);
  const isFavourite = useCallback((id: string) => items.some((item) => item.id === id), [items]);

  return { items, toggle, remove, isFavourite };
}
