export interface TravelProfile {
  interests: string[];
  pace: "relaxed" | "balanced" | "fast";
  stayStyle: "budget" | "mid-range" | "luxury";
  diet: string;
  completed: boolean;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  provider: "email" | "google" | "apple";
  profile: TravelProfile;
}
