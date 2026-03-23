import type { McpEvent } from "../mcp-client.js";

export interface BookingConfirmedPayload {
  event: string;
  bookingId: string;
  status: string;
  passenger: string;
  summary: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Transform a booking.confirmed event into a forward-ready payload.
 * Return null to skip forwarding this event.
 */
export function handleBookingConfirmed(
  event: McpEvent,
): BookingConfirmedPayload | null {
  const { data } = event;

  return {
    event: "booking.confirmed",
    bookingId: (data.bookingId as string) ?? "unknown",
    status: "confirmed",
    passenger: (data.passenger as string) ?? (data.name as string) ?? "unknown",
    summary: buildSummary(data),
    data,
    timestamp: event.timestamp,
  };
}

function buildSummary(data: Record<string, unknown>): string {
  const parts: string[] = [];

  if (data.type) parts.push(`${data.type}`);
  if (data.origin && data.destination) {
    parts.push(`${data.origin} → ${data.destination}`);
  }
  if (data.location) parts.push(`at ${data.location}`);
  if (data.date) parts.push(`on ${data.date}`);
  if (data.price) parts.push(`$${data.price}`);

  return parts.length > 0
    ? `Booking confirmed: ${parts.join(", ")}`
    : "Booking confirmed";
}
