import { useCallback, useEffect, useState } from "react";

import { savedTripsStore, subscribeToStorage } from "@/lib/storage";
import type { SavedTrip, TripRoute } from "@/lib/types";

export function useSavedTrips() {
  const [trips, setTrips] = useState<SavedTrip[]>([]);

  useEffect(() => {
    setTrips(savedTripsStore.all());
    return subscribeToStorage(() => setTrips(savedTripsStore.all()));
  }, []);

  const toggle = useCallback((route: TripRoute) => {
    const exists = savedTripsStore.has(route.id);
    setTrips(exists ? savedTripsStore.remove(route.id) : savedTripsStore.save(route));
    return !exists;
  }, []);

  const remove = useCallback((id: string) => setTrips(savedTripsStore.remove(id)), []);
  const rename = useCallback((id: string, name: string) => setTrips(savedTripsStore.rename(id, name)), []);
  const isSaved = useCallback((id: string) => trips.some((trip) => trip.id === id), [trips]);

  return { trips, toggle, remove, rename, isSaved };
}
