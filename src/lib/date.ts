/**
 * One robust date-normalisation layer for the whole app.
 *
 * Nothing anywhere else should call `new Date(x)` on data that came from
 * local storage, a URL, a form field or an API. Those values are routinely
 * `undefined`, `null`, `""`, `NaN`, or a UNIX timestamp expressed in seconds,
 * and every one of those silently becomes 1970 (or `Invalid Date`) when
 * passed straight into the Date constructor.
 */

/** Smallest value we accept as a millisecond timestamp: 2001-09-09. */
const MS_THRESHOLD = 1_000_000_000_000;
/** Anything between these bounds is almost certainly seconds, not ms. */
const SECONDS_MIN = 100_000_000; // 1973 in seconds
const SECONDS_MAX = 100_000_000_000; // year 5138 in seconds

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Dev-only diagnostics. Users never see these. */
export function devWarn(scope: string, message: string, detail?: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(`[astera:${scope}] ${message}`, detail ?? "");
  }
}

/**
 * Coerces anything into a valid `Date`, or `null` when it cannot be trusted.
 * Never returns the Unix epoch as a stand-in for missing data.
 */
export function toValidDate(input: unknown): Date | null {
  if (input == null) return null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === "number") {
    if (!Number.isFinite(input) || input === 0) return null;
    // Seconds-based timestamps are ~1000x too small for `new Date(ms)`.
    const ms =
      Math.abs(input) < MS_THRESHOLD && Math.abs(input) > SECONDS_MIN && Math.abs(input) < SECONDS_MAX
        ? input * 1000
        : input;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Numeric strings are timestamps, not date strings.
    if (/^-?\d+$/.test(trimmed)) return toValidDate(Number(trimmed));

    // Plain `YYYY-MM-DD` is parsed as UTC midnight by the spec; build it
    // locally so the calendar day never shifts backwards in western zones.
    if (ISO_DATE.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      const valid =
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;
      return valid ? date : null;
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** True when the value can be turned into a real calendar date. */
export const isValidDateInput = (input: unknown): boolean => toValidDate(input) !== null;

/** `YYYY-MM-DD` for a valid input, otherwise `null`. */
export function toIsoDate(input: unknown): string | null {
  const date = toValidDate(input);
  if (!date) return null;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Today as `YYYY-MM-DD` in the traveller's own timezone. */
export const todayIso = (): string => toIsoDate(new Date())!;

/** Adds (or subtracts) whole days. Returns `null` for untrustworthy input. */
export function addDaysIso(input: unknown, days: number): string | null {
  const date = toValidDate(input);
  if (!date || !Number.isFinite(days)) return null;
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + Math.trunc(days));
  return toIsoDate(next);
}

/** Whole nights between two dates, or `null` when either end is unusable. */
export function nightsBetweenSafe(start: unknown, end: unknown): number | null {
  const from = toValidDate(start);
  const to = toValidDate(end);
  if (!from || !to) return null;
  const nights = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  return nights > 0 ? nights : null;
}

/** True when the date is today or later. */
export function isFutureOrToday(input: unknown): boolean {
  const date = toValidDate(input);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() >= today.getTime();
}

const LONG = { day: "numeric", month: "short", year: "numeric" } as const;
const SHORT = { day: "numeric", month: "short" } as const;

/** Human date, or the supplied placeholder when the value is not a real date. */
export function formatDateSafe(input: unknown, fallback = "—"): string {
  const date = toValidDate(input);
  return date ? date.toLocaleDateString("en-GB", LONG) : fallback;
}

export function formatShortDateSafe(input: unknown, fallback = "—"): string {
  const date = toValidDate(input);
  return date ? date.toLocaleDateString("en-GB", SHORT) : fallback;
}

/** "12 – 22 Jun 2026" style range, collapsing a shared month/year. */
export function formatDateRange(start: unknown, end: unknown, fallback = "Dates not set"): string {
  const from = toValidDate(start);
  const to = toValidDate(end);
  if (!from || !to) return fallback;
  const sameYear = from.getFullYear() === to.getFullYear();
  const left = sameYear
    ? from.toLocaleDateString("en-GB", SHORT)
    : from.toLocaleDateString("en-GB", LONG);
  return `${left} – ${to.toLocaleDateString("en-GB", LONG)}`;
}
