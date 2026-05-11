import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { callTool, type McpTool, type McpToolResult } from "./mcp-client.js";
import { ToolExecutionContext } from "./types.js";

// ---------------------------------------------------------------------------
// SYSTEM PROMPT
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a travel assistant.

Your job is to understand natural travel requests and decide what action to take.

STRICT RULES:
- NEVER invent IDs (hotelId, token, correlationId, recommendationId, roomId, fareSourceCode)
- ALWAYS reuse values from previous tool responses
- If required data is missing, call the appropriate previous tool
- Continue from current context whenever possible
- Format final user-facing answers as clean markdown with headings, short bullet lists, and concise sections.

DECISION RULES:
- If user asks for flights, use flight tools
- If user asks for hotels, use hotel tools
- If user asks for cars, use car tools
- If user asks to plan a trip, decide the appropriate tools
- If user refines previous results, continue from current context instead of restarting
- If user do not provide year when providing dates take year: ${new Date().getFullYear()} by default. The current date is ${new Date().toISOString()}

HOTEL FLOW:
1. search_destinations → search_hotels
2. search_hotels → get_rooms_and_rates
3. get_rooms_and_rates → revalidate
4. revalidate → get_payment_url

FLIGHT FLOW:
1. flight_session → flight_locations
2. flight_locations → flight_search
3. flight_search → flight_revalidate
4. flight_revalidate → flight_get_payment_url

CAR FLOW:
car_locations → car_search → car_revalidate → car_get_payment_url

Be concise and helpful.`;

// ---------------------------------------------------------------------------

const MAX_TOOL_ITERATIONS = 10;

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  response: string;
  messages: Message[];
}

export type OnToolCall = (name: string, args: Record<string, unknown>) => void;

// ---------------------------------------------------------------------------
// ENTRY POINT
// ---------------------------------------------------------------------------

export async function chat(
  messages: Message[],
  tools: McpTool[],
  context: ToolExecutionContext,
  onToolCall?: OnToolCall,
): Promise<ChatResult> {
  if (config.llm.provider === "anthropic") {
    return chatAnthropic(messages, tools, context, onToolCall);
  }

  if (config.llm.provider === "mistral") {
    return chatMistral(messages, tools, context, onToolCall);
  }

  return chatOpenAI(messages, tools, context, onToolCall);
}

// ---------------------------------------------------------------------------
// TOOL MAPPER
// ---------------------------------------------------------------------------

function mcpToolsToOpenAI(tools: McpTool[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

// ---------------------------------------------------------------------------
// SHARED ENGINE (OpenAI-compatible: OpenAI + Mistral)
// ---------------------------------------------------------------------------

async function chatOpenAICompatible(
  client: OpenAI,
  model: string,
  messages: Message[],
  tools: McpTool[],
  context: ToolExecutionContext,
  onToolCall?: OnToolCall,
): Promise<ChatResult> {
  const contextPrompt = buildContextPrompt(context);
  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: contextPrompt },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const openaiTools = mcpToolsToOpenAI(tools);

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      tools: openaiTools,
    });

    const choice = response.choices[0];
    if (!choice) throw new Error("No response");

    const assistantMessage = choice.message;
    openaiMessages.push(assistantMessage);

    if (!assistantMessage.tool_calls?.length) {
      const text = assistantMessage.content ?? "";
      return {
        response: text,
        messages: [...messages, { role: "assistant", content: text }],
      };
    }

    for (const toolCall of assistantMessage.tool_calls) {
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

      let json = extractJson(result);

      const updatedJson = handleToolResult(json, tool.name);

      updateExecutionContext(tool.name, finalArgs, updatedJson, context);

      const messageContent = result.isError
        ? `Error: ${JSON.stringify(result.content)}`
        : JSON.stringify(updatedJson);

      openaiMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: messageContent,
      });
    }
  }

  return { response: "Max iterations reached", messages };
}

// ---------------------------------------------------------------------------
// OPENAI
// ---------------------------------------------------------------------------

async function chatOpenAI(
  messages: Message[],
  tools: McpTool[],
  context: ToolExecutionContext,
  onToolCall?: OnToolCall,
) {
  const client = new OpenAI({
    apiKey: config.llm.openai.apiKey,
  });

  return chatOpenAICompatible(
    client,
    config.llm.openai.model,
    messages,
    tools,
    context,
    onToolCall,
  );
}

// ---------------------------------------------------------------------------
// MISTRAL (OpenAI-compatible)
// ---------------------------------------------------------------------------

async function chatMistral(
  messages: Message[],
  tools: McpTool[],
  context: ToolExecutionContext,
  onToolCall?: OnToolCall,
) {
  const client = new OpenAI({
    apiKey: config.llm.mistral.apiKey,
    baseURL: config.llm.mistral.baseUrl, // e.g. https://api.mistral.ai/v1
  });

  return chatOpenAICompatible(
    client,
    config.llm.mistral.model,
    messages,
    tools,
    context,
    onToolCall,
  );
}

// ---------------------------------------------------------------------------
// ANTHROPIC
// ---------------------------------------------------------------------------

async function chatAnthropic(
  messages: Message[],
  tools: McpTool[],
  context: ToolExecutionContext,
  onToolCall?: OnToolCall,
): Promise<ChatResult> {
  const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });
  const contextPrompt = buildContextPrompt(context);

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: config.llm.anthropic.model,
      max_tokens: 4096,
      system: `${SYSTEM_PROMPT}\n\n${contextPrompt}`,
      messages: anthropicMessages,
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
      const text = response.content.map((b: any) => b.text || "").join("\n");
      return { response: text, messages };
    }

    anthropicMessages.push({ role: "assistant", content: response.content });

    const toolResults: any[] = [];

    for (const block of toolUses) {
      const tool = tools.find((t) => t.name === block.name);
      if (!tool) continue;

      const finalArgs = buildToolArgs(
        block.name,
        (block.input ?? {}) as Record<string, unknown>,
        tool,
        context,
      );
      validateArgs(tool, finalArgs);

      const result = await callTool(block.name, finalArgs);

      const json = extractJson(result);
      updateExecutionContext(block.name, finalArgs, json, context);

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: extractText(result, tool.name),
      });
    }

    anthropicMessages.push({ role: "user", content: toolResults });
  }

  return { response: "Max iterations reached", messages };
}

// ---------------------------------------------------------------------------
// ARG BUILDER (CRITICAL)
// ---------------------------------------------------------------------------

function buildToolArgs(
  name: string,
  args: Record<string, unknown>,
  tool: McpTool,
  context: ToolExecutionContext,
): Record<string, unknown> {
  const enriched = { ...args };
  const schema = isRecord(tool.inputSchema?.properties)
    ? tool.inputSchema.properties
    : {};
  const hotel = context.hotel;

  if ("token" in schema && hotel.token && !hasValue(enriched.token)) {
    enriched.token = hotel.token;
  }
  if (
    "correlationId" in schema &&
    hotel.correlationId &&
    !hasValue(enriched.correlationId)
  ) {
    enriched.correlationId = hotel.correlationId;
  }

  if (
    "hotelId" in schema &&
    hotel.selectedHotel?.hotelId &&
    !hasValue(enriched.hotelId)
  ) {
    enriched.hotelId = hotel.selectedHotel.hotelId;
  }

  if (
    "hotelName" in schema &&
    hotel.selectedHotel?.hotelName &&
    !hasValue(enriched.hotelName)
  ) {
    enriched.hotelName = hotel.selectedHotel.hotelName;
  }

  if (
    "recommendationId" in schema &&
    hotel.selectedRoom?.recommendationId &&
    !hasValue(enriched.recommendationId)
  ) {
    enriched.recommendationId = hotel.selectedRoom.recommendationId;
  }

  if (
    "roomId" in schema &&
    hotel.selectedRoom?.roomId &&
    !hasValue(enriched.roomId)
  ) {
    enriched.roomId = hotel.selectedRoom.roomId;
  }

  if (
    "publishedRate" in schema &&
    hotel.selectedRoom?.publishedRate !== undefined &&
    !hasValue(enriched.publishedRate)
  ) {
    enriched.publishedRate = hotel.selectedRoom.publishedRate;
  }

  const flight = context.flight;
  if (
    "sessionId" in schema &&
    flight.sessionId !== undefined &&
    !hasValue(enriched.sessionId)
  ) {
    enriched.sessionId = flight.sessionId;
  }

  return enriched;
}

// ---------------------------------------------------------------------------
// CONTEXT UPDATE
// ---------------------------------------------------------------------------

function updateExecutionContext(
  toolName: string,
  args: any,
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
          recommendationId: roomFromContext.recommendationId,
          publishedRate: selectedRate?.publishedRate,
        };
      }
    }
  }

  if(toolName === "flight_session") {
    context.flight.sessionId = result?.sessionId ? result.sessionId : "";
  }
  
  if(toolName === "flight_search") {
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

// ---------------------------------------------------------------------------
// VALIDATION
// ---------------------------------------------------------------------------

function validateArgs(tool: McpTool, args: Record<string, unknown>) {
  const required = Array.isArray(tool.inputSchema.required)
    ? tool.inputSchema.required.filter(
        (field): field is string => typeof field === "string",
      )
    : [];

  for (const field of required) {
    if (!args[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function extractJson(result: McpToolResult): any {
  for (const item of result.content) {
    if (typeof item.text === "string") {
      try {
        return JSON.parse(item.text);
      } catch {}
    }
  }
  return null;
}

function extractText(result: McpToolResult, toolName: string): string {
  if (result.isError) {
    return `Error: ${JSON.stringify(result.content)}`;
  }

  if (toolName === "search_hotels") {
    let json = extractJson(result);

    if (json) {
      json =
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

      return JSON.stringify(json);
    }
  }

  if (toolName === "get_rooms_and_rates") {
    let json = extractJson(result);

    if (json) {
      json =
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

      return JSON.stringify(json);
    }
  }
  return result.content.map((c) => c.text || JSON.stringify(c)).join("\n");
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
          const flightName = (item?.flights || []).map((f: any) => `Departure: ${f.departure} (departureTime: ${f.departureTime}) -> Arrival: ${f.arrival} (arrivalTime: ${f.arrivalTime})`).join(", ") ?? "Unknown flight";
          return `${index + 1}. ${flightName} (airline: ${airline}, fareSourceCode: ${fareSourceCode}, stops: ${item?.stops})`;
        })
        .join("\n")
    : "";
  const selectedFlight = flight.selectedFlight ?? {};
  const carSummaries = Array.isArray(context.car.cars)
    ? context.car.cars.slice(0, 5).map((item: any, index: number) => {
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
    context.car.selectedCar ? `- Selected car: ${context.car.selectedCar.fareCode}` : "- No car selected yet",
    

    "If the user's request can be answered by continuing from this context, do not restart the search flow.",
    "Only call an earlier search tool when the user changed destination/dates/occupancy or required context is genuinely missing.",
  ].join("\n");
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
