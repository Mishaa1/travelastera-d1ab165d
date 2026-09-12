import type { PlannerResponse } from "@/lib/planner/schema";
import type { TripPreferences } from "@/lib/types";

export interface PlannerClientDiagnostics {
  httpStatus: number | null;
  configuredModel: string;
  actualModel: string | null;
  parseSuccess: boolean;
  timedOut: boolean;
  attempts: number;
  responseShape: string[];
  extraction: string;
  schemaErrors: string[];
  errorBody?: string;
}

export async function requestConstraintPlan(
  preferences: TripPreferences,
  requestedDestination: string | null,
  totalNights: number,
  signal?: AbortSignal,
  regionalCandidates?: Array<{ name: string; country: string; estimatedTravelMinutes: number; type: string; themes: string[]; suitableFor: string[]; provenance: string }>,
): Promise<{
  plan: PlannerResponse;
  planner: {
    provider: string;
    model: string;
    configuredModel?: string;
    diagnostics?: PlannerClientDiagnostics;
  };
} | null> {
  if (typeof window === "undefined") return null;
  const timeout = AbortSignal.timeout(65_000);
  const response = await fetch("/api/planner/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferences, requestedDestination, totalNights, regionalCandidates }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const payload = (await response.json()) as {
    plan?: PlannerResponse | null;
    planner?: {
      provider: string;
      model?: string;
      configuredModel?: string;
      actualModel?: string | null;
      diagnostics?: PlannerClientDiagnostics;
    };
    error?: string;
  };
  if (!response.ok) {
    const message = payload.error ?? `Planner failed (${response.status})`;
    if (import.meta.env.DEV && payload.planner?.diagnostics) {
      console.error("[planner diagnostics]", payload.planner.diagnostics);
    }
    throw new Error(message);
  }
  if (!payload.plan) return null;
  return {
    plan: payload.plan,
    planner: {
      provider: payload.planner?.provider ?? "OpenRouter",
      model:
        payload.planner?.model ??
        payload.planner?.actualModel ??
        payload.planner?.configuredModel ??
        "unknown",
      configuredModel: payload.planner?.configuredModel,
      diagnostics: payload.planner?.diagnostics,
    },
  };
}
