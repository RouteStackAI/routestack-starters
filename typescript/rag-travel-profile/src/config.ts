import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env variable: ${name}`);
  }
  return value;
}

export const config = {
  llm: {
    provider: required("LLM_PROVIDER") as
      | "openai"
      | "anthropic"
      | "mistral",

    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    },

    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model:
        process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-latest",
    },

    mistral: {
      apiKey: process.env.MISTRAL_API_KEY,
      model:
        process.env.MISTRAL_MODEL ?? "mistral-large-latest",
      baseUrl:
        process.env.MISTRAL_BASE_URL ??
        "https://api.mistral.ai/v1",
    },
  },

  embeddings: {
    provider:
      process.env.EMBEDDINGS_PROVIDER ??
      process.env.LLM_PROVIDER ??
      "mistral",

    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model:
        process.env.OPENAI_EMBEDDING_MODEL ??
        "text-embedding-3-small",
    },

    mistral: {
      apiKey: process.env.MISTRAL_API_KEY,
      model:
        process.env.MISTRAL_EMBEDDING_MODEL ??
        "mistral-embed",
    },
  },

  routestack: {
    apiKey: required("ROUTESTACK_API_KEY"),
    apiSecret: process.env.ROUTESTACK_API_SECRET,
    mcpUrl: required("ROUTESTACK_MCP_URL"),
  },

  vector: {
    chromaUrl: process.env.CHROMA_URL,
  },
};