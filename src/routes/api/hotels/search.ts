import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { hotelbedsProvider } from "@/lib/hotels/hotelbeds.server";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bodySchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    checkInDate: isoDate,
    checkOutDate: isoDate,
    travellers: z.number().int().min(1).max(9),
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

        if (!hotelbedsProvider.isConfigured()) {
          return Response.json({ hotel: null, configured: false });
        }

        try {
          const hotel = await hotelbedsProvider.search(parsed.data);
          return Response.json({ hotel, configured: true });
        } catch (error) {
          console.error("Hotelbeds availability search failed", error);
          return Response.json({
            hotel: null,
            configured: true,
            error: "Hotelbeds unavailable",
          });
        }
      },
    },
  },
});
