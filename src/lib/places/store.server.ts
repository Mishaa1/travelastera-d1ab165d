export interface PlaceCacheEntry<T = unknown> {
  key: string;
  provider: "google-places";
  fetchedAt: string;
  expiresAt: string;
  sourceStatus: "success" | "zero-results";
  providerIds: string[];
  attribution: unknown[];
  value: T;
}

export interface GoogleUsageEvent {
  id: string;
  provider: "google-places";
  operation: "attraction-search" | "restaurant-search" | "details" | "photo";
  timestamp: string;
  date: string;
  month: string;
  userSessionHash: string;
  itineraryRequestId: string;
  city: string;
  httpStatus: number | null;
  cacheHit: boolean;
  providerRequestMade: boolean;
  estimatedBillableEvent: boolean;
  blockedByQuota: boolean;
  blockReason?: string;
}

export interface PlacesStoreData {
  version: 1;
  caches: Record<string, PlaceCacheEntry>;
  usage: GoogleUsageEvent[];
}

export interface GooglePlacesStore {
  transaction<T>(fn: (data: PlacesStoreData) => T | Promise<T>): Promise<T>;
}

const emptyStore = (): PlacesStoreData => ({ version: 1, caches: {}, usage: [] });

export class MemoryGooglePlacesStore implements GooglePlacesStore {
  private data = emptyStore();
  private queue = Promise.resolve();

  transaction<T>(fn: (data: PlacesStoreData) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(() => fn(this.data));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

export class FileGooglePlacesStore implements GooglePlacesStore {
  private readonly path: string;

  constructor(path = `${process.cwd()}/.astera/google-places-store.json`) {
    this.path = path;
  }

  async transaction<T>(fn: (data: PlacesStoreData) => T | Promise<T>): Promise<T> {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(path.dirname(this.path), { recursive: true });
    const lockPath = `${this.path}.lock`;
    let lock: Awaited<ReturnType<typeof fs.open>> | undefined;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      try {
        lock = await fs.open(lockPath, "wx");
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    if (!lock) throw new Error("Timed out acquiring Google Places usage-store lock");
    try {
      let data = emptyStore();
      try {
        data = JSON.parse(await fs.readFile(this.path, "utf8")) as PlacesStoreData;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const result = await fn(data);
      const temporary = `${this.path}.${process.pid}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
      await fs.rename(temporary, this.path);
      return result;
    } finally {
      await lock.close();
      await fs.unlink(lockPath).catch(() => undefined);
    }
  }
}

let singleton: GooglePlacesStore | undefined;

export function googlePlacesStore() {
  if (!singleton) singleton = new FileGooglePlacesStore();
  return singleton;
}

export function setGooglePlacesStoreForTests(store?: GooglePlacesStore) {
  singleton = store;
}
