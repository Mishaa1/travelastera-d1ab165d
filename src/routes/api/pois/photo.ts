import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { googlePlacesClient } from "@/lib/places/google-places.server";

const querySchema = z.object({
  photo: z.string().regex(/^places\/[^/]+\/photos\/[^/]+$/),
  city: z.string().trim().min(1).max(120),
  itineraryRequestId: z.string().trim().min(1).max(200),
  session: z.string().regex(/^[a-f0-9]{64}$/),
});

export const Route = createFileRoute("/api/pois/photo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
        if (!parsed.success) return new Response("Invalid photo request", { status: 400 });
        const result = await googlePlacesClient.fetchPhoto(parsed.data.photo, {
          city: parsed.data.city,
          latitude: 0,
          longitude: 0,
          userSessionHash: parsed.data.session,
          itineraryRequestId: parsed.data.itineraryRequestId,
        });
        if (!result.bytes || !result.contentType)
          return new Response("Place photo unavailable", {
            status: 404,
            headers: { "Cache-Control": "private, max-age=60" },
          });
        return new Response(result.bytes, {
          status: 200,
          headers: {
            "Content-Type": result.contentType,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
