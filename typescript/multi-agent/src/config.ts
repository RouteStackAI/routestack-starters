import "dotenv/config";

export const config = {
  routestack: {
    apiKey: process.env.ROUTESTACK_API_KEY ?? "",
    mcpUrl: process.env.ROUTESTACK_MCP_URL ?? "https://mcp.routestack.ai/sse",
  },
} as const;

if (!config.routestack.apiKey) {
  console.error("Error: ROUTESTACK_API_KEY is required. Set it in your .env file.");
  process.exit(1);
}

