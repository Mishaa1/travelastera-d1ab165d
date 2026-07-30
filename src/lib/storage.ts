import type { FavouriteItem, SavedTrip, TripPreferences, TripRoute } from "@/lib/types";

const KEYS = {
  saved: "safara.saved-trips.v1",
  draft: "safara.planner-draft.v1",
  lastResults: "safara.last-results.v1",
  favourites: "safara.favourites.v1",
  recentPlaces: "safara.recent-places.v1",
  searches: "safara.saved-searches.v1",
} as const;

const isBrowser = () => typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("safara:storage", { detail: key }));
  } catch {
    /* quota or private mode — non fatal */
  }
}

export const savedTripsStore = {
  key: KEYS.saved,
  all(): SavedTrip[] {
    return read<SavedTrip[]>(KEYS.saved, []);
  },
  save(route: TripRoute, name?: string): SavedTrip[] {
    const trips = savedTripsStore.all();
    const existing = trips.findIndex((trip) => trip.route.id === route.id);
    const entry: SavedTrip = {
      id: route.id,
      name: name ?? route.title,
      savedAt: new Date().toISOString(),
      route,
    };
    const next =
      existing >= 0 ? trips.map((t, i) => (i === existing ? entry : t)) : [entry, ...trips];
    write(KEYS.saved, next);
    return next;
  },
  remove(id: string): SavedTrip[] {
    const next = savedTripsStore.all().filter((trip) => trip.id !== id);
    write(KEYS.saved, next);
    return next;
  },
  rename(id: string, name: string): SavedTrip[] {
    const next = savedTripsStore.all().map((trip) => (trip.id === id ? { ...trip, name } : trip));
    write(KEYS.saved, next);
    return next;
  },
  has(id: string) {
    return savedTripsStore.all().some((trip) => trip.id === id);
  },
};

export const draftStore = {
  key: KEYS.draft,
  get(): Partial<TripPreferences> | null {
    return read<Partial<TripPreferences> | null>(KEYS.draft, null);
  },
  set(value: Partial<TripPreferences>) {
    write(KEYS.draft, value);
  },
  clear() {
    if (isBrowser()) window.localStorage.removeItem(KEYS.draft);
  },
};

export const resultsStore = {
  key: KEYS.lastResults,
  get(): TripRoute[] {
    return read<TripRoute[]>(KEYS.lastResults, []);
  },
  set(routes: TripRoute[]) {
    write(KEYS.lastResults, routes);
  },
};

/** Bookmarked attractions, restaurants and day trips. */
export const favouritesStore = {
  key: KEYS.favourites,
  all(): FavouriteItem[] {
    return read<FavouriteItem[]>(KEYS.favourites, []);
  },
  has(id: string) {
    return favouritesStore.all().some((item) => item.id === id);
  },
  toggle(item: Omit<FavouriteItem, "savedAt">): FavouriteItem[] {
    const current = favouritesStore.all();
    const next = current.some((entry) => entry.id === item.id)
      ? current.filter((entry) => entry.id !== item.id)
      : [{ ...item, savedAt: new Date().toISOString() }, ...current];
    write(KEYS.favourites, next);
    return next;
  },
  remove(id: string): FavouriteItem[] {
    const next = favouritesStore.all().filter((item) => item.id !== id);
    write(KEYS.favourites, next);
    return next;
  },
};

/** Recently picked locations, newest first. */
export const recentPlacesStore = {
  key: KEYS.recentPlaces,
  all(): string[] {
    return read<string[]>(KEYS.recentPlaces, []);
  },
  push(placeId: string): string[] {
    const next = [placeId, ...recentPlacesStore.all().filter((id) => id !== placeId)].slice(0, 6);
    write(KEYS.recentPlaces, next);
    return next;
  },
};

export interface SavedSearch {
  id: string;
  label: string;
  savedAt: string;
  preferences: TripPreferences;
}

/** Re-runnable searches so travellers never retype their constraints. */
export const savedSearchesStore = {
  key: KEYS.searches,
  all(): SavedSearch[] {
    return read<SavedSearch[]>(KEYS.searches, []);
  },
  save(preferences: TripPreferences, label: string): SavedSearch[] {
    const entry: SavedSearch = {
      id: `search-${Date.now()}`,
      label,
      savedAt: new Date().toISOString(),
      preferences,
    };
    const next = [entry, ...savedSearchesStore.all()].slice(0, 12);
    write(KEYS.searches, next);
    return next;
  },
  remove(id: string): SavedSearch[] {
    const next = savedSearchesStore.all().filter((entry) => entry.id !== id);
    write(KEYS.searches, next);
    return next;
  },
};

export function findRouteById(id: string): TripRoute | undefined {
  return (
    resultsStore.get().find((route) => route.id === id) ??
    savedTripsStore.all().find((trip) => trip.route.id === id)?.route
  );
}

/** Updates a generated route wherever it already lives without creating a new record. */
export function persistRoute(route: TripRoute) {
  const results = resultsStore.get();
  if (results.some((item) => item.id === route.id)) {
    resultsStore.set(results.map((item) => (item.id === route.id ? route : item)));
  }

  const saved = savedTripsStore.all();
  const savedTrip = saved.find((trip) => trip.route.id === route.id);
  if (savedTrip) {
    write(
      KEYS.saved,
      saved.map((trip) => (trip.id === savedTrip.id ? { ...trip, route } : trip)),
    );
  }
}

export function subscribeToStorage(listener: () => void) {
  if (!isBrowser()) return () => {};
  window.addEventListener("safara:storage", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("safara:storage", listener);
    window.removeEventListener("storage", listener);
  };
}
