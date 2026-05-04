import "dotenv/config";

function sanitizeEnv(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

export const config = {
  app: {
    port: Number(sanitizeEnv(process.env.PORT ?? "3000")),
    publicBaseUrl: sanitizeEnv(process.env.PUBLIC_BASE_URL ?? "https://alpha.routestack.ai"),
  },
  routestack: {
    apiKey: sanitizeEnv(process.env.ROUTESTACK_API_KEY ?? ""),
    apiSecret: sanitizeEnv(process.env.ROUTESTACK_API_SECRET ?? ""),
    mcpUrl: sanitizeEnv(process.env.ROUTESTACK_MCP_URL ?? "https://mcp.routestack.ai/sse"),
    portalUrl: sanitizeEnv(process.env.ROUTESTACK_PORTAL_URL ?? ""),
  },
  discord: {
    token: sanitizeEnv(process.env.DISCORD_TOKEN ?? ""),
    clientId: sanitizeEnv(process.env.DISCORD_CLIENT_ID ?? ""),
    guildId: sanitizeEnv(process.env.DISCORD_GUILD_ID ?? ""),
  },
  llm: {
    openaiApiKey: sanitizeEnv(process.env.OPENAI_API_KEY ?? ""),
    openaiModel: sanitizeEnv(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
  },
} as const;

if (!config.routestack.apiKey) {
  console.error("Error: ROUTESTACK_API_KEY is required.");
  process.exit(1);
}

if (
  config.routestack.mcpUrl.includes("evolvemcp.routestack.ai") &&
  !config.routestack.apiSecret
) {
  console.error(
    "Error: ROUTESTACK_API_SECRET is required for evolvemcp.routestack.ai.",
  );
  process.exit(1);
}

if (!config.discord.token) {
  console.error("Error: DISCORD_TOKEN is required.");
  process.exit(1);
}

if (!config.discord.clientId) {
  console.error("Error: DISCORD_CLIENT_ID is required.");
  process.exit(1);
}

if (!/^\d{17,20}$/.test(config.discord.clientId)) {
  console.error(
    "Error: DISCORD_CLIENT_ID should be the Discord Application ID, which is a numeric snowflake.",
  );
  process.exit(1);
}
