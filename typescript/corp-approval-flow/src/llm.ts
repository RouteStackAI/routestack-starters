import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { config } from "./config.js";
import { callTool } from "./mcp-client.js";
import type { McpTool, McpToolResult } from "./types.js";

const MAX_ITERATIONS = 8;
const SYSTEM_PROMPT =
  `You are a corporate travel booking assistant. Use tools to find options. Return strict JSON object with { summary: string, options: [{ title, totalPrice, currency, description, raw }] }.
FLIGHT SEARCH FLOW:
flight_session → flight_locations → flight_search
HOTEL SEARCH FLOW:
hotel_search_destinations → hotel_search
`;

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
  return result.content;
}

function asOpenAITools(tools: McpTool[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

async function runOpenAICompatible(client: OpenAI, model: string, prompt: string, tools: McpTool[]): Promise<string> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: asOpenAITools(tools),
      response_format: { type: "json_object" },
    });

    const msg = response.choices[0]?.message;
    if (!msg) throw new Error("No LLM response");
    messages.push(msg);

    if (!msg.tool_calls?.length) {
      return msg.content ?? "{}";
    }

    for (const toolCall of msg.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      const result = await callTool(toolCall.function.name, args);
      const json = extractJson(result);

      const updatedJson = handleToolResult(json, toolCall.function.name);

      const content = result.isError
      ? { error: true, detail: result.content }
      : updatedJson;

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(content),
      });
    }
  }

  throw new Error("LLM tool call iterations exceeded");
}

async function runAnthropic(prompt: string, tools: McpTool[]): Promise<string> {
  const client = new Anthropic({ apiKey: config.llm.apiKey });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: config.llm.model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
    });

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUses.length) {
      const text = response.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("\n")
        .trim();
      return text || "{}";
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const result = await callTool(toolUse.name, (toolUse.input ?? {}) as Record<string, unknown>);
      const payload = result.isError
        ? { error: true, detail: result.content }
        : extractJson(result);

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(payload),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  throw new Error("LLM tool call iterations exceeded");
}

export async function runSearchPrompt(prompt: string, tools: McpTool[]): Promise<string> {
  if (config.llm.provider === "anthropic") {
    return runAnthropic(prompt, tools);
  }

  if (config.llm.provider === "mistral") {
    const client = new OpenAI({
      apiKey: config.llm.apiKey,
      baseURL: config.llm.mistralBaseUrl,
    });
    return runOpenAICompatible(client, config.llm.model, prompt, tools);
  }

  const client = new OpenAI({ apiKey: config.llm.apiKey });
  return runOpenAICompatible(client, config.llm.model, prompt, tools);
}

function handleToolResult(json: any, toolName: string) {
  let updatedResult = json;

  if (toolName === "hotel_search" && json) {
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

  if (toolName === "hotel_get_details" && json) {
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

  if (toolName === "hotel_get_rooms_and_rates" && json) {
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

  if (toolName === "hotel_get_booking" && json) {
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
              flights: json?.result.slice(0, 10),
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