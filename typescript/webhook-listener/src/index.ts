import { connectMcp, disconnectMcp } from "./mcp-client.js";
import "./config.js";

async function main() {
  console.log("RouteStack Webhook Listener");
  console.log("Listening for booking events...\n");

  await connectMcp();

  // TODO: Subscribe to SSE event stream
  // TODO: Listen for: booking.confirmed, booking.cancelled, price.changed
  // TODO: Forward events to FORWARD_URL with retry logic

  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await disconnectMcp();
    process.exit(0);
  });
}

main().catch(console.error);
