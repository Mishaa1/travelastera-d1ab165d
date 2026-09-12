import { legacyTripEditParser } from "./legacyTripEditParser.server";
import { TRIP_EDIT_JSON_SCHEMA, tripEditInstructionSchema } from "./tripEditSchema";

const endpoint = "https://openrouter.ai/api/v1/chat/completions";
const clean = (value: string) => value.replace(/sk-or-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 1200);
class InvalidStructuredEditError extends Error {}

async function attempt(input: { prompt: string; route: unknown }, retry: boolean) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_PLANNER_MODEL?.trim() || "openrouter/free";
  if (!apiKey) throw new Error("OpenRouter is not configured. Add OPENROUTER_API_KEY to use Edit with AI.");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": process.env.APP_URL?.trim() || "http://localhost:3000", "X-Title": "ASTERA" },
    body: JSON.stringify({
      model, temperature: 0, provider: { require_parameters: true },
      messages: [
        { role: "system", content: "You are ASTERA's reasoning layer. Return only the required structured trip-edit JSON. Add/include/visit/stop in X means add_destination, never replacement. Requests such as show nearby countries, add a hidden town, fit a day trip, find something less touristy nearby, or surprise me regionally mean expand_route_regionally. Populate regionalPreference, maxAdditionalTravelMinutes, allowNewCountry and maxAdditionalHotelChanges from the request; use null when unspecified. Unless explicitly fixed, adding a destination sets tripDurationDeltaDays to the requested number or 1 by default. A negative budgetDelta reduces budget; positive increases it. Preserve existing itinerary days by listing their day numbers when the user requests preservation. Ask for clarification only for genuinely missing execution-critical details. Never return prose outside the schema and never invent provider facts." },
        { role: "user", content: JSON.stringify({ request: input.prompt, currentTrip: input.route, retry: retry ? "Previous output failed schema validation. Return every required field exactly." : undefined }) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "astera_trip_edit", strict: true, schema: TRIP_EDIT_JSON_SCHEMA } },
    }), signal: AbortSignal.timeout(28_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenRouter edit parsing failed (${response.status}): ${clean(raw)}`);
  let payload: { model?: string; choices?: Array<{ message?: { content?: string } }> };
  try { payload = JSON.parse(raw); } catch { throw new InvalidStructuredEditError("OpenRouter response envelope was not JSON."); }
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new InvalidStructuredEditError("OpenRouter returned no structured edit instruction.");
  let json: unknown;
  try { json = JSON.parse(content); } catch { throw new InvalidStructuredEditError("OpenRouter structured edit was invalid JSON."); }
  const validated = tripEditInstructionSchema.safeParse(json);
  if (!validated.success) throw new InvalidStructuredEditError(validated.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  return { instruction: validated.data, provider: "OpenRouter", configuredModel: model, actualModel: payload.model ?? model, parserSource: "structured-output" as const };
}

export async function parseTripEditWithOpenRouter(input: { prompt: string; route: unknown }) {
  let validationError: InvalidStructuredEditError | null = null;
  for (let index = 0; index < 2; index += 1) {
    try { return await attempt(input, index === 1); }
    catch (error) {
      if (!(error instanceof InvalidStructuredEditError)) throw error;
      validationError = error;
      if (process.env.NODE_ENV !== "production") console.error(`[trip-edit:validation-${index + 1}]`, error.message);
    }
  }
  if (process.env.NODE_ENV !== "production") console.warn("[trip-edit:legacy-fallback]", validationError?.message);
  return { instruction: legacyTripEditParser(input.prompt), provider: "ASTERA legacy parser", configuredModel: process.env.OPENROUTER_PLANNER_MODEL?.trim() || "openrouter/free", actualModel: null, parserSource: "legacy-fallback" as const };
}
