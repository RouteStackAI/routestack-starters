import { streamText, tool } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { z } from "zod";

import { config } from "@/lib/config";
import { listTools, callTool } from "@/lib/mcp-client";

type ToolArgs = Record<string, any>;

type ExecutionContext = {
  hotel: {
    token?: string;
    correlationId?: string;
    hotels?: any[];
    rooms?: any[];
    searchArgs?: ToolArgs;

    selectedHotel?: {
      hotelId?: string;
      hotelName?: string;
      hotelImage?: string;
      hotelLatitude?: number;
      hotelLongitude?: number;
      hotelStarRating?: number;
      hotelRating?: number;
      destination?: string;
      displayedPrice?: number;
    };

    selectedRoom?: {
      roomName?: string;
      roomId?: string;
      recommendationId?: string;
      displayedPrice?: number;
      publishedRate?: number;
    };

    limit?: number;
  };

  flight: {
    sessionId?: string;
    correlationId?: string;
    searchFilterObj?: string;
    flights?: any[];
    searchArgs?: ToolArgs;

    selectedFlight?: {
      fareSourceCode?: string;
      flight?: any;
    };
  };

  car: {
    correlationId?: string;
    cars?: any[];
    searchArgs?: ToolArgs;

    selectedCar?: {
      fareCode?: string;
      car?: any;
    };
  };
};

function normalizeFlightSearchArgs(args: ToolArgs): ToolArgs {
  const inputFilter =
    typeof args.filter === "object" && args.filter !== null ? args.filter : {};

  const origin = inputFilter.origin ?? inputFilter.departureAirportCode ?? "";

  const destination =
    inputFilter.destination ?? inputFilter.arrivalAirportCode ?? "";

  const departureDate = inputFilter.departureDate ?? "";
  const returnDate =
    typeof inputFilter.returnDate === "string" && inputFilter.returnDate.trim()
      ? inputFilter.returnDate
      : departureDate;

  return {
    ...args,
    filter: {
      ...inputFilter,
      origin,
      destination,
      departureDate,
      returnDate,
      adults: typeof inputFilter.adults === "number" ? inputFilter.adults : 1,
      cabinClass:
        typeof inputFilter.cabinClass === "string"
          ? inputFilter.cabinClass
          : "economy",
      tripType:
        typeof inputFilter.tripType === "string"
          ? inputFilter.tripType
          : "round_trip",
      originLocation: inputFilter.originLocation ?? {
        code: origin,
      },
      destinationLocation: inputFilter.destinationLocation ?? {
        code: destination,
      },
    },
  };
}

function buildToolArgs(
  toolName: string,
  args: ToolArgs,
  context: ExecutionContext,
): ToolArgs {
  const enriched = { ...args };

  // ---------------------------------------
  // flight_search normalization
  // ---------------------------------------
  if (toolName === "flight_search") {
    return normalizeFlightSearchArgs(enriched);
  }

  // ---------------------------------------
  // FLIGHT
  // ---------------------------------------
  if (toolName === "flight_revalidate") {
    const selected = context.flight.selectedFlight;

    if (!enriched.fareSourceCode && selected?.fareSourceCode) {
      enriched.fareSourceCode = selected.fareSourceCode;
    }

    if (!enriched.correlationId && context.flight.correlationId) {
      enriched.correlationId = context.flight.correlationId;
    }

    if (!enriched.searchFilterObj && context.flight.searchFilterObj) {
      enriched.searchFilterObj = context.flight.searchFilterObj;
    }
  }

  if (toolName === "flight_get_payment_url") {
    const filter = context.flight.searchArgs?.filter ?? {};
    const selected = context.flight.selectedFlight;

    if (!enriched.flight && selected?.flight) {
      enriched.flight = selected.flight;
    }

    if (!enriched.origin) {
      enriched.origin = filter.origin;
    }

    if (!enriched.destination) {
      enriched.destination = filter.destination;
    }

    if (!enriched.departureDate) {
      enriched.departureDate = filter.departureDate;
    }

    if (!enriched.returnDate) {
      enriched.returnDate = filter.returnDate;
    }

    if (!enriched.adults) {
      enriched.adults = filter.adults ?? 1;
    }

    if (!enriched.sessionId && context.flight.sessionId) {
      enriched.sessionId = context.flight.sessionId;
    }

    if (!enriched.correlationId && context.flight.correlationId) {
      enriched.correlationId = context.flight.correlationId;
    }

    if (!enriched.searchFilterObj && context.flight.searchFilterObj) {
      enriched.searchFilterObj = context.flight.searchFilterObj;
    }
  }

  // ---------------------------------------
  // HOTEL
  // ---------------------------------------
  if (toolName === "search_hotels") {
    enriched.limit ??= context.hotel.limit;
  }

  if (toolName === "get_rooms_and_rates") {
    const hotel = context.hotel.selectedHotel;
    const search = context.hotel.searchArgs;

    enriched.hotelId ??= hotel?.hotelId;
    enriched.hotelName ??= hotel?.hotelName;
    enriched.token ??= context.hotel.token;
    enriched.correlationId ??= context.hotel.correlationId;
    enriched.checkIn ??= search?.checkIn;
    enriched.checkOut ??= search?.checkOut;
    enriched.rooms ??= search?.rooms;
    enriched.publishedRate ??= hotel?.displayedPrice;
  }

  if (toolName === "revalidate") {
    enriched.hotelId ??= context.hotel.selectedHotel?.hotelId;
    enriched.recommendationId ??= context.hotel.selectedRoom?.recommendationId;
    enriched.token ??= context.hotel.token;
    enriched.correlationId ??= context.hotel.correlationId;
    enriched.publishedRate ??= context.hotel.selectedRoom?.displayedPrice;
  }

  if (toolName === "get_payment_url" || toolName === "hotel_get_payment_url") {
    const hotel = context.hotel.selectedHotel;
    const room = context.hotel.selectedRoom;
    const search = context.hotel.searchArgs;

    enriched.hotelId ??= hotel?.hotelId;
    enriched.token ??= context.hotel.token;
    enriched.roomId ??= room?.roomId;
    enriched.recommendationId ??= room?.recommendationId;
    enriched.checkIn ??= search?.checkIn;
    enriched.checkOut ??= search?.checkOut;
    enriched.hotelName ??= hotel?.hotelName;
    enriched.hotelImage ??= hotel?.hotelImage;
    enriched.correlationId ??= context.hotel.correlationId;
    enriched.displayedPrice ??= room?.displayedPrice ?? hotel?.displayedPrice;
    enriched.destination ??= hotel?.destination;
    enriched.hotelLatitude ??= hotel?.hotelLatitude;
    enriched.hotelLongitude ??= hotel?.hotelLongitude;
    enriched.hotelStarRating ??= hotel?.hotelStarRating;
    enriched.hotelRating ??= hotel?.hotelRating;
  }

  // ---------------------------------------
  // CAR
  // ---------------------------------------
  if (toolName === "car_revalidate") {
    enriched.fareCode ??= context.car.selectedCar?.fareCode;
    enriched.correlationId ??= context.car.correlationId;
  }

  if (toolName === "car_get_payment_url") {
    const search = context.car.searchArgs;

    enriched.pickup ??= search?.filter?.pickup;
    enriched.dropoff ??= search?.filter?.dropoff;
    enriched.pickupDate ??= search?.filter?.pickupDate;
    enriched.dropoffDate ??= search?.filter?.dropoffDate;
    enriched.car ??= context.car.selectedCar?.car;
  }

  return enriched;
}

function handleToolResult(json: any, toolName: string) {
  let updatedResult = json;

  if (toolName === "search_hotels" && json) {
    updatedResult =
      json?.result?.result?.length > 0
        ? {
            ...json,
            result: {
              ...json.result,
              result: json?.result?.result.slice(0, 5).map((h: any) => ({
                id: h.id,
                name: h.name,
                providerName: h.providerName,
                starRating: h.starRating,
                ourprice: h.ourprice,
                publishedRate: h.publishedRate,
                saving: h.saving,
                distance: h.distance,
                heroImage: h.heroImage,
              })),
            },
          }
        : json;
  }

  if (toolName === "get_hotel_details" && json) {
    const hotelResult = json?.result;
    updatedResult = hotelResult
      ? {
          id: hotelResult.id,
          name: hotelResult.name,
          hotelImage: hotelResult.heroImage,
          checkinInfo: hotelResult.checkinInfo,
          checkoutInfo: hotelResult.checkoutInfo,
          starRating: hotelResult.starRating,
          nearByAttractions:
            hotelResult?.nearByAttractions?.length > 0
              ? hotelResult.nearByAttractions
                  .slice(0, 3)
                  .map((a: any) => `${a.name} (${a.distance} ${a.unit})`)
              : [],
          geoCode: hotelResult?.geoCode,
          // descriptions: hotelResult?.descriptions?.length > 0 ? hotelResult.descriptions.slice(0, 5) : [],
          address: hotelResult?.contact?.address
            ? [
                hotelResult?.contact?.address?.line1,
                hotelResult?.contact?.address?.city?.name,
                hotelResult?.contact?.address?.country?.name,
                hotelResult?.contact?.address?.state?.name,
                hotelResult?.contact?.address?.postalCode,
              ]
                .filter((value) => Boolean(value))
                .join(", ")
            : "",
          facilities:
            hotelResult?.facilities?.length > 0
              ? hotelResult.facilities.slice(0, 5).map((f: any) => f.name)
              : [],
        }
      : json;
  }

  if (toolName === "get_rooms_and_rates" && json) {
    updatedResult =
      json?.result?.groups?.length > 0
        ? {
            ...json,
            result: {
              id: json.result.id,
              token: json.result.token,
              correlationId: json.result.correlationId,
              rooms: json?.result?.groups
                .map((d: any) =>
                  d.rooms.map((r: any) => ({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    recommendationId: r.recommendationId,
                    rateid: r.rateid,
                    ourprice: r.ourprice,
                    publishedRate: r.publishedRate,
                    refundable: r.refundable,
                  })),
                )
                .flat()
                .slice(0, 5),
            },
          }
        : json;
  }

  if (toolName === "get_booking_info" && json) {
    const bookingResult = json?.result;
    updatedResult = bookingResult
      ? {
          bookingId: bookingResult.bookingId,
          hotelName: bookingResult.name,
          hotelId: bookingResult.hotelid,
          currency: bookingResult.currency,
          bookingStatus: bookingResult.bookingStatus,
          hotelImage: bookingResult.heroImage,
          roomName: bookingResult.roomname,
          boardBasis: bookingResult.boardBasis,
          hotelContact: bookingResult.contact,
          guestNames: bookingResult.guestNames,
          confirmationNumber: bookingResult.providerConfirmationNumber,
          creationDate: bookingResult.creationDate,
          cancellationDate: bookingResult.cancellationDate,
          checkInDate: bookingResult.tripStartDate,
          checkOutDate: bookingResult.tripEndDate,
          prepaid: bookingResult.prepaid,
          cancellationPolicies: bookingResult.cancellationPolicies,
          cancellationDetails: bookingResult.cancellationDetails,
          additionalCharges: bookingResult.additional_charges,
          billingContact: bookingResult.billingContact,
          taxes: bookingResult.taxes,
          fees: bookingResult.fees,
          roomCost: bookingResult.roomCost,
          payable: bookingResult.payable,
          billingCountry: bookingResult.billing_country,
          memberid: bookingResult.memberid,
          policies: bookingResult.policies,
          occupancies: bookingResult.occupancies,
          rooms: bookingResult.rooms,
          adults: bookingResult.adults,
          children: bookingResult.children,
        }
      : json;
  }

  if (toolName === "flight_search" && json) {
    updatedResult =
      json?.result?.length > 0
        ? {
            ...json,
            result: {
              flights: json?.result.slice(0, 5),
            },
          }
        : json;
  }

  if(toolName === "car_search" && json) {
    updatedResult =
      json?.result?.cars?.length > 0
        ? {
            ...json,
            result: {
              cars: json?.result?.cars.slice(0, 5),
            },
          }
        : json;
  }

  return updatedResult;
}

function updateExecutionContext(
  toolName: string,
  args: any,
  result: any,
  context: ExecutionContext,
) {
  if (!result) return;

  if (toolName === "search_hotels") {
    context.hotel.token = result?.result?.token;
    context.hotel.correlationId = result?.result?.correlationId;
    context.hotel.hotels = result?.result?.result.map((h: any) => ({
      id: h.id,
      name: h.name,
      providerName: h.providerName,
      starRating: h.starRating,
      ourprice: h.ourprice,
      publishedRate: h.publishedRate,
      saving: h.saving,
      distance: h.distance,
      heroImage: h.heroImage,
    }));
  }

  if (toolName === "get_hotel_details") {
    context.hotel.selectedHotel = {
      hotelId: result?.id,
      hotelName: result?.name,
      hotelImage: result?.hotelImage,
    };
  }

  if (toolName === "get_rooms_and_rates") {
    const hotelId = result?.result?.id;

    if (hotelId) {
      const selectedHotel = context.hotel.hotels?.find((h) => h.id === hotelId);

      if (selectedHotel) {
        context.hotel.selectedHotel = {
          hotelId: selectedHotel.id,
          hotelName: selectedHotel.name,
        };
      }
    }

    const rooms =
      result?.result?.rooms?.length > 0 ? result?.result?.rooms : [];

    if (rooms.length > 0) {
      context.hotel.rooms = rooms;
    }
  }

  if (toolName === "revalidate") {
    const hotelId = result?.result?.hotelId;
    if (hotelId === context.hotel.selectedHotel?.hotelId) {
      const selectedRoom = result?.result?.room?.[0];
      const selectedRate = result?.result?.rate?.[0];

      if (selectedRoom) {
        const roomFromContext = context.hotel.rooms?.find(
          (r) => r.id === selectedRoom.id,
        );

        context.hotel.selectedRoom = {
          roomName: selectedRoom.name,
          roomId: selectedRoom.id,
          recommendationId: roomFromContext.recommendationId,
          publishedRate: selectedRate?.publishedRate,
        };
      }
    }
  }

  if (toolName === "flight_session") {
    context.flight.sessionId = result?.sessionId ? result.sessionId : "";
  }

  if (toolName === "flight_search") {
    context.flight.searchFilterObj = result?.searchFilterObj;
    context.flight.correlationId = result?.correlationId;
    context.flight.flights = result?.result?.flights;
  }

  if (toolName === "car_search") {
    context.car.correlationId = result?.correlationId;
    context.car.cars = result?.result?.cars;
  }

  if (toolName === "car_revalidate") {
    context.car.selectedCar = {
      fareCode: result?.result?.fareCode,
      car: result?.result?.car,
    }

    context.car.searchArgs = {
      pickup: result?.result?.pickup,
      dropoff: result?.result?.dropoff
    }
  }
}

function buildContextPrompt(context: ExecutionContext) {
  return `
CURRENT TOOL CONTEXT

HOTEL:
- token: ${context.hotel.token ?? "none"}
- correlationId: ${context.hotel.correlationId ?? "none"}
- selected hotelId: ${context.hotel.selectedHotel?.hotelId ?? "none"}
- selected recommendationId: ${context.hotel.selectedRoom?.recommendationId ?? "none"}

FLIGHT:
- sessionId: ${context.flight.sessionId ?? "none"}
- correlationId: ${context.flight.correlationId ?? "none"}
- selected fareSourceCode: ${context.flight.selectedFlight?.fareSourceCode ?? "none"}

CAR:
- correlationId: ${context.car.correlationId ?? "none"}
- selected fareCode: ${context.car.selectedCar?.fareCode ?? "none"}

STRICT:
- Reuse existing context whenever possible
- Never invent ids
- Never invent payment URLs
- Never show raw tool calls
`;
}

function extractJson(result: any): any {
  for (const item of result.content) {
    if (typeof item.text === "string") {
      try {
        return JSON.parse(item.text);
      } catch {}
    }
  }
  return null;
}

const context: ExecutionContext = {
  hotel: { limit: 5 },
  flight: {},
  car: {},
};

export async function handleChatPost(req: Request) {
  const { messages } = await req.json();

  const mcpTools = await listTools();

  const tools = Object.fromEntries(
    mcpTools.map((t) => [
      t.name,
      tool({
        description: t.description || "",
        parameters: z.object({}).passthrough(),

        execute: async (args) => {
          try {
            const normalizedArgs = buildToolArgs(
              t.name,
              args as Record<string, unknown>,
              context,
            );

            const result = await callTool(t.name, normalizedArgs);

            let json = extractJson(result);

            const updatedJson = handleToolResult(json, t.name);

            updateExecutionContext(
              t.name,
              normalizedArgs,
              updatedJson,
              context,
            );

            const content = Array.isArray(result.content) ? result.content : [];
            const text =
              content.find(
                (c): c is { text: string } =>
                  typeof c === "object" &&
                  c !== null &&
                  "text" in c &&
                  typeof (c as { text?: string }).text === "string",
              )?.text ?? JSON.stringify(result.content);

            if (result.isError) {
              return {
                toolError: true,
                toolName: t.name,
                message: text,
              };
            }

            try {
              return JSON.stringify(updatedJson);
            } catch {
              return { text };
            }
          } catch (error) {
            return {
              toolError: true,
              toolName: t.name,
              message:
                error instanceof Error
                  ? error.message
                  : "Unknown tool execution error",
            };
          }
        },
      }),
    ]),
  );

  const result = await streamText({
    model: mistral(config.mistral.model || "mistral-small-latest"),

    system: `
You are RouteStack travel assistant.

HOTEL FLOW:
search_destinations → search_hotels → get_rooms_and_rates → revalidate → get_payment_url

FLIGHT FLOW:
flight_session → flight_locations → flight_search → flight_revalidate → flight_get_payment_url

CAR FLOW:
car_locations → car_search → car_revalidate → car_get_payment_url

${buildContextPrompt(context)}

STRICT RULES:
- NEVER invent IDs (hotelId, token, correlationId, recommendationId, roomId, fareSourceCode).
- ALWAYS reuse values from previous tool responses
- If required data is missing, call the appropriate previous tool
- If user do not provide year when providing dates take year: ${new Date().getFullYear()} by default. The current date is ${new Date().toISOString()}
- Follow correct sequence
Be concise and accurate.
    `,

    messages,
    tools,
    maxSteps: 8,
  });

  return result.toDataStreamResponse();
}
