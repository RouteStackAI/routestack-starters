import type { McpTool } from "./mcp-client.js";

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

export interface HotelRoomOccupancy {
  adults: number;
  children: number;
  childAges?: number[];
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
  raw: Record<string, unknown>;
}

export interface HotelRoomOffer {
  id: string;
  name: string;
  recommendationId?: string;
  price?: number;
  currency?: string;
  publishedRate?: number;
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
  routeSummary?: string;
  cabin?: string;
  fareFamily?: string;
  remainingSeats?: number;
  exchangeTime?: string;
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

export interface ToolState {
  connected: boolean;
  transport: string;
  tools: McpTool[];
}

export interface HotelSessionData {
  query: string;
  destinationOptions: HotelLookupOption[];
  selectedDestination?: HotelLookupOption;
  checkIn: string;
  checkOut: string;
  rooms: HotelRoomOccupancy[];
  currency: string;
  token?: string | null;
  correlationId?: string | null;
  hotels: HotelListing[];
  selectedHotel?: HotelListing;
  hotelDetails?: Record<string, unknown> | null;
  roomOffers: HotelRoomOffer[];
  selectedRoom?: HotelRoomOffer;
  paymentUrl?: string;
}

export interface FlightSessionData {
  originQuery: string;
  destinationQuery: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabinClass: string;
  originOptions: LookupOption[];
  destinationOptions: LookupOption[];
  origin?: LookupOption;
  destination?: LookupOption;
  flights: FlightOffer[];
  selectedFlight?: FlightOffer;
  session?: Record<string, unknown> | null;
  correlationId?: string;
  searchFilterObj?: string;
  paymentUrl?: string;
}

export interface CarSessionData {
  pickupQuery: string;
  dropoffQuery: string;
  pickupDate: string;
  dropoffDate: string;
  driverAge: number;
  pickup?: LookupOption;
  dropoff?: LookupOption;
  cars: CarOffer[];
  selectedCar?: CarOffer;
  paymentUrl?: string;
}

export type TravelSession =
  | {
      id: string;
      kind: "hotel";
      userId: string;
      createdAt: number;
      updatedAt: number;
      data: HotelSessionData;
    }
  | {
      id: string;
      kind: "flight";
      userId: string;
      createdAt: number;
      updatedAt: number;
      data: FlightSessionData;
    }
  | {
      id: string;
      kind: "car";
      userId: string;
      createdAt: number;
      updatedAt: number;
      data: CarSessionData;
    };
