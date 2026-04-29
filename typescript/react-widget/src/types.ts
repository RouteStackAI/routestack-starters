import type { McpTool } from "./mcp-client.js";

export type SearchMode = "hotels" | "flights" | "cars";

export interface HotelRoomOccupancy {
  adults: number;
  children: number;
  childAges?: number[];
}

export interface LookupOption {
  id: string;
  label: string;
  subtitle?: string;
  code?: string;
  lat?: number;
  long?: number;
  raw: Record<string, unknown>;
}

export interface HotelLookupOption {
  city: string;
  type: string;
  referenceId: string;
  fullName: string;
  country: string;
  id: string;
  lat: number;
  long: number;
  raw: Record<string, unknown>;
}

export interface HotelListing {
  id: string;
  name: string;
  address: string;
  price?: number;
  currency?: string;
  starRating?: number;
  rating?: number;
  image?: string;
  latitude?: number;
  longitude?: number;
  token?: string;
  correlationId?: string;
  raw: Record<string, unknown>;
}

export interface HotelRoomOffer {
  id: string;
  name: string;
  recommendationId?: string;
  price?: number;
  currency?: string;
  refundable?: boolean;
  mealPlan?: string;
  description?: string;
  facilities?: string[];
  raw: Record<string, unknown>;
}

export interface FlightOffer {
  id: string;
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration?: string;
  price?: number;
  currency?: string;
  stops?: number;
  fareSourceCode?: string;
  correlationId?: string;
  sessionId?: string;
  searchFilterObj?: string;
  raw: Record<string, unknown>;
}

export interface CarOffer {
  id: string;
  vendor: string;
  vehicleName: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  transmission?: string;
  seats?: number;
  price?: number;
  currency?: string;
  fareCode?: string;
  correlationId?: string;
  raw: Record<string, unknown>;
}

export interface TravelSearchResult {
  mode: SearchMode;
  payload: Record<string, unknown>;
  results: Record<string, unknown>;
}

export interface TravelSearchProps {
  apiBaseUrl?: string;
  title?: string;
  subtitle?: string;
  defaultMode?: SearchMode;
  onResult?: (result: TravelSearchResult) => void;
}

export interface ToolState {
  connected: boolean;
  transport: string;
  tools: McpTool[];
}
