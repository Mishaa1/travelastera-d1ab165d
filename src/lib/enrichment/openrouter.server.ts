import { LIVE_QUALITY } from "@/api/config";
import type { DataQuality } from "@/lib/types";

/**
 * OpenRouter enrichment for personalised travel copy.
 *
 * Generates concise, route-specific explanations such as "Why Astera picked
 * this" text. Kept deterministic by a low temperature and a strict system
 * prompt. All credentials are read inside the call.
 */

export interface EnrichmentCopy {
  text: string;
  quality: DataQuality;
}

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 15_000;

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function generateWhyCopy(context: {
  city: string;
  country: string;
  travellerStyle: string;
  interests: string[];
  diets?: string[];
  pace: string;
  luxuryLevel: string;
  stopNumber: number;
  totalStops: number;
}): Promise<EnrichmentCopy> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const system =
    "You are a senior travel editor writing one concise sentence (max 25 words) explaining why a city belongs on a specific traveller's route. Be warm, specific, and avoid generic adjectives. Mention one concrete reason tied to the traveller's interests.";

  const user = `City: ${context.city}, ${context.country}. Stop ${context.stopNumber} of ${context.totalStops}. Traveller: ${context.travellerStyle}, ${context.pace} pace, ${context.luxuryLevel} stays. Interests: ${context.interests.join(", ")}. ${context.diets?.length ? `Diets: ${context.diets.join(", ")}.` : ""}`;

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://astera.lovable.app",
        "X-Title": "Astera Travel Optimiser",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.55,
        max_tokens: 80,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`OpenRouter request failed [${response.status}]: ${body.slice(0, 500)}`);
      throw new Error(`OpenRouter request failed (${response.status})`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    return { text: text || `A strong fit for ${context.city} based on your interests.`, quality: LIVE_QUALITY("OpenRouter") };
  } finally {
    clearTimeout(timer);
  }
}
