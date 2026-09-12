import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { demoHotelFixture } from "@/data/demoHotels";
import { hotelbedsProvider, HotelbedsProviderError } from "@/lib/hotels/hotelbeds.server";
import { allowLabelledDemoHotels, developmentDiagnostics, requireLiveData } from "@/lib/live-data";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bodySchema = z
  .object({
    cityName: z.string().trim().max(100).optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    checkInDate: isoDate,
    checkOutDate: isoDate,
    travellers: z.number().int().min(1).max(9),
    currency: z.enum(["EUR", "USD", "GBP"]),
    luxuryLevel: z.enum(["hostel", "midscale", "boutique", "luxury"]),
  })
  .refine((value) => value.checkOutDate > value.checkInDate, {
    message: "Check-out must be after check-in",
  });

export const Route = createFileRoute("/api/hotels/search")({
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
            { error: parsed.error.issues[0]?.message ?? "Invalid hotel search" },
            { status: 400 },
          );
        }

        const demoAllowed = allowLabelledDemoHotels();
        const strictFailureStatus = requireLiveData() && !demoAllowed ? 503 : 200;
        if (!hotelbedsProvider.isConfigured()) {
          const fallbackReason = "Hotelbeds credentials are not configured.";
          return Response.json(
            {
              hotel: demoAllowed
                ? demoHotelFixture({
                    ...parsed.data,
                    fallbackReason,
                    httpStatus: null,
                    quotaExceeded: false,
                  })
                : null,
              liveHotelCount: 0,
              configured: false,
              requiredLiveData: requireLiveData(),
              demoMode: demoAllowed,
              diagnostics: {
                status: null,
                environment: hotelbedsProvider.environment(),
              },
              error: fallbackReason,
            },
            { status: strictFailureStatus },
          );
        }

        try {
          const result = await hotelbedsProvider.search(parsed.data);
          return Response.json({
            ...result,
            configured: true,
            requiredLiveData: requireLiveData(),
            demoMode: false,
          });
        } catch (error) {
          console.error("Hotelbeds availability search failed", error);
          const diagnostics =
            error instanceof HotelbedsProviderError
              ? error.diagnostics
              : { status: null, environment: hotelbedsProvider.environment() };
          const quotaExceeded =
            error instanceof HotelbedsProviderError && Boolean(error.diagnostics.quotaExceeded);
          const fallbackReason = quotaExceeded
            ? "Hotel availability is shown in demo mode because the provider’s test quota is temporarily exhausted. These rooms and prices are not bookable."
            : "Hotelbeds is temporarily unavailable. Labelled demo hotel inventory is being shown and is not bookable.";
          return Response.json(
            {
              hotel: demoAllowed
                ? demoHotelFixture({
                    ...parsed.data,
                    fallbackReason,
                    httpStatus: diagnostics.status,
                    quotaExceeded,
                  })
                : null,
              liveHotelCount: 0,
              configured: true,
              requiredLiveData: requireLiveData(),
              demoMode: demoAllowed,
              diagnostics: developmentDiagnostics() ? diagnostics : undefined,
              error: fallbackReason,
            },
            { status: strictFailureStatus },
          );
        }
      },
    },
  },
});
