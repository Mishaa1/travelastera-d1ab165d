import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authStore } from "@/lib/auth/store.server";
import { sameOrigin, sessionCookie } from "@/lib/auth/session.server";

const schema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email().max(180), password: z.string().min(8).max(128) });
export const Route = createFileRoute("/api/auth/signup")({ server: { handlers: { POST: async ({ request }) => {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid name, email and password of at least 8 characters." }, { status: 400 });
  const user = await authStore().signup(parsed.data.name, parsed.data.email, parsed.data.password);
  if (!user) return Response.json({ error: "An account already exists for this email." }, { status: 409 });
  const token = await authStore().createSession(user.id);
  return Response.json({ user }, { status: 201, headers: { "Set-Cookie": sessionCookie(token, request) } });
} } } });
