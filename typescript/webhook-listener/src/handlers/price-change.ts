import type { McpEvent } from "../mcp-client.js";

export interface PriceChangePayload {
  event: string;
  itemId: string;
  itemType: string;
  previousPrice: number | null;
  currentPrice: number | null;
  currency: string;
  direction: "up" | "down" | "unknown";
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Transform a price.changed event into a forward-ready payload.
 * Return null to skip forwarding this event.
 */
export function handlePriceChange(
  event: McpEvent,
): PriceChangePayload | null {
  const { data } = event;

  const previousPrice = data.previousPrice as number | null ?? null;
  const currentPrice = data.currentPrice as number | null ?? null;

  let direction: "up" | "down" | "unknown" = "unknown";
  if (previousPrice != null && currentPrice != null) {
    direction = currentPrice > previousPrice ? "up" : "down";
  }

  return {
    event: "price.changed",
    itemId: (data.itemId as string) ?? (data.id as string) ?? "unknown",
    itemType: (data.itemType as string) ?? (data.type as string) ?? "unknown",
    previousPrice,
    currentPrice,
    currency: (data.currency as string) ?? "USD",
    direction,
    data,
    timestamp: event.timestamp,
  };
}
