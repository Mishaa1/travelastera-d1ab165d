import type { SharedTripView, TravellerProfile, GroupVote } from "@/lib/collaboration/types";
import type { TripPreferences } from "@/lib/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Collaboration request failed");
  return body as T;
}
export const collaborationApi = {
  create: (organizerName: string, travellerNames: string[], basePreferences: TripPreferences) => request<{ token: string }>("/api/collaboration", { method: "POST", body: JSON.stringify({ organizerName, travellerNames, basePreferences }) }),
  get: (token: string) => request<SharedTripView>(`/api/collaboration/${encodeURIComponent(token)}`),
  updatePreferences: (token: string, preferences: TripPreferences) => request<SharedTripView>(`/api/collaboration/${encodeURIComponent(token)}`, { method: "PATCH", body: JSON.stringify({ action: "preferences", preferences }) }),
  submitResponse: (token: string, response: TravellerProfile) => request<SharedTripView>(`/api/collaboration/${encodeURIComponent(token)}`, { method: "PATCH", body: JSON.stringify({ action: "response", response }) }),
  vote: (token: string, travellerId: string, routeId: string, value: GroupVote) => request<SharedTripView>(`/api/collaboration/${encodeURIComponent(token)}`, { method: "PATCH", body: JSON.stringify({ action: "vote", travellerId, routeId, value }) }),
};
