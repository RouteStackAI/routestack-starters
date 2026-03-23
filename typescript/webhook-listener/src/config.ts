import "dotenv/config";

export const config = {
  routestack: {
    apiKey: process.env.ROUTESTACK_API_KEY ?? "",
    mcpUrl: process.env.ROUTESTACK_MCP_URL ?? "https://mcp.routestack.ai/sse",
  },
  forwarding: {
    url: process.env.FORWARD_URL ?? "",
    maxRetries: Number(process.env.MAX_RETRIES ?? 3),
    retryDelayMs: Number(process.env.RETRY_DELAY_MS ?? 1000),
  },
  eventFilter: process.env.EVENT_FILTER
    ? process.env.EVENT_FILTER.split(",").map((e) => e.trim())
    : [],
} as const;

if (!config.routestack.apiKey) {
  console.error("Error: ROUTESTACK_API_KEY is required. Set it in your .env file.");
  process.exit(1);
}

if (!config.forwarding.url) {
  console.error("Error: FORWARD_URL is required. Set it in your .env file.");
  process.exit(1);
}

// Validate FORWARD_URL is a valid http/https URL
try {
  const parsed = new URL(config.forwarding.url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    console.error(`Error: FORWARD_URL must use http or https, got: ${parsed.protocol}`);
    process.exit(1);
  }
} catch {
  console.error(`Error: FORWARD_URL is not a valid URL: ${config.forwarding.url}`);
  process.exit(1);
}

if (!Number.isFinite(config.forwarding.maxRetries) || config.forwarding.maxRetries < 1) {
  console.error("Error: MAX_RETRIES must be a positive integer.");
  process.exit(1);
}

if (!Number.isFinite(config.forwarding.retryDelayMs) || config.forwarding.retryDelayMs < 0) {
  console.error("Error: RETRY_DELAY_MS must be a non-negative number.");
  process.exit(1);
}
