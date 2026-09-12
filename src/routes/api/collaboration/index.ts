import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { collaborationStore } from "@/lib/collaboration/store.server";
import type { TripPreferences } from "@/lib/types";

const createSchema = z.object({
  organizerName: z.string().trim().min(1).max(80),
  travellerNames: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  basePreferences: z.record(z.unknown()),
});

export const Route = createFileRoute("/api/collaboration/")({
  server: { handlers: { POST: async ({ request }) => {
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Enter an organiser and at least one traveller." }, { status: 400 });
    const created = await collaborationStore().create(parsed.data.organizerName, parsed.data.travellerNames, parsed.data.basePreferences as unknown as TripPreferences);
    return Response.json({ token: created.token }, { status: 201 });
  } } },
});
