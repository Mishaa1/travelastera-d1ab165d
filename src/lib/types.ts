/** Shared domain types for the Astera optimisation engine. */

export type DataSource = "live" | "estimate" | "mock";

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

export interface TripPreferences {
  startCity: string;
  endCity: string;
  startDate: string;
  endDate: string;
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
}

export interface StopWeather {
  city: string;
  tempC: number;
  rainChance: number;
  summary: string;
  quality: DataQuality;
}

export interface HotelSuggestion {
  name: string;
  area: string;
  nightlyFrom: number;
  rating: number;
  style: string;
  quality: DataQuality;
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
}

export interface TripStop extends Place {
  nights: number;
  dayTrips: string[];
  hotel: HotelSuggestion;
  weather: StopWeather;
}

export interface TripScores {
  overall: number;
  experience: number;
  nature: number;
  food: number;
  weather: number;
  efficiency: number;
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
}

export interface SavedTrip {
  id: string;
  name: string;
  savedAt: string;
  route: TripRoute;
}

export type OptimiseGoal =
  | "spend-less"
  | "reduce-travel"
  | "add-city"
  | "more-nature"
  | "more-luxury"
  | "avoid-flights";

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
