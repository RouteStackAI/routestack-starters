import { dateTokenPattern, normalizeWhitespace } from "./shared.js";

export interface ParsedFlightsCommand {
  originQuery: string;
  destinationQuery: string;
  departureInput: string;
  returnInput?: string;
  adults: number;
  children: number;
  infants: number;
  cabinClass: string;
}

const flightsPattern = new RegExp(
  `^(?<origin>.+?)\\s+to\\s+(?<destination>.+?)\\s+(?<departure>${dateTokenPattern})(?:\\s+return\\s+(?<return>${dateTokenPattern}))?(?:,\\s*(?<adults>\\d+)\\s*adults?)?(?:,\\s*(?<children>\\d+)\\s*children?)?(?:,\\s*(?<infants>\\d+)\\s*infants?)?(?:,\\s*(?<cabin>economy|premium economy|premium_economy|business|first))?$`,
  "i",
);

export function parseFlightsCommand(text: string): ParsedFlightsCommand | null {
  const normalized = normalizeWhitespace(text);
  const match = normalized.match(flightsPattern);
  if (!match?.groups) return null;

  const cabinRaw = (match.groups.cabin ?? "economy").toLowerCase();

  return {
    originQuery: match.groups.origin.trim(),
    destinationQuery: match.groups.destination.trim(),
    departureInput: match.groups.departure.trim(),
    returnInput: match.groups.return?.trim(),
    adults: Number(match.groups.adults ?? "1"),
    children: Number(match.groups.children ?? "0"),
    infants: Number(match.groups.infants ?? "0"),
    cabinClass: cabinRaw.replace(/\s+/g, "_"),
  };
}

export const flightsUsage =
  "Use `/flights LAX to JFK Dec 15`, `/flights SFO to JFK 2026-12-15`, or add `return`, `adults`, and `business` at the end.";
