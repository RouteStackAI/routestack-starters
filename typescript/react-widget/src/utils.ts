import { McpToolResult } from "./mcp-client";
import {
  CarOffer,
  FlightOffer,
  HotelListing,
  HotelLookupOption,
  HotelRoomOccupancy,
  HotelRoomOffer,
  LookupOption,
} from "./types";

export function formatPrice(price?: number, currency?: string) {
  if (price === undefined) return "Price on request";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency ?? "USD"} ${price}`;
  }
}

export function formatRoomSummary(rooms: HotelRoomOccupancy[]) {
  return rooms
    .map(
      (room, index) => `Room ${index + 1}: ${room.adults}A/${room.children}C`,
    )
    .join(" • ");
}

export function readStringRecord(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!record) return undefined;
  return readString(record, keys);
}

export function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

export function readBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getFutureDate(daysAhead: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

export function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

export function hasTool(tools: { name: string }[], toolName: string) {
  return tools.some((tool) => tool.name === toolName);
}

export function firstRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;
  if (Array.isArray(value)) {
    const record = value.find(isRecord);
    return record ?? null;
  }
  return null;
}

export function findRecords(
  value: unknown,
  preferredKeys: string[],
): Array<Record<string, unknown>> {
  const visited = new Set<unknown>();
  const queue: unknown[] = [value];

  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      const valid = current.filter(isRecord);
      if (valid.length) return valid;
      queue.push(...current);
      continue;
    }

    if (!isRecord(current)) continue;

    for (const key of preferredKeys) {
      const candidate = current[key];
      if (Array.isArray(candidate) && candidate.some(isRecord)) {
        return candidate.filter(isRecord);
      }
    }

    queue.push(...Object.values(current));
  }

  return [];
}

export function findSessionMeta(raw: unknown) {
  const root = firstRecord(raw);
  const result = root && isRecord(root.result) ? root.result : root;

  return {
    token: readStringRecord(result, ["token"]),
    correlationId: readStringRecord(result, ["correlationId", "correlationid"]),
    sessionId: readStringRecord(result, ["sessionId", "sessionid"]),
  };
}

export function extractJson(result: McpToolResult): unknown {
  for (const item of result.content) {
    if (typeof item.text === "string") {
      try {
        return JSON.parse(item.text) as unknown;
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function extractText(result: McpToolResult) {
  return result.content
    .map((item) => item.text ?? JSON.stringify(item))
    .join("\n");
}

export function formatToolError(result: McpToolResult) {
  const json = extractJson(result);
  if (json) return JSON.stringify(json);
  return extractText(result) || "RouteStack tool returned an unknown error.";
}

export function extractPaymentUrl(raw: unknown) {
  const root = firstRecord(raw);
  if (!root) return "";
  return (
    readStringRecord(root, ["paymentUrl", "url", "portalUrl", "checkoutUrl"]) ??
    ""
  );
}

export function normalizeHotelLookupOptions(
  raw: { result: any[] },
  fallbackLabel: string,
): HotelLookupOption[] {
  let destinations: HotelLookupOption[] = [];

  if (raw.result?.length > 0) {
    destinations = raw.result as HotelLookupOption[];
  }

  return destinations;
}

export function normalizeLookupOptions(
  raw: unknown,
  fallbackLabel: string,
): LookupOption[] {
  const records = findRecords(raw, [
    "result",
    "results",
    "items",
    "data",
    "destinations",
    "locations",
  ]);

  return records.slice(0, 8).map((item, index) => ({
    id:
      readString(item, ["id", "destinationId", "code", "airportCode"]) ??
      `${fallbackLabel}-${index}`,
    label:
      readString(item, [
        "name",
        "label",
        "displayName",
        "city",
        "description",
      ]) ?? fallbackLabel,
    subtitle: readString(item, ["fullName", "country", "region", "address"]),
    code: readString(item, ["code", "airportCode", "iata", "iataCode"]),
    lat: readNumber(item, ["lat", "latitude"]),
    long: readNumber(item, ["long", "lng", "longitude"]),
    raw: item,
  }));
}

export function normalizeHotelListings(
  raw: unknown,
  fallbackLocation: string,
): {
  token: string | null;
  correlationId: string | null;
  hotels: HotelListing[];
} {
  const session = findSessionMeta(raw);
  const records = findRecords(raw, [
    "result",
    "hotels",
    "results",
    "items",
    "properties",
  ]);

  const hotels = records.slice(0, 8).map((item, index) => ({
    id: readString(item, ["id", "hotelId"]) ?? `hotel-${index}`,
    name: readString(item, ["name", "hotelName"]) ?? "Hotel",
    address:
      readString(item, ["address", "location", "city", "region"]) ??
      fallbackLocation,
    price: readNumber(item, ["ourprice", "price", "publishedRate", "rate"]),
    currency: readString(item, ["currency", "currencyCode"]),
    starRating: readNumber(item, ["starRating", "stars"]),
    rating: readNumber(item, ["rating", "reviewScore"]),
    image: readString(item, ["heroImage", "image", "imageUrl"]),
    latitude: readNumber(item, ["lat", "latitude"]),
    longitude: readNumber(item, ["long", "longitude"]),
    raw: item,
  }));

  return {
    hotels,
    token: session.token ?? null,
    correlationId: session.correlationId ?? null,
  };
}

export function normalizeHotelRoomOffers(raw: any): HotelRoomOffer[] {
  let rooms = [];

  if (raw?.result?.groups?.length > 0) {
    rooms = raw?.result?.groups
      .map((d: any) =>
        d.rooms.map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          recommendationId: r.recommendationId,
          rateid: r.rateid,
          price: r.ourprice,
          currency: r.currency,
          publishedRate: r.publishedRate,
          refundable: r.refundable,
          mealPlan: r.mealPlan,
          facilities:
            r?.facilities?.length > 0
              ? r?.facilities.slice(0, 5).map((f: any) => f.name)
              : [],
          raw: r,
        })),
      )
      .flat();
  }

  return rooms;
}

export function normalizeFlightOffers(raw: unknown): FlightOffer[] {
  const session = findSessionMeta(raw);
  const records = findRecords(raw, [
    "flights",
    "results",
    "items",
    "data",
    "result",
  ]);

  return records.slice(0, 10).map((item, index) => ({
    id:
      readString(item, ["id", "fareSourceCode", "fareCode"]) ??
      `flight-${index}`,
    airline:
      readString(item, ["airline", "carrier", "carrierName"]) ?? "Airline",
    flightNumber: readString(item, ["flightNumber", "number"]) ?? "N/A",
    from: readString(item, ["origin", "from", "departureAirport"]) ?? "Origin",
    to:
      readString(item, ["destination", "to", "arrivalAirport"]) ??
      "Destination",
    departure:
      readString(item, ["departure", "departureTime", "departAt"]) ?? "N/A",
    arrival: readString(item, ["arrival", "arrivalTime", "arriveAt"]) ?? "N/A",
    duration: readString(item, ["duration"]),
    price: readNumber(item, ["price", "amount", "total"]),
    currency: readString(item, ["currency", "currencyCode"]),
    stops: readNumber(item, ["stops", "stopCount"]),
    fareSourceCode: readString(item, ["fareSourceCode", "fareCode"]),
    correlationId:
      readString(item, ["correlationId", "correlationid"]) ??
      session.correlationId,
    sessionId: readString(item, ["sessionId"]) ?? session.sessionId,
    searchFilterObj: readString(item, ["searchFilterObj"]),
    raw: item,
  }));
}

export function normalizeCarOffers(raw: unknown): CarOffer[] {
  const session = findSessionMeta(raw);
  const records = findRecords(raw, [
    "cars",
    "vehicles",
    "results",
    "items",
    "data",
    "result",
  ]);

  return records.slice(0, 10).map((item, index) => ({
    id: readString(item, ["id", "fareCode", "vehicleId"]) ?? `car-${index}`,
    vendor:
      readString(item, ["vendor", "provider", "company"]) ?? "Rental partner",
    vehicleName:
      readString(item, ["vehicleName", "name", "carType", "description"]) ??
      "Vehicle",
    pickupLocation: readString(item, ["pickupLocation", "pickup", "location"]),
    dropoffLocation: readString(item, ["dropoffLocation", "dropoff"]),
    transmission: readString(item, ["transmission"]),
    seats: readNumber(item, ["seats", "passengers"]),
    price: readNumber(item, ["price", "amount", "total"]),
    currency: readString(item, ["currency", "currencyCode"]),
    fareCode: readString(item, ["fareCode", "fareSourceCode"]),
    correlationId:
      readString(item, ["correlationId", "correlationid"]) ??
      session.correlationId,
    raw: item,
  }));
}
