import type { McpToolResult } from "./mcp-client.js";
import type {
  CarOffer,
  FlightOffer,
  HotelListing,
  HotelLookupOption,
  HotelRoomOccupancy,
  HotelRoomOffer,
  LookupOption,
} from "./types.js";

const MONTH_LOOKUP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

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
      (room, index) =>
        `Room ${index + 1}: ${room.adults} adult${room.adults === 1 ? "" : "s"}, ${room.children} child${room.children === 1 ? "" : "ren"}`,
    )
    .join(" | ");
}

export function truncate(text: string, max = 3000) {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

export function formatMinutes(totalMinutes?: number) {
  if (totalMinutes === undefined || !Number.isFinite(totalMinutes)) {
    return undefined;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
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

export function readBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

export function readStringRecord(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!record) return undefined;
  return readString(record, keys);
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

export function findFlightSearchMeta(raw: unknown) {
  const root = firstRecord(raw);
  const result = root && isRecord(root.result) ? root.result : root;

  return {
    correlationId:
      readStringRecord(result, ["correlationId", "correlationid"]) ??
      readStringRecord(root, ["correlationId", "correlationid"]),
    sessionId:
      readStringRecord(result, ["sessionId", "sessionid"]) ??
      readStringRecord(root, ["sessionId", "sessionid"]),
    searchFilterObj:
      readStringRecord(result, ["searchFilterObj"]) ??
      readStringRecord(root, ["searchFilterObj"]),
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

export function normalizeHotelLookupOptions(raw: {
  result?: unknown[];
}): HotelLookupOption[] {
  if (!Array.isArray(raw.result)) return [];

  return raw.result
    .filter(isRecord)
    .slice(0, 10)
    .map((item) => ({
      city: readString(item, ["city"]) ?? "",
      type: readString(item, ["type"]) ?? "",
      referenceId: readString(item, ["referenceId"]) ?? "",
      fullName: readString(item, ["fullName", "name"]) ?? "Destination",
      country: readString(item, ["country"]) ?? "",
      id: readString(item, ["id", "destinationId"]) ?? cryptoRandomId(),
      lat: readNumber(item, ["lat", "latitude"]) ?? 0,
      long: readNumber(item, ["long", "lng", "longitude"]) ?? 0,
      raw: item,
    }));
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

  return {
    token: session.token ?? null,
    correlationId: session.correlationId ?? null,
    hotels: records.slice(0, 5).map((item, index) => ({
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
    })),
  };
}

export function normalizeHotelRoomOffers(raw: unknown): HotelRoomOffer[] {
  const root = firstRecord(raw);
  const result = root && isRecord(root.result) ? root.result : root;
  const groups = result && Array.isArray(result.groups) ? result.groups : [];

  return groups
    .filter(isRecord)
    .flatMap((group) => {
      const rooms = Array.isArray(group.rooms) ? group.rooms : [];
      return rooms.filter(isRecord).map((room) => ({
        id: readString(room, ["id"]) ?? cryptoRandomId(),
        name: readString(room, ["name"]) ?? "Room",
        recommendationId: readString(room, ["recommendationId"]),
        price: readNumber(room, ["ourprice", "price", "publishedRate"]),
        currency: readString(room, ["currency", "currencyCode"]),
        publishedRate: readNumber(room, ["publishedRate"]),
        refundable: readBoolean(room, ["refundable"]),
        mealPlan: readString(room, ["mealPlan", "boardBasis"]),
        description: readString(room, ["description"]),
        facilities: Array.isArray(room.facilities)
          ? room.facilities
              .filter(isRecord)
              .map((facility) => readString(facility, ["name"]) ?? "")
              .filter(Boolean)
              .slice(0, 5)
          : [],
        raw: room,
      }));
    })
    .slice(0, 5);
}

export function normalizeFlightOffers(raw: unknown): FlightOffer[] {
  const session = findSessionMeta(raw);
  const root = firstRecord(raw);
  const records = findRecords(raw, [
    "flights",
    "results",
    "items",
    "data",
    "result",
  ]);

  const currency =
    readStringRecord(root, ["currency", "currencyCode"]) ??
    readStringRecord(session as Record<string, unknown>, ["currency"]);

  return records.slice(0, 5).map((item, index) => {
    const segments = Array.isArray(item.flights)
      ? item.flights.filter(isRecord)
      : [];
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1] ?? firstSegment;
    const routeCodes = segments
      .flatMap((segment, segmentIndex) => {
        const departure = readString(segment, ["departure"]);
        const arrival = readString(segment, ["arrival"]);
        return segmentIndex === 0 ? [departure, arrival] : [arrival];
      })
      .filter((value): value is string => Boolean(value));

    return {
      id: `flight-${index}`,
      airline:
        readString(firstSegment ?? item, ["airline", "carrier", "carrierName"]) ??
        "Airline",
      flightNumber: segments.length
        ? segments
            .map((segment) =>
              [
                readString(segment, ["flightCode"]),
                readString(segment, ["flightNumber"]),
              ]
                .filter(Boolean)
                .join(" "),
            )
            .filter(Boolean)
            .join(", ")
        : readString(item, ["flightNumber", "number"]) ?? "N/A",
      from:
        readString(firstSegment ?? item, ["departure", "origin", "from"]) ??
        "Origin",
      to:
        readString(lastSegment ?? item, ["arrival", "destination", "to"]) ??
        "Destination",
      departure:
        readString(firstSegment ?? item, ["departureTime", "departure", "departAt"]) ??
        "N/A",
      arrival:
        readString(lastSegment ?? item, ["arrivalTime", "arrival", "arriveAt"]) ??
        "N/A",
      duration:
        formatMinutes(readNumber(item, ["triptime", "totalDuration"])) ??
        readString(item, ["duration"]),
      price: readNumber(item, [
        "ourprice",
        "showOurprice",
        "totalFare",
        "price",
        "amount",
      ]),
      currency: readString(item, ["currency", "currencyCode"]) ?? currency,
      stops: readNumber(item, ["stops", "stopCount"]),
      routeSummary: routeCodes.join(" -> "),
      cabin: readString(firstSegment ?? item, ["cabin"]),
      fareFamily: readString(firstSegment ?? item, ["fareFamily"]),
      remainingSeats: readNumber(firstSegment ?? item, ["remainingSeats"]),
      exchangeTime: readString(item, ["exchangeTime"]),
      fareSourceCode: readString(item, ["fareSourceCode", "fareCode"]),
      correlationId:
        readString(item, ["correlationId", "correlationid"]) ??
        readStringRecord(root, ["correlationId", "correlationid"]) ??
        session.correlationId,
      sessionId:
        readString(item, ["sessionId", "alphaSessionId"]) ??
        readStringRecord(root, ["alphaSessionId", "sessionId"]) ??
        session.sessionId,
      searchFilterObj:
        readString(item, ["searchFilterObj"]) ??
        readStringRecord(root, ["searchFilterObj"]),
      raw: item,
    };
  });
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

  return records.slice(0, 5).map((item, index) => ({
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

export function hotelRoomOccupancyFromCounts(
  rooms: number,
  adults: number,
  children: number,
) {
  const safeRooms = Math.max(1, rooms);
  const adultsPerRoom = Math.max(1, Math.floor(adults / safeRooms));
  const remainderAdults = adults % safeRooms;
  const childrenPerRoom = Math.floor(children / safeRooms);
  const remainderChildren = children % safeRooms;

  return Array.from({ length: safeRooms }, (_, index) => ({
    adults: adultsPerRoom + (index < remainderAdults ? 1 : 0),
    children: childrenPerRoom + (index < remainderChildren ? 1 : 0),
    childAges: [] as number[],
  })).map((room) => ({
    adults: Math.max(1, room.adults),
    children: Math.max(0, room.children),
    childAges: [],
  }));
}

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatDateForUi(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function parseFlexibleDate(input: string, reference = new Date()) {
  const raw = input.trim().replace(/,$/, "");
  if (!raw) return null;

  if (isIsoDate(raw)) {
    return raw;
  }

  const match = raw.match(
    /^(?<month>[A-Za-z]{3,9})\s+(?<day>\d{1,2})(?:,\s*(?<year>\d{4}))?$/i,
  );
  if (!match?.groups) return null;

  const month = MONTH_LOOKUP[match.groups.month.toLowerCase()];
  const day = Number(match.groups.day);
  if (month === undefined || !Number.isInteger(day) || day < 1 || day > 31) {
    return null;
  }

  let year = match.groups.year ? Number(match.groups.year) : reference.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, month, day));

  if (!match.groups.year) {
    const todayUtc = new Date(
      Date.UTC(
        reference.getUTCFullYear(),
        reference.getUTCMonth(),
        reference.getUTCDate(),
      ),
    );
    if (candidate.getTime() < todayUtc.getTime()) {
      year += 1;
      candidate = new Date(Date.UTC(year, month, day));
    }
  }

  return candidate.toISOString().slice(0, 10);
}

export function parseFlexibleDateRange(
  startInput: string,
  endInput: string,
  reference = new Date(),
) {
  const start = parseFlexibleDate(startInput, reference);
  if (!start) return null;

  const endDayOnly = endInput.trim().match(/^\d{1,2}$/);
  if (endDayOnly) {
    const startDate = new Date(`${start}T00:00:00Z`);
    const day = Number(endDayOnly[0]);
    const endDate = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        day,
      ),
    );
    if (
      endDate.getUTCMonth() !== startDate.getUTCMonth() ||
      endDate.getUTCDate() !== day
    ) {
      return null;
    }
    return {
      start,
      end: endDate.toISOString().slice(0, 10),
    };
  }

  const end = parseFlexibleDate(endInput, new Date(`${start}T00:00:00Z`));
  if (!end) return null;
  return { start, end };
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10);
}
