import { McpToolResult } from "./mcp-client";
import {
  CarOffer,
  FlightOffer,
  FlightSegment,
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

export function formatIsoDateTime(value?: string) {
  if (!value) return "Time pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function formatFlightStops(stops?: number) {
  if (stops === undefined) return "Stop details pending";
  if (stops <= 0) return "Nonstop";
  if (stops === 1) return "1 stop";
  return `${stops} stops`;
}

export function formatTravelerSummary(
  adults: number,
  children: number,
  infants: number,
) {
  const items = [
    `${adults} adult${adults === 1 ? "" : "s"}`,
    children ? `${children} child${children === 1 ? "" : "ren"}` : null,
    infants ? `${infants} infant${infants === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return items.join(" • ");
}

export function formatDurationMinutes(minutes?: number) {
  if (minutes === undefined || minutes <= 0) return undefined;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
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

export function readArray(
  record: Record<string, unknown>,
  keys: string[],
): unknown[] | undefined {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
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
        "departurelocation",
        "arrivallocation",
      ]) ?? fallbackLabel,
    subtitle: readString(item, [
      "fullName",
      "country",
      "region",
      "address",
      "airport",
      "airportName",
      "departairport",
      "arrivalairport",
    ]),
    code: readString(item, [
      "code",
      "airportCode",
      "iata",
      "iataCode",
      "departure",
      "arrival",
    ]),
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
  const root = firstRecord(raw);
  const results = root && Array.isArray(root.result) ? root.result : [];
  const correlationId =
    readStringRecord(root, ["correlationId", "correlationid"]) ??
    session.correlationId;
  const sessionId =
    readStringRecord(root, ["alphaSessionId", "sessionId", "sessionid"]) ??
    session.sessionId;
  const currency =
    readStringRecord(root, ["currency", "currencyCode"]) ?? "USD";
  const searchFilterObj = readStringRecord(root, ["searchFilterObj"]);

  return results
    .filter(isRecord)
    .slice(0, 10)
    .map((item, index) => {
      const segmentRecords = (readArray(item, ["flights"]) ?? []).filter(isRecord);
      const segments = segmentRecords.map(normalizeFlightSegment);
      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];
      const totalDurationMinutes =
        readNumber(item, ["triptime", "totalDuration"]) ??
        segmentRecords.reduce((sum, segment) => {
          const duration = readNumber(segment, ["triptime", "duration"]);
          return sum + (duration ?? 0);
        }, 0);
      const stopCount =
        readNumber(item, ["stops", "stopCount"]) ??
        Math.max(0, segments.length - 1);
      const seatValues = segmentRecords
        .map((segment) => readNumber(segment, ["remainingSeats"]))
        .filter((value): value is number => value !== undefined);
      const remainingSeats =
        readNumber(item, ["remainingSeats"]) ??
        (seatValues.length ? Math.min(...seatValues) : undefined);

      return {
        id:
          readString(item, ["id", "fareSourceCode", "fareCode"]) ??
          `flight-${index}`,
        airline: firstSegment?.airline ?? "Airline",
        airlineCode:
          firstSegment?.airlineCode ??
          readString(item, ["airlineCode", "carrierCode", "airline_code"]),
        airlineLogo: readString(item, [
          "airlineLogo",
          "carrierLogo",
          "logo",
          "image",
          "imageUrl",
        ]),
        flightNumber:
          segments.map((segment) => segment.flightNumber).join(", ") || "N/A",
        from: firstSegment?.departureCity ?? "Origin",
        to: lastSegment?.arrivalCity ?? "Destination",
        originCode: firstSegment?.from,
        destinationCode: lastSegment?.to,
        originAirport: firstSegment?.departureAirport,
        destinationAirport: lastSegment?.arrivalAirport,
        departureCity: firstSegment?.departureCity,
        arrivalCity: lastSegment?.arrivalCity,
        departure: formatIsoDateTime(firstSegment?.departureTime),
        arrival: formatIsoDateTime(lastSegment?.arrivalTime),
        duration:
          formatDurationMinutes(totalDurationMinutes) ??
          readString(item, ["duration"]),
        durationMinutes: totalDurationMinutes,
        price: readNumber(item, [
          "ourprice",
          "showOurprice",
          "convertedCoin",
          "price",
          "amount",
          "totalFare",
        ]),
        currency,
        stops: stopCount,
        cabinClass:
          firstSegment?.cabinClass ?? readString(item, ["cabinClass", "cabin"]),
        refundable:
          readBoolean(item, ["refundable", "isRefundable"]) ??
          deriveRefundable(item),
        baggageText: buildBaggageText(item, segments),
        fareFamily: readString(segmentRecords[0] ?? item, ["fareFamily"]),
        remainingSeats,
        layoverSummary: buildLayoverSummary(segments),
        segments,
        fareSourceCode: readString(item, ["fareSourceCode", "fareCode"]),
        correlationId,
        sessionId:
          readString(item, ["sessionId"]) ??
          sessionId,
        searchFilterObj,
        raw: item,
      };
    });
}

function normalizeFlightSegment(segment: Record<string, unknown>): FlightSegment {
  return {
    airline: readString(segment, ["airline", "carrier", "carrierName"]) ?? "Airline",
    airlineCode:
      readString(segment, ["flightCode", "airlineCode", "carrierCode"]) ??
      readString(segment, ["flightNumber"])?.slice(0, 2),
    flightNumber:
      [readString(segment, ["flightCode"]), readString(segment, ["flightNumber"])]
        .filter(Boolean)
        .join(" ") || "N/A",
    from: readString(segment, ["departure", "origin"]) ?? "Origin",
    to: readString(segment, ["arrival", "destination"]) ?? "Destination",
    departureCity: readString(segment, ["departurelocation", "departureCity"]),
    arrivalCity: readString(segment, ["arrivallocation", "arrivalCity"]),
    departureAirport: readString(segment, ["departairport", "departureAirport"]),
    arrivalAirport: readString(segment, ["arrivalairport", "arrivalAirport"]),
    departureTime:
      readString(segment, ["departureTime", "departure", "departAt"]) ?? "N/A",
    arrivalTime:
      readString(segment, ["arrivalTime", "arrival", "arriveAt"]) ?? "N/A",
    durationMinutes: readNumber(segment, ["triptime", "duration"]),
    cabinClass: readString(segment, ["cabin", "cabinClass", "class"]),
  };
}

function deriveRefundable(item: Record<string, unknown>) {
  const details = (readArray(item, ["penaltydetails"]) ?? []).filter(isRecord);
  if (!details.length) return undefined;
  return details.some((detail) => readBoolean(detail, ["refundAllowed"]) === true);
}

function buildBaggageText(
  item: Record<string, unknown>,
  segments: FlightSegment[],
) {
  const explicit = readString(item, [
    "baggage",
    "baggageText",
    "checkedBaggage",
    "baggageAllowance",
  ]);
  if (explicit) return explicit;

  const seats = readNumber(item, ["quantity"]);
  const fareFamily = readString(item, ["fareFamily"]);
  const segmentCabin = segments[0]?.cabinClass;
  const parts = [
    fareFamily,
    segmentCabin ? `${segmentCabin} cabin` : null,
    seats ? `${seats} traveler${seats === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return parts.join(" • ") || undefined;
}

function buildLayoverSummary(segments: FlightSegment[]) {
  if (segments.length <= 1) return undefined;
  const layovers = segments.slice(0, -1).map((segment, index) => {
    const next = segments[index + 1];
    const city = segment.arrivalCity ?? segment.to;
    const duration = differenceInMinutes(segment.arrivalTime, next.departureTime);
    return duration ? `${city} (${formatDurationMinutes(duration)})` : city;
  });

  return layovers.join(" • ");
}

function differenceInMinutes(start?: string, end?: string) {
  if (!start || !end) return undefined;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return undefined;
  }
  const diff = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
  return diff > 0 ? diff : undefined;
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
