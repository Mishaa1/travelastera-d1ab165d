import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { combineGroupPreferences } from "@/lib/collaboration/aggregate";
import { collaborationStore } from "@/lib/collaboration/store.server";
import type { TravellerProfile } from "@/lib/collaboration/types";
import type { TripPreferences } from "@/lib/types";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preferences"), preferences: z.record(z.unknown()) }),
  z.object({ action: z.literal("response"), response: z.record(z.unknown()) }),
  z.object({ action: z.literal("vote"), travellerId: z.string().uuid(), routeId: z.string().min(1).max(200), value: z.enum(["love", "okay", "not-for-me"]) }),
]);

const view = (trip: NonNullable<Awaited<ReturnType<ReturnType<typeof collaborationStore>["get"]>>>) => {
  const { tokenHash: _private, ...safe } = trip;
  return { ...safe, profile: combineGroupPreferences(trip) };
};

export const Route = createFileRoute("/api/collaboration/$token")({
  server: { handlers: {
    GET: async ({ params }) => {
      const trip = await collaborationStore().get(params.token);
      return trip ? Response.json(view(trip)) : Response.json({ error: "Invite not found." }, { status: 404 });
    },
    PATCH: async ({ request, params }) => {
      const parsed = actionSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return Response.json({ error: "Invalid collaboration update." }, { status: 400 });
      const data = parsed.data;
      const trip = data.action === "preferences"
        ? await collaborationStore().updatePreferences(params.token, data.preferences as unknown as TripPreferences)
        : data.action === "response"
          ? await collaborationStore().saveResponse(params.token, data.response as unknown as TravellerProfile)
          : await collaborationStore().saveVote(params.token, { travellerId: data.travellerId, routeId: data.routeId, value: data.value });
      return trip ? Response.json(view(trip)) : Response.json({ error: "Invite or traveller not found." }, { status: 404 });
    },
  } },
});
