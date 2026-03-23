import type { McpEvent } from "../mcp-client.js";

export interface BookingCancelledPayload {
  event: string;
  bookingId: string;
  status: string;
  reason: string;
  data: Record<string, unknown>;
  timestamp: string;
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
    bookingId: (data.bookingId as string) ?? "unknown",
    status: "cancelled",
    reason: (data.reason as string) ?? "not specified",
    data,
    timestamp: event.timestamp,
  };
}
