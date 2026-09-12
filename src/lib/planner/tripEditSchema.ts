import { z } from "zod";

export const editIntentSchema = z.enum([
  "add_destination", "remove_destination", "replace_destination", "change_budget", "change_pace",
  "replace_hotel", "add_constraint", "remove_constraint", "preserve_day", "modify_interest",
  "modify_food", "modify_transport", "existing_accommodation", "change_duration", "regenerate_trip",
  "expand_route_regionally",
]);

export const tripEditInstructionSchema = z.object({
  intent: editIntentSchema,
  confidence: z.number().min(0).max(1),
  requiresClarification: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  changes: z.object({
    destination: z.string().nullable(),
    budgetDelta: z.number().nullable(),
    tripDurationDeltaDays: z.number().int().min(-30).max(30).nullable(),
    replaceDestination: z.string().nullable(),
    hotelPreference: z.string().nullable(),
    foodPreference: z.string().nullable(),
    transportPreference: z.string().nullable(),
    walkingTolerance: z.enum(["short", "moderate", "long"]).nullable(),
    pace: z.enum(["relaxed", "balanced", "fast"]).nullable(),
    preserveDays: z.array(z.number().int().min(1).max(30)).max(30),
    existingAccommodation: z.array(z.string()).max(10),
    constraints: z.array(z.string()).max(20),
    regionalPreference: z.enum(["day-trips", "nearby-cities", "surprise"]).nullable(),
    maxAdditionalTravelMinutes: z.number().int().min(30).max(240).nullable(),
    allowNewCountry: z.boolean().nullable(),
    maxAdditionalHotelChanges: z.number().int().min(0).max(3).nullable(),
  }),
});

export type AITripEditInstruction = z.infer<typeof tripEditInstructionSchema>;

export const TRIP_EDIT_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    intent: { type: "string", enum: editIntentSchema.options },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    requiresClarification: { type: "boolean" }, clarificationQuestion: { type: ["string", "null"] },
    changes: {
      type: "object", additionalProperties: false,
      properties: {
        destination: { type: ["string", "null"] }, budgetDelta: { type: ["number", "null"] },
        tripDurationDeltaDays: { type: ["integer", "null"], minimum: -30, maximum: 30 },
        replaceDestination: { type: ["string", "null"] }, hotelPreference: { type: ["string", "null"] },
        foodPreference: { type: ["string", "null"] }, transportPreference: { type: ["string", "null"] },
        walkingTolerance: { type: ["string", "null"], enum: ["short", "moderate", "long", null] },
        pace: { type: ["string", "null"], enum: ["relaxed", "balanced", "fast", null] },
        preserveDays: { type: "array", items: { type: "integer", minimum: 1, maximum: 30 }, maxItems: 30 },
        existingAccommodation: { type: "array", items: { type: "string" }, maxItems: 10 },
        constraints: { type: "array", items: { type: "string" }, maxItems: 20 },
        regionalPreference: { type: ["string", "null"], enum: ["day-trips", "nearby-cities", "surprise", null] },
        maxAdditionalTravelMinutes: { type: ["integer", "null"], minimum: 30, maximum: 240 },
        allowNewCountry: { type: ["boolean", "null"] },
        maxAdditionalHotelChanges: { type: ["integer", "null"], minimum: 0, maximum: 3 },
      },
      required: ["destination", "budgetDelta", "tripDurationDeltaDays", "replaceDestination", "hotelPreference", "foodPreference", "transportPreference", "walkingTolerance", "pace", "preserveDays", "existingAccommodation", "constraints", "regionalPreference", "maxAdditionalTravelMinutes", "allowNewCountry", "maxAdditionalHotelChanges"],
    },
  },
  required: ["intent", "confidence", "requiresClarification", "clarificationQuestion", "changes"],
} as const;
