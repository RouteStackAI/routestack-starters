import { connectMcp, disconnectMcp } from "./mcp-client.js";
import "./config.js";

async function main() {
  console.log("RouteStack Corporate Approval Flow");

  await connectMcp();

  // TODO: Accept travel request input
  // TODO: Search flights via RouteStack MCP
  // TODO: Generate JWT-signed Deep Link for checkout
  // TODO: Send approval email to manager with Deep Link

  console.log("TODO: Implement search → deep link → email flow");

  await disconnectMcp();
}

main().catch(console.error);
