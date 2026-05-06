import { dateTokenPattern, normalizeWhitespace } from "./shared.js";

export interface ParsedCarsCommand {
  pickupQuery: string;
  dropoffQuery: string;
  pickupInput: string;
  dropoffInput: string;
  driverAge: number;
}

const carsPattern = new RegExp(
  `^(?<pickup>.+?)(?:\\s+to\\s+(?<dropoff>.+?))?\\s+(?<start>${dateTokenPattern})\\s*(?:-|to)\\s*(?<end>\\d{1,2}|${dateTokenPattern})(?:,\\s*(?<age>\\d+)\\s*(?:years? old|yo|driver age))?$`,
  "i",
);

export function parseCarsCommand(text: string): ParsedCarsCommand | null {
  const normalized = normalizeWhitespace(text);
  const match = normalized.match(carsPattern);
  if (!match?.groups) return null;

  const pickupQuery = match.groups.pickup.trim();

  return {
    pickupQuery,
    dropoffQuery: match.groups.dropoff?.trim() ?? pickupQuery,
    pickupInput: match.groups.start.trim(),
    dropoffInput: match.groups.end.trim(),
    driverAge: Number(match.groups.age ?? "30"),
  };
}

export const carsUsage =
  "Use `/cars Miami Dec 1-5` or `/cars JFK Airport to LGA Airport 2026-12-01 to 2026-12-05, 30 yo`.";
