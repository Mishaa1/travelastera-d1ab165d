import { useCallback, useEffect, useState } from "react";

import { savedSearchesStore, subscribeToStorage, type SavedSearch } from "@/lib/storage";
import type { TripPreferences } from "@/lib/types";

/** Re-runnable searches, so constraints never have to be retyped. */
export function useSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    setSearches(savedSearchesStore.all());
    return subscribeToStorage(() => setSearches(savedSearchesStore.all()));
  }, []);

  const save = useCallback((preferences: TripPreferences, label: string) => {
    setSearches(savedSearchesStore.save(preferences, label));
  }, []);

  const remove = useCallback((id: string) => setSearches(savedSearchesStore.remove(id)), []);

  return { searches, save, remove };
}
