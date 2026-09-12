import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { getWikimediaMoodImages } from "@/lib/images/wikimedia-mood.server";

const querySchema = z.object({
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().max(120).default(""),
});

export const Route = createFileRoute("/api/images/mood")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = querySchema.safeParse({
          city: url.searchParams.get("city"),
          country: url.searchParams.get("country") ?? "",
        });
        if (!parsed.success) return Response.json({ error: "Invalid city" }, { status: 400 });
        try {
          const result = await getWikimediaMoodImages(parsed.data.city, parsed.data.country);
          return Response.json(result, {
            headers: { "Cache-Control": "public, max-age=86400, s-maxage=2592000" },
          });
        } catch (error) {
          return Response.json(
            { images: [], error: error instanceof Error ? error.message : "Image search failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
