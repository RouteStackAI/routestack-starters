import { chat } from "../llm.js";
import type {
  AgentResult,
  ToolExecutionContext,
  TripRequest,
} from "../types.js";
import type { McpTool } from "../mcp-client.js";

export async function runHotelAgent(
  request: TripRequest,
  tools: McpTool[],
  context: ToolExecutionContext,
): Promise<AgentResult> {
  const result = await chat(
    [
      {
        role: "user",
        content: `
Find hotel options.

Destination: ${request.destination}
Check-in: ${request.departureDate}
Check-out: ${request.returnDate}
Adults: ${request.adults}

Return 2-3 good hotel options with approximate pricing.
        `,
      },
    ],
    tools,
    context,
  );

  return {
    summary: result.response,
  };
}