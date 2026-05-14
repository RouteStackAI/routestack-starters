export function formatPrice(price?: number, currency?: string) {
  if (price === undefined || Number.isNaN(price)) return "Price unavailable";
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

export function readArray(record: Record<string, unknown>, keys: string[]): unknown[] | undefined {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type FlightSegmentView = {
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departureCity?: string;
  arrivalCity?: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes?: number;
  cabinClass?: string;
};

export type FlightCardView = {
  id: string;
  airline: string;
  airlineCode?: string;
  airlineLogo?: string;
  flightNumber: string;
  originCode: string;
  destinationCode: string;
  departureCity: string;
  arrivalCity: string;
  originAirport?: string;
  destinationAirport?: string;
  departure: string;
  arrival: string;
  duration?: string;
  durationMinutes?: number;
  price?: number;
  currency?: string;
  stops?: number;
  cabinClass?: string;
  refundable?: boolean;
  fareFamily?: string;
  remainingSeats?: number;
  layoverSummary?: string;
  baggageText?: string;
  segments: FlightSegmentView[];
};

function normalizeSegment(segment: Record<string, unknown>): FlightSegmentView {
  const codePart =
    readString(segment, ["flightCode", "airlineCode", "carrierCode"]) ?? "";
  const numPart = readString(segment, ["flightNumber"]) ?? "";
  const flightNumber = [codePart, numPart].filter(Boolean).join(" ").trim() || "N/A";

  return {
    airline: readString(segment, ["airline", "carrier", "carrierName"]) ?? "Airline",
    flightNumber,
    from: readString(segment, ["departure", "origin"]) ?? "—",
    to: readString(segment, ["arrival", "destination"]) ?? "—",
    departureCity: readString(segment, ["departurelocation", "departureCity"]),
    arrivalCity: readString(segment, ["arrivallocation", "arrivalCity"]),
    departureTime:
      readString(segment, ["departureTime", "departure", "departAt"]) ?? "",
    arrivalTime: readString(segment, ["arrivalTime", "arrival", "arriveAt"]) ?? "",
    durationMinutes: readNumber(segment, ["triptime", "duration"]),
    cabinClass: readString(segment, ["cabin", "cabinClass", "class"]),
  };
}

function differenceInMinutes(start?: string, end?: string) {
  if (!start || !end) return undefined;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return undefined;
  const diff = (endDate.getTime() - startDate.getTime()) / 60000;
  return diff > 0 ? Math.round(diff) : undefined;
}

function buildLayoverSummary(segments: FlightSegmentView[]) {
  if (segments.length <= 1) return undefined;
  const layovers = segments.slice(0, -1).map((segment, index) => {
    const next = segments[index + 1];
    const city = segment.arrivalCity ?? segment.to;
    const duration = differenceInMinutes(segment.arrivalTime, next.departureTime);
    const durLabel = duration ? formatDurationMinutes(duration) : undefined;
    return durLabel ? `${city} (${durLabel})` : city;
  });
  return layovers.join(" • ");
}

function buildBaggageText(item: Record<string, unknown>, segments: FlightSegmentView[]) {
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

/** Build a display model from API flight row stored on `TravelOption.raw`. */
export function flightCardViewFromOption(
  option: {
    raw: Record<string, unknown>;
    title: string;
    description: string;
    totalPrice?: number;
    currency?: string;
  },
  index: number,
): FlightCardView {
  const item = option.raw;
  const segmentRecords = (readArray(item, ["flights"]) ?? []).filter(isRecord);
  const segments = segmentRecords.map(normalizeSegment);
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  const totalDurationMinutes =
    readNumber(item, ["triptime", "totalDuration"]) ??
    segmentRecords.reduce((sum, segment) => {
      const duration = readNumber(segment, ["triptime", "duration"]);
      return sum + (duration ?? 0);
    }, 0);

  const stopCount =
    readNumber(item, ["stops", "stopCount"]) ?? Math.max(0, segments.length - 1);

  const seatValues = segmentRecords
    .map((segment) => readNumber(segment, ["remainingSeats"]))
    .filter((value): value is number => value !== undefined);
  const remainingSeats =
    readNumber(item, ["remainingSeats"]) ??
    (seatValues.length ? Math.min(...seatValues) : undefined);

  const currency = readString(item, ["currency", "currencyCode"]) ?? option.currency ?? "USD";
  const price =
    readNumber(item, ["ourprice", "showOurprice", "convertedCoin", "price", "amount", "totalFare"]) ??
    option.totalPrice;

  return {
    id: readString(item, ["id", "fareSourceCode", "fareCode"]) ?? `flight-${index}`,
    airline: firstSegment?.airline ?? readString(item, ["airline"]) ?? "Airline",
    airlineCode: readString(item, ["airlineCode", "carrierCode", "airline_code"]),
    airlineLogo: readString(item, ["airlineLogo", "carrierLogo", "logo", "image", "imageUrl"]),
    flightNumber: segments.map((s) => s.flightNumber).join(", ") || option.title,
    originCode: firstSegment?.from ?? "—",
    destinationCode: lastSegment?.to ?? "—",
    departureCity: (() => {
      const seg = firstSegment?.departureCity;
      if (seg) return seg;
      const leg = option.description.split("|")[0]?.split("->");
      return leg?.[0]?.trim() || "Origin";
    })(),
    arrivalCity: (() => {
      const seg = lastSegment?.arrivalCity;
      if (seg) return seg;
      const leg = option.description.split("|")[0]?.split("->");
      return leg?.[1]?.trim() || "Destination";
    })(),
    originAirport: readString(segmentRecords[0] ?? {}, ["departairport", "departureAirport"]),
    destinationAirport: readString(segmentRecords[segmentRecords.length - 1] ?? {}, [
      "arrivalairport",
      "arrivalAirport",
    ]),
    departure: formatIsoDateTime(firstSegment?.departureTime),
    arrival: formatIsoDateTime(lastSegment?.arrivalTime),
    duration: formatDurationMinutes(totalDurationMinutes) ?? readString(item, ["duration"]),
    durationMinutes: totalDurationMinutes || undefined,
    price,
    currency,
    stops: stopCount,
    cabinClass: firstSegment?.cabinClass ?? readString(item, ["cabinClass", "cabin"]),
    refundable: readBoolean(item, ["refundable", "isRefundable"]),
    fareFamily: readString(segmentRecords[0] ?? item, ["fareFamily"]),
    remainingSeats,
    layoverSummary: buildLayoverSummary(segments),
    baggageText: buildBaggageText(item, segments),
    segments,
  };
}

export function hotelStarRating(raw: Record<string, unknown>) {
  const n = readNumber(raw, ["starRating", "stars", "rating"]);
  if (n === undefined) return 4;
  return Math.max(1, Math.min(5, Math.round(n)));
}
