import "dotenv/config";

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readKeepAlive(value: string | undefined): number | string {
  if (!value) return -1;

  const trimmed = value.trim();
  if (!trimmed) return -1;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : trimmed;
}

export const config = {
  routestack: {
    apiKey: process.env.ROUTESTACK_API_KEY ?? "",
    apiSecret: process.env.ROUTESTACK_API_SECRET ?? "",
    mcpUrl: process.env.ROUTESTACK_MCP_URL ?? "https://mcp.routestack.ai/sse",
  },
  ollama: {
    model: process.env.OLLAMA_MODEL ?? "llama3.1",
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    requestTimeoutMs: readNumber(process.env.OLLAMA_TIMEOUT_MS, 300000),
    maxToolIterations: readNumber(process.env.MAX_TOOL_ITERATIONS, 8),
    keepAlive: readKeepAlive(process.env.OLLAMA_KEEP_ALIVE),
    maxHistoryMessages: readNumber(process.env.OLLAMA_MAX_HISTORY_MESSAGES, 12),
    maxToolResultChars: readNumber(process.env.OLLAMA_MAX_TOOL_RESULT_CHARS, 4000),
  },
} as const;

if (!config.routestack.apiKey) {
  console.error("Error: ROUTESTACK_API_KEY is required. Set it in your .env file.");
  process.exit(1);
}

if (
  config.routestack.mcpUrl.includes("evolvemcp.routestack.ai") &&
  !config.routestack.apiSecret
) {
  console.error(
    "Error: ROUTESTACK_API_SECRET is required when using evolvemcp.routestack.ai.",
  );
  process.exit(1);
}
