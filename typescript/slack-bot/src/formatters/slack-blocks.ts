import type { KnownBlock } from "@slack/types";
import type { TravelSession } from "../types.js";
import {
  formatDateForUi,
  formatPrice,
  formatRoomSummary,
  truncate,
} from "../utils.js";

type SlackResponse = {
  response_type: "ephemeral";
  replace_original?: boolean;
  text: string;
  blocks: KnownBlock[];
};

type HotelTravelSession = Extract<TravelSession, { kind: "hotel" }>;
type FlightTravelSession = Extract<TravelSession, { kind: "flight" }>;
type CarTravelSession = Extract<TravelSession, { kind: "car" }>;

function markdownSection(text: string): KnownBlock {
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: truncate(text, 3000),
    },
  };
}

function hotelSummaryBlock(hotel: HotelTravelSession["data"]["hotels"][number], index: number): KnownBlock {
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: truncate(
        `*${index + 1}. ${hotel.name}*\n${hotel.address}\n${formatPrice(hotel.price, hotel.currency)}${hotel.starRating ? ` | ${hotel.starRating} star` : ""}${hotel.rating ? ` | rating ${hotel.rating}` : ""}`,
        3000,
      ),
    },
    accessory: hotel.image
      ? {
          type: "image",
          image_url: hotel.image,
          alt_text: hotel.name,
        }
      : undefined,
  };
}

function contextBlock(elements: string[]): KnownBlock {
  return {
    type: "context",
    elements: elements.map((text) => ({
      type: "mrkdwn",
      text: truncate(text, 2000),
    })),
  };
}

function divider(): KnownBlock {
  return { type: "divider" };
}

function staticSelectBlock(
  actionId: string,
  placeholder: string,
  options: Array<{ text: string; value: string; description?: string }>,
): KnownBlock {
  return {
    type: "actions",
    elements: [
      {
        type: "static_select",
        action_id: actionId,
        placeholder: {
          type: "plain_text",
          text: truncate(placeholder, 150),
          emoji: true,
        },
        options: options.map((option) => ({
          text: {
            type: "plain_text",
            text: truncate(option.text, 75),
            emoji: true,
          },
          description: option.description
            ? {
                type: "plain_text",
                text: truncate(option.description, 75),
                emoji: true,
              }
            : undefined,
          value: option.value,
        })),
      },
    ],
  };
}

function checkoutButton(url: string, text: string): KnownBlock {
  return {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text,
          emoji: true,
        },
        url,
        action_id: "noop_checkout_link",
      },
    ],
  };
}

function checkoutBlocks(url: string, label: string): KnownBlock[] {
  if (!url) {
    return [markdownSection("RouteStack did not return a checkout URL.")];
  }

  if (url.length <= 3000) {
    return [checkoutButton(url, label)];
  }

  return [
    markdownSection(
      `Checkout link:\n${truncate(url, 2900)}`,
    ),
  ];
}

export function errorResponse(message: string): SlackResponse {
  return {
    response_type: "ephemeral",
    replace_original: true,
    text: "RouteStack request failed",
    blocks: [
      markdownSection(`*:warning: RouteStack request failed*\n${message}`),
    ],
  };
}

export function loadingResponse(label: string): SlackResponse {
  return {
    response_type: "ephemeral",
    replace_original: true,
    text: label,
    blocks: [markdownSection(`:hourglass_flowing_sand: ${label}`)],
  };
}

export function destinationDiscoveryResponse(
  session: HotelTravelSession,
): SlackResponse {
  return {
    response_type: "ephemeral",
    replace_original: true,
    text: "Choose a destination",
    blocks: [
      markdownSection(
        `*Choose a RouteStack destination*\nFound ${session.data.destinationOptions.length} option(s) for *${session.data.query}*.\nTravel dates: *${formatDateForUi(session.data.checkIn)}* to *${formatDateForUi(session.data.checkOut)}*`,
      ),
      contextBlock([formatRoomSummary(session.data.rooms)]),
      staticSelectBlock(
        `hotel_destination__${session.id}`,
        "Select a destination",
        session.data.destinationOptions.slice(0, 10).map((option) => ({
          text: option.fullName,
          description: option.type || option.country || "Destination",
          value: option.id,
        })),
      ),
    ],
  };
}

export function hotelResultsResponse(session: HotelTravelSession): SlackResponse {
  const blocks: KnownBlock[] = [
    markdownSection(
      `*Hotels in ${session.data.selectedDestination?.fullName ?? session.data.query}*\nFound ${session.data.hotels.length} option(s). Pick one to load details and live room rates.`,
    ),
    contextBlock([
      `${formatDateForUi(session.data.checkIn)} to ${formatDateForUi(session.data.checkOut)}`,
      formatRoomSummary(session.data.rooms),
    ]),
  ];

  for (const [index, hotel] of session.data.hotels.entries()) {
    blocks.push(divider(), hotelSummaryBlock(hotel, index));
  }

  if (session.data.hotels.length > 0) {
    blocks.push(
      divider(),
      staticSelectBlock(
        `hotel_property__${session.id}`,
        "Select a hotel",
        session.data.hotels.map((hotel) => ({
          text: hotel.name,
          description: `${formatPrice(hotel.price, hotel.currency)} | ${hotel.address}`,
          value: hotel.id,
        })),
      ),
    );
  } else {
    blocks.push(divider(), markdownSection("No hotels were returned for that destination."));
  }

  return {
    response_type: "ephemeral",
    replace_original: true,
    text: "Hotel results",
    blocks,
  };
}

export function hotelDetailsResponse(session: HotelTravelSession): SlackResponse {
  const hotel = session.data.selectedHotel;
  if (!hotel) {
    return errorResponse("No hotel is selected.");
  }

  const details = session.data.hotelDetails ?? {};
  const description =
    typeof details.description === "string"
      ? details.description
      : typeof details.shortDescription === "string"
        ? details.shortDescription
        : hotel.address;

  const blocks: KnownBlock[] = [
    markdownSection(
      `*${hotel.name}*\n${truncate(description, 800)}\n${hotel.address}`,
    ),
    contextBlock([
      `${formatDateForUi(session.data.checkIn)} to ${formatDateForUi(session.data.checkOut)}`,
      formatRoomSummary(session.data.rooms),
    ]),
  ];

  for (const [index, room] of session.data.roomOffers.entries()) {
    blocks.push(
      divider(),
      markdownSection(
        `*${index + 1}. ${room.name}*\n${formatPrice(room.price, room.currency)}\n${room.refundable === true ? "Refundable" : room.refundable === false ? "Non-refundable" : "Refundability not specified"}\nMeal plan: ${room.mealPlan ?? "Not specified"}${room.facilities?.length ? `\nHighlights: ${room.facilities.join(", ")}` : ""}`,
      ),
    );
  }

  if (session.data.roomOffers.length > 0) {
    blocks.push(
      divider(),
      staticSelectBlock(
        `hotel_room__${session.id}`,
        "Select a room",
        session.data.roomOffers.map((room) => ({
          text: room.name,
          description: `${formatPrice(room.price, room.currency)} | ${room.refundable ? "Refundable" : "Check terms"}`,
          value: `${room.id}___${room.recommendationId}`,
        })),
      ),
    );
  } else {
    blocks.push(divider(), markdownSection("No live room offers were returned for this hotel."));
  }

  return {
    response_type: "ephemeral",
    replace_original: true,
    text: "Hotel room options",
    blocks,
  };
}

export function hotelCheckoutResponse(
  session: HotelTravelSession,
): SlackResponse {
  const hotel = session.data.selectedHotel;
  const room = session.data.selectedRoom;
  const url = session.data.paymentUrl ?? "";

  const blocks: KnownBlock[] = [
    markdownSection(
      `*:white_check_mark: Hotel checkout ready*\n${hotel ? `*${hotel.name}*` : "Selected hotel"}${room ? ` | ${room.name}` : ""}\n${formatDateForUi(session.data.checkIn)} to ${formatDateForUi(session.data.checkOut)}\n${formatPrice(room?.price ?? hotel?.price, room?.currency ?? hotel?.currency)}`,
    ),
  ];

  blocks.push(...checkoutBlocks(url, "Open hotel checkout"));

  return {
    response_type: "ephemeral",
    replace_original: true,
    text: "Hotel checkout ready",
    blocks,
  };
}

export function flightResultsResponse(
  session: FlightTravelSession,
): SlackResponse {
  const blocks: KnownBlock[] = [
    markdownSection(
      `*Flight options*\n${session.data.origin?.code ?? session.data.originQuery} to ${session.data.destination?.code ?? session.data.destinationQuery}\n${formatDateForUi(session.data.departureDate)}${session.data.returnDate ? ` | return ${formatDateForUi(session.data.returnDate)}` : ""}`,
    ),
    contextBlock([
      `${session.data.adults} adult${session.data.adults === 1 ? "" : "s"}, ${session.data.children} child${session.data.children === 1 ? "" : "ren"}, ${session.data.infants} infant${session.data.infants === 1 ? "" : "s"}`,
      `Cabin: ${session.data.cabinClass.replace(/_/g, " ")}`,
    ]),
  ];

  if (session.data.flights.length === 0) {
    blocks.push(markdownSection("No live fares were returned for this search."));
    return {
      response_type: "ephemeral",
      replace_original: true,
      text: "No flights found",
      blocks,
    };
  }

  for (const [index, flight] of session.data.flights.entries()) {
    blocks.push(
      divider(),
      markdownSection(
        `*${index + 1}. ${flight.airline} ${flight.flightNumber}*\n${flight.routeSummary ?? `${flight.from} -> ${flight.to}`}\n${flight.departure} to ${flight.arrival}\n${formatPrice(flight.price, flight.currency)}${flight.duration ? ` | ${flight.duration}` : ""}${flight.stops !== undefined ? ` | ${flight.stops === 0 ? "nonstop" : `${flight.stops} stop${flight.stops === 1 ? "" : "s"}`}` : ""}`,
      ),
    );
  }

  blocks.push(
    divider(),
    staticSelectBlock(
      `flight_fare__${session.id}`,
      "Select a fare",
      session.data.flights.map((flight) => ({
        text: `${flight.airline} ${flight.flightNumber}`.trim(),
        description: `${flight.routeSummary ?? `${flight.from} -> ${flight.to}`} | ${formatPrice(flight.price, flight.currency)}`,
        value: flight.id,
      })),
    ),
  );

  return {
    response_type: "ephemeral",
    replace_original: true,
    text: "Flight results",
    blocks,
  };
}

export function flightCheckoutResponse(
  session: FlightTravelSession,
): SlackResponse {
  const flight = session.data.selectedFlight;
  const url = session.data.paymentUrl ?? "";

  const blocks: KnownBlock[] = [
    markdownSection(
      `*:white_check_mark: Flight checkout ready*\n${flight ? `${flight.airline} ${flight.flightNumber}` : "Selected fare"}\n${flight?.routeSummary ?? `${session.data.origin?.code ?? session.data.originQuery} -> ${session.data.destination?.code ?? session.data.destinationQuery}`}\n${formatPrice(flight?.price, flight?.currency)}`,
    ),
  ];

  blocks.push(...checkoutBlocks(url, "Open flight checkout"));

  return {
    response_type: "ephemeral",
    replace_original: true,
    text: "Flight checkout ready",
    blocks,
  };
}

export function carResultsResponse(session: CarTravelSession): SlackResponse {
  const blocks: KnownBlock[] = [
    markdownSection(
      `*Rental car options*\n${session.data.pickup?.label ?? session.data.pickupQuery} to ${session.data.dropoff?.label ?? session.data.dropoffQuery}\n${formatDateForUi(session.data.pickupDate)} to ${formatDateForUi(session.data.dropoffDate)}`,
    ),
    contextBlock([`Driver age: ${session.data.driverAge}`]),
  ];

  if (session.data.cars.length === 0) {
    blocks.push(markdownSection("No cars were returned for this search."));
    return {
      response_type: "ephemeral",
      replace_original: true,
      text: "No cars found",
      blocks,
    };
  }

  for (const [index, car] of session.data.cars.entries()) {
    blocks.push(
      divider(),
      markdownSection(
        `*${index + 1}. ${car.vehicleName}*\n${car.vendor}\n${formatPrice(car.price, car.currency)}${car.transmission ? ` | ${car.transmission}` : ""}${car.seats ? ` | ${car.seats} seats` : ""}`,
      ),
    );
  }

  blocks.push(
    divider(),
    staticSelectBlock(
      `car_vehicle__${session.id}`,
      "Select a vehicle",
      session.data.cars.map((car) => ({
        text: car.vehicleName,
        description: `${car.vendor} | ${formatPrice(car.price, car.currency)}`,
        value: car.id,
      })),
    ),
  );

  return {
    response_type: "ephemeral",
    replace_original: true,
    text: "Car results",
    blocks,
  };
}

export function carCheckoutResponse(session: CarTravelSession): SlackResponse {
  const car = session.data.selectedCar;
  const url = session.data.paymentUrl ?? "";

  const blocks: KnownBlock[] = [
    markdownSection(
      `*:white_check_mark: Car checkout ready*\n${car ? `${car.vehicleName} | ${car.vendor}` : "Selected vehicle"}\n${formatPrice(car?.price, car?.currency)}`,
    ),
  ];

  blocks.push(...checkoutBlocks(url, "Open car checkout"));

  return {
    response_type: "ephemeral",
    replace_original: true,
    text: "Car checkout ready",
    blocks,
  };
}
