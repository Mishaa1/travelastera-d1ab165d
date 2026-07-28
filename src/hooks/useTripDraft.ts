import { useCallback, useEffect, useState } from "react";

import { draftStore } from "@/lib/storage";
import { SAMPLE_PREFERENCES } from "@/services/tripOptimizer";
import type { TripPreferences } from "@/lib/types";

/** Planner state with automatic local-storage persistence. */
export function useTripDraft() {
  const [preferences, setPreferences] = useState<TripPreferences>(SAMPLE_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = draftStore.get();
    if (stored) setPreferences((current) => ({ ...current, ...stored }));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) draftStore.set(preferences);
  }, [preferences, hydrated]);

  const update = useCallback(<K extends keyof TripPreferences>(key: K, value: TripPreferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    draftStore.clear();
    setPreferences(SAMPLE_PREFERENCES);
  }, []);

  return { preferences, setPreferences, update, reset, hydrated };
}
