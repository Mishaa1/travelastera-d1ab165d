export interface StructuredNearbyDestination {
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  estimatedTravelMinutes: number;
  modes: Array<"train" | "bus" | "boat" | "car">;
  type: string;
  themes: string[];
  suitableFor: Array<"day-trip" | "overnight">;
  provenance: "curated-adjacency";
  hiddenGem?: boolean;
}

export const CURATED_DESTINATION_ADJACENCY: Record<string, StructuredNearbyDestination[]> = {
  vienna: [
    { name: "Bratislava", country: "Slovakia", countryCode: "SK", lat: 48.1486, lon: 17.1077, estimatedTravelMinutes: 60, modes: ["train", "bus", "boat"], type: "nearby-capital", themes: ["old-town", "food", "riverfront", "history"], suitableFor: ["day-trip", "overnight"], provenance: "curated-adjacency" },
    { name: "Wachau Valley", country: "Austria", countryCode: "AT", lat: 48.36, lon: 15.43, estimatedTravelMinutes: 70, modes: ["train", "car", "boat"], type: "scenic-region", themes: ["nature", "wine", "photography", "history"], suitableFor: ["day-trip"], provenance: "curated-adjacency", hiddenGem: true },
    { name: "Brno", country: "Czechia", countryCode: "CZ", lat: 49.1951, lon: 16.6068, estimatedTravelMinutes: 95, modes: ["train", "bus"], type: "historic-town", themes: ["food", "architecture", "history", "hidden-gems"], suitableFor: ["day-trip", "overnight"], provenance: "curated-adjacency", hiddenGem: true },
    { name: "Graz", country: "Austria", countryCode: "AT", lat: 47.0707, lon: 15.4395, estimatedTravelMinutes: 150, modes: ["train", "car"], type: "historic-city", themes: ["food", "architecture", "photography"], suitableFor: ["overnight"], provenance: "curated-adjacency" },
    { name: "Budapest", country: "Hungary", countryCode: "HU", lat: 47.4979, lon: 19.0402, estimatedTravelMinutes: 155, modes: ["train", "bus"], type: "major-nearby-city", themes: ["food", "nightlife", "history", "photography"], suitableFor: ["overnight"], provenance: "curated-adjacency" },
    { name: "Salzburg", country: "Austria", countryCode: "AT", lat: 47.8095, lon: 13.055, estimatedTravelMinutes: 150, modes: ["train", "car"], type: "scenic-city", themes: ["nature", "music", "photography", "history"], suitableFor: ["overnight"], provenance: "curated-adjacency" },
  ],
  milan: [
    { name: "Bergamo", country: "Italy", countryCode: "IT", lat: 45.6983, lon: 9.6773, estimatedTravelMinutes: 50, modes: ["train", "car"], type: "historic-town", themes: ["history", "food", "photography", "hidden-gems"], suitableFor: ["day-trip", "overnight"], provenance: "curated-adjacency", hiddenGem: true },
    { name: "Como", country: "Italy", countryCode: "IT", lat: 45.8081, lon: 9.0852, estimatedTravelMinutes: 55, modes: ["train", "car", "boat"], type: "scenic-region", themes: ["nature", "photography", "food", "lake"], suitableFor: ["day-trip", "overnight"], provenance: "curated-adjacency" },
    { name: "Turin", country: "Italy", countryCode: "IT", lat: 45.0703, lon: 7.6869, estimatedTravelMinutes: 60, modes: ["train", "car"], type: "major-nearby-city", themes: ["food", "museums", "history", "architecture"], suitableFor: ["day-trip", "overnight"], provenance: "curated-adjacency" },
    { name: "Verona", country: "Italy", countryCode: "IT", lat: 45.4384, lon: 10.9916, estimatedTravelMinutes: 75, modes: ["train", "car"], type: "historic-city", themes: ["history", "food", "photography", "architecture"], suitableFor: ["day-trip", "overnight"], provenance: "curated-adjacency" },
    { name: "Lugano", country: "Switzerland", countryCode: "CH", lat: 46.0037, lon: 8.9511, estimatedTravelMinutes: 75, modes: ["train", "car"], type: "border-city", themes: ["nature", "lake", "food", "photography"], suitableFor: ["day-trip", "overnight"], provenance: "curated-adjacency" },
  ],
  annecy: [
    { name: "Geneva", country: "Switzerland", countryCode: "CH", lat: 46.2044, lon: 6.1432, estimatedTravelMinutes: 45, modes: ["bus", "car"], type: "border-city", themes: ["lake", "food", "culture", "photography"], suitableFor: ["day-trip", "overnight"], provenance: "curated-adjacency" },
    { name: "Chamonix", country: "France", countryCode: "FR", lat: 45.9237, lon: 6.8694, estimatedTravelMinutes: 75, modes: ["bus", "car"], type: "scenic-region", themes: ["nature", "mountains", "adventure", "photography"], suitableFor: ["day-trip", "overnight"], provenance: "curated-adjacency" },
    { name: "Lausanne", country: "Switzerland", countryCode: "CH", lat: 46.5197, lon: 6.6323, estimatedTravelMinutes: 95, modes: ["train", "car"], type: "scenic-city", themes: ["lake", "food", "culture", "photography"], suitableFor: ["day-trip", "overnight"], provenance: "curated-adjacency" },
    { name: "Lyon", country: "France", countryCode: "FR", lat: 45.764, lon: 4.8357, estimatedTravelMinutes: 115, modes: ["train", "bus", "car"], type: "major-nearby-city", themes: ["food", "history", "museums", "architecture"], suitableFor: ["day-trip", "overnight"], provenance: "curated-adjacency" },
    { name: "Aosta", country: "Italy", countryCode: "IT", lat: 45.737, lon: 7.3201, estimatedTravelMinutes: 150, modes: ["car", "bus"], type: "regional-hidden-gem", themes: ["mountains", "history", "food", "photography"], suitableFor: ["overnight"], provenance: "curated-adjacency", hiddenGem: true },
    { name: "Interlaken", country: "Switzerland", countryCode: "CH", lat: 46.6863, lon: 7.8632, estimatedTravelMinutes: 210, modes: ["train", "car"], type: "scenic-region", themes: ["mountains", "lake", "nature", "photography"], suitableFor: ["overnight"], provenance: "curated-adjacency" },
    { name: "Strasbourg", country: "France", countryCode: "FR", lat: 48.5734, lon: 7.7521, estimatedTravelMinutes: 235, modes: ["train", "car"], type: "historic-city", themes: ["history", "food", "architecture", "photography"], suitableFor: ["overnight"], provenance: "curated-adjacency" },
  ],
};

export function verifiedNearbyFor(input: {
  destination: string;
  maxMinutes: number;
  countryCode?: string;
  sameCountryOnly?: boolean;
}) {
  return (CURATED_DESTINATION_ADJACENCY[input.destination.trim().toLowerCase()] ?? []).filter(
    (place) => place.estimatedTravelMinutes <= input.maxMinutes && (!input.sameCountryOnly || place.countryCode === input.countryCode),
  );
}

export function allowedRegionalFamilies(input: {
  nights: number;
  mode: "off" | "day-trips" | "nearby-cities" | "surprise";
  hotelChanges: "none" | "one" | "flexible";
  existingAccommodation: boolean;
}) {
  const families = ["destination-only"];
  if (input.mode === "off") return families;
  families.push("nearby-day-trip");
  if (input.nights >= 4) families.push("regional-hidden-gem");
  if (input.mode === "day-trips" || input.nights <= 3 || input.hotelChanges === "none" || input.existingAccommodation) return families;
  families.push("second-city");
  if (input.nights >= 5) families.push("major-nearby-city");
  if (input.nights >= 6 && input.mode === "surprise") families.push("scenic-route");
  return families;
}
