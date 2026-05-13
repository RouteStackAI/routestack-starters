import type { McpEvent } from "../mcp-client.js";

export interface PriceChangePayload {
  event: string;
  itemId: string;
  itemType: string;
  previousPrice: number | null;
  currentPrice: number | null;
  currency: string;
  direction: "up" | "down" | "unchanged" | "unknown";
  data: Record<string, unknown>;
  timestamp: string;
}

function toText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Transform a price.changed event into a forward-ready payload.
 * Return null to skip forwarding this event.
 */
export function handlePriceChange(
  event: McpEvent,
): PriceChangePayload | null {
  const { data } = event;

  const previousPrice = toNumber(data.previousPrice);
  const currentPrice = toNumber(data.currentPrice);

  let direction: "up" | "down" | "unchanged" | "unknown" = "unknown";
  if (previousPrice != null && currentPrice != null) {
    if (currentPrice > previousPrice) {
      direction = "up";
    } else if (currentPrice < previousPrice) {
      direction = "down";
    } else {
      direction = "unchanged";
    }
  }

  return {
    event: "price.changed",
    itemId: toText(data.itemId ?? data.id, "unknown"),
    itemType: toText(data.itemType ?? data.type, "unknown"),
    previousPrice,
    currentPrice,
    currency: toText(data.currency, "USD"),
    direction,
    data,
    timestamp: event.timestamp,
  };
}
