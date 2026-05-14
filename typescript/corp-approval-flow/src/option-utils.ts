import type { TravelOption } from "./types.js";

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function normalizeOption(input: Record<string, unknown>): TravelOption {
  return {
    title: String(input.title ?? "Option"),
    description: String(input.description ?? ""),
    totalPrice: toNumber(input.totalPrice),
    currency: typeof input.currency === "string" ? input.currency : undefined,
    paymentUrl: typeof input.paymentUrl === "string" ? input.paymentUrl : undefined,
    raw: input.raw && typeof input.raw === "object" ? (input.raw as Record<string, unknown>) : input,
  };
}
