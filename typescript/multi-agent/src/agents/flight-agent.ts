import { chat } from "../llm.js";
import type {
  AgentResult,
  ToolExecutionContext,
  TripRequest,
} from "../types.js";
import type { McpTool } from "../mcp-client.js";

export async function runFlightAgent(
  request: TripRequest,
  tools: McpTool[],
  context: ToolExecutionContext,
): Promise<AgentResult> {
  const result = await chat(
    [
      {
        role: "user",
        content: `
Find flight options.

Origin: ${request.origin}
Destination: ${request.destination}
Departure: ${request.departureDate}
Return: ${request.returnDate}
Adults: ${request.adults}

Return 2-3 good options with approximate pricing.
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