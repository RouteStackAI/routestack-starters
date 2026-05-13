import { config } from "./config.js";
import {
  callTool,
  connectMcp,
  disconnectMcp,
  listTools,
  type McpEvent,
  type McpTool,
} from "./mcp-client.js";
import { forwardEvent } from "./forwarder.js";
import { handleBookingConfirmed } from "./handlers/booking-confirmed.js";
import { handleBookingCancelled } from "./handlers/booking-cancelled.js";
import { handlePriceChange } from "./handlers/price-change.js";
import { logError, logInfo, logWarn } from "./logger.js";

let eventCount = 0;
let forwardedCount = 0;
let failedCount = 0;
let shuttingDown = false;
let hasReceivedLiveNotification = false;
let fakeEventTimer: NodeJS.Timeout | null = null;
let pollingTimer: NodeJS.Timeout | null = null;
let resolvedPollToolName = "";

async function main(): Promise<void> {
  logInfo("RouteStack Webhook Listener starting");
  logInfo(`MCP endpoint: ${config.routestack.mcpUrl}`);
  logInfo(`Forward endpoint: ${config.forwarding.url}`);
  logInfo(
    `Forward retries: ${config.forwarding.maxRetries} (${config.forwarding.retryDelayMs}ms base delay)`,
  );
  logInfo(
    `Forward timeout: ${config.forwarding.timeoutMs}ms | Connect retries: ${config.routestack.connectRetries}`,
  );

  if (config.eventFilter.size > 0) {
    logInfo(`Event filter: ${Array.from(config.eventFilter).join(", ")}`);
  } else {
    logInfo("Event filter: all events");
  }

  if (config.runtime.devFakeEventsEnabled) {
    logInfo(
      `DEV_FAKE_EVENTS enabled, interval=${config.runtime.devFakeEventsIntervalMs}ms`,
    );
  }

  if (config.runtime.pollingFallbackEnabled) {
    logInfo(
      `MCP polling fallback enabled, interval=${config.runtime.pollIntervalMs}ms`,
    );
  }

  logInfo("Connecting to MCP server...");
  await connectMcp(handleEvent);
  logInfo("Connected. Listening for events.");

  if (config.runtime.devFakeEventsEnabled) {
    startFakeEvents();
  }

  if (config.runtime.pollingFallbackEnabled) {
    await bootstrapPollingFallback();
  }
}

async function handleEvent(event: McpEvent): Promise<void> {
  hasReceivedLiveNotification = true;

  if (config.eventFilter.size > 0 && !config.eventFilter.has(event.type)) {
    return;
  }

  await processEvent(event);
}

async function processEvent(event: McpEvent): Promise<void> {
  eventCount++;
  logInfo(`Event received: ${event.type}`);

  const transformedData = routeEvent(event);
  if (transformedData === null) {
    logInfo(`Event skipped by handler: ${event.type}`);
    return;
  }

  const outboundPayload = {
    event: event.type,
    data: transformedData,
    timestamp: event.timestamp,
    source: "routestack",
  };

  const result = await forwardEvent(outboundPayload);
  if (result.success) {
    forwardedCount++;
    logInfo(
      `Forwarded event=${event.type} status=${result.statusCode} attempts=${result.attempts}`,
    );
    return;
  }

  failedCount++;
  logWarn(
    `Forward failed event=${event.type} attempts=${result.attempts} reason=${result.error ?? "unknown"}`,
  );
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
      return event.data;
  }
}

function startFakeEvents(): void {
  const mockEvents: McpEvent[] = [
    {
      type: "booking.confirmed",
      data: {
        type: "booking.confirmed",
        bookingId: "DEV-BK-1001",
        passenger: "Alex Tester",
        origin: "LAX",
        destination: "JFK",
        date: "2026-06-20",
        price: 209,
      },
      timestamp: new Date().toISOString(),
    },
    {
      type: "booking.cancelled",
      data: {
        type: "booking.cancelled",
        bookingId: "DEV-BK-1002",
        reason: "user_requested",
      },
      timestamp: new Date().toISOString(),
    },
    {
      type: "price.changed",
      data: {
        type: "price.changed",
        itemId: "DEV-FLIGHT-900",
        itemType: "flight",
        previousPrice: 299,
        currentPrice: 249,
        currency: "USD",
      },
      timestamp: new Date().toISOString(),
    },
  ];

  let index = 0;
  fakeEventTimer = setInterval(() => {
    const source = mockEvents[index % mockEvents.length];
    const event: McpEvent = {
      type: source.type,
      data: source.data,
      timestamp: new Date().toISOString(),
    };

    void processEvent(event).catch((error) => {
      logError(`DEV_FAKE_EVENTS dispatch failed: ${error instanceof Error ? error.message : String(error)}`);
    });

    index += 1;
  }, config.runtime.devFakeEventsIntervalMs);
}

async function bootstrapPollingFallback(): Promise<void> {
  if (config.runtime.pollToolName) {
    resolvedPollToolName = config.runtime.pollToolName;
    logInfo(`Polling MCP tool: ${resolvedPollToolName}`);
  } else {
    logInfo("Polling fallback has no MCP_POLL_TOOL_NAME set, attempting tool auto-discovery.");
    const tools = await listTools().catch((error) => {
      throw new Error(`Could not list MCP tools for auto-discovery: ${error instanceof Error ? error.message : String(error)}`);
    });

    const selected = autoSelectPollingTool(tools);
    if (!selected) {
      logWarn("No suitable polling tool found automatically. Set MCP_POLL_TOOL_NAME to enable polling fallback.");
      return;
    }

    resolvedPollToolName = selected.name;
    logInfo(`Auto-selected polling tool: ${resolvedPollToolName}`);
  }

  setTimeout(() => {
    if (!hasReceivedLiveNotification) {
      logWarn("No MCP notifications observed yet; activating polling fallback now.");
      startPollingLoop();
      return;
    }

    logInfo("Live MCP notifications are active; polling fallback stays idle unless needed.");
  }, config.runtime.pollIntervalMs);
}

function autoSelectPollingTool(tools: McpTool[]): McpTool | null {
  const keywords = ["event", "notification", "activity", "updates", "booking", "price"];

  for (const tool of tools) {
    const haystack = `${tool.name} ${tool.description}`.toLowerCase();
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return tool;
    }
  }

  return tools.length > 0 ? tools[0] : null;
}

function startPollingLoop(): void {
  if (pollingTimer) return;

  pollingTimer = setInterval(() => {
    void pollOnce().catch((error) => {
      logWarn(`Polling cycle failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, config.runtime.pollIntervalMs);

  void pollOnce().catch((error) => {
    logWarn(`Initial polling cycle failed: ${error instanceof Error ? error.message : String(error)}`);
  });
}

async function pollOnce(): Promise<void> {
  const toolName = config.runtime.pollToolName;
  const effectiveToolName = resolvedPollToolName || toolName;
  if (!effectiveToolName) return;

  const result = await callTool(effectiveToolName, config.runtime.pollToolArgs);

  if (result.isError) {
    throw new Error(`Tool ${effectiveToolName} returned error result`);
  }

  const polledEvents = extractEventsFromToolResult(result.content, config.runtime.pollResultEventsPath);
  if (polledEvents.length === 0) {
    logInfo(`Polling tool=${effectiveToolName} returned no events`);
    return;
  }

  logInfo(`Polling tool=${effectiveToolName} produced ${polledEvents.length} event(s)`);
  for (const event of polledEvents) {
    if (config.eventFilter.size > 0 && !config.eventFilter.has(event.type)) {
      continue;
    }

    await processEvent(event);
  }
}

function extractEventsFromToolResult(
  content: Array<{ type: string; text?: string; [key: string]: unknown }>,
  configuredPath: string,
): McpEvent[] {
  const events: McpEvent[] = [];

  for (const item of content) {
    const jsonPayload = parseContentItemJson(item);
    if (jsonPayload === null) continue;

    const selected = configuredPath ? getPath(jsonPayload, configuredPath) : jsonPayload;

    if (Array.isArray(selected)) {
      for (const value of selected) {
        const event = toMcpEvent(value);
        if (event) events.push(event);
      }
      continue;
    }

    const event = toMcpEvent(selected);
    if (event) events.push(event);
  }

  return events;
}

function parseContentItemJson(item: { type: string; text?: string; [key: string]: unknown }): unknown | null {
  if (item.type === "json" && "json" in item) {
    return item.json;
  }

  if (typeof item.text === "string" && item.text.trim()) {
    try {
      return JSON.parse(item.text);
    } catch {
      return null;
    }
  }

  return null;
}

function getPath(payload: unknown, path: string): unknown {
  const parts = path.split(".").map((part) => part.trim()).filter(Boolean);
  let current: unknown = payload;

  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function toMcpEvent(payload: unknown): McpEvent | null {
  if (typeof payload !== "object" || payload === null) return null;

  const data = payload as Record<string, unknown>;
  const eventType = typeof data.type === "string" && data.type.trim() ? data.type : "polled.event";

  return {
    type: eventType,
    data,
    timestamp: new Date().toISOString(),
  };
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  if (fakeEventTimer) {
    clearInterval(fakeEventTimer);
    fakeEventTimer = null;
  }

  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }

  logInfo(`Received ${signal}. Shutting down...`);
  logInfo(`Events received=${eventCount} forwarded=${forwardedCount} failed=${failedCount}`);

  await disconnectMcp();
  logInfo("Shutdown complete.");
}

process.on("SIGINT", async () => {
  await shutdown("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdown("SIGTERM");
  process.exit(0);
});

process.on("uncaughtException", async (error) => {
  logError(`Uncaught exception: ${error.message}`);
  await shutdown("SIGTERM");
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logError(`Unhandled rejection: ${message}`);
  await shutdown("SIGTERM");
  process.exit(1);
});

main().catch(async (error) => {
  logError(`Fatal startup error: ${error instanceof Error ? error.message : String(error)}`);
  await shutdown("SIGTERM");
  process.exit(1);
});
