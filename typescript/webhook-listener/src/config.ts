import "dotenv/config";

const DEFAULT_MCP_URL = "https://mcp.routestack.ai/sse";
const DEFAULT_FORWARD_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const DEFAULT_CONNECT_RETRIES = 8;
const DEFAULT_CONNECT_RETRY_DELAY_MS = 1_000;
const DEFAULT_LOG_LEVEL = "info";
const DEFAULT_DEV_FAKE_EVENTS_INTERVAL_MS = 5_000;
const DEFAULT_POLL_INTERVAL_MS = 15_000;

type LogLevel = "debug" | "info" | "warn" | "error";

function readRequiredString(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Error: ${name} is required. Set it in your .env file.`);
    process.exit(1);
  }
  return value;
}

function readOptionalInt(name: string, defaultValue: number, minValue: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return defaultValue;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < minValue) {
    console.error(`Error: ${name} must be an integer >= ${minValue}.`);
    process.exit(1);
  }

  return parsed;
}

function readOptionalBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;

  console.error(`Error: ${name} must be a boolean (true/false).`);
  process.exit(1);
}

function readOptionalJsonObject(name: string): Record<string, unknown> {
  const raw = process.env[name]?.trim();
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`Error: ${name} must be valid JSON object.`);
    process.exit(1);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    console.error(`Error: ${name} must be a JSON object.`);
    process.exit(1);
  }

  return parsed as Record<string, unknown>;
}

function readForwardUrl(name: string): string {
  const value = readRequiredString(name);
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    console.error(`Error: ${name} is not a valid URL: ${value}`);
    process.exit(1);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    console.error(`Error: ${name} must use http or https, got: ${parsed.protocol}`);
    process.exit(1);
  }

  return value;
}

function readEventFilter(): Set<string> {
  const raw = process.env.EVENT_FILTER?.trim();
  if (!raw) return new Set<string>();

  const eventTypes = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(eventTypes);
}

function readLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase() ?? DEFAULT_LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }

  console.error("Error: LOG_LEVEL must be one of debug, info, warn, error.");
  process.exit(1);
}

export const config = {
  routestack: {
    apiKey: readRequiredString("ROUTESTACK_API_KEY"),
    apiSecret: process.env.ROUTESTACK_API_SECRET?.trim() ?? "",
    mcpUrl: process.env.ROUTESTACK_MCP_URL?.trim() || DEFAULT_MCP_URL,
    connectRetries: readOptionalInt("MCP_CONNECT_RETRIES", DEFAULT_CONNECT_RETRIES, 1),
    connectRetryDelayMs: readOptionalInt(
      "MCP_CONNECT_RETRY_DELAY_MS",
      DEFAULT_CONNECT_RETRY_DELAY_MS,
      0,
    ),
  },
  forwarding: {
    url: readForwardUrl("FORWARD_URL"),
    timeoutMs: readOptionalInt("FORWARD_TIMEOUT_MS", DEFAULT_FORWARD_TIMEOUT_MS, 1),
    maxRetries: readOptionalInt("MAX_RETRIES", DEFAULT_MAX_RETRIES, 1),
    retryDelayMs: readOptionalInt("RETRY_DELAY_MS", DEFAULT_RETRY_DELAY_MS, 0),
  },
  runtime: {
    devFakeEventsEnabled: readOptionalBool("DEV_FAKE_EVENTS", false),
    devFakeEventsIntervalMs: readOptionalInt(
      "DEV_FAKE_EVENTS_INTERVAL_MS",
      DEFAULT_DEV_FAKE_EVENTS_INTERVAL_MS,
      500,
    ),
    pollingFallbackEnabled: readOptionalBool("MCP_POLLING_FALLBACK", false),
    pollIntervalMs: readOptionalInt("MCP_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS, 1_000),
    pollToolName: process.env.MCP_POLL_TOOL_NAME?.trim() ?? "",
    pollToolArgs: readOptionalJsonObject("MCP_POLL_TOOL_ARGS"),
    pollResultEventsPath: process.env.MCP_POLL_RESULT_EVENTS_PATH?.trim() ?? "",
  },
  eventFilter: readEventFilter(),
  logLevel: readLogLevel(),
} as const;
