import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authStore } from "@/lib/auth/store.server";
import { sameOrigin, sessionCookie } from "@/lib/auth/session.server";

const schema = z.object({ email: z.string().email(), password: z.string().min(1).max(128) });
export const Route = createFileRoute("/api/auth/login")({ server: { handlers: { POST: async ({ request }) => {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter your email and password." }, { status: 400 });
  const user = await authStore().login(parsed.data.email, parsed.data.password);
  if (!user) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  const token = await authStore().createSession(user.id);
  return Response.json({ user }, { headers: { "Set-Cookie": sessionCookie(token, request) } });
} } } });
