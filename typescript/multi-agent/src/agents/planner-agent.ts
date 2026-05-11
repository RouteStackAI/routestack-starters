import type { TripRequest, ToolExecutionContext } from "../types.js";
import type { McpTool } from "../mcp-client.js";

import { runFlightAgent } from "./flight-agent.js";
import { runHotelAgent } from "./hotel-agent.js";
import { runCarAgent } from "./car-agent.js";

export async function runPlannerAgent(
  request: TripRequest,
  tools: McpTool[],
) {
  const context: ToolExecutionContext = {
    hotel: {},
    flight: {},
    car: {}
  };

  const [flight, hotel, car] = await Promise.all([
    runFlightAgent(request, tools, context),
    runHotelAgent(request, tools, context),
    runCarAgent(request, tools, context),
  ]);

  return `
==============================
TRIP PLAN
==============================

Flights
-------
${flight.summary}

Hotels
------
${hotel.summary}

Cars
----
${car.summary}
`;
}