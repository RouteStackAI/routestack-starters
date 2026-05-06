import { dateTokenPattern, normalizeWhitespace } from "./shared.js";

export interface ParsedHotelsCommand {
  query: string;
  checkInInput: string;
  checkOutInput: string;
  adults: number;
  children: number;
  rooms: number;
}

const hotelsPattern = new RegExp(
  `^(?<query>.+?)\\s+(?<start>${dateTokenPattern})\\s*(?:-|to)\\s*(?<end>\\d{1,2}|${dateTokenPattern})(?:,\\s*(?<guests>\\d+)\\s*guests?)?(?:,\\s*(?<rooms>\\d+)\\s*rooms?)?(?:,\\s*(?<children>\\d+)\\s*children?)?$`,
  "i",
);

export function parseHotelsCommand(text: string): ParsedHotelsCommand | null {
  const normalized = normalizeWhitespace(text);
  const match = normalized.match(hotelsPattern);
  if (!match?.groups) return null;

  const adults = Number(match.groups.guests ?? "2");
  const rooms = Number(match.groups.rooms ?? "1");
  const children = Number(match.groups.children ?? "0");

  return {
    query: match.groups.query.trim(),
    checkInInput: match.groups.start.trim(),
    checkOutInput: match.groups.end.trim(),
    adults: Number.isFinite(adults) ? adults : 2,
    children: Number.isFinite(children) ? children : 0,
    rooms: Number.isFinite(rooms) ? rooms : 1,
  };
}

export const hotelsUsage =
  "Use `/hotels Chicago Dec 20-22, 2 guests` or `/hotels Chicago 2026-12-20 to 2026-12-22, 2 guests, 1 room`.";
