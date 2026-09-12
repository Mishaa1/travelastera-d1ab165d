import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { parseTripEditWithOpenRouter } from "@/lib/planner/tripEdit.server";

const bodySchema = z.object({ prompt: z.string().trim().min(1).max(1000), route: z.record(z.unknown()) });
export const Route = createFileRoute("/api/planner/edit")({ server: { handlers: { POST: async ({ request }) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid trip edit request." }, { status: 400 });
  try {
    const result = await parseTripEditWithOpenRouter(parsed.data);
    if (process.env.NODE_ENV !== "production") console.info("[trip-edit:parsed-intent]", { ...result.instruction, provider: result.provider, model: result.actualModel });
    return Response.json(result);
  } catch (error) {
    console.error("[trip-edit:parser-failed]", error instanceof Error ? error.message : error);
    return Response.json({ error: error instanceof Error ? error.message : "OpenRouter could not understand this edit." }, { status: 502 });
  }
} } } });
