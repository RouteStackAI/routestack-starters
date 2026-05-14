export type TravelType = "flight" | "hotel";

export type LookupOption = {
  id: string;
  label: string;
  code?: string;
  subtitle?: string;
  raw: Record<string, unknown>;
};

export type DestinationOption = {
  id: string;
  label: string;
  subtitle?: string;
  lat?: number;
  long?: number;
  raw: Record<string, unknown>;
};

export type TravelRequest = {
  employeeName: string;
  employeeEmail: string;
  managerEmail: string;
  purpose: string;
  travelType: TravelType;
  origin?: string;
  destination: string;
  checkInDate?: string;
  checkOutDate?: string;
  departDate?: string;
  returnDate?: string;
  travelers: number;
  budget: number;
};

export type TravelOption = {
  title: string;
  description: string;
  totalPrice?: number;
  currency?: string;
  paymentUrl?: string;
  raw: Record<string, unknown>;
};

export type RoomOption = {
  id: string;
  name: string;
  description: string;
  recommendationId?: string;
  publishedRate?: number;
  refundable: boolean;
  raw: Record<string, unknown>;
};

export type ApprovalRecord = { request: TravelRequest; selectedOption: TravelOption };

export { formatPrice } from "./utils";

export function getImage(raw: Record<string, unknown>) {
  const image = raw.heroImage ?? raw.image ?? raw.imageUrl;
  return typeof image === "string" ? image : undefined;
}
