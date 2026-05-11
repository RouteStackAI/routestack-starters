import "dotenv/config";

export const config = {
  routestack: {
    apiKey: process.env.ROUTESTACK_API_KEY || "",
    apiSecret: process.env.ROUTESTACK_API_SECRET || "",
    mcpUrl: process.env.ROUTESTACK_MCP_URL || "",
  },

  llm: {
    provider: process.env.LLM_PROVIDER || "anthropic",

    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      model:
        process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-latest",
    },

    mistral: {
      apiKey: process.env.MISTRAL_API_KEY || "",
      model:
        process.env.MISTRAL_MODEL || "mistral-large-latest",
      baseUrl:
        process.env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1",
    },

    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    },
  },
};