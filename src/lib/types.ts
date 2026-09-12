/** Shared domain types for the Astera optimisation engine. */

export type DataSource = "live" | "test" | "estimate" | "mock";

export interface DataQuality {
  source: DataSource;
  /** Human readable provider name, e.g. "Open-Meteo". */
  provider: string;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface Place extends GeoPoint {
  id: string;
  name: string;
  country: string;
  countryCode: string;
}

export type Interest =
  | "nature"
  | "food"
  | "shopping"
  | "photography"
  | "history"
  | "museums"
  | "nightlife"
  | "adventure"
  | "luxury";

export type TransportMode = "flight" | "train" | "car" | "mixed";

export type LuxuryLevel = "hostel" | "midscale" | "boutique" | "luxury";

/** Food and dietary context used to filter and explain restaurant picks. */
export type Diet =
  | "halal"
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "seafood"
  | "local-cuisine"
  | "fine-dining"
  | "street-food"
  | "coffee"
  | "dessert";

export type TravelStyle = "couple" | "family" | "friends" | "solo" | "business" | "honeymoon";

/** Richer activity vocabulary shown in the planner; mapped onto `Interest`. */
export type Activity =
  | "nature"
  | "mountains"
  | "lakes"
  | "beaches"
  | "museums"
  | "castles"
  | "shopping"
  | "luxury"
  | "hidden-gems"
  | "photography"
  | "hiking"
  | "theme-parks"
  | "architecture"
  | "nightlife";

export type DateMode = "exact" | "flexible";

export type RegionalDiscoveryMode = "off" | "day-trips" | "nearby-cities" | "surprise";
export type RegionalHotelChanges = "none" | "one" | "flexible";

export interface TripPreferences {
  startCity: string;
  /** Blank means destination discovery — Astera picks where you go. */
  endCity: string;
  startDate: string;
  endDate: string;
  /** Exact dates, or a month plus a trip length. */
  dateMode: DateMode;
  /** YYYY-MM, used when `dateMode` is "flexible". */
  flexibleMonth: string;
  /** Nights wanted when `dateMode` is "flexible". */
  flexibleNights: number;
  travellers: number;
  budget: number;
  currency: "EUR" | "USD" | "GBP";
  interests: Interest[];
  transport: TransportMode;
  maxTravelHours: number;
  avoidFlights: boolean;
  fewerHotelChanges: boolean;
  luxuryLevel: LuxuryLevel;
  /** Traveller profile — influences explanations and future optimisation. */
  diets: Diet[];
  travelStyle: TravelStyle;
  activities: Activity[];
  /** Free-text context, e.g. "I already have accommodation in Vienna." */
  notes: string;
  /** Optional regional route exploration; omitted drafts use the safe defaults. */
  regionalDiscovery?: RegionalDiscoveryMode;
  maxAdditionalTravelMinutes?: 60 | 120 | 240;
  regionalHotelChanges?: RegionalHotelChanges;
  allowNewCountry?: boolean;
}

export interface CostBreakdown {
  transport: number;
  accommodation: number;
  food: number;
  activities: number;
  buffer: number;
}

export interface RouteLeg {
  from: string;
  to: string;
  mode: Exclude<TransportMode, "mixed">;
  hours: number;
  cost: number;
  note: string;
  quality?: DataQuality;
}

export interface StopWeather {
  city: string;
  tempC: number;
  rainChance: number;
  summary: string;
  quality: DataQuality;
}

export interface HotelSuggestion {
  id?: string;
  name: string;
  area: string;
  nightlyFrom: number;
  /** Total returned for the complete stay and requested room occupancy. */
  totalStayPrice?: number;
  rating: number;
  style: string;
  roomType?: string;
  boardType?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  currency?: string;
  websiteUrl?: string;
  /** Sanitized explanation when sample inventory replaced a provider result. */
  fallbackReason?: string;
  quality: DataQuality;
  providerDiagnostics?: {
    status: number | null;
    environment: string;
    liveHotelCount: number;
    responseBody?: string;
  };
  hotelProvenance?: {
    source: "hotelbeds-live" | "hotelbeds-cache" | "demo-fixture";
    httpStatus: number | null;
    quotaExceeded: boolean;
    cacheAgeMs: number | null;
    liveAvailability: boolean;
    bookable: boolean;
    fallbackReason?: string;
  };
}

export interface DayPlan {
  day: number;
  city: string;
  morning: string;
  afternoon: string;
  evening: string;
  restaurant: string;
  transportNote?: string;
  rainyDayAlternative: string;
  /** Live POI enrichment. The existing UI can render these without changing its contract. */
  experiences?: PlannedExperience[];
  restaurantDetails?: PlannedRestaurant;
  /** Generic planner intentions only; never rendered as venue names. */
  activityIntents?: string[];
  poiProvenance?: {
    attractionsDisplayed: number;
    restaurantsDisplayed: number;
    googleIds: string[];
    overpassIds: string[];
    generatedNamesRejected: number;
  };
}

export interface TripStop extends Place {
  nights: number;
  dayTrips: string[];
  hotel: HotelSuggestion;
  weather: StopWeather;
  /** True when the traveller said this stay was already arranged. */
  accommodationProvided?: boolean;
}

export interface PlannedExperience {
  id: string;
  provider: "google" | "overpass" | "opentripmap";
  providerPlaceId: string;
  sourceStatus: "google-live" | "google-cache" | "overpass-live" | "opentripmap-live";
  name: string;
  category: string;
  image?: string;
  description?: string;
  lat?: number;
  lon?: number;
  address?: string;
  rating?: number;
  reviewCount?: number;
  openingHours?: string[];
  openNow?: boolean;
  website?: string;
  providerUrl?: string;
  photoReference?: string;
  photoAttributions?: Array<{ displayName?: string; uri?: string; photoUri?: string }>;
  quality: DataQuality;
}

export interface PlannedRestaurant {
  id: string;
  provider: "google" | "overpass" | "opentripmap";
  providerPlaceId: string;
  sourceStatus: "google-live" | "google-cache" | "overpass-live" | "opentripmap-live";
  name: string;
  image?: string;
  description?: string;
  lat?: number;
  lon?: number;
  category?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  openingHours?: string[];
  openNow?: boolean;
  website?: string;
  providerUrl?: string;
  photoReference?: string;
  photoAttributions?: Array<{ displayName?: string; uri?: string; photoUri?: string }>;
  quality: DataQuality;
}

export interface TripScores {
  overall: number;
  experience: number;
  nature: number;
  food: number;
  weather: number;
  efficiency: number;
}

/** One transparent contributor to a route's overall score. */
export interface ScoreFactor {
  key: string;
  label: string;
  /** 0-100 score for this factor. */
  value: number;
  /** Share of the overall score, 0-1. */
  weight: number;
  /** Plain-language reason, written for a traveller not an engineer. */
  explanation: string;
}

export interface OptimizerMetricBreakdown {
  totalCost: number | null;
  journeyDuration: number | null;
  transferCount: number | null;
  hotelQuality: number | null;
  attractionRelevance: number | null;
  pacing: number | null;
  preferenceMatch: number | null;
}

export interface TripProvenance {
  planner: {
    provider: string;
    model: string;
    configuredModel?: string;
    active: boolean;
    mode?: "llm" | "heuristic";
    failureReason?: string;
    httpStatus?: number | null;
    parseSuccess?: boolean;
    timedOut?: boolean;
  };
  hotelbeds?: {
    source: "hotelbeds-live" | "hotelbeds-cache" | "demo-fixture";
    status: number | null;
    environment: string;
    liveHotelCount: number;
    quotaExceeded: boolean;
    cacheAgeMs: number | null;
    liveAvailability: boolean;
    bookable: boolean;
    fallbackReason?: string;
    responseBody?: string;
  };
  pois?: {
    provider: string;
    status: "active" | "partial" | "empty" | "error";
    source?: string;
    liveAttractionCount: number;
    liveRestaurantCount: number;
    cities?: Array<{
      requestedCity: string;
      latitude: number;
      longitude: number;
      httpStatus: number | null;
      returnedElementCount: number;
      parsedElementCount: number;
      normalizedAttractionCount: number;
      normalizedRestaurantCount: number;
      renderingAttractionCount: number;
      renderingRestaurantCount: number;
      attempts?: Array<{
        attempt: string;
        radiusMetres: number;
        endpoint?: string;
        query: string;
        httpStatus: number;
        returnedElementCount: number;
        parsedElementCount: number;
        normalizedAttractionCount: number;
        normalizedRestaurantCount: number;
      }>;
    }>;
    google?: {
      enabled: boolean;
      active: boolean;
      source?: string;
      httpStatus: number | null;
      callsThisItinerary: number;
      callsThisHour: number;
      callsToday: number;
      callsThisMonth: number;
      configuredMonthlyLimit: number;
      configuredDailyLimit: number;
      configuredHourlyLimit: number;
      remainingMonthlyAllowance: number;
      cacheHits: number;
      cacheMisses: number;
      attractionSearchCalls: number;
      restaurantSearchCalls: number;
      detailsCalls: number;
      photoCalls: number;
      quotaBlocked: boolean;
      quotaBlockReason?: string;
      errorCategory?: string;
    };
    fallbackProvider?: string | null;
    fallbackMessage?: string;
    partial?: boolean;
    categories?: {
      attractions: { source: string; count: number; unavailableReason?: string };
      restaurants: { source: string; count: number; unavailableReason?: string };
    };
  };
  apiCalls: string[];
  poiIds: string[];
  metrics: OptimizerMetricBreakdown;
  fallbackUsed: boolean;
  fallbackReasons: string[];
}

/**
 * A concrete, locally-costed change a traveller can apply to a route without
 * re-running the whole optimiser.
 */
export interface BudgetStretchOption {
  id: string;
  label: string;
  detail: string;
  /** Negative saves money, positive spends more. */
  costDelta: number;
  tradeoff: string;
}

export interface TripRoute {
  id: string;
  title: string;
  tagline: string;
  image: string;
  countries: string[];
  stops: TripStop[];
  legs: RouteLeg[];
  scores: TripScores;
  /** Transparent breakdown of how `scores.overall` was reached. */
  scoreFactors: ScoreFactor[];
  /** Cheap, locally-costed adjustments offered under "Stretch your budget". */
  stretchOptions: BudgetStretchOption[];
  cost: number;
  costBreakdown: CostBreakdown;
  budgetLeft: number;
  journeyHours: number;
  transportRecommendation: string;
  reasoning: string[];

  packingList: string[];
  itinerary: DayPlan[];
  quality: DataQuality;
  preferences: TripPreferences;
  generatedAt: string;
  /** Development diagnostics for proving how this recommendation was assembled. */
  provenance?: TripProvenance;
  bookingSelection?: TripBookingSelection;
  regionalDiscovery?: RegionalRouteContext;
}

export type RegionalRouteFamily =
  | "destination-only"
  | "nearby-day-trip"
  | "second-city"
  | "regional-hidden-gem"
  | "major-nearby-city"
  | "scenic-route";

export interface RegionalRouteContext {
  requestedDestination: string;
  family: RegionalRouteFamily;
  destinationType: string;
  addedDestinations: Array<{
    name: string;
    country: string;
    lat: number;
    lon: number;
    estimatedTravelMinutes: number;
    modes: string[];
    provenance: string;
  }>;
  travelMinutesAdded: number;
  primaryBenefit: string;
  tradeOff: string;
  suggestionReason: string;
  feasibilityStatus: "valid" | "near-miss";
  metrics: {
    regionalDiscoveryValue: number;
    travelTimePenalty: number;
    cityChangePenalty: number;
    thematicDiversity: number;
    hiddenGemValue: number;
    budgetEfficiency: number;
    preferenceGain: number;
    overnightValue: number;
    routeCoherence: number;
  };
}

export interface BookingFlightSelection {
  id: string;
  source: "live" | "estimate";
  airlineName: string;
  originCode: string;
  destinationCode: string;
  departureAt?: string;
  arrivalAt?: string;
  durationMinutes: number;
  stops: number;
  baggageSummary?: string;
  totalAmount: number;
  currency: string;
  bookingUrl?: string;
}

export interface TripBookingSelection {
  flight?: BookingFlightSelection;
  hotelNamesByStop: Record<string, string>;
}

export interface SavedTrip {
  id: string;
  name: string;
  savedAt: string;
  route: TripRoute;
}

export type OptimiseGoal =
  "spend-less" | "reduce-travel" | "add-city" | "more-nature" | "more-luxury" | "avoid-flights";

/** Anything a traveller can bookmark locally. */
export type FavouriteKind = "attraction" | "restaurant" | "daytrip";

export interface FavouriteItem {
  id: string;
  kind: FavouriteKind;
  title: string;
  subtitle: string;
  image: string;
  meta: string;
  savedAt: string;
}
