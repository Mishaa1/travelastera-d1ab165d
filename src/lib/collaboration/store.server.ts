import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { SharedTrip, StoredVote, TravellerProfile } from "./types";
import type { TripPreferences } from "@/lib/types";

interface CollaborationData { version: 1; trips: Record<string, SharedTrip> }
const emptyData = (): CollaborationData => ({ version: 1, trips: {} });
export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

export class FileCollaborationStore {
  private readonly path: string;
  constructor(path = `${process.cwd()}/.astera/collaboration-store.json`) { this.path = path; }

  private async transaction<T>(fn: (data: CollaborationData) => T | Promise<T>): Promise<T> {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(path.dirname(this.path), { recursive: true });
    const lockPath = `${this.path}.lock`;
    let lock: Awaited<ReturnType<typeof fs.open>> | undefined;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      try { lock = await fs.open(lockPath, "wx"); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    if (!lock) throw new Error("Timed out acquiring collaboration-store lock");
    try {
      let data = emptyData();
      try { data = JSON.parse(await fs.readFile(this.path, "utf8")) as CollaborationData; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      const result = await fn(data);
      const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
      await fs.rename(temporary, this.path);
      return result;
    } finally {
      await lock.close();
      await fs.unlink(lockPath).catch(() => undefined);
    }
  }

  async create(organizerName: string, names: string[], basePreferences: TripPreferences) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashInviteToken(token);
    const now = new Date().toISOString();
    const travellers = names.map((name) => ({ id: randomUUID(), name: name.trim() })).filter((item) => item.name);
    const trip: SharedTrip = {
      id: randomUUID(), tokenHash, organizerName: organizerName.trim(), travellers,
      basePreferences, responses: {}, votes: {}, createdAt: now, updatedAt: now,
    };
    await this.transaction((data) => { data.trips[tokenHash] = trip; });
    return { token, trip };
  }

  get(token: string) { return this.transaction((data) => data.trips[hashInviteToken(token)] ?? null); }

  updatePreferences(token: string, preferences: TripPreferences) {
    return this.transaction((data) => {
      const trip = data.trips[hashInviteToken(token)];
      if (!trip) return null;
      trip.basePreferences = preferences;
      trip.updatedAt = new Date().toISOString();
      return trip;
    });
  }

  saveResponse(token: string, response: TravellerProfile) {
    return this.transaction((data) => {
      const trip = data.trips[hashInviteToken(token)];
      if (!trip || !trip.travellers.some((traveller) => traveller.id === response.travellerId)) return null;
      const traveller = trip.travellers.find((item) => item.id === response.travellerId)!;
      traveller.name = response.name.trim() || traveller.name;
      trip.responses[response.travellerId] = { ...response, name: traveller.name, submittedAt: new Date().toISOString() };
      trip.updatedAt = new Date().toISOString();
      return trip;
    });
  }

  saveVote(token: string, vote: Omit<StoredVote, "updatedAt">) {
    return this.transaction((data) => {
      const trip = data.trips[hashInviteToken(token)];
      if (!trip || !trip.travellers.some((traveller) => traveller.id === vote.travellerId)) return null;
      const key = `${vote.routeId}:${vote.travellerId}`;
      trip.votes[key] = { ...vote, updatedAt: new Date().toISOString() };
      trip.updatedAt = new Date().toISOString();
      return trip;
    });
  }
}

let singleton: FileCollaborationStore | undefined;
export function collaborationStore() { return singleton ??= new FileCollaborationStore(); }
