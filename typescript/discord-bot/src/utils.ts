import type {
  CarOffer,
  FlightOffer,
  HotelListing,
  HotelLookupOption,
  HotelRoomOccupancy,
  HotelRoomOffer,
  LookupOption,
} from "./types.js";
import type { McpToolResult } from "./mcp-client.js";

export function formatPrice(price?: number, currency?: string) {
  if (price === undefined) return "Price on request";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency ?? "USD"} ${price}`;
  }
}

export function formatRoomSummary(rooms: HotelRoomOccupancy[]) {
  return rooms
    .map(
      (room, index) =>
        `Room ${index + 1} - ${room.adults} ${room.adults > 1 ? "adults" : "adult"}, ${room.children} ${room.children > 1 ? "children" : "child"}`,
    )
    .join(" | ");
}

export function truncate(text: string, max = 1024) {
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
      readString(item, ["id", "destinationId", "code", "airportCode", "location_code", "locationCode"]) ??
      `${fallbackLabel}-${index}`,
    label:
      readString(item, [
        "name",
        "label",
        "displayName",
        "city",
        "description",
        "location_name",
        "locationName",
        "airport_name",
        "airportName",
      ]) ?? fallbackLabel,
    subtitle: readString(item, ["fullName", "country", "region", "address", "state", "type"]),
    code: readString(item, ["code", "airportCode", "iata", "iataCode", "location_code", "locationCode"]),
    lat: readNumber(item, ["lat", "latitude"]),
    long: readNumber(item, ["long", "lng", "longitude"]),
    raw: item,
  }));
}

export function normalizeCarLookupOptions(raw: unknown): LookupOption[] {
  const root = firstRecord(raw);
  if (!root) return [];

  const directLists = [root.result, root.data, root.locations];
  for (const candidate of directLists) {
    if (Array.isArray(candidate) && candidate.some(isRecord)) {
      return normalizeLookupOptions({ result: candidate }, "location");
    }
  }

  return normalizeLookupOptions(raw, "location");
}

export function preferAirportLookupOption(
  term: string,
  options: LookupOption[],
): LookupOption | undefined {
  if (!options.length) return undefined;

  const normalizedTerm = term.trim().toLowerCase();
  const airportOptions = options.filter((option) => {
    const type = readString(option.raw, ["type"]);
    return type?.toLowerCase() === "airport";
  });

  return (
    airportOptions.find((option) => option.code?.toLowerCase() === normalizedTerm) ??
    options.find((option) => option.code?.toLowerCase() === normalizedTerm) ??
    airportOptions.find((option) => option.label.toLowerCase().includes(normalizedTerm)) ??
    options.find((option) => option.label.toLowerCase() === normalizedTerm) ??
    airportOptions[0] ??
    options[0]
  );
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
              [readString(segment, ["flightCode"]), readString(segment, ["flightNumber"])]
                .filter(Boolean)
                .join(" "),
            )
            .filter(Boolean)
            .join(", ")
        : readString(item, ["flightNumber", "number"]) ?? "N/A",
      from:
        readString(firstSegment ?? item, ["departure", "origin", "from"]) ?? "Origin",
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
      price: readNumber(item, ["ourprice", "showOurprice", "totalFare", "price", "amount"]),
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
  const root = firstRecord(raw);
  const session = findSessionMeta(raw);
  const result = root && isRecord(root.result) ? root.result : root;
  const cars =
    result && Array.isArray(result.cars)
      ? result.cars.filter(isRecord)
      : findRecords(raw, ["cars", "vehicles", "results", "items", "data"]).filter(
          (item) => "name" in item || "vehicleName" in item,
        );

  const currency = readStringRecord(result, ["currency"]) ?? "USD";

  return cars.slice(0, 6).map((item, index) => {
    const partner = isRecord(item.partner) ? item.partner : null;
    const pricePostpaid = isRecord(item.price_postpaid) ? item.price_postpaid : null;
    const pricePrepaid = isRecord(item.price_prepaid) ? item.price_prepaid : null;
    const activePrice = pricePrepaid ?? pricePostpaid;
    const pickup = isRecord(item.pickup) ? item.pickup : null;
    const dropoff = isRecord(item.dropoff) ? item.dropoff : null;
    const category = readString(item, ["type_name", "description"]) ?? "Car";
    const vehicleName = readString(item, ["name"]) ?? "or similar";
    const fareCode =
      readStringRecord(pricePostpaid, ["fareCode"]) ??
      readStringRecord(pricePrepaid, ["fareCode"]) ??
      readString(item, ["fareCode", "fareSourceCode"]);

    return {
      id: `car-${index}`,
      vendor: readStringRecord(partner, ["name"]) ?? "Rental partner",
      vehicleName: `${category} – ${vehicleName}`,
      category,
      pickupLocation: formatCarLocationLabel(pickup),
      dropoffLocation: formatCarLocationLabel(dropoff),
      transmission:
        item.manual_transmission === true
          ? "Manual"
          : item.hasAMT === true
            ? "Automatic"
            : readString(item, ["transmission"]),
      seats: readNumber(item, ["passengers", "seats"]),
      doors: readNumber(item, ["doors"]),
      bags: readNumber(item, ["bags"]),
      fuelType: formatFuelType(readString(item, ["fuelType"])),
      mileage: item.mileage === true ? "Unlimited" : item.mileage === false ? "Limited" : undefined,
      freeCancellation:
        readBoolean(pricePostpaid ?? {}, ["free_cancellation"]) ??
        readBoolean(pricePrepaid ?? {}, ["free_cancellation"]),
      inclusions: Array.isArray(item.inclusions)
        ? item.inclusions.map((entry) => String(entry)).filter(Boolean)
        : [],
      image: readString(item, ["heroImage", "image", "imageUrl"]),
      price:
        readNumber(item, ["display_price", "show_display_price"]) ??
        readNumber(activePrice ?? {}, ["showTotal", "total"]),
      currency: readStringRecord(activePrice, ["currency"]) ?? currency,
      rateType: readStringRecord(activePrice, ["rateType"]),
      fareCode,
      correlationId:
        readStringRecord(root, ["correlationId", "correlationid"]) ??
        session.correlationId,
      raw: item,
    };
  });
}

function formatFuelType(value?: string) {
  if (!value) return undefined;
  const labels: Record<string, string> = {
    petrol_gasoline: "Petrol/Gasoline",
    diesel: "Diesel",
    electric: "Electric",
    hybrid: "Hybrid",
  };
  return labels[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCarLocationLabel(location: Record<string, unknown> | null) {
  if (!location) return undefined;

  const place =
    readString(location, ["airport_name", "location", "name"]) ?? "Location";
  const info = readString(location, ["location_information"]);
  const code = readString(location, ["airport_code", "location_code", "code"]);

  if (info) {
    return `${place}${code ? ` (${code})` : ""} (${info})`;
  }

  return code ? `${place} (${code})` : place;
}

function stringOrEmpty(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberOrZero(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function sanitizeCarPriceBlock(
  block: Record<string, unknown> | null,
  fallback: Record<string, unknown>,
) {
  const source = block ?? {};
  return {
    currency: readString(source, ["currency"]) ?? readString(fallback, ["currency"]) ?? "USD",
    symbol: stringOrEmpty(source.symbol),
    total: numberOrZero(source.total ?? source.showTotal),
    showTotal: numberOrZero(source.showTotal ?? source.total),
    rateType: readString(source, ["rateType"]) ?? readString(fallback, ["rateType"]) ?? "postpaid",
    net_rate: readBoolean(source, ["net_rate"]) ?? false,
    pay_at_booking: readBoolean(source, ["pay_at_booking"]) ?? false,
    mileage: readBoolean(source, ["mileage"]) ?? false,
    free_cancellation: readBoolean(source, ["free_cancellation"]) ?? false,
    days: numberOrZero(source.days),
    fareCode: stringOrEmpty(source.fareCode),
    allow_cancellation:
      readString(source, ["allow_cancellation"]) ??
      (readBoolean(source, ["free_cancellation"]) ? "true" : "false"),
    strikeout_price: numberOrZero(source.strikeout_price),
    margin: numberOrZero(source.margin),
    netPrice: numberOrZero(source.netPrice),
    marginPerc: numberOrZero(source.marginPerc),
    merchantFee: numberOrZero(source.merchantFee),
    merchantFeesPerc: numberOrZero(source.merchantFeesPerc),
  };
}

function sanitizeCarLocationBlock(location: Record<string, unknown> | null) {
  const source = location ?? {};
  return {
    ...source,
    neighborhood: stringOrEmpty(source.neighborhood),
    location_information: stringOrEmpty(source.location_information),
    airport_name: stringOrEmpty(source.airport_name),
    airport_code: stringOrEmpty(source.airport_code),
    location_code: stringOrEmpty(source.location_code),
    location: stringOrEmpty(source.location),
  };
}

export function sanitizeCarPaymentPayload(car: Record<string, unknown>) {
  const partner = isRecord(car.partner) ? car.partner : {};
  const discounts = isRecord(car.discounts) ? car.discounts : {};
  const pricePostpaid = isRecord(car.price_postpaid) ? car.price_postpaid : null;
  const pricePrepaid = isRecord(car.price_prepaid) ? car.price_prepaid : null;
  const sanitizedPostpaid = sanitizeCarPriceBlock(pricePostpaid, {
    currency: "USD",
    rateType: "postpaid",
  });
  const sanitizedPrepaid = sanitizeCarPriceBlock(pricePrepaid, {
    currency: sanitizedPostpaid.currency,
    rateType: "prepaid",
  });

  return {
    ...car,
    doors: numberOrZero(car.doors),
    isPrepaid: Boolean(pricePrepaid),
    allow_cancellation:
      readString(pricePostpaid ?? {}, ["allow_cancellation"]) ??
      (readBoolean(pricePostpaid ?? {}, ["free_cancellation"]) ? "true" : "false"),
    runtimeType: readString(car, ["runtimeType", "type"]) ?? "car",
    partner: {
      ...partner,
      phone: stringOrEmpty(partner.phone),
      count: numberOrZero(partner.count),
    },
    discounts: {
      ...discounts,
      discount_code: stringOrEmpty(discounts.discount_code),
      applied: stringOrEmpty(discounts.applied),
    },
    pickup: sanitizeCarLocationBlock(isRecord(car.pickup) ? car.pickup : null),
    dropoff: sanitizeCarLocationBlock(isRecord(car.dropoff) ? car.dropoff : null),
    price_postpaid: sanitizedPostpaid,
    price_prepaid: sanitizedPrepaid,
  };
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10);
}
