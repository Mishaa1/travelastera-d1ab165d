import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { enforcePlannerConstraints } from "@/lib/planner/constraints";
import { openRouterPlanner, PlannerProviderError } from "@/lib/planner/openrouter.server";
import { developmentDiagnostics, requireLiveData } from "@/lib/live-data";
import type { TripPreferences } from "@/lib/types";

const bodySchema = z.object({
  preferences: z
    .object({
      startCity: z.string().trim().min(1).max(100),
      endCity: z.string().max(100),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      travellers: z.number().int().min(1).max(12),
      budget: z.number().min(200).max(100_000),
      currency: z.enum(["EUR", "USD", "GBP"]),
    })
    .passthrough(),
  requestedDestination: z.string().trim().max(100).nullable(),
  totalNights: z.number().int().min(1).max(30),
  regionalCandidates: z.array(z.object({
    name: z.string(), country: z.string(), estimatedTravelMinutes: z.number(), type: z.string(),
    themes: z.array(z.string()), suitableFor: z.array(z.string()), provenance: z.string(),
  })).max(20).optional(),
});

export const Route = createFileRoute("/api/planner/plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = bodySchema.safeParse(await request.json());
        } catch {
          return Response.json({ error: "Malformed planner request" }, { status: 400 });
        }
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid planner constraints" },
            { status: 400 },
          );
        }
        if (!openRouterPlanner.isConfigured()) {
          return Response.json({ plan: null, configured: false });
        }

        try {
          const preferences = parsed.data.preferences as TripPreferences;
          const result = await openRouterPlanner.plan({
            preferences,
            requestedDestination: parsed.data.requestedDestination,
            totalNights: parsed.data.totalNights,
            regionalCandidates: parsed.data.regionalCandidates,
          });
          const plan = enforcePlannerConstraints(
            result.plan,
            preferences,
            parsed.data.requestedDestination,
            parsed.data.totalNights,
          );
          console.info(
            `[planner] provider=${openRouterPlanner.provider} model=${openRouterPlanner.model()} plans=${plan.plans.length}`,
          );
          plan.plans.forEach((candidate, index) => {
            console.info(
              `[planner:plan-${index + 1}] provider=${openRouterPlanner.provider} model=${openRouterPlanner.model()} route=${candidate.cities.map((city) => city.city).join(" -> ")}`,
            );
          });
          return Response.json({
            plan,
            configured: true,
            planner: {
              provider: openRouterPlanner.provider,
              model: result.diagnostics.actualModel ?? openRouterPlanner.model(),
              configuredModel: openRouterPlanner.model(),
              diagnostics: result.diagnostics,
            },
          });
        } catch (error) {
          console.error("Constraint planner failed", error);
          const diagnostics = error instanceof PlannerProviderError ? error.diagnostics : undefined;
          return Response.json(
            {
              plan: null,
              configured: true,
              active: diagnostics?.httpStatus != null,
              planner: {
                provider: openRouterPlanner.provider,
                configuredModel: openRouterPlanner.model(),
                actualModel: diagnostics?.actualModel ?? null,
                diagnostics: developmentDiagnostics() ? diagnostics : undefined,
              },
              error:
                developmentDiagnostics() && error instanceof Error
                  ? error.message
                  : "The AI planner failed",
            },
            { status: requireLiveData() ? 502 : 200 },
          );
        }
      },
    },
  },
});
