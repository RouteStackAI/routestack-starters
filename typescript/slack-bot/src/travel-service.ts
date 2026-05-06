import { config } from "./config.js";
import { callTool } from "./mcp-client.js";
import type {
  CarSessionData,
  FlightSessionData,
  HotelLookupOption,
  HotelRoomOccupancy,
  HotelSessionData,
  LookupOption,
} from "./types.js";
import {
  extractJson,
  extractPaymentUrl,
  extractText,
  findFlightSearchMeta,
  formatRoomSummary,
  formatToolError,
  normalizeCarOffers,
  normalizeFlightOffers,
  normalizeHotelListings,
  normalizeHotelLookupOptions,
  normalizeHotelRoomOffers,
  normalizeLookupOptions,
  readStringRecord,
} from "./utils.js";

async function callToolJson(name: string, args: Record<string, unknown>) {
  const result = await callTool(name, args);
  if (result.isError) {
    throw new Error(formatToolError(result));
  }
  return extractJson(result) ?? extractText(result);
}

function buildFlightLocationPayload(option: LookupOption) {
  return {
    name:
      readStringRecord(option.raw, ["name", "displayName", "label"]) ??
      option.label,
    code:
      readStringRecord(option.raw, ["code", "airportCode", "iata", "iataCode"]) ??
      option.code ??
      option.label,
    city:
      readStringRecord(option.raw, ["city", "cityName", "municipality"]) ??
      option.label,
    country: readStringRecord(option.raw, ["country", "countryName"]) ?? "",
    fullname:
      readStringRecord(option.raw, ["fullname", "fullName", "description"]) ??
      option.subtitle ??
      option.label,
  };
}

function resolveBestLookupOption(term: string, options: LookupOption[]) {
  const normalizedTerm = term.trim().toLowerCase();
  return (
    options.find((option) => option.code?.toLowerCase() === normalizedTerm) ??
    options.find((option) => option.label.toLowerCase() === normalizedTerm) ??
    options[0]
  );
}

export async function createHotelDiscoverySession(input: {
  query: string;
  checkIn: string;
  checkOut: string;
  rooms: HotelRoomOccupancy[];
  currency: string;
}): Promise<HotelSessionData> {
  const raw = (await callToolJson("search_destinations", {
    query: input.query,
    type: "DESTINATION",
  })) as { result?: unknown[] };

  const destinationOptions = normalizeHotelLookupOptions(raw);
  if (destinationOptions.length === 0) {
    throw new Error("No RouteStack destinations matched that query.");
  }

  return {
    query: input.query,
    destinationOptions,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    rooms: input.rooms,
    currency: input.currency,
    hotels: [],
    roomOffers: [],
  };
}

export async function searchHotelsForDestination(
  input: HotelSessionData,
  destination: HotelLookupOption,
): Promise<HotelSessionData> {
  const json = await callToolJson("search_hotels", {
    destinationId: destination.id,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    rooms: input.rooms,
    lat: destination.lat ?? 0,
    long: destination.long ?? 0,
    currency: input.currency,
  });

  const normalized = normalizeHotelListings(json, destination.fullName);
  return {
    ...input,
    selectedDestination: destination,
    token: normalized.token,
    correlationId: normalized.correlationId,
    hotels: normalized.hotels,
    roomOffers: [],
    selectedHotel: undefined,
    selectedRoom: undefined,
    paymentUrl: undefined,
  };
}

export async function inspectHotel(
  session: HotelSessionData,
  hotelId: string,
): Promise<HotelSessionData> {
  const hotel = session.hotels.find((entry) => entry.id === hotelId);
  if (!hotel) {
    throw new Error("Selected hotel was not found in the current session.");
  }
  if (!session.token || !session.correlationId) {
    throw new Error("Hotel search token or correlationId is missing.");
  }

  const details = (await callToolJson("get_hotel_details", {
    hotelId: hotel.id,
  })) as Record<string, unknown>;

  const roomsJson = await callToolJson("get_rooms_and_rates", {
    hotelId: hotel.id,
    token: session.token,
    correlationId: session.correlationId,
    checkIn: session.checkIn,
    checkOut: session.checkOut,
    rooms: session.rooms.map((room) => ({
      adults: room.adults,
      children: room.children,
    })),
    hotelName: hotel.name,
    publishedRate: hotel.price ?? 0,
  });

  return {
    ...session,
    selectedHotel: hotel,
    hotelDetails: details,
    roomOffers: normalizeHotelRoomOffers(roomsJson),
    selectedRoom: undefined,
    paymentUrl: undefined,
  };
}

export async function prepareHotelCheckout(
  session: HotelSessionData,
  uniqueRoomId: string,
): Promise<HotelSessionData> {
  if (!session.selectedHotel || !session.selectedDestination) {
    throw new Error("Select a hotel before continuing to checkout.");
  }

  const room = session.roomOffers.find(
    (entry) => `${entry.id}___${entry.recommendationId}` === uniqueRoomId,
  );
  if (!room || !room.recommendationId) {
    throw new Error("Selected room is missing recommendation data.");
  }
  if (!session.token || !session.correlationId) {
    throw new Error("Hotel session metadata is missing.");
  }

  const priceCheckResult = (await callToolJson("revalidate", {
    hotelId: session.selectedHotel.id,
    recommendationId: room.recommendationId,
    token: session.token,
    correlationId: session.correlationId,
    publishedRate: room.price ?? session.selectedHotel.price ?? 0,
  })) as Record<string, unknown>;

  const paymentJson = await callToolJson("hotel_get_payment_url", {
    hotelId: session.selectedHotel.id,
    recommendationId: room.recommendationId,
    token: session.token,
    checkIn: session.checkIn,
    checkOut: session.checkOut,
    roomId: room.id,
    hotelName: session.selectedHotel.name,
    hotelAddress: session.selectedHotel.address,
    hotelImage: session.selectedHotel.image ?? "",
    hotelLatitude: session.selectedHotel.latitude ?? 0,
    hotelLongitude: session.selectedHotel.longitude ?? 0,
    hotelStarRating: session.selectedHotel.starRating ?? 0,
    hotelRating:
      session.selectedHotel.rating ?? session.selectedHotel.starRating ?? 0,
    correlationId: session.correlationId,
    travellers: formatRoomSummary(session.rooms),
    destination: session.selectedDestination.fullName,
    displayedPrice: room.price ?? session.selectedHotel.price ?? 0,
    portalUrl: config.routestack.portalUrl || undefined,
    priceCheckResult,
  });

  return {
    ...session,
    selectedRoom: room,
    paymentUrl: extractPaymentUrl(paymentJson),
  };
}

export async function createFlightSession(input: {
  originQuery: string;
  destinationQuery: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabinClass: string;
  availableTools: string[];
}): Promise<FlightSessionData> {
  let session: Record<string, unknown> | null = null;
  if (input.availableTools.includes("flight_session")) {
    session = (await callToolJson("flight_session", {})) as Record<
      string,
      unknown
    >;
  }

  const [originRaw, destinationRaw] = await Promise.all([
    callToolJson("flight_locations", { term: input.originQuery }),
    callToolJson("flight_locations", { term: input.destinationQuery }),
  ]);

  const originOptions = normalizeLookupOptions(originRaw, "origin");
  const destinationOptions = normalizeLookupOptions(destinationRaw, "destination");
  const origin = resolveBestLookupOption(input.originQuery, originOptions);
  const destination = resolveBestLookupOption(
    input.destinationQuery,
    destinationOptions,
  );

  if (!origin || !destination) {
    throw new Error("RouteStack could not resolve one or both flight endpoints.");
  }

  const filter = {
    origin: origin.code ?? origin.label,
    destination: destination.code ?? destination.label,
    departureDate: input.departureDate,
    returnDate: input.returnDate || undefined,
    adults: input.adults,
    children: input.children || undefined,
    infants: input.infants || undefined,
    cabinClass: input.cabinClass,
    tripType: input.returnDate ? "round_trip" : "one_way",
    originLocation: buildFlightLocationPayload(origin),
    destinationLocation: buildFlightLocationPayload(destination),
  };

  const flightsRaw = await callToolJson("flight_search", { filter });
  const flights = normalizeFlightOffers(flightsRaw);
  const flightMeta = findFlightSearchMeta(flightsRaw);

  return {
    originQuery: input.originQuery,
    destinationQuery: input.destinationQuery,
    departureDate: input.departureDate,
    returnDate: input.returnDate,
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    cabinClass: input.cabinClass,
    originOptions,
    destinationOptions,
    origin,
    destination,
    flights,
    session,
    correlationId: flightMeta.correlationId,
    searchFilterObj: flightMeta.searchFilterObj,
  };
}

export async function prepareFlightCheckout(
  session: FlightSessionData,
  flightId: string,
): Promise<FlightSessionData> {
  const flight = session.flights.find((entry) => entry.id === flightId);
  if (!flight || !session.origin || !session.destination) {
    throw new Error("Selected flight was not found in the current session.");
  }

  const fareSourceCode = flight.fareSourceCode ?? flight.id;
  const revalidateResult = await callToolJson("flight_revalidate", {
    fareSourceCode,
    searchListPrice: flight.price,
    searchFilterObj: flight.searchFilterObj ?? session.searchFilterObj,
    correlationId: flight.correlationId ?? session.correlationId,
  });

  const paymentJson = await callToolJson("flight_get_payment_url", {
    flight: {
      ...flight.raw,
      fareSourceCode,
      revalidateResult,
    },
    origin: session.origin.code ?? session.origin.label,
    destination: session.destination.code ?? session.destination.label,
    departureDate: session.departureDate,
    returnDate: session.returnDate || undefined,
    adults: session.adults,
    children: session.children,
    infants: session.infants,
    correlationId: flight.correlationId ?? session.correlationId,
    searchFilterObj: flight.searchFilterObj ?? session.searchFilterObj,
    portalUrl: config.routestack.portalUrl || undefined,
    sessionId:
      flight.sessionId ?? readStringRecord(session.session, ["sessionId", "id"]),
  });

  return {
    ...session,
    selectedFlight: flight,
    paymentUrl: extractPaymentUrl(paymentJson),
  };
}

export async function createCarSession(input: {
  pickupQuery: string;
  dropoffQuery: string;
  pickupDate: string;
  dropoffDate: string;
  driverAge: number;
}): Promise<CarSessionData> {
  const [pickupRaw, dropoffRaw] = await Promise.all([
    callToolJson("car_locations", { term: input.pickupQuery }),
    callToolJson("car_locations", { term: input.dropoffQuery }),
  ]);

  const pickupOptions = normalizeLookupOptions(pickupRaw, "pickup");
  const dropoffOptions = normalizeLookupOptions(dropoffRaw, "dropoff");
  const pickup = resolveBestLookupOption(input.pickupQuery, pickupOptions);
  const dropoff = resolveBestLookupOption(input.dropoffQuery, dropoffOptions);

  if (!pickup || !dropoff) {
    throw new Error("RouteStack could not resolve one or both car locations.");
  }

  const filter = {
    pickup: pickup.code ?? pickup.label,
    dropoff: dropoff.code ?? dropoff.label,
    pickupDate: input.pickupDate,
    dropoffDate: input.dropoffDate,
    driverAge: input.driverAge,
    pickupLocation: pickup.raw,
    dropoffLocation: dropoff.raw,
  };

  const carsRaw = await callToolJson("car_search", { filter });
  const cars = normalizeCarOffers(carsRaw);

  return {
    pickupQuery: input.pickupQuery,
    dropoffQuery: input.dropoffQuery,
    pickupDate: input.pickupDate,
    dropoffDate: input.dropoffDate,
    driverAge: input.driverAge,
    pickup,
    dropoff,
    cars,
  };
}

export async function prepareCarCheckout(
  session: CarSessionData,
  carId: string,
): Promise<CarSessionData> {
  const car = session.cars.find((entry) => entry.id === carId);
  if (!car || !session.pickup || !session.dropoff) {
    throw new Error("Selected car was not found in the current session.");
  }

  await callToolJson("car_revalidate", {
    fareCode: car.fareCode ?? car.id,
    correlationId: car.correlationId,
  });

  const paymentJson = await callToolJson("car_get_payment_url", {
    pickup: session.pickup.code ?? session.pickup.label,
    dropoff: session.dropoff.code ?? session.dropoff.label,
    pickupDate: session.pickupDate,
    dropoffDate: session.dropoffDate,
    car: car.raw,
    portalUrl: config.routestack.portalUrl || undefined,
  });

  return {
    ...session,
    selectedCar: car,
    paymentUrl: extractPaymentUrl(paymentJson),
  };
}
