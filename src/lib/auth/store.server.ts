import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PublicUser, TravelProfile } from "./types";

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 30;

interface StoredUser extends PublicUser {
  passwordHash?: string;
  oauthSubject?: string;
  createdAt: string;
  updatedAt: string;
}
interface StoredSession { userId: string; expiresAt: string }
interface AuthData { version: 1; users: Record<string, StoredUser>; sessions: Record<string, StoredSession> }
const empty = (): AuthData => ({ version: 1, users: {}, sessions: {} });
const defaultProfile = (): TravelProfile => ({ interests: [], pace: "balanced", stayStyle: "mid-range", diet: "No preference", completed: false });
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const publicUser = ({ passwordHash: _password, oauthSubject: _subject, createdAt: _created, updatedAt: _updated, ...user }: StoredUser): PublicUser => user;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}
async function verifyPassword(password: string, encoded?: string) {
  if (!encoded) return false;
  const [algorithm, saltValue, hashValue] = encoded.split(":");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, "base64url");
  const actual = (await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class FileAuthStore {
  private readonly path: string;
  constructor(path = `${process.cwd()}/.astera/auth-store.json`) { this.path = path; }
  private async transaction<T>(fn: (data: AuthData) => T | Promise<T>) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(path.dirname(this.path), { recursive: true });
    const lockPath = `${this.path}.lock`;
    let lock: Awaited<ReturnType<typeof fs.open>> | undefined;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { lock = await fs.open(lockPath, "wx"); break; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; await new Promise((resolve) => setTimeout(resolve, 20)); }
    }
    if (!lock) throw new Error("Auth store is busy. Please retry.");
    try {
      let data = empty();
      try { data = JSON.parse(await fs.readFile(this.path, "utf8")) as AuthData; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      const now = Date.now();
      for (const [key, session] of Object.entries(data.sessions)) if (Date.parse(session.expiresAt) <= now) delete data.sessions[key];
      const result = await fn(data);
      const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
      await fs.rename(temporary, this.path);
      return result;
    } finally { await lock.close(); await fs.unlink(lockPath).catch(() => undefined); }
  }
  async signup(name: string, email: string, password: string) {
    return this.transaction(async (data) => {
      const normalized = normalizeEmail(email);
      if (Object.values(data.users).some((user) => user.email === normalized)) return null;
      const now = new Date().toISOString();
      const user: StoredUser = { id: randomUUID(), name: name.trim(), email: normalized, provider: "email", profile: defaultProfile(), passwordHash: await hashPassword(password), createdAt: now, updatedAt: now };
      data.users[user.id] = user;
      return publicUser(user);
    });
  }
  async login(email: string, password: string) {
    const found = await this.transaction((data) => Object.values(data.users).find((user) => user.email === normalizeEmail(email)) ?? null);
    return found && await verifyPassword(password, found.passwordHash) ? publicUser(found) : null;
  }
  async upsertOAuth(input: { provider: "google" | "apple"; subject: string; email: string; name: string; avatarUrl?: string }) {
    return this.transaction((data) => {
      const email = normalizeEmail(input.email);
      let user = Object.values(data.users).find((candidate) => candidate.email === email || (candidate.provider === input.provider && candidate.oauthSubject === input.subject));
      const now = new Date().toISOString();
      if (!user) {
        user = { id: randomUUID(), name: input.name || email.split("@")[0]!, email, avatarUrl: input.avatarUrl, provider: input.provider, oauthSubject: input.subject, profile: defaultProfile(), createdAt: now, updatedAt: now };
        data.users[user.id] = user;
      } else {
        user.name ||= input.name;
        user.avatarUrl ||= input.avatarUrl;
        user.oauthSubject = input.subject;
        user.updatedAt = now;
      }
      return publicUser(user);
    });
  }
  createSession(userId: string) {
    return this.transaction((data) => {
      const token = randomBytes(32).toString("base64url");
      data.sessions[tokenHash(token)] = { userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString() };
      return token;
    });
  }
  getBySession(token?: string) {
    if (!token) return Promise.resolve(null);
    return this.transaction((data) => {
      const session = data.sessions[tokenHash(token)];
      const user = session && data.users[session.userId];
      return user ? publicUser(user) : null;
    });
  }
  deleteSession(token?: string) { return this.transaction((data) => { if (token) delete data.sessions[tokenHash(token)]; }); }
  updateProfile(userId: string, profile: TravelProfile) {
    return this.transaction((data) => {
      const user = data.users[userId];
      if (!user) return null;
      user.profile = { ...profile, completed: true };
      user.updatedAt = new Date().toISOString();
      return publicUser(user);
    });
  }
}

let instance: FileAuthStore | undefined;
export function authStore() { return instance ??= new FileAuthStore(); }
