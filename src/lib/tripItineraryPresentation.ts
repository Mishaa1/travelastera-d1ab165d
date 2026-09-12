import type { DayPlan } from "@/lib/types";

export type ItineraryPhase =
  "Arrival" | "Discovery" | "Hidden gems" | "Adventure" | "Slow days" | "Farewell";

export type DayLayoutVariant = "template-a" | "template-b" | "template-c";

function dayText(day: DayPlan) {
  return [day.morning, day.afternoon, day.evening, ...(day.activityIntents ?? [])]
    .join(" ")
    .toLowerCase();
}

export function getItineraryPhase(days: DayPlan[], index: number): ItineraryPhase {
  if (index === 0) return "Arrival";
  if (index === days.length - 1) return "Farewell";

  const progress = index / Math.max(1, days.length - 1);
  if (progress < 0.3) return "Discovery";
  if (progress < 0.5) return "Hidden gems";
  if (progress < 0.72) return "Adventure";
  return "Slow days";
}

export function getDayLayoutVariant(
  day: DayPlan,
  index: number,
  days: DayPlan[],
): DayLayoutVariant {
  const text = dayText(day);
  const isFoodLed = /food|restaurant|market|cafe|café|tasting|culinary/.test(text);

  if (isFoodLed || index % 3 === 2) return "template-c";
  if (day.transportNote || index % 3 === 1) return "template-b";
  return "template-a";
}

export function shouldInsertEditorialBreak(index: number, totalDays: number) {
  if (totalDays < 7) return false;
  const first = Math.max(2, Math.floor(totalDays * 0.4));
  const second = Math.max(first + 2, Math.floor(totalDays * 0.72));
  return index + 1 === first || (totalDays >= 10 && index + 1 === second);
}
