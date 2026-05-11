import { chat } from "../llm.js";
import type {
  AgentResult,
  ToolExecutionContext,
  TripRequest,
} from "../types.js";
import type { McpTool } from "../mcp-client.js";

export async function runCarAgent(
  request: TripRequest,
  tools: McpTool[],
  context: ToolExecutionContext,
): Promise<AgentResult> {
  const result = await chat(
    [
      {
        role: "user",
        content: `
Find car rental options.

Pickup city: ${request.destination}
Pickup date: ${request.departureDate}
Drop date: ${request.returnDate}

Return 2-3 suitable car rental options.
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