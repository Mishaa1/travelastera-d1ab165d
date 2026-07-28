import type { SavedTrip, TripPreferences, TripRoute } from "@/lib/types";

const KEYS = {
  saved: "safara.saved-trips.v1",
  draft: "safara.planner-draft.v1",
  lastResults: "safara.last-results.v1",
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
    const next = existing >= 0 ? trips.map((t, i) => (i === existing ? entry : t)) : [entry, ...trips];
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

export function findRouteById(id: string): TripRoute | undefined {
  return (
    resultsStore.get().find((route) => route.id === id) ??
    savedTripsStore.all().find((trip) => trip.route.id === id)?.route
  );
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
