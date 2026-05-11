import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

import { config } from "../config.js";
import {
  callTool,
  listTools,
  type McpTool,
  type McpToolResult,
} from "../mcp-client.js";
import { retrieveRelevantProfile } from "../profile/retrieve.js";
import { buildSystemPrompt } from "./prompts.js";

const MAX_TOOL_ITERATIONS = 10;

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type ToolExecutionContext = {
  flight: {
    sessionId?: string;
    correlationId?: string;
    searchFilterObj?: Record<string, unknown>;
    flights?: any[];
    selectedFlight?: {
      fareSourceCode?: string;
    };
  };

  hotel: {
    token?: string;
    correlationId?: string;
    hotels?: any[];
    selectedHotel?: {
      hotelId?: string;
      hotelName?: string;
      hotelImage?: string;
    };
    rooms?: any[];
    selectedRoom?: {
      roomName?: string;
      roomId?: string;
      recommendationId?: string;
      publishedRate?: number;
    };
  };

  car: {
    correlationId?: string;
    cars?: any[];
    selectedCar?: {
      fareCode?: string;
      car?: any;
    };
    searchArgs?: {
      pickup?: string;
      dropoff?: string;
    };
  };
};

export type OnToolCall = (
  toolName: string,
  args: Record<string, unknown>,
) => void;

export async function runTravelAgent(
  userInput: string,
  history: Message[] = [],
  context: ToolExecutionContext,
  onToolCall?: OnToolCall,
): Promise<string> {
  const preferences = await retrieveRelevantProfile(userInput);
  const tools = await listTools();

  const systemPrompt = [
    buildSystemPrompt(preferences),
    buildContextPrompt(context),
  ].join("\n\n");

  if (config.llm.provider === "anthropic") {
    return runAnthropic(
      userInput,
      history,
      tools,
      context,
      systemPrompt,
      onToolCall,
    );
  }

  if (config.llm.provider === "mistral") {
    const client = new OpenAI({
      apiKey: config.llm.mistral.apiKey,
      baseURL: config.llm.mistral.baseUrl,
    });

    return runOpenAICompatible(
      client,
      config.llm.mistral.model,
      userInput,
      history,
      tools,
      context,
      systemPrompt,
      onToolCall,
    );
  }

  const client = new OpenAI({
    apiKey: config.llm.openai.apiKey,
  });

  return runOpenAICompatible(
    client,
    config.llm.openai.model,
    userInput,
    history,
    tools,
    context,
    systemPrompt,
    onToolCall,
  );
}

function mapTools(tools: McpTool[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

async function runOpenAICompatible(
  client: OpenAI,
  model: string,
  userInput: string,
  history: Message[],
  tools: McpTool[],
  context: ToolExecutionContext,
  systemPrompt: string,
  onToolCall?: OnToolCall,
): Promise<string> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: userInput },
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: mapTools(tools),
    });

    const assistant = response.choices[0]?.message;
    if (!assistant) {
      throw new Error("No response from LLM");
    }

    messages.push(assistant);

    if (!assistant.tool_calls?.length) {
      return assistant.content ?? "";
    }

    for (const toolCall of assistant.tool_calls) {
      const tool = tools.find((t) => t.name === toolCall.function.name);
      if (!tool) continue;

      let args: Record<string, unknown> = {};

      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch {}

      const finalArgs = buildToolArgs(tool.name, args, tool, context);

      validateArgs(tool, finalArgs);

      onToolCall?.(tool.name, finalArgs);
      const result = await callTool(tool.name, finalArgs);

      const json = extractJson(result);

      const updatedJson = handleToolResult(json, tool.name);

      updateExecutionContext(tool.name, finalArgs, updatedJson, context);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result.content
          .map((c) => c.text || JSON.stringify(c))
          .join("\n"),
      });
    }
  }

  return "Max iterations reached";
}

async function runAnthropic(
  userInput: string,
  history: Message[],
  tools: McpTool[],
  context: ToolExecutionContext,
  systemPrompt: string,
  onToolCall?: OnToolCall,
): Promise<string> {
  const client = new Anthropic({
    apiKey: config.llm.anthropic.apiKey,
  });

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    {
      role: "user",
      content: userInput,
    },
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: config.llm.anthropic.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
    });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolUses.length) {
      return response.content
        .map((b) => ("text" in b ? b.text : ""))
        .join("\n");
    }

    messages.push({
      role: "assistant",
      content: response.content,
    });

    const toolResults: Anthropic.ContentBlockParam[] = [];

    for (const block of toolUses) {
      const tool = tools.find((t) => t.name === block.name);
      if (!tool) continue;

      const args = buildToolArgs(
        block.name,
        (block.input ?? {}) as Record<string, unknown>,
        tool,
        context,
      );

      validateArgs(tool, args);

      onToolCall?.(tool.name, args);

      const result = await callTool(block.name, args);

      const json = extractJson(result);

      const updatedJson = handleToolResult(json, block.name);

      updateExecutionContext(block.name, args, updatedJson, context);

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.content
          .map((c) => c.text || JSON.stringify(c))
          .join("\n"),
      });
    }

    messages.push({
      role: "user",
      content: toolResults,
    });
  }

  return "Max iterations reached";
}

function buildToolArgs(
  toolName: string,
  args: Record<string, unknown>,
  tool: McpTool,
  context: ToolExecutionContext,
) {
  const enriched = { ...args };

  const schema =
    typeof tool.inputSchema === "object" &&
    tool.inputSchema &&
    "properties" in tool.inputSchema
      ? (tool.inputSchema.properties as Record<string, unknown>)
      : {};

  if (
    "sessionId" in schema &&
    context.flight.sessionId &&
    !enriched.sessionId
  ) {
    enriched.sessionId = context.flight.sessionId;
  }

  if ("token" in schema && context.hotel.token && !enriched.token) {
    enriched.token = context.hotel.token;
  }

  if (
    "correlationId" in schema &&
    context.hotel.correlationId &&
    !enriched.correlationId
  ) {
    enriched.correlationId = context.hotel.correlationId;
  }

  if (
    "hotelId" in schema &&
    context.hotel.selectedHotel?.hotelId &&
    !enriched.hotelId
  ) {
    enriched.hotelId = context.hotel.selectedHotel.hotelId;
  }

  if (
    "recommendationId" in schema &&
    context.hotel.selectedRoom?.recommendationId &&
    !enriched.recommendationId
  ) {
    enriched.recommendationId = context.hotel.selectedRoom.recommendationId;
  }

  if (
    "roomId" in schema &&
    context.hotel.selectedRoom?.roomId &&
    !enriched.roomId
  ) {
    enriched.roomId = context.hotel.selectedRoom.roomId;
  }

  return enriched;
}

function validateArgs(tool: McpTool, args: Record<string, unknown>) {
  const required = Array.isArray(tool.inputSchema.required)
    ? tool.inputSchema.required
    : [];

  for (const field of required) {
    if (!args[field as string]) {
      throw new Error(`Missing required field: ${String(field)}`);
    }
  }
}

function extractJson(result: McpToolResult) {
  for (const item of result.content) {
    if (typeof item.text === "string") {
      try {
        return JSON.parse(item.text);
      } catch {}
    }
  }

  return null;
}

function updateExecutionContext(
  toolName: string,
  _args: any,
  result: any,
  context: ToolExecutionContext,
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
          recommendationId: roomFromContext?.recommendationId,
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
    };

    context.car.searchArgs = {
      pickup: result?.result?.pickup,
      dropoff: result?.result?.dropoff,
    };
  }
}

function buildContextPrompt(context: ToolExecutionContext): string {
  // HOTEL CONTEXT
  const hotel = context.hotel ?? {};
  const hotelSummaries = Array.isArray(hotel.hotels)
    ? hotel.hotels
        .slice(0, 5)
        .map((item: any, index: number) => {
          const hotelId = item?.hotelId ?? item?.id ?? "unknown";
          const hotelName = item?.name ?? item?.hotelName ?? "Unknown hotel";
          return `${index + 1}. ${hotelName} (hotelId: ${hotelId})`;
        })
        .join("\n")
    : "";

  const roomSummaries = Array.isArray(hotel.rooms)
    ? hotel.rooms
        .slice(0, 5)
        .map((item: any, index: number) => {
          const roomId = item?.id ?? item?.roomId ?? "unknown";
          const roomName = item?.name ?? item?.roomName ?? "Unknown room";
          const recommendationId = item?.recommendationId ?? "unknown";
          return `${index + 1}. ${roomName} (roomId: ${roomId}, recommendationId: ${recommendationId})`;
        })
        .join("\n")
    : "";

  // FLIGHT CONTEXT
  const flight = context.flight ?? {};
  const flightSummaries = Array.isArray(flight.flights)
    ? flight.flights
        .slice(0, 5)
        .map((item: any, index: number) => {
          const fareSourceCode = item?.fareSourceCode ?? "unknown";
          const airline = item?.flights?.[0]?.airline ?? "Unknown airline";
          const flightName =
            (item?.flights || [])
              .map(
                (f: any) =>
                  `Departure: ${f.departure} (departureTime: ${f.departureTime}) -> Arrival: ${f.arrival} (arrivalTime: ${f.arrivalTime})`,
              )
              .join(", ") ?? "Unknown flight";
          return `${index + 1}. ${flightName} (airline: ${airline}, fareSourceCode: ${fareSourceCode}, stops: ${item?.stops})`;
        })
        .join("\n")
    : "";
  const selectedFlight = flight.selectedFlight ?? {};
  const carSummaries = Array.isArray(context.car.cars)
    ? context.car.cars
        .slice(0, 5)
        .map((item: any, index: number) => {
          const fareCode = item?.price_postpaid?.fareCode ?? "unknown";
          const carName = item?.name ?? "unknown";
          const locations = `Pickup: ${item.pickup.location} (${item.pickup.location_code}) -> Dropoff: ${item.dropoff.location} (${item.dropoff.location_code})`;
          return `${index + 1}. ${carName} (locations: ${locations}, fareCode: ${fareCode})`;
        })
        .join("\n")
    : [];

  return [
    "CURRENT TOOL CONTEXT:",
    hotel.token
      ? `- Active hotel search token: ${hotel.token}`
      : "- No active hotel search token",
    hotel.correlationId
      ? `- Active hotel correlationId: ${hotel.correlationId}`
      : "- No active hotel correlationId",
    hotel.selectedHotel?.hotelId
      ? `- Selected hotel: ${hotel.selectedHotel.hotelName ?? "Unknown"} (hotelId: ${hotel.selectedHotel.hotelId})`
      : "- No hotel selected yet",
    hotel.selectedRoom?.roomId
      ? `- Selected room: roomId=${hotel.selectedRoom.roomId}, recommendationId=${hotel.selectedRoom.recommendationId ?? "unknown"}`
      : "- No room selected yet",
    hotelSummaries
      ? `- Hotels from previous search:\n${hotelSummaries}`
      : "- No cached hotel list",
    roomSummaries
      ? `- Rooms for selected hotel from previous search:\n${roomSummaries}`
      : "- No cached rooms list",
    flight.sessionId
      ? `- Active flight session: ${flight.sessionId}`
      : "- No active flight session",
    flight.correlationId
      ? `- Active flight correlationId: ${flight.correlationId}`
      : "- No active flight correlationId",
    flight.selectedFlight?.fareSourceCode
      ? `- Selected flight: ${flight.selectedFlight.fareSourceCode}`
      : "- No flight selected yet",
    flight.searchFilterObj
      ? `- Active flight search filter: ${JSON.stringify(flight.searchFilterObj)}`
      : "- No active flight search filter",
    flightSummaries
      ? `- Flights from previous search:\n${flightSummaries}`
      : "- No cached flight list",
    selectedFlight.fareSourceCode
      ? `- Selected flight: ${selectedFlight.fareSourceCode}`
      : "- No flight selected yet",
    carSummaries
      ? `- Cars from previous search:\n${carSummaries}`
      : "- No cached car list",
    context.car.selectedCar
      ? `- Selected car: ${context.car.selectedCar.fareCode}`
      : "- No car selected yet",

    "If the user's request can be answered by continuing from this context, do not restart the search flow.",
    "Only call an earlier search tool when the user changed destination/dates/occupancy or required context is genuinely missing.",
  ].join("\n");
}

function handleToolResult(json: any, toolName: string) {
  let updatedResult = json;

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
              flights: json?.result,
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
              cars: json?.result?.cars.slice(0, 20)
            },
          }
        : json;
  }

  return updatedResult;
}
