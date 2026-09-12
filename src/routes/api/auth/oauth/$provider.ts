import { createFileRoute } from "@tanstack/react-router";
import { authStore } from "@/lib/auth/store.server";
import { authorizationUrl, exchangeOAuth, oauthConfigured } from "@/lib/auth/oauth.server";
import { sessionCookie } from "@/lib/auth/session.server";

const providerOf = (value: string) => value === "google" || value === "apple" ? value : null;
async function callback(request: Request, providerValue: string, input: URLSearchParams) {
  const provider = providerOf(providerValue);
  const origin = new URL(request.url).origin;
  if (!provider || !oauthConfigured(provider)) return Response.redirect(`${origin}/login?error=sso-not-configured`, 303);
  const code = input.get("code"); const state = input.get("state");
  if (!code || !state) return Response.redirect(`${origin}/login?error=sso-cancelled`, 303);
  try {
    let suppliedName: string | undefined;
    const appleUser = input.get("user");
    if (appleUser) { const parsed = JSON.parse(appleUser) as { name?: { firstName?: string; lastName?: string } }; suppliedName = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(" "); }
    const identity = await exchangeOAuth(provider, code, origin, state, suppliedName);
    const user = await authStore().upsertOAuth(identity);
    const token = await authStore().createSession(user.id);
    return new Response(null, { status: 303, headers: { Location: user.profile.completed ? "/account" : "/onboarding", "Set-Cookie": sessionCookie(token, request) } });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[auth:oauth]", provider, error instanceof Error ? error.message : error);
    return Response.redirect(`${origin}/login?error=sso-failed`, 303);
  }
}
export const Route = createFileRoute("/api/auth/oauth/$provider")({ server: { handlers: {
  GET: async ({ request, params }) => {
    const provider = providerOf(params.provider); const url = new URL(request.url);
    if (!provider) return Response.json({ error: "Unknown provider." }, { status: 404 });
    if (url.searchParams.has("code") || url.searchParams.has("error")) return callback(request, provider, url.searchParams);
    if (!oauthConfigured(provider)) return Response.redirect(`${url.origin}/login?error=sso-not-configured`, 303);
    return Response.redirect(authorizationUrl(provider, url.origin), 302);
  },
  POST: async ({ request, params }) => callback(request, params.provider, new URLSearchParams(await request.text())),
} } });
