import {
  addDaysIso,
  formatDateSafe,
  formatShortDateSafe,
  nightsBetweenSafe,
  todayIso as todayIsoSafe,
} from "@/lib/date";

export const formatCurrency = (
  value: number,
  currency: "EUR" | "USD" | "GBP" = "EUR",
  maximumFractionDigits = 0,
) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0);

export const formatHours = (hours: number) => {
  if (!Number.isFinite(hours) || hours < 0) return "—";
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
};

/** Never renders 1970 — unparseable input becomes an em dash. */
export const formatDate = (iso: unknown) => formatDateSafe(iso);

export const formatShortDate = (iso: unknown) => formatShortDateSafe(iso);

/** Nights between two dates, defaulting to a sensible 7 when unknown. */
export const nightsBetween = (start: unknown, end: unknown) => nightsBetweenSafe(start, end) ?? 7;

/** Adds days to an ISO date, falling back to today's date when input is bad. */
export const addDays = (iso: unknown, days: number) => addDaysIso(iso, days) ?? todayIsoSafe();

export const todayIso = todayIsoSafe;

export { formatDateRange } from "@/lib/date";
