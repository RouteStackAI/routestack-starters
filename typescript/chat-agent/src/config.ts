import "dotenv/config";

export type LlmProvider = "openai" | "anthropic";

export const config = {
  routestack: {
    apiKey: process.env.ROUTESTACK_API_KEY ?? "",
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
  },
  port: Number(process.env.PORT ?? 3000),
} as const;

if (!config.routestack.apiKey) {
  console.error("Error: ROUTESTACK_API_KEY is required. Set it in your .env file.");
  process.exit(1);
}

const { provider } = config.llm;

if (provider !== "openai" && provider !== "anthropic") {
  console.error(`Error: LLM_PROVIDER must be "openai" or "anthropic", got "${provider}".`);
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
