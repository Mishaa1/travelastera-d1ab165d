# Add provider secrets and wire them into ASTERA

## Goal
Securely store the five provider credentials the user already has, document them in `.env.example`, and connect each one to the existing ASTERA architecture without changing the product's UX or information architecture.

## Phase 1 — Secure secret storage
Use Lovable's secret tools to add the credentials as runtime environment variables. Each secret is read only inside server functions / server routes, never exposed to the browser.

| Provider | Secret name(s) | Where it is used |
| --- | --- | --- |
| Duffel | `DUFFEL_ACCESS_TOKEN` | `src/lib/flights/duffel.server.ts` / `src/routes/api/flights/search.ts` |
| Hotelbeds | `HOTELBEDS_API_KEY`, `HOTELBEDS_API_SECRET` | `src/lib/hotels/hotelbeds.server.ts` / `src/routes/api/hotels/search.ts` |
| Google Places | `GOOGLE_PLACES_API_KEY` | New server helper for place photos and details |
| OpenRouter | `OPENROUTER_API_KEY` | New server helper for AI-generated reasoning / enrichment |
| Wikimedia | `WIKIMEDIA_USER_AGENT` (optional key if available) | Image enrichment fallback |

## Phase 2 — Update `.env.example`
Add the new keys to `.env.example` with placeholder comments so future developers know the expected shape, while keeping real values out of the repo.

## Phase 3 — Wire each provider into the app
1. **Duffel** — already integrated. Verify the token is live and the `/api/flights/search` route returns offers.
2. **Hotelbeds** — the provider file exists but may be stubbed. Complete the search implementation and connect it to `/api/hotels/search`.
3. **Google Places** — create a small server-only helper that fetches a place photo / detail by name, used to enrich attraction and restaurant cards.
4. **OpenRouter** — create a server-only helper for one-shot AI calls (e.g., generating the "Why ASTERA picked this" narrative or local tips). Keep calls behind `createServerFn` or a server route.
5. **Wikimedia** — create a server-only helper that searches Commons for a landmark/city image fallback when the primary image source is missing.

## Phase 4 — Validation
- Run TypeScript checks to confirm all new server helpers compile.
- Spot-test each endpoint with a lightweight `code--exec` curl or server-function call.
- Confirm no secrets appear in client bundles by inspecting that all keys are read only inside `.server.ts`, server routes, or `createServerFn` handlers.

## Out of scope
- Redesigning UI or information architecture.
- Replacing existing mock/estimated fallbacks entirely; live APIs will be used when configured and fall back gracefully when not.
- Adding new user-facing pages.
