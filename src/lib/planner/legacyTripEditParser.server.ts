import type { AITripEditInstruction } from "./tripEditSchema";

/** Emergency-only parser used after two schema-invalid LLM responses. */
export function legacyTripEditParser(prompt: string): AITripEditInstruction {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const blank: AITripEditInstruction["changes"] = { destination: null, budgetDelta: null, tripDurationDeltaDays: null, replaceDestination: null, hotelPreference: null, foodPreference: null, transportPreference: null, walkingTolerance: null, pace: null, preserveDays: [], existingAccommodation: [], constraints: [], regionalPreference: null, maxAdditionalTravelMinutes: null, allowNewCountry: null, maxAdditionalHotelChanges: null };
  if (/nearby|day trip|hidden town|less tourist|nearby countr|surprise me/.test(lower)) {
    const hours = Number(lower.match(/(?:no more than|max(?:imum)?|within)\s+(\d+)\s*hours?/)?.[1] ?? 0);
    return { intent: "expand_route_regionally", confidence: .65, requiresClarification: false, clarificationQuestion: null, changes: { ...blank, regionalPreference: /day trip/.test(lower) ? "day-trips" : /surprise/.test(lower) ? "surprise" : "nearby-cities", maxAdditionalTravelMinutes: hours ? Math.min(240, hours * 60) : null, allowNewCountry: /countr/.test(lower) ? true : null, maxAdditionalHotelChanges: /one hotel|no hotel change/.test(lower) ? 0 : null } };
  }
  const swap = text.match(/(?:swap|replace)\s+(.+?)\s+(?:for|with)\s+([^,.!]+)/i);
  if (swap) return { intent: "replace_destination", confidence: .72, requiresClarification: false, clarificationQuestion: null, changes: { ...blank, replaceDestination: swap[1].trim(), destination: swap[2].trim() } };
  const add = text.match(/(?:add|include|visit|stop\s+in)\s+([^,.!]+?)(?:\s+(?:to|as well|by)|[.!]|$)/i);
  if (add) return { intent: "add_destination", confidence: .7, requiresClarification: false, clarificationQuestion: null, changes: { ...blank, destination: add[1].trim(), tripDurationDeltaDays: Number(lower.match(/(\d+)\s+(?:new\s+|extra\s+)?days?/)?.[1] ?? 1) } };
  const budget = lower.match(/(?:budget|spend).{0,18}([+-]?\s*[€£$]?\s*[\d,.]+)/i);
  if (budget) { const amount = Number(budget[1].replace(/[^\d.-]/g, "")); return { intent: "change_budget", confidence: .65, requiresClarification: false, clarificationQuestion: null, changes: { ...blank, budgetDelta: /less|reduce|lower|cut/.test(lower) ? -Math.abs(amount) : Math.abs(amount) } }; }
  return { intent: "add_constraint", confidence: .2, requiresClarification: true, clarificationQuestion: "What part of the trip would you like changed?", changes: blank };
}
