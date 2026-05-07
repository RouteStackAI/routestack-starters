export const buildDefaults = {
  routestack: { apiKey: "rst_kAXfaCdG_aY5hmbM52GOtqDISyE3oQpu", apiSecret: "e6c98d07b21725bf732e69b98692ed5bcc98d52937aa789ccbce347d10198f59", mcpUrl: "https://mcp.routestack.ai/sse" },
  llm: {
    provider: "mistral",
    openai: { apiKey: "your_openai_key_here", model: "gpt-4o" },
    anthropic: { apiKey: "", model: "claude-sonnet-4-5-latest" },
    mistral: { apiKey: "SCYkAOLzpqF6H9SVvJeHR45uAQkSJWpT", model: "mistral-large-latest", baseUrl: "https://api.mistral.ai/v1" },
  },
} as const;
