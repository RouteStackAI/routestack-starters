import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function llmProvider(): "openai" | "anthropic" | "mistral" {
  const raw = optional("LLM_PROVIDER", "openai").toLowerCase();
  if (raw === "openai" || raw === "anthropic" || raw === "mistral") return raw;
  throw new Error("LLM_PROVIDER must be one of: openai, anthropic, mistral");
}

export const config = {
  port: Number(process.env.PORT ?? "3000"),
  routestack: {
    apiKey: required("ROUTESTACK_API_KEY"),
    apiSecret: process.env.ROUTESTACK_API_SECRET?.trim() ?? "",
    mcpUrl: optional("ROUTESTACK_MCP_URL", "https://mcp.routestack.ai/sse"),
  },
  llm: {
    provider: llmProvider(),
    apiKey: required("LLM_API_KEY"),
    model: required("LLM_MODEL"),
    mistralBaseUrl: optional("MISTRAL_BASE_URL", "https://api.mistral.ai/v1"),
  },
  resend: {
    apiKey: required("RESEND_API_KEY"),
    from: optional("RESEND_FROM_EMAIL", "approval@updates.routestack.ai"),
  },
  app: {
    baseUrl: optional("APP_BASE_URL", "http://localhost:3000"),
  },
  jwtSecret: required("JWT_SECRET"),
} as const;
