import type { PublicUser, TravelProfile } from "@/lib/auth/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin", headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Authentication request failed.");
  return body;
}
export const authApi = {
  me: () => request<{ user: PublicUser | null }>("/api/auth/me"),
  signup: (data: { name: string; email: string; password: string }) => request<{ user: PublicUser }>("/api/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) => request<{ user: PublicUser }>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST", body: "{}" }),
  profile: (profile: TravelProfile) => request<{ user: PublicUser }>("/api/auth/me", { method: "PATCH", body: JSON.stringify(profile) }),
};
