import type { ExtensionSettings } from "./config.js";
import { getSettings } from "./config.js";
import { callTool } from "./mcp-client.js";
import type {
  McpTool,
  McpToolResult,
  Message,
  PageContext,
  ResultSection,
  ToolCallTrace,
} from "./types.js";

const SYSTEM_PROMPT = `You are a travel assistant.

STRICT RULES:
- NEVER invent IDs (hotelId, token, correlationId, recommendationId, roomId, fareSourceCode).
- ALWAYS reuse values from previous tool responses
- If required data is missing, call the appropriate previous tool
- Follow correct sequence

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

Be concise and accurate.`;

const MAX_TOOL_ITERATIONS = 8;

export interface ToolExecutionContext {
  hotel: {
    token?: string;
    correlationId?: string;
    hotels?: any[];
    rooms?: any[];
    selectedHotel?: {
      hotelId?: string;
      hotelName?: string;
    };
    selectedRoom?: {
      roomId?: string;
      recommendationId?: string;
      publishedRate?: number;
    };
  };
  flight: {
    sessionId?: string;
    correlationId?: string;
    flights?: any[];
    searchFilterObj?: Record<string, unknown>;
    selectedFlight?: {
      fareSourceCode?: string;
      flights?: any[];
      ourprice?: number;
    };
  };
  generic: {
    lastToolName?: string;
    lastToolJson?: unknown;
    recentSummaries: string[];
  };
}

export interface ChatExecutionResult {
  response: string;
  messages: Message[];
  toolCalls: ToolCallTrace[];
  resultSections: ResultSection[];
}

export async function runTravelAgent(
  messages: Message[],
  tools: McpTool[],
  pageContext: PageContext | null,
  context: ToolExecutionContext,
): Promise<ChatExecutionResult> {
  const settings = await getSettings();
  if (settings.llm.provider === "anthropic") {
    return runAnthropic(messages, tools, pageContext, context, settings);
  }

  return runOpenAiCompatible(messages, tools, pageContext, context, settings);
}

async function runOpenAiCompatible(
  messages: Message[],
  tools: McpTool[],
  pageContext: PageContext | null,
  context: ToolExecutionContext,
  settings: ExtensionSettings,
): Promise<ChatExecutionResult> {
  const endpoint =
    settings.llm.provider === "mistral"
      ? `${settings.llm.mistral.baseUrl.replace(/\/$/, "")}/chat/completions`
      : "https://api.openai.com/v1/chat/completions";
  const model =
    settings.llm.provider === "mistral"
      ? settings.llm.mistral.model
      : settings.llm.openai.model;
  const apiKey =
    settings.llm.provider === "mistral"
      ? settings.llm.mistral.apiKey
      : settings.llm.openai.apiKey;

  const toolCalls: ToolCallTrace[] = [];
  const resultSections: ResultSection[] = [];
  const conversation: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: buildContextPrompt(pageContext, context) },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: conversation,
        tools: tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        })),
      }),
    });

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          role?: string;
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: {
              name: string;
              arguments: string;
            };
          }>;
        };
      }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Unable to reach the selected LLM provider.");
    }

    const assistantMessage = payload.choices?.[0]?.message;
    if (!assistantMessage) throw new Error("The LLM returned an empty response.");

    conversation.push(assistantMessage);

    if (!assistantMessage.tool_calls?.length) {
      const text = assistantMessage.content ?? "I could not generate a response.";
      return {
        response: postProcessAssistantResponse(text, resultSections),
        messages: [...messages, { role: "assistant", content: text }],
        toolCalls,
        resultSections: dedupeSections(resultSections),
      };
    }

    for (const toolCall of assistantMessage.tool_calls) {
      const tool = tools.find((entry) => entry.name === toolCall.function.name);
      if (!tool) continue;

      const parsedArgs = safeParseJson(toolCall.function.arguments);
      const finalArgs = buildToolArgs(tool.name, parsedArgs, tool, context);

      console.log("buildToolArgs:::", tool.name, parsedArgs, finalArgs)
      validateArgs(tool, finalArgs);

      const toolResult = await callTool(tool.name, finalArgs);
      const json = extractJson(toolResult);
      const reduced = reduceToolResult(tool.name, json);
      updateExecutionContext(tool.name, finalArgs, reduced, context);

      toolCalls.push({
        name: tool.name,
        args: finalArgs,
        summary: summarizeToolResult(tool.name, reduced, toolResult),
      });

      const section = resultSectionFromTool(tool.name, reduced);
      if (section) resultSections.push(section);

      conversation.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(reduced ?? toolResult.content),
      });
    }
  }

  return {
    response: "I reached the tool-call limit before the booking flow completed.",
    messages,
    toolCalls,
    resultSections: dedupeSections(resultSections),
  };
}

async function runAnthropic(
  messages: Message[],
  tools: McpTool[],
  pageContext: PageContext | null,
  context: ToolExecutionContext,
  settings: ExtensionSettings,
): Promise<ChatExecutionResult> {
  const toolCalls: ToolCallTrace[] = [];
  const resultSections: ResultSection[] = [];
  const conversation: any[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": settings.llm.anthropic.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: settings.llm.anthropic.model,
        max_tokens: 2048,
        system: `${SYSTEM_PROMPT}\n\n${buildContextPrompt(pageContext, context)}`,
        messages: conversation,
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        })),
      }),
    });

    const payload = (await response.json()) as {
      content?: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      >;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Unable to reach Anthropic.");
    }

    const blocks = payload.content ?? [];
    const toolUses = blocks.filter(
      (block): block is Extract<(typeof blocks)[number], { type: "tool_use" }> =>
        block.type === "tool_use",
    );

    if (!toolUses.length) {
      const text = blocks
        .filter(
          (block): block is Extract<(typeof blocks)[number], { type: "text" }> =>
            block.type === "text",
        )
        .map((block) => block.text)
        .join("\n")
        .trim();

      return {
        response: postProcessAssistantResponse(text || "I could not generate a response.", resultSections),
        messages: [...messages, { role: "assistant", content: text || "I could not generate a response." }],
        toolCalls,
        resultSections: dedupeSections(resultSections),
      };
    }

    conversation.push({ role: "assistant", content: blocks });

    const toolResults: any[] = [];
    for (const toolUse of toolUses) {
      const tool = tools.find((entry) => entry.name === toolUse.name);
      if (!tool) continue;

      const finalArgs = buildToolArgs(tool.name, toolUse.input ?? {}, tool, context);
      validateArgs(tool, finalArgs);

      const toolResult = await callTool(tool.name, finalArgs);
      const json = extractJson(toolResult);
      const reduced = reduceToolResult(tool.name, json);
      updateExecutionContext(tool.name, finalArgs, reduced, context);

      toolCalls.push({
        name: tool.name,
        args: finalArgs,
        summary: summarizeToolResult(tool.name, reduced, toolResult),
      });

      const section = resultSectionFromTool(tool.name, reduced);
      if (section) resultSections.push(section);

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(reduced ?? toolResult.content),
      });
    }

    conversation.push({ role: "user", content: toolResults });
  }

  return {
    response: "I reached the tool-call limit before the booking flow completed.",
    messages,
    toolCalls,
    resultSections: dedupeSections(resultSections),
  };
}

function buildContextPrompt(pageContext: PageContext | null, context: ToolExecutionContext) {
  const hotelSummary = (context.hotel.hotels ?? [])
    .slice(0, 5)
    .map((hotel, index) => `${index + 1}. ${hotel.name} (${hotel.id})`)
    .join("\n");
  const roomSummary = (context.hotel.rooms ?? [])
    .slice(0, 5)
    .map(
      (room, index) =>
        `${index + 1}. ${room.name} (${room.id}, recommendationId=${room.recommendationId ?? "unknown"})`,
    )
    .join("\n");
  const flightSummary = (context.flight.flights ?? [])
    .slice(0, 5)
    .map((flight, index) => {
      const firstSegment = flight?.flights?.[0];
      const lastSegment = flight?.flights?.[flight?.flights?.length - 1];
      return `${index + 1}. ${firstSegment?.departure ?? "Origin"} to ${lastSegment?.arrival ?? "Destination"} (fareSourceCode=${flight?.fareSourceCode ?? "unknown"})`;
    })
    .join("\n");

  return [
    "Current page context:",
    pageContext
      ? `- Title: ${pageContext.title}\n- URL: ${pageContext.url}\n- Travel hints: ${pageContext.travelHints.join("; ") || "none"}\n- Excerpt: ${pageContext.textExcerpt || "none"}`
      : "- No page context available",
    "Current RouteStack context:",
    context.hotel.token ? `- Hotel token: ${context.hotel.token}` : "- No active hotel token",
    context.hotel.correlationId
      ? `- Hotel correlationId: ${context.hotel.correlationId}`
      : "- No active hotel correlationId",
    context.hotel.selectedHotel?.hotelId
      ? `- Selected hotel: ${context.hotel.selectedHotel.hotelName ?? "Unknown"} (${context.hotel.selectedHotel.hotelId})`
      : "- No hotel selected",
    context.hotel.selectedRoom?.roomId
      ? `- Selected room: ${context.hotel.selectedRoom.roomId}`
      : "- No room selected",
    hotelSummary ? `- Cached hotels:\n${hotelSummary}` : "- No cached hotels",
    roomSummary ? `- Cached rooms:\n${roomSummary}` : "- No cached rooms",
    context.flight.sessionId ? `- Flight session: ${context.flight.sessionId}` : "- No active flight session",
    context.flight.correlationId
      ? `- Flight correlationId: ${context.flight.correlationId}`
      : "- No active flight correlationId",
    context.flight.selectedFlight?.fareSourceCode
      ? `- Selected flight: ${context.flight.selectedFlight.fareSourceCode}`
      : "- No flight selected",
    flightSummary ? `- Cached flights:\n${flightSummary}` : "- No cached flights",
  ].join("\n");
}

function buildToolArgs(
  name: string,
  args: Record<string, unknown>,
  tool: McpTool,
  context: ToolExecutionContext,
): Record<string, unknown> {
  const enriched = { ...args };
  const properties =
    typeof tool.inputSchema?.properties === "object" && tool.inputSchema.properties
      ? (tool.inputSchema.properties as Record<string, unknown>)
      : {};

  if ("token" in properties && context.hotel.token && !hasValue(enriched.token)) {
    enriched.token = context.hotel.token;
  }
  if ("correlationId" in properties && context.hotel.correlationId && !hasValue(enriched.correlationId)) {
    enriched.correlationId = context.hotel.correlationId;
  }
  if ("hotelId" in properties && context.hotel.selectedHotel?.hotelId && !hasValue(enriched.hotelId)) {
    enriched.hotelId = context.hotel.selectedHotel.hotelId;
  }
  if ("roomId" in properties && context.hotel.selectedRoom?.roomId && !hasValue(enriched.roomId)) {
    enriched.roomId = context.hotel.selectedRoom.roomId;
  }
  if (
    "recommendationId" in properties &&
    context.hotel.selectedRoom?.recommendationId &&
    !hasValue(enriched.recommendationId)
  ) {
    enriched.recommendationId = context.hotel.selectedRoom.recommendationId;
  }
  if (
    "publishedRate" in properties &&
    context.hotel.selectedRoom?.publishedRate !== undefined &&
    !hasValue(enriched.publishedRate)
  ) {
    enriched.publishedRate = context.hotel.selectedRoom.publishedRate;
  }
  if ("sessionId" in properties && context.flight.sessionId && !hasValue(enriched.sessionId)) {
    enriched.sessionId = context.flight.sessionId;
  }
  if (
    name === "flight_revalidate" &&
    context.flight.selectedFlight?.fareSourceCode &&
    !hasValue(enriched.fareSourceCode)
  ) {
    enriched.fareSourceCode = context.flight.selectedFlight.fareSourceCode;
  }

  if (name === "flight_search") {
    const hasFilter =
      enriched.filter &&
      typeof enriched.filter === "object" &&
      !Array.isArray(enriched.filter);

    if (!hasFilter) {
      const filter: Record<string, unknown> = {};

      const fields = [
        "origin",
        "destination",
        "departureDate",
        "returnDate",
        "adults",
        "children",
        "infants",
        "cabinClass",
        "tripType",
        "originLocation",
        "destinationLocation",
      ];

      for (const field of fields) {
        if (hasValue(enriched[field])) {
          filter[field] = enriched[field];
          delete enriched[field];
        }
      }

      if (Object.keys(filter).length > 0) {
        enriched.filter = filter;
      }
    }
  }

  return enriched;
}

function validateArgs(tool: McpTool, args: Record<string, unknown>) {
  const required = Array.isArray(tool.inputSchema.required)
    ? tool.inputSchema.required.filter((value): value is string => typeof value === "string")
    : [];

  for (const field of required) {
    if (!hasValue(args[field])) {
      throw new Error(`Missing required field "${field}" for ${tool.name}.`);
    }
  }
}

function extractJson(result: McpToolResult): any {
  for (const item of result.content) {
    const parsed = extractJsonLike(item);
    if (parsed) return parsed;
  }
  return extractJsonLike(result.content);
}

function reduceToolResult(toolName: string, json: any): any {
  if (!json) return json;

  if (toolName === "search_hotels") {
    return {
      token: json?.result?.token,
      correlationId: json?.result?.correlationId,
      hotels: (json?.result?.result ?? []).slice(0, 6).map((hotel: any) => ({
        id: hotel.id,
        name: hotel.name,
        address: hotel.address,
        providerName: hotel.providerName,
        starRating: hotel.starRating,
        ourprice: hotel.ourprice,
        publishedRate: hotel.publishedRate,
        saving: hotel.saving,
        distance: hotel.distance,
        heroImage: hotel.heroImage,
      })),
    };
  }

  if (toolName === "get_rooms_and_rates") {
    const root = json?.result ?? json;
    const groups =
      firstArray(
        root?.groups,
        root?.result?.groups,
        root?.roomGroups,
        root?.data?.groups,
      ) ?? [];
    const flatRooms = groups.flatMap((group: any) => group?.rooms ?? group?.roomOptions ?? []);

    return {
      hotelId: root?.id ?? root?.hotelId,
      token: root?.token,
      correlationId: root?.correlationId,
      rooms: flatRooms
        .slice(0, 6)
        .map((room: any) => ({
          id: room.id ?? room.roomId,
          name: room.name ?? room.roomName ?? room.roomType,
          description: room.description ?? room.rateDescription ?? room.bedType,
          recommendationId: room.recommendationId ?? room.recommendationToken,
          rateid: room.rateid ?? room.rateId,
          ourprice: room.ourprice ?? room.price?.ourprice ?? room.amount ?? room.totalPrice,
          publishedRate: room.publishedRate ?? room.price?.publishedRate ?? room.strikePrice,
          refundable: room.refundable ?? room.cancellationPolicy?.refundable,
        })),
    };
  }

  if (toolName === "get_hotel_details") {
    return {
      id: json?.result?.id,
      name: json?.result?.name,
      heroImage: json?.result?.heroImage,
      starRating: json?.result?.starRating,
      address: json?.result?.contact?.address,
      facilities: (json?.result?.facilities ?? []).slice(0, 6).map((facility: any) => facility.name),
      nearByAttractions: (json?.result?.nearByAttractions ?? []).slice(0, 4),
    };
  }

  if (toolName === "flight_search") {
    return {
      correlationId: json?.correlationId,
      searchFilterObj: json?.searchFilterObj,
      flights: (json?.result ?? []).slice(0, 6),
    };
  }

  return json;
}

function updateExecutionContext(
  toolName: string,
  args: Record<string, unknown>,
  result: any,
  context: ToolExecutionContext,
) {
  context.generic.lastToolName = toolName;
  context.generic.lastToolJson = result;
  context.generic.recentSummaries.push(`${toolName} completed`);
  context.generic.recentSummaries = context.generic.recentSummaries.slice(-10);

  if (toolName === "search_hotels" && result) {
    context.hotel.token = result.token;
    context.hotel.correlationId = result.correlationId;
    context.hotel.hotels = result.hotels;
  }

  if (toolName === "get_hotel_details" && result?.id) {
    context.hotel.selectedHotel = {
      hotelId: result.id,
      hotelName: result.name,
    };
  }

  if (toolName === "get_rooms_and_rates" && result) {
    context.hotel.rooms = result.rooms ?? [];
    if (result.hotelId) {
      const selectedHotel = (context.hotel.hotels ?? []).find((hotel) => hotel.id === result.hotelId);
      if (selectedHotel) {
        context.hotel.selectedHotel = {
          hotelId: selectedHotel.id,
          hotelName: selectedHotel.name,
        };
      }
    }
  }

  if (toolName === "revalidate" && result?.result?.room?.[0]) {
    const room = result.result.room[0];
    const rate = result.result.rate?.[0];
    const cachedRoom = (context.hotel.rooms ?? []).find((entry) => entry.id === room.id);
    context.hotel.selectedRoom = {
      roomId: room.id,
      recommendationId: cachedRoom?.recommendationId,
      publishedRate: rate?.publishedRate,
    };
  }

  if (toolName === "flight_session" && result?.sessionId) {
    context.flight.sessionId = result.sessionId;
  }

  if (toolName === "flight_search" && result) {
    context.flight.correlationId = result.correlationId;
    context.flight.searchFilterObj = result.searchFilterObj;
    context.flight.flights = result.flights ?? [];
    const firstFlight = result.flights?.[0];
    if (firstFlight?.fareSourceCode) {
      context.flight.selectedFlight = {
        fareSourceCode: firstFlight.fareSourceCode,
        flights: firstFlight.flights,
        ourprice: firstFlight.ourprice,
      };
    }
  }

  if (
    (toolName === "flight_revalidate" || toolName === "flight_get_payment_url") &&
    hasValue(args.fareSourceCode)
  ) {
    context.flight.selectedFlight = {
      ...(context.flight.selectedFlight ?? {}),
      fareSourceCode: String(args.fareSourceCode),
    };
  }
}

function summarizeToolResult(toolName: string, result: any, toolResult: McpToolResult) {
  if (toolResult.isError) return `${toolName} returned an error`;
  if (toolName === "search_hotels") return `${toolName} found ${(result?.hotels ?? []).length} hotels`;
  if (toolName === "get_rooms_and_rates") {
    return `${toolName} returned ${(result?.rooms ?? []).length} room options`;
  }
  if (toolName === "flight_search") return `${toolName} found ${(result?.flights ?? []).length} flights`;
  return `${toolName} completed`;
}

function resultSectionFromTool(toolName: string, json: any): ResultSection | null {
  if (!json) return null;

  if (toolName === "search_hotels" && Array.isArray(json.hotels)) {
    return {
      title: "Hotels",
      kind: "hotel",
      items: json.hotels.map((hotel: any) => ({
        title: hotel.name ?? "Hotel",
        subtitle: hotel.providerName,
        price: formatCurrency(hotel.ourprice),
        meta: [
          hotel.starRating ? `${hotel.starRating} stars` : "",
          hotel.distance ? `${hotel.distance} km away` : "",
          hotel.saving ? `Save ${formatCurrency(hotel.saving)}` : "",
        ].filter(Boolean),
        description: typeof hotel.address === "string" ? hotel.address : "",
        imageUrl: hotel.heroImage,
        accent: "hotel",
      })),
    };
  }

  if (toolName === "get_rooms_and_rates" && Array.isArray(json.rooms)) {
    return {
      title: "Rooms",
      kind: "booking",
      items: json.rooms.map((room: any) => ({
        title: room.name ?? "Room",
        price: formatCurrency(room.ourprice),
        meta: [
          room.refundable === true ? "Refundable" : room.refundable === false ? "Non-refundable" : "",
          room.recommendationId ? `Rec ${room.recommendationId}` : "",
        ].filter(Boolean),
        description: room.description,
        accent: "booking",
      })),
    };
  }

  if (toolName === "flight_search" && Array.isArray(json.flights)) {
    return {
      title: "Flights",
      kind: "flight",
      items: json.flights.map((flight: any) => {
        const firstSegment = flight?.flights?.[0];
        const lastSegment = flight?.flights?.[flight?.flights?.length - 1];

        return {
          title: `${firstSegment?.departure ?? "Origin"} to ${lastSegment?.arrival ?? "Destination"}`,
          subtitle: firstSegment?.airline ?? "Flight option",
          price: formatCurrency(flight?.ourprice),
          meta: [
            flight?.stops !== undefined ? `${flight.stops} stops` : "",
            flight?.fareSourceCode ? `Fare ${flight.fareSourceCode}` : "",
            firstSegment?.departureTime && lastSegment?.arrivalTime
              ? `${firstSegment.departureTime} - ${lastSegment.arrivalTime}`
              : "",
          ].filter(Boolean),
          description: Array.isArray(flight?.flights)
            ? flight.flights.map((segment: any) => `${segment.departure} -> ${segment.arrival}`).join(" | ")
            : "",
          accent: "flight",
        };
      }),
    };
  }

  if (toolName.includes("payment_url") || toolName.includes("booking_url")) {
    const bookingUrl = findUrl(json);
    if (!bookingUrl) return null;

    return {
      title: "Booking",
      kind: "booking",
      items: [
        {
          title: "Continue to booking",
          subtitle: "Validated RouteStack checkout link",
          ctaLabel: "Open booking",
          ctaUrl: bookingUrl,
          accent: "booking",
        },
      ],
    };
  }

  if (toolName.includes("car") || toolName.includes("vehicle")) {
    const items = collectObjects(json)
      .filter((entry) => hasCarShape(entry))
      .slice(0, 6)
      .map((entry) => ({
        title: String(entry.name ?? entry.vehicleName ?? entry.category ?? "Rental car"),
        subtitle: String(entry.vendor ?? entry.providerName ?? entry.supplier ?? ""),
        price: formatCurrency(entry.ourprice ?? entry.price ?? entry.totalPrice),
        meta: [
          entry.transmission ? String(entry.transmission) : "",
          entry.seats ? `${entry.seats} seats` : "",
          entry.fuelPolicy ? String(entry.fuelPolicy) : "",
        ].filter(Boolean),
        description: String(entry.description ?? ""),
        imageUrl:
          typeof entry.image === "string"
            ? entry.image
            : typeof entry.imageUrl === "string"
              ? entry.imageUrl
              : undefined,
        accent: "car" as const,
      }));

    if (items.length) {
      return {
        title: "Cars",
        kind: "car",
        items,
      };
    }
  }

  return null;
}

function collectObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectObjects(entry));
  }
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap((entry) => collectObjects(entry))];
}

function hasCarShape(value: Record<string, unknown>) {
  return "vehicleName" in value || "category" in value || "transmission" in value || "seats" in value;
}

function findUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = findUrl(entry);
      if (nested) return nested;
    }
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      const nested = findUrl(entry);
      if (nested) return nested;
    }
  }
  return undefined;
}

function dedupeSections(sections: ResultSection[]) {
  const seen = new Set<string>();
  return sections.filter((section) => {
    const fingerprint = JSON.stringify(section);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

function postProcessAssistantResponse(response: string, sections: ResultSection[]) {
  if (!sections.length) return response;

  const resultTitles = new Set(
    sections.flatMap((section) => section.items.map((item) => item.title.toLowerCase())).filter(Boolean),
  );
  const lines = response
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const filteredLines = lines.filter((line) => {
    const normalized = line
      .replace(/^[-*•]\s+/, "")
      .replace(/^\d+\.\s+/, "")
      .toLowerCase();
    const looksLikeList = /^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line);
    if (!looksLikeList) return true;
    return !Array.from(resultTitles).some((title) => normalized.includes(title));
  });

  const collapsed = filteredLines.join("\n").trim();
  return collapsed || response;
}

function extractJsonLike(value: unknown): any {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = extractJsonLike(entry);
      if (parsed) return parsed;
    }
    return null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") {
      const parsed = extractJsonLike(record.text);
      if (parsed) return parsed;
    }
    if ("json" in record && record.json) return record.json;
    if ("data" in record && record.data) {
      const parsed = extractJsonLike(record.data);
      if (parsed) return parsed;
    }
  }

  return null;
}

function firstArray(...candidates: unknown[]) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return undefined;
}

function safeParseJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return {};
  }

  return {};
}

function formatCurrency(value: unknown): string | undefined {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numeric)) return undefined;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}
