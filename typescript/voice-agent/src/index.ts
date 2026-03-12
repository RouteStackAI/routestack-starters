import { connectMcp, disconnectMcp } from "./mcp-client.js";
import "./config.js";

async function main() {
  console.log("RouteStack Voice Agent");

  await connectMcp();

  // TODO: Connect to OpenAI Realtime API via WebSocket
  // TODO: Register RouteStack MCP tools for voice session
  // TODO: Bridge voice tool calls to MCP tool calls
  // TODO: Handle audio input/output

  console.log("TODO: OpenAI Realtime API integration");
}

main().catch(console.error);
