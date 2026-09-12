import type { GooglePlacesConfig } from "./google-config.server.ts";
import {
  googlePlacesStore,
  type GooglePlacesStore,
  type GoogleUsageEvent,
  type PlacesStoreData,
} from "./store.server.ts";

export interface UsageContext {
  operation: GoogleUsageEvent["operation"];
  userSessionHash: string;
  itineraryRequestId: string;
  city: string;
}

export interface UsageSnapshot {
  callsThisItinerary: number;
  callsThisHour: number;
  callsToday: number;
  callsThisMonth: number;
  configuredMonthlyLimit: number;
  configuredDailyLimit: number;
  configuredHourlyLimit: number;
  remainingMonthlyAllowance: number;
  photoCallsThisItinerary: number;
}

const billable = (event: GoogleUsageEvent) =>
  event.providerRequestMade && event.estimatedBillableEvent;

function snapshot(
  data: PlacesStoreData,
  context: UsageContext,
  config: GooglePlacesConfig,
  now: Date,
) {
  const hour = now.toISOString().slice(0, 13);
  const date = now.toISOString().slice(0, 10);
  const month = date.slice(0, 7);
  const events = data.usage.filter(billable);
  const monthlyCap = Math.max(0, config.monthlyLimit - config.monthlySafetyBuffer);
  const result: UsageSnapshot = {
    callsThisItinerary: events.filter(
      (event) => event.itineraryRequestId === context.itineraryRequestId,
    ).length,
    callsThisHour: events.filter((event) => event.timestamp.startsWith(hour)).length,
    callsToday: events.filter((event) => event.date === date).length,
    callsThisMonth: events.filter((event) => event.month === month).length,
    configuredMonthlyLimit: config.monthlyLimit,
    configuredDailyLimit: config.dailyLimit,
    configuredHourlyLimit: config.hourlyLimit,
    remainingMonthlyAllowance: 0,
    photoCallsThisItinerary: events.filter(
      (event) =>
        event.itineraryRequestId === context.itineraryRequestId && event.operation === "photo",
    ).length,
  };
  result.remainingMonthlyAllowance = Math.max(0, monthlyCap - result.callsThisMonth);
  return result;
}

function event(
  context: UsageContext,
  now: Date,
  fields: Partial<GoogleUsageEvent>,
): GoogleUsageEvent {
  return {
    id: crypto.randomUUID(),
    provider: "google-places",
    operation: context.operation,
    timestamp: now.toISOString(),
    date: now.toISOString().slice(0, 10),
    month: now.toISOString().slice(0, 7),
    userSessionHash: context.userSessionHash,
    itineraryRequestId: context.itineraryRequestId,
    city: context.city,
    httpStatus: null,
    cacheHit: false,
    providerRequestMade: false,
    estimatedBillableEvent: false,
    blockedByQuota: false,
    ...fields,
  };
}

export class GooglePlacesUsageGuard {
  private readonly config: GooglePlacesConfig;
  private readonly store: GooglePlacesStore;
  private readonly now: () => Date;

  constructor(
    config: GooglePlacesConfig,
    store: GooglePlacesStore = googlePlacesStore(),
    now: () => Date = () => new Date(),
  ) {
    this.config = config;
    this.store = store;
    this.now = now;
  }

  async reserve(context: UsageContext) {
    return this.store.transaction((data) => {
      const now = this.now();
      const counts = snapshot(data, context, this.config, now);
      const hour = now.toISOString().slice(0, 13);
      const userHour = data.usage.filter(
        (item) =>
          billable(item) &&
          item.userSessionHash === context.userSessionHash &&
          item.timestamp.startsWith(hour),
      ).length;
      const itineraryNonPhotoCalls = data.usage.filter(
        (item) =>
          billable(item) &&
          item.itineraryRequestId === context.itineraryRequestId &&
          item.operation !== "photo",
      ).length;
      const monthlyCap = Math.max(0, this.config.monthlyLimit - this.config.monthlySafetyBuffer);
      const reason =
        counts.callsThisMonth >= monthlyCap
          ? "monthly-limit"
          : counts.callsToday >= this.config.dailyLimit
            ? "daily-limit"
            : counts.callsThisHour >= this.config.hourlyLimit
              ? "hourly-limit"
              : userHour >= this.config.userHourlyLimit
                ? "per-user-hourly-limit"
                : context.operation !== "photo" &&
                    itineraryNonPhotoCalls >= this.config.itineraryLimit
                  ? "per-itinerary-limit"
                  : context.operation === "photo" &&
                      counts.photoCallsThisItinerary >= this.config.maxPhotosPerItinerary
                    ? "photo-limit"
                    : undefined;
      if (reason) {
        data.usage.push(event(context, now, { blockedByQuota: true, blockReason: reason }));
        return { allowed: false as const, reason, usage: counts };
      }
      const reservation = event(context, now, {
        providerRequestMade: true,
        estimatedBillableEvent: true,
      });
      data.usage.push(reservation);
      return {
        allowed: true as const,
        reservationId: reservation.id,
        usage: {
          ...counts,
          callsThisItinerary: counts.callsThisItinerary + 1,
          callsThisHour: counts.callsThisHour + 1,
          callsToday: counts.callsToday + 1,
          callsThisMonth: counts.callsThisMonth + 1,
          remainingMonthlyAllowance: Math.max(0, counts.remainingMonthlyAllowance - 1),
          photoCallsThisItinerary:
            counts.photoCallsThisItinerary + Number(context.operation === "photo"),
        },
      };
    });
  }

  async complete(reservationId: string, httpStatus: number | null) {
    await this.store.transaction((data) => {
      const item = data.usage.find((entry) => entry.id === reservationId);
      if (item) Object.assign(item, { httpStatus });
    });
  }

  async recordCacheHit(context: UsageContext) {
    await this.store.transaction((data) =>
      data.usage.push(event(context, this.now(), { cacheHit: true })),
    );
  }

  async snapshot(context: UsageContext) {
    return this.store.transaction((data) => snapshot(data, context, this.config, this.now()));
  }
}
