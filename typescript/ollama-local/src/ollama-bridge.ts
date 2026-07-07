import { config } from "./config.js";
import { callTool, type McpTool } from "./mcp-client.js";
import {
  formatToolResultForModel,
  normalizeToolArgs,
  sanitizeToolSchema,
  summarizeTools,
  validateToolArgs,
} from "./tool-parser.js";

const SYSTEM_PROMPT = `You are a travel assistant connected to RouteStack MCP tools.

STRICT RULES:
- Never invent IDs such as hotelId, token, correlationId, recommendationId, roomId, fareSourceCode, or sessionId.
- Reuse exact values returned by previous tool results.
- If required data is missing, call an earlier discovery tool or ask one short clarifying question.
- Keep responses brief.

HOTEL FLOW:
1. hotel_search_destinations -> hotel_search
2. hotel_search -> hotel_get_rooms_and_rates
3. hotel_get_rooms_and_rates -> hotel_revalidate_rate
4. hotel_revalidate_rate -> hotel_get_checkout_url

FLIGHT FLOW:
1. flight_session -> flight_locations
2. flight_locations -> flight_search
3. flight_search -> flight_revalidate
4. flight_revalidate -> flight_get_checkout_url`;

type OllamaRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: OllamaRole;
  content: string;
  tool_name?: string;
  tool_calls?: OllamaToolCall[];
}

export interface ChatTurnResult {
  response: string;
  messages: ChatMessage[];
}

export interface ToolExecutionContext {
  hotel: {
    token?: string;
    correlationId?: string;
    hotels?: Array<Record<string, unknown>>;
    rooms?: Array<Record<string, unknown>>;
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
    searchFilterObj?: Record<string, unknown>;
    flights?: Array<Record<string, unknown>>;
    selectedFlight?: {
      fareSourceCode?: string;
    };
  };
}

export type OnToolCall = (name: string, args: Record<string, unknown>) => void;

interface OllamaToolCall {
  type?: "function";
  function: {
    name: string;
    arguments?: Record<string, unknown> | string;
  };
}

interface OllamaChatResponse {
  message?: {
    role?: OllamaRole;
    content?: string;
    tool_calls?: OllamaToolCall[];
  };
}

interface OllamaToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export async function chatTurn(
  history: ChatMessage[],
  userInput: string,
  tools: McpTool[],
  context: ToolExecutionContext,
  onToolCall?: OnToolCall,
): Promise<ChatTurnResult> {
  const conversation: ChatMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n${buildContextPrompt(context)}\n\nAvailable tools:\n${summarizeTools(tools)}`,
    },
    ...compactHistory(history),
    { role: "user", content: userInput },
  ];

  const ollamaTools = tools.map<OllamaToolDefinition>((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: sanitizeToolSchema(tool.inputSchema),
    },
  }));

  for (let iteration = 0; iteration < config.ollama.maxToolIterations; iteration += 1) {
    const response = await requestOllama(conversation, ollamaTools);
    const assistantMessage = normalizeAssistantMessage(response.message);
    conversation.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        response: assistantMessage.content.trim() || "No response generated.",
        messages: conversation.filter((message) => message.role !== "system"),
      };
    }

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const tool = tools.find((item) => item.name === toolName);

      if (!tool) {
        conversation.push({
          role: "tool",
          tool_name: toolName,
          content: `Error: Tool "${toolName}" is not available.`,
        });
        continue;
      }

      const args = buildToolArgs(
        normalizeToolArgs(toolCall.function.arguments, tool.inputSchema),
        tool,
        context,
      );

      try {
        validateToolArgs(tool, args);
      } catch (error) {
        conversation.push({
          role: "tool",
          tool_name: toolName,
          content: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      onToolCall?.(toolName, args);
      const result = await callTool(toolName, args);
      const formattedResult = formatToolResultForModel(result);

      updateExecutionContext(toolName, formattedResult, context);
      conversation.push({
        role: "tool",
        tool_name: toolName,
        content: formattedResult,
      });
    }
  }

  return {
    response:
      "I hit the tool iteration limit before finishing. Please refine the request or try again.",
    messages: conversation.filter((message) => message.role !== "system"),
  };
}

async function requestOllama(
  messages: ChatMessage[],
  tools: OllamaToolDefinition[],
): Promise<OllamaChatResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ollama.requestTimeoutMs);

  try {
    const response = await fetch(new URL("/api/chat", config.ollama.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: config.ollama.model,
        stream: false,
        keep_alive: config.ollama.keepAlive,
        messages,
        tools,
        options: {
          temperature: 0.1,
        },
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Ollama request failed (${response.status}): ${text}`);
    }

    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`Ollama response was not valid JSON: ${text}`);
    }

    if (!isRecord(json)) {
      throw new Error("Ollama response did not include an object payload.");
    }

    return json as OllamaChatResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Ollama request timed out after ${config.ollama.requestTimeoutMs}ms.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAssistantMessage(message: OllamaChatResponse["message"]): ChatMessage {
  const toolCalls = Array.isArray(message?.tool_calls)
    ? message.tool_calls.filter(
        (call): call is OllamaToolCall =>
          isRecord(call) &&
          isRecord(call.function) &&
          typeof call.function.name === "string",
      )
    : [];

  return {
    role: "assistant",
    content: typeof message?.content === "string" ? message.content : "",
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  };
}

function compactHistory(history: ChatMessage[]): ChatMessage[] {
  const trimmed = history.filter((message) => message.role !== "system");
  return trimmed.length <= config.ollama.maxHistoryMessages
    ? trimmed
    : trimmed.slice(-config.ollama.maxHistoryMessages);
}

function buildToolArgs(
  args: Record<string, unknown>,
  tool: McpTool,
  context: ToolExecutionContext,
): Record<string, unknown> {
  const enriched = { ...args };
  const properties = isRecord(tool.inputSchema.properties)
    ? tool.inputSchema.properties
    : {};

  if ("token" in properties && context.hotel.token && !hasValue(enriched.token)) {
    enriched.token = context.hotel.token;
  }
  if (
    "correlationId" in properties &&
    context.hotel.correlationId &&
    !hasValue(enriched.correlationId)
  ) {
    enriched.correlationId = context.hotel.correlationId;
  }
  if (
    "hotelId" in properties &&
    context.hotel.selectedHotel?.hotelId &&
    !hasValue(enriched.hotelId)
  ) {
    enriched.hotelId = context.hotel.selectedHotel.hotelId;
  }
  if (
    "hotelName" in properties &&
    context.hotel.selectedHotel?.hotelName &&
    !hasValue(enriched.hotelName)
  ) {
    enriched.hotelName = context.hotel.selectedHotel.hotelName;
  }
  if (
    "roomId" in properties &&
    context.hotel.selectedRoom?.roomId &&
    !hasValue(enriched.roomId)
  ) {
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
  if (
    "sessionId" in properties &&
    context.flight.sessionId &&
    !hasValue(enriched.sessionId)
  ) {
    enriched.sessionId = context.flight.sessionId;
  }
  if (
    "fareSourceCode" in properties &&
    context.flight.selectedFlight?.fareSourceCode &&
    !hasValue(enriched.fareSourceCode)
  ) {
    enriched.fareSourceCode = context.flight.selectedFlight.fareSourceCode;
  }

  return enriched;
}

function updateExecutionContext(
  toolName: string,
  toolResultText: string,
  context: ToolExecutionContext,
): void {
  let result: unknown;

  try {
    result = JSON.parse(toolResultText) as unknown;
  } catch {
    return;
  }

  if (!isRecord(result)) return;

  if (toolName === "hotel_search" && isRecord(result.result)) {
    context.hotel.token =
      typeof result.result.token === "string" ? result.result.token : context.hotel.token;
    context.hotel.correlationId =
      typeof result.result.correlationId === "string"
        ? result.result.correlationId
        : context.hotel.correlationId;
    context.hotel.hotels = Array.isArray(result.result.result)
      ? (result.result.result as Array<Record<string, unknown>>)
      : context.hotel.hotels;
  }

  if (toolName === "hotel_get_details") {
    context.hotel.selectedHotel = {
      hotelId: typeof result.id === "string" ? result.id : context.hotel.selectedHotel?.hotelId,
      hotelName:
        typeof result.name === "string" ? result.name : context.hotel.selectedHotel?.hotelName,
    };
  }

  if (toolName === "hotel_get_rooms_and_rates" && isRecord(result.result)) {
    const hotelId = typeof result.result.id === "string" ? result.result.id : undefined;

    if (hotelId && Array.isArray(context.hotel.hotels)) {
      const selectedHotel = context.hotel.hotels.find((hotel) => hotel.id === hotelId);
      if (selectedHotel) {
        context.hotel.selectedHotel = {
          hotelId,
          hotelName:
            typeof selectedHotel.name === "string" ? selectedHotel.name : undefined,
        };
      }
    }

    if (Array.isArray(result.result.rooms)) {
      context.hotel.rooms = result.result.rooms as Array<Record<string, unknown>>;
    }
  }

  if (toolName === "hotel_revalidate_rate" && isRecord(result.result)) {
    const room = Array.isArray(result.result.room) ? result.result.room[0] : undefined;
    const rate = Array.isArray(result.result.rate) ? result.result.rate[0] : undefined;

    if (isRecord(room)) {
      const roomId = typeof room.id === "string" ? room.id : undefined;

      context.hotel.selectedRoom = {
        roomId: roomId ?? context.hotel.selectedRoom?.roomId,
        recommendationId:
          findRecommendationId(roomId, context.hotel.rooms) ??
          context.hotel.selectedRoom?.recommendationId,
        publishedRate:
          isRecord(rate) && typeof rate.publishedRate === "number"
            ? rate.publishedRate
            : context.hotel.selectedRoom?.publishedRate,
      };
    }
  }

  if (toolName === "flight_session") {
    context.flight.sessionId =
      typeof result.sessionId === "string" ? result.sessionId : context.flight.sessionId;
  }

  if (toolName === "flight_search") {
    if (typeof result.correlationId === "string") {
      context.flight.correlationId = result.correlationId;
    }
    if (isRecord(result.searchFilterObj)) {
      context.flight.searchFilterObj = result.searchFilterObj;
    }
    if (isRecord(result.result) && Array.isArray(result.result.flights)) {
      context.flight.flights = result.result.flights as Array<Record<string, unknown>>;

      const firstFlight = result.result.flights[0];
      if (isRecord(firstFlight) && typeof firstFlight.fareSourceCode === "string") {
        context.flight.selectedFlight = {
          fareSourceCode: firstFlight.fareSourceCode,
        };
      }
    }
  }
}

function buildContextPrompt(context: ToolExecutionContext): string {
  return [
    "CURRENT TOOL CONTEXT:",
    context.hotel.token ? `- hotel token: ${context.hotel.token}` : "- hotel token: none",
    context.hotel.correlationId
      ? `- hotel correlationId: ${context.hotel.correlationId}`
      : "- hotel correlationId: none",
    context.hotel.selectedHotel?.hotelId
      ? `- selected hotelId: ${context.hotel.selectedHotel.hotelId}`
      : "- selected hotelId: none",
    context.hotel.selectedRoom?.recommendationId
      ? `- selected recommendationId: ${context.hotel.selectedRoom.recommendationId}`
      : "- selected recommendationId: none",
    context.flight.sessionId
      ? `- flight sessionId: ${context.flight.sessionId}`
      : "- flight sessionId: none",
    context.flight.correlationId
      ? `- flight correlationId: ${context.flight.correlationId}`
      : "- flight correlationId: none",
    context.flight.selectedFlight?.fareSourceCode
      ? `- selected fareSourceCode: ${context.flight.selectedFlight.fareSourceCode}`
      : "- selected fareSourceCode: none",
  ].join("\n");
}

function findRecommendationId(
  roomId: string | undefined,
  rooms: Array<Record<string, unknown>> | undefined,
): string | undefined {
  if (!roomId || !rooms) return undefined;

  const room = rooms.find((item) => item.id === roomId);
  return room && typeof room.recommendationId === "string"
    ? room.recommendationId
    : undefined;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
