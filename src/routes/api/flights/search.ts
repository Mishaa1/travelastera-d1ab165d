import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { duffelProvider } from "@/lib/flights/duffel.server";
import { MAX_DISCOVERY_DESTINATIONS } from "@/lib/flights/types";

/**
 * POST /api/flights/search
 *
 * Validates the request, fans out to at most three destinations with a small
 * concurrency limit, and returns normalised offers. Provider failure is always
 * reported per-destination so the rest of the page keeps working.
 */

const iata = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Must be a three-letter IATA code");

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date");

const bodySchema = z
  .object({
    origin: iata,
    destinations: z.array(iata).min(1).max(MAX_DISCOVERY_DESTINATIONS),
    departureDate: isoDate,
    returnDate: isoDate.optional(),
    travellers: z.number().int().min(1).max(9),
    cabin: z.literal("economy").default("economy"),
  })
  .superRefine((value, ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    if (value.departureDate < today) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Departure date is in the past" });
    }
    if (value.returnDate && value.returnDate < value.departureDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Return date is before departure" });
    }
    if (value.destinations.includes(value.origin)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Destination equals origin" });
    }
  });

export const Route = createFileRoute("/api/flights/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = bodySchema.safeParse(await request.json());
        } catch {
          return Response.json({ error: "Malformed request body" }, { status: 400 });
        }
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid search" },
            { status: 400 },
          );
        }

        if (!duffelProvider.isConfigured()) {
          return Response.json(
            { results: [], configured: false, error: "Flight provider is not configured" },
            { status: 200 },
          );
        }

        const { origin, destinations, departureDate, returnDate, travellers, cabin } = parsed.data;

        // Small fan-out, run two at a time so we never hammer the provider.
        const results: {
          destination: string;
          offers: unknown[];
          error?: string;
        }[] = [];

        const queue = [...destinations];
        const worker = async () => {
          while (queue.length) {
            const destination = queue.shift()!;
            try {
              const offers = await duffelProvider.search({
                origin,
                destination,
                departureDate,
                returnDate,
                travellers,
                cabin,
              });
              results.push({ destination, offers });
            } catch (error) {
              console.error("Flight search failed", destination, error);
              results.push({
                destination,
                offers: [],
                error: "Provider unavailable",
              });
            }
          }
        };

        await Promise.all([worker(), worker()]);

        return Response.json({ results, configured: true });
      },
    },
  },
});
