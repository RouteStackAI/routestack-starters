import { callTool } from "./mcp-client.js";
import type { EmployeeRequest, McpToolResult, TravelOption } from "./types.js";

function extractJson(result: McpToolResult): unknown {
  for (const item of result.content) {
    if (typeof item.text === "string") {
      try {
        return JSON.parse(item.text);
      } catch {
        return item.text;
      }
    }
  }
  return null;
}

async function callToolJson(name: string, args: Record<string, unknown>) {
  const result = await callTool(name, args);
  if (result.isError) {
    throw new Error(`Tool ${name} failed: ${JSON.stringify(result.content)}`);
  }
  return extractJson(result);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function pickPaymentUrl(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const obj = input as Record<string, unknown>;
  const direct = ["paymentUrl", "url", "checkoutUrl", "redirectUrl", "link"];
  for (const key of direct) {
    const v = obj[key];
    if (typeof v === "string" && v.startsWith("http")) return v;
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const nested = pickPaymentUrl(value);
      if (nested) return nested;
    }
  }
  return undefined;
}

function roomOccupancyFromTravelers(travelers: number) {
  return [{ adults: Math.max(1, travelers), children: 0 }];
}

function normalizeFlightOption(
  flight: Record<string, unknown>,
  request: EmployeeRequest,
  meta: { correlationId?: string; searchFilterObj?: unknown; sessionId?: string },
): TravelOption {
  const segments = Array.isArray(flight.flights)
    ? (flight.flights as Array<Record<string, unknown>>)
    : [];
  const first = segments[0] ?? {};
  const last = segments[segments.length - 1] ?? {};

  const title = `${asString(first.airline) ?? "Flight"} ${asString(first.flightNumber) ?? ""}`.trim();
  const route = `${asString(first.departure) ?? request.origin ?? "Origin"} -> ${asString(last.arrival) ?? request.destination}`;

  return {
    title,
    description: `${route} | Stops: ${String(flight.stops ?? 0)}`,
    totalPrice: asNumber(flight.ourprice ?? flight.totalFare ?? flight.price),
    currency: asString(flight.currency ?? "USD"),
    raw: {
      ...flight,
      fareSourceCode: asString(flight.fareSourceCode),
      correlationId: asString(flight.correlationId) ?? meta.correlationId,
      searchFilterObj: flight.searchFilterObj ?? meta.searchFilterObj,
      sessionId: asString(flight.sessionId) ?? meta.sessionId,
    },
  };
}

function normalizeHotelOption(hotel: Record<string, unknown>, context: Record<string, unknown>): TravelOption {
  return {
    title: asString(hotel.name) ?? "Hotel",
    description: `${asString(hotel.providerName) ?? ""} ${asString(hotel.distance) ? `| ${asString(hotel.distance)}` : ""}`.trim(),
    totalPrice: asNumber(hotel.ourprice ?? hotel.publishedRate ?? hotel.price),
    currency: asString(hotel.currency ?? "USD"),
    raw: {
      ...hotel,
      token: asString(context.token),
      correlationId: asString(context.correlationId),
      destinationName: asString(context.destinationName),
      destinationId: asString(context.destinationId),
    },
  };
}

export async function deterministicSearch(request: EmployeeRequest) {
  if (request.travelType === "flight") {
    const flightSession = (await callToolJson("flight_session", {}).catch(() => null)) as Record<string, unknown> | null;

    const [originRaw, destinationRaw] = await Promise.all([
      callToolJson("flight_locations", { term: request.origin }),
      callToolJson("flight_locations", { term: request.destination }),
    ]);

    const originList = Array.isArray((originRaw as Record<string, unknown>)?.result)
      ? ((originRaw as Record<string, unknown>).result as Array<Record<string, unknown>>)
      : [];
    const destinationList = Array.isArray((destinationRaw as Record<string, unknown>)?.result)
      ? ((destinationRaw as Record<string, unknown>).result as Array<Record<string, unknown>>)
      : [];

    if (!originList.length || !destinationList.length) {
      throw new Error("Could not resolve origin/destination airports.");
    }

    const origin = originList[0];
    const destination = destinationList[0];

    const filter = {
      origin: asString(origin.code ?? origin.airportCode) ?? request.origin,
      destination: asString(destination.code ?? destination.airportCode) ?? request.destination,
      departureDate: request.departDate,
      returnDate: request.returnDate,
      adults: request.travelers,
      cabinClass: "economy",
      tripType: request.returnDate ? "round_trip" : "one_way",
      originLocation: origin,
      destinationLocation: destination,
    };

    const search = (await callToolJson("flight_search", { filter })) as Record<string, unknown>;
    const flights = Array.isArray(search.result) ? (search.result as Array<Record<string, unknown>>) : [];
    if (!flights.length) throw new Error("No flights found.");

    const options = flights.slice(0, 6).map((flight) =>
      normalizeFlightOption(flight, request, {
        correlationId: asString(search.correlationId),
        searchFilterObj: search.searchFilterObj,
        sessionId: asString(search.alphaSessionId) ?? asString(flightSession?.sessionId),
      }),
    );

    return { summary: `Found ${options.length} flight options. Select one to revalidate fare and fetch checkout URL.`, options };
  }

  const destinationRaw = (await callToolJson("search_destinations", { query: request.destination, type: "DESTINATION" })) as Record<string, unknown>;
  const destinations = Array.isArray(destinationRaw.result) ? (destinationRaw.result as Array<Record<string, unknown>>) : [];
  if (!destinations.length) throw new Error("No destinations found.");

  const destination = destinations[0];
  const searchHotels = (await callToolJson("search_hotels", {
    destinationId: destination.id,
    checkIn: request.checkInDate,
    checkOut: request.checkOutDate,
    rooms: roomOccupancyFromTravelers(request.travelers),
    lat: asNumber(destination.lat ?? destination.latitude) ?? 0,
    long: asNumber(destination.long ?? destination.longitude) ?? 0,
    currency: "USD",
    page: 1,
    limit: 10,
  })) as Record<string, unknown>;

  const result = searchHotels.result as Record<string, unknown> | undefined;
  const hotels = Array.isArray(result?.result) ? (result.result as Array<Record<string, unknown>>) : [];
  if (!hotels.length) throw new Error("No hotels found.");

  const options = hotels.slice(0, 8).map((hotel) =>
    normalizeHotelOption(hotel, {
      token: result?.token,
      correlationId: result?.correlationId,
      destinationId: destination.id,
      destinationName: destination.fullName ?? destination.name,
    }),
  );

  return { summary: `Found ${options.length} hotels. Select one to load rooms and validate latest pricing.`, options };
}

export async function prepareFlightCheckout(request: EmployeeRequest, selectedOption: TravelOption) {
  const raw = selectedOption.raw;
  const fareSourceCode = asString(raw.fareSourceCode);
  if (!fareSourceCode) throw new Error("Selected flight is missing fareSourceCode.");

  const revalidated = await callToolJson("flight_revalidate", {
    fareSourceCode,
    searchListPrice: selectedOption.totalPrice,
    searchFilterObj: raw.searchFilterObj,
    correlationId: raw.correlationId,
  });

  const payment = await callToolJson("flight_get_payment_url", {
    flight: { ...raw, fareSourceCode, revalidateResult: revalidated },
    origin: request.origin,
    destination: request.destination,
    departureDate: request.departDate,
    returnDate: request.returnDate,
    adults: request.travelers,
    children: 0,
    infants: 0,
    correlationId: raw.correlationId,
    searchFilterObj: raw.searchFilterObj,
    sessionId: raw.sessionId,
  });

  return {
    option: { ...selectedOption, paymentUrl: pickPaymentUrl(payment) },
    revalidated,
    payment,
  };
}

export async function fetchHotelRooms(request: EmployeeRequest, selectedOption: TravelOption) {
  const raw = selectedOption.raw;
  const hotelId = asString(raw.id ?? raw.hotelId);
  const token = asString(raw.token);
  const correlationId = asString(raw.correlationId);

  if (!hotelId || !token || !correlationId) {
    throw new Error("Selected hotel is missing hotel context (hotelId/token/correlationId).");
  }

  const roomsRes = (await callToolJson("get_rooms_and_rates", {
    hotelId,
    token,
    correlationId,
    checkIn: request.checkInDate,
    checkOut: request.checkOutDate,
    rooms: roomOccupancyFromTravelers(request.travelers).map((r) => ({ adults: r.adults, children: r.children })),
    hotelName: selectedOption.title,
    publishedRate: selectedOption.totalPrice ?? 0,
  })) as Record<string, unknown>;

  const groups = Array.isArray((roomsRes.result as Record<string, unknown> | undefined)?.groups)
    ? ((roomsRes.result as Record<string, unknown>).groups as Array<Record<string, unknown>>)
    : [];

  const rooms = groups
    .flatMap((group) => (Array.isArray(group.rooms) ? (group.rooms as Array<Record<string, unknown>>) : []))
    .slice(0, 8)
    .map((room, i) => ({
      id: asString(room.id) ?? `room-${i}`,
      name: asString(room.name) ?? "Room",
      description: asString(room.description) ?? "",
      recommendationId: asString(room.recommendationId),
      publishedRate: asNumber(room.publishedRate ?? room.ourprice),
      refundable: Boolean(room.refundable),
      raw: room,
    }));

  if (!rooms.length) throw new Error("No rooms found for selected hotel.");
  return { rooms };
}

export async function prepareHotelCheckout(
  request: EmployeeRequest,
  selectedHotel: TravelOption,
  selectedRoom: Record<string, unknown>,
) {
  const hotelRaw = selectedHotel.raw;
  const hotelId = asString(hotelRaw.id ?? hotelRaw.hotelId);
  const token = asString(hotelRaw.token);
  const correlationId = asString(hotelRaw.correlationId);
  const roomId = asString(selectedRoom.id);
  const recommendationId = asString(selectedRoom.recommendationId);

  if (!hotelId || !token || !correlationId || !roomId || !recommendationId) {
    throw new Error("Missing hotel checkout fields.");
  }

  const revalidated = await callToolJson("revalidate", {
    hotelId,
    recommendationId,
    token,
    correlationId,
    publishedRate: asNumber(selectedRoom.publishedRate) ?? selectedHotel.totalPrice ?? 0,
  });

  const payment = await callToolJson("get_payment_url", {
    hotelId,
    recommendationId,
    token,
    checkIn: request.checkInDate,
    checkOut: request.checkOutDate,
    roomId,
    hotelName: selectedHotel.title,
    hotelAddress: asString(hotelRaw.address) ?? "",
    hotelImage: asString(hotelRaw.heroImage ?? hotelRaw.image ?? "") ?? "",
    hotelLatitude: asNumber(hotelRaw.lat ?? hotelRaw.latitude) ?? 0,
    hotelLongitude: asNumber(hotelRaw.long ?? hotelRaw.longitude) ?? 0,
    hotelStarRating: asNumber(hotelRaw.starRating) ?? 0,
    hotelRating: asNumber(hotelRaw.rating ?? hotelRaw.starRating) ?? 0,
    correlationId,
    travellers: `Room 1: ${request.travelers}A/0C`,
    destination: asString(hotelRaw.destinationName) ?? request.destination,
    displayedPrice: asNumber(selectedRoom.publishedRate) ?? selectedHotel.totalPrice ?? 0,
    priceCheckResult: revalidated,
  }).catch(async () =>
    callToolJson("hotel_get_payment_url", {
      hotelId,
      recommendationId,
      token,
      checkIn: request.checkInDate,
      checkOut: request.checkOutDate,
      roomId,
    }),
  );

  return {
    option: { ...selectedHotel, paymentUrl: pickPaymentUrl(payment), raw: { ...selectedHotel.raw, selectedRoom } },
    revalidated,
    payment,
  };
}
