import { createFileRoute } from "@tanstack/react-router";
import { authStore } from "@/lib/auth/store.server";
import { clearSessionCookie, cookieValue, sameOrigin, SESSION_COOKIE } from "@/lib/auth/session.server";

export const Route = createFileRoute("/api/auth/logout")({ server: { handlers: { POST: async ({ request }) => {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  await authStore().deleteSession(cookieValue(request, SESSION_COOKIE));
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(request) } });
} } } });
