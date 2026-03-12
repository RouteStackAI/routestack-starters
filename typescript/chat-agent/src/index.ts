import { connectMcp, disconnectMcp } from "./mcp-client.js";
import "./config.js";

async function main() {
  console.log("RouteStack Chat Agent");
  console.log("TODO: Start dev server and serve chat UI\n");

  await connectMcp();

  // TODO: Start HTTP server, serve chat UI, handle WebSocket/SSE messages
  // TODO: Wire LLM provider for chat completions with MCP tools
}

main().catch(console.error);
