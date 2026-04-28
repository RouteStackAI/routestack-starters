import "dotenv/config";

export type LlmProvider = "openai" | "anthropic" | "mistral";

export const config = {
  routestack: {
    apiKey: process.env.ROUTESTACK_API_KEY ?? "",
    apiSecret: process.env.ROUTESTACK_API_SECRET ?? "",
    mcpUrl: process.env.ROUTESTACK_MCP_URL ?? "https://mcp.routestack.ai/sse",
  },
  llm: {
    provider: (process.env.LLM_PROVIDER ?? "openai") as LlmProvider,
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? "",
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-latest",
    },
    mistral: {
      apiKey: process.env.MISTRAL_API_KEY ?? "",
      model: process.env.MISTRAL_MODEL ?? "mistral-large-latest",
      // Mistral provides an OpenAI-compatible API at this base URL.
      baseUrl: process.env.MISTRAL_BASE_URL ?? "https://api.mistral.ai/v1",
    },
  },
  port: Number(process.env.PORT ?? 3000),
} as const;

if (!config.routestack.apiKey) {
  console.error("Error: ROUTESTACK_API_KEY is required. Set it in your .env file.");
  process.exit(1);
}

// For partner-token auth flows (e.g. evolvemcp), ROUTESTACK_API_SECRET is required.
if (config.routestack.mcpUrl.includes("evolvemcp.routestack.ai") && !config.routestack.apiSecret) {
  console.error(
    "Error: ROUTESTACK_API_SECRET is required when using evolvemcp.routestack.ai. Set it in your .env file.",
  );
  process.exit(1);
}

const { provider } = config.llm;

if (provider !== "openai" && provider !== "anthropic" && provider !== "mistral") {
  console.error(
    `Error: LLM_PROVIDER must be "openai", "anthropic", or "mistral", got "${provider}".`,
  );
  process.exit(1);
}

if (provider === "openai" && !config.llm.openai.apiKey) {
  console.error("Error: OPENAI_API_KEY is required when LLM_PROVIDER=openai.");
  process.exit(1);
}

if (provider === "anthropic" && !config.llm.anthropic.apiKey) {
  console.error("Error: ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic.");
  process.exit(1);
}

if (provider === "mistral" && !config.llm.mistral.apiKey) {
  console.error("Error: MISTRAL_API_KEY is required when LLM_PROVIDER=mistral.");
  process.exit(1);
}
