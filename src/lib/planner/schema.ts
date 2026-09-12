import { z } from "zod";

import type { TripPreferences } from "@/lib/types";

export const plannedCitySchema = z.object({
  city: z.string().trim().min(1).max(80),
  nights: z.coerce.number().int().min(1).max(30),
  activities: z.array(z.string().trim().min(1).max(100)).max(12),
});

export const plannerResponseSchema = z.object({
  plans: z
    .array(
      z.object({
        cities: z.array(plannedCitySchema).min(1).max(5),
        routePattern: z.enum(["destination-only", "day-trip", "overnight"]),
        regionalDestination: z.string().trim().min(1).max(80).nullable(),
        regionalActivities: z.array(z.string().trim().min(1).max(100)).max(12),
        reasoning: z.string().trim().min(1).max(500),
      }),
    )
    .min(1)
    .max(5),
});

export type PlannerResponse = z.infer<typeof plannerResponseSchema>;
export type PlannedCity = z.infer<typeof plannedCitySchema>;

export interface PlannerRequest {
  preferences: TripPreferences;
  requestedDestination: string | null;
  totalNights: number;
  regionalCandidates?: Array<{
    name: string;
    country: string;
    estimatedTravelMinutes: number;
    type: string;
    themes: string[];
    suitableFor: string[];
    provenance: string;
  }>;
}

export const PLANNER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    plans: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          cities: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                city: { type: "string" },
                nights: { type: "integer", minimum: 1, maximum: 30 },
                activities: {
                  type: "array",
                  minItems: 1,
                  maxItems: 12,
                  items: { type: "string" },
                },
              },
              required: ["city", "nights", "activities"],
            },
          },
          reasoning: { type: "string", minLength: 1, maxLength: 500 },
          routePattern: { type: "string", enum: ["destination-only", "day-trip", "overnight"] },
          regionalDestination: { anyOf: [{ type: "string" }, { type: "null" }] },
          regionalActivities: {
            type: "array",
            maxItems: 12,
            items: { type: "string" },
          },
        },
        required: ["cities", "routePattern", "regionalDestination", "regionalActivities", "reasoning"],
      },
    },
  },
  required: ["plans"],
} as const;
