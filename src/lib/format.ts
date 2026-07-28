export const formatCurrency = (
  value: number,
  currency: "EUR" | "USD" | "GBP" = "EUR",
  maximumFractionDigits = 0,
) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(value);

export const formatHours = (hours: number) => {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
};

export const formatDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

export const formatShortDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";

export const nightsBetween = (start: string, end: string) => {
  if (!start || !end) return 7;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(2, Math.round(ms / 86_400_000));
};

export const addDays = (iso: string, days: number) => {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const todayIso = () => new Date().toISOString().slice(0, 10);
