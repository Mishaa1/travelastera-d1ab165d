import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authStore } from "@/lib/auth/store.server";
import { currentUser, sameOrigin } from "@/lib/auth/session.server";

const profileSchema = z.object({ interests: z.array(z.string().min(1).max(40)).max(12), pace: z.enum(["relaxed", "balanced", "fast"]), stayStyle: z.enum(["budget", "mid-range", "luxury"]), diet: z.string().min(1).max(50), completed: z.boolean().optional() });
export const Route = createFileRoute("/api/auth/me")({ server: { handlers: {
  GET: async ({ request }) => Response.json({ user: await currentUser(request) }),
  PATCH: async ({ request }) => {
    if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const user = await currentUser(request);
    if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
    const parsed = profileSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Choose valid travel preferences." }, { status: 400 });
    return Response.json({ user: await authStore().updateProfile(user.id, { ...parsed.data, completed: true }) });
  },
} } });
