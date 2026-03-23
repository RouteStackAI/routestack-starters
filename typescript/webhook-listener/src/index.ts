import chalk from "chalk";
import { config } from "./config.js";
import { connectMcp, disconnectMcp, type McpEvent } from "./mcp-client.js";
import { forwardEvent } from "./forwarder.js";
import { handleBookingConfirmed } from "./handlers/booking-confirmed.js";
import { handleBookingCancelled } from "./handlers/booking-cancelled.js";
import { handlePriceChange } from "./handlers/price-change.js";

let eventCount = 0;
let forwardedCount = 0;
let failedCount = 0;

async function main() {
  console.log(chalk.bold("\nRouteStack Webhook Listener\n"));
  console.log(chalk.dim(`MCP: ${config.routestack.mcpUrl}`));
  console.log(chalk.dim(`Forward: ${config.forwarding.url}`));
  console.log(
    chalk.dim(
      `Retries: ${config.forwarding.maxRetries} (${config.forwarding.retryDelayMs}ms base delay)`,
    ),
  );

  if (config.eventFilter.length > 0) {
    console.log(chalk.dim(`Filter: ${config.eventFilter.join(", ")}`));
  } else {
    console.log(chalk.dim("Filter: all events"));
  }

  console.log("\nConnecting to MCP server...");
  await connectMcp(handleEvent);
  console.log(chalk.green("Connected. Listening for events...\n"));
}

async function handleEvent(event: McpEvent) {
  const { eventFilter } = config;

  // Apply event filter
  if (eventFilter.length > 0 && !eventFilter.includes(event.type)) {
    return;
  }

  eventCount++;
  const ts = new Date().toLocaleTimeString();
  console.log(chalk.cyan(`[${ts}] Event: ${event.type}`));

  // Route to typed handler
  const payload = routeEvent(event);

  if (payload === null) {
    console.log(chalk.dim("  Skipped by handler"));
    return;
  }

  // Forward the transformed payload to webhook URL
  const result = await forwardEvent(payload);

  if (result.success) {
    forwardedCount++;
    console.log(
      chalk.green(
        `  Forwarded (${result.statusCode}, ${result.attempts} attempt${result.attempts === 1 ? "" : "s"})`,
      ),
    );
  } else {
    failedCount++;
    console.log(chalk.red(`  Failed: ${result.error}`));
  }
}

function routeEvent(event: McpEvent): unknown {
  switch (event.type) {
    case "booking.confirmed":
      return handleBookingConfirmed(event);
    case "booking.cancelled":
      return handleBookingCancelled(event);
    case "price.changed":
      return handlePriceChange(event);
    default:
      // Unknown event types are forwarded as-is
      return event.data;
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log(chalk.dim("\n\nShutting down..."));
  console.log(
    chalk.dim(
      `Events: ${eventCount} received, ${forwardedCount} forwarded, ${failedCount} failed`,
    ),
  );
  await disconnectMcp();
  console.log(chalk.dim("Goodbye.\n"));
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectMcp();
  process.exit(0);
});

main().catch((err) => {
  console.error(
    chalk.red(`Fatal: ${err instanceof Error ? err.message : err}`),
  );
  process.exit(1);
});
