export const config = {
  routestack: {
    apiKey: process.env.ROUTESTACK_API_KEY || "",
    apiSecret: process.env.ROUTESTACK_API_SECRET || "",
    mcpUrl: process.env.ROUTESTACK_MCP_URL || "",
  },

  mistral: {
    apiKey: process.env.MISTRAL_API_KEY || "",
    model: process.env.MISTRAL_MODEL || "mistral-small-latest",
  },
};