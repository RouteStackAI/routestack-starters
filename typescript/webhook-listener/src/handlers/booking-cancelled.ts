import type { McpEvent } from "../mcp-client.js";

export interface BookingCancelledPayload {
  event: string;
  bookingId: string;
  status: string;
  reason: string;
  data: Record<string, unknown>;
  timestamp: string;
}

function toText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

/**
 * Transform a booking.cancelled event into a forward-ready payload.
 * Return null to skip forwarding this event.
 */
export function handleBookingCancelled(
  event: McpEvent,
): BookingCancelledPayload | null {
  const { data } = event;

  return {
    event: "booking.cancelled",
    bookingId: toText(data.bookingId, "unknown"),
    status: "cancelled",
    reason: toText(data.reason, "not specified"),
    data,
    timestamp: event.timestamp,
  };
}
