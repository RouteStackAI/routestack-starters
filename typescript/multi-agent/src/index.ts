import { connectMcp, disconnectMcp } from "./mcp-client.js";
import "./config.js";

async function main() {
  console.log("RouteStack Multi-Agent Trip Planner");
  console.log("TODO: Initialize agent framework and plan a trip\n");

  await connectMcp();

  // TODO: Initialize planner agent with sub-agents (flight, hotel, car)
  // TODO: Accept user input: "Plan a trip from NYC to Tokyo, Dec 15-22, 2 adults"
  // TODO: Orchestrate sub-agents to search and compile trip plan

  await disconnectMcp();
}

main().catch(console.error);
