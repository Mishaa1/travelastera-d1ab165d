import {
  PLANNER_JSON_SCHEMA,
  plannerResponseSchema,
  type PlannerRequest,
  type PlannerResponse,
} from "@/lib/planner/schema";

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";
const TIMEOUT_MS = 28_000;

export interface PlannerDiagnostics {
  httpStatus: number | null;
  configuredModel: string;
  actualModel: string | null;
  responseShape: string[];
  extraction: "success" | "failed" | "not-attempted";
  parseSuccess: boolean;
  schemaErrors: string[];
  timedOut: boolean;
  attempts: number;
  errorBody?: string;
}

export class PlannerProviderError extends Error {
  constructor(
    message: string,
    readonly diagnostics: PlannerDiagnostics,
    readonly status = 502,
  ) {
    super(message);
    this.name = "PlannerProviderError";
  }
}

const apiKey = () => process.env.OPENROUTER_API_KEY?.trim() ?? "";
const configuredModel = () => process.env.OPENROUTER_PLANNER_MODEL?.trim() || DEFAULT_MODEL;

const cleanText = (value: string) => {
  const redacted = value
    .replace(/sk-or-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
  try {
    const payload = JSON.parse(redacted) as Record<string, unknown>;
    delete payload.user_id;
    return JSON.stringify(payload).slice(0, 1_500);
  } catch {
    return redacted.slice(0, 1_500);
  }
};

function providerFailureMessage(payload: unknown, status: number) {
  const error =
    payload && typeof payload === "object"
      ? (
          payload as {
            error?: { message?: string; metadata?: { headers?: Record<string, string> } };
          }
        ).error
      : undefined;
  if (status === 429) {
    const reset = Number(error?.metadata?.headers?.["X-RateLimit-Reset"]);
    const resetCopy = Number.isFinite(reset)
      ? ` Reset: ${new Date(reset).toLocaleString("en-GB", {
          timeZone: "Europe/Paris",
          dateStyle: "medium",
          timeStyle: "short",
        })} Paris time.`
      : "";
    return `OpenRouter's free daily request limit has been reached.${resetCopy}`;
  }
  return error?.message
    ? `OpenRouter planning failed (${status}): ${cleanText(error.message)}`
    : `OpenRouter planning failed (${status})`;
}

const extractJson = (content: string): unknown => {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(trimmed);
};

const responseShape = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return [typeof payload];
  const root = payload as Record<string, unknown>;
  const choice = Array.isArray(root.choices) ? root.choices[0] : undefined;
  const message =
    choice && typeof choice === "object" ? (choice as Record<string, unknown>).message : undefined;
  return [
    `root:${Object.keys(root)
      .filter((key) => key !== "user_id")
      .sort()
      .join(",")}`,
    `choice:${
      choice && typeof choice === "object"
        ? Object.keys(choice as Record<string, unknown>)
            .sort()
            .join(",")
        : "none"
    }`,
    `message:${
      message && typeof message === "object"
        ? Object.keys(message as Record<string, unknown>)
            .sort()
            .join(",")
        : "none"
    }`,
  ];
};

const baseDiagnostics = (): PlannerDiagnostics => ({
  httpStatus: null,
  configuredModel: configuredModel(),
  actualModel: null,
  responseShape: [],
  extraction: "not-attempted",
  parseSuccess: false,
  schemaErrors: [],
  timedOut: false,
  attempts: 0,
});

function requestBody(input: PlannerRequest, retry: boolean) {
  return {
    model: configuredModel(),
    temperature: retry ? 0 : 0.15,
    provider: { require_parameters: true },
    messages: [
      {
        role: "system",
        content:
          "You are ASTERA's constraint-first route planner. Output only the requested schema. Choose city order, nights, activity search intents, and a concise route rationale grounded only in the supplied constraints and verified regional candidates. Never name or invent flights, hotels, restaurants, attractions, prices, ratings, or provider facts.",
      },
      {
        role: "user",
        content: JSON.stringify({
          hardConstraints: {
            origin: input.preferences.startCity,
            destination: input.requestedDestination,
            startDate: input.preferences.startDate,
            endDate: input.preferences.endDate,
            totalNights: input.totalNights,
            budget: input.preferences.budget,
            currency: input.preferences.currency,
            travellers: input.preferences.travellers,
            avoidFlights: input.preferences.avoidFlights,
            maxTravelHours: input.preferences.maxTravelHours,
            existingArrangements: input.preferences.notes,
          },
          softPreferences: {
            interests: input.preferences.interests,
            activities: input.preferences.activities,
            diets: input.preferences.diets,
            travelStyle: input.preferences.travelStyle,
            transport: input.preferences.transport,
            luxuryLevel: input.preferences.luxuryLevel,
            fewerHotelChanges: input.preferences.fewerHotelChanges,
          },
          verifiedRegionalCandidates: input.regionalCandidates ?? [],
          rules: [
            "Return 3 to 5 structurally different plans when feasible.",
            "Every plan's nights must sum exactly to totalNights.",
            "The requested destination must be the final city.",
            "Do not include the origin as a stay unless origin equals destination.",
            "Activities are generic search intents only, never venue names.",
            "Order activity intents by editorial importance: each day should begin with a visually iconic, emotionally distinctive destination experience such as a landmark, alpine panorama, lake, historic quarter, art, food culture, or local atmosphere.",
            "Never use airports, stations, transfers, terminals, generic transit, or 'airport vibes' as an activity or hero intent.",
            "For regional expansion, use only verifiedRegionalCandidates. Never invent a nearby destination.",
            "Return destination-only plus materially different feasible regional plans when verified candidates improve the user's interests.",
            "Respect each candidate's travel minutes and suitability; short trips must not gain impractical overnight stops.",
            "For a day trip, keep the hotel-base city in cities, set routePattern to day-trip, set regionalDestination to the verified nearby place, and put generic search intents in regionalActivities.",
            "For an overnight expansion, include the verified nearby place in cities, set routePattern to overnight and regionalDestination to that place.",
            "For destination-only, set routePattern to destination-only, regionalDestination to null and regionalActivities to an empty array.",
            "Each day-trip or overnight plan must select exactly one verified regionalDestination; never combine two candidates into one plan or leave regionalDestination null.",
            "A candidate may be overnight only when its suitableFor list explicitly contains overnight; otherwise it may only be a day trip.",
            "Each plan reasoning must explain its distinct user benefit and trade-off using only supplied facts; never claim a price, duration, hotel, venue, or weather result that was not supplied.",
          ],
          retryInstruction: retry
            ? "The previous output was invalid. Follow the schema exactly."
            : undefined,
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "astera_candidate_plans",
        strict: true,
        schema: PLANNER_JSON_SCHEMA,
      },
    },
  };
}

async function attempt(input: PlannerRequest, number: number) {
  const diagnostics = baseDiagnostics();
  diagnostics.attempts = number;
  let response: Response;
  try {
    response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL?.trim() || "http://localhost:3000",
        "X-Title": "ASTERA",
      },
      body: JSON.stringify(requestBody(input, number > 1)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    diagnostics.timedOut =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new PlannerProviderError(
      diagnostics.timedOut ? "OpenRouter planner timed out" : "OpenRouter request failed",
      diagnostics,
      504,
    );
  }

  diagnostics.httpStatus = response.status;
  const rawBody = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    diagnostics.errorBody = cleanText(rawBody);
  }
  diagnostics.responseShape = responseShape(payload);
  if (!response.ok) {
    diagnostics.errorBody = cleanText(rawBody);
    throw new PlannerProviderError(
      providerFailureMessage(payload, response.status),
      diagnostics,
      response.status,
    );
  }

  const root = payload as {
    model?: string;
    choices?: { message?: { content?: string | null } }[];
  };
  diagnostics.actualModel = root.model ?? null;
  const content = root.choices?.[0]?.message?.content;
  if (!content) {
    diagnostics.extraction = "failed";
    throw new PlannerProviderError("OpenRouter returned no message content", diagnostics);
  }

  let json: unknown;
  try {
    json = extractJson(content);
    diagnostics.extraction = "success";
  } catch (error) {
    diagnostics.extraction = "failed";
    diagnostics.errorBody = cleanText(
      error instanceof Error ? `${error.message}; content=${content}` : content,
    );
    throw new PlannerProviderError("OpenRouter JSON extraction failed", diagnostics);
  }

  const parsed = plannerResponseSchema.safeParse(json);
  if (!parsed.success) {
    diagnostics.schemaErrors = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "root"}: ${issue.message}`,
    );
    throw new PlannerProviderError("OpenRouter schema validation failed", diagnostics);
  }
  diagnostics.parseSuccess = true;
  return { plan: parsed.data as PlannerResponse, diagnostics };
}

export const openRouterPlanner = {
  isConfigured: () => Boolean(apiKey()),
  provider: "OpenRouter",
  model: configuredModel,

  async plan(input: PlannerRequest) {
    let firstError: PlannerProviderError | null = null;
    try {
      return await attempt(input, 1);
    } catch (error) {
      firstError =
        error instanceof PlannerProviderError
          ? error
          : new PlannerProviderError("Unknown OpenRouter failure", baseDiagnostics());
      console.error("[planner:attempt-1]", firstError.diagnostics);
      // Authentication, model availability and account-wide rate limits cannot
      // be repaired by repeating the same request. Retrying would only consume
      // time or another request.
      if ([401, 403, 404, 429].includes(firstError.status)) throw firstError;
    }
    try {
      return await attempt(input, 2);
    } catch (error) {
      const finalError =
        error instanceof PlannerProviderError
          ? error
          : new PlannerProviderError("Unknown OpenRouter failure", baseDiagnostics());
      finalError.diagnostics.attempts = 2;
      if (!finalError.diagnostics.errorBody && firstError?.diagnostics.errorBody) {
        finalError.diagnostics.errorBody = firstError.diagnostics.errorBody;
      }
      throw finalError;
    }
  },
};
