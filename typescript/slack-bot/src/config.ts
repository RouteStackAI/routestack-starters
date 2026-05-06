import "dotenv/config";

function sanitizeEnv(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

export const config = {
  app: {
    port: Number(sanitizeEnv(process.env.PORT ?? "3000")),
  },
  routestack: {
    apiKey: sanitizeEnv(process.env.ROUTESTACK_API_KEY ?? ""),
    apiSecret: sanitizeEnv(process.env.ROUTESTACK_API_SECRET ?? ""),
    mcpUrl: sanitizeEnv(
      process.env.ROUTESTACK_MCP_URL ?? "https://mcp.routestack.ai/sse",
    ),
    portalUrl: sanitizeEnv(process.env.ROUTESTACK_PORTAL_URL ?? ""),
  },
  slack: {
    botToken: sanitizeEnv(process.env.SLACK_BOT_TOKEN ?? ""),
    signingSecret: sanitizeEnv(process.env.SLACK_SIGNING_SECRET ?? ""),
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

if (!config.slack.botToken) {
  console.error("Error: SLACK_BOT_TOKEN is required.");
  process.exit(1);
}

if (!config.slack.signingSecret) {
  console.error("Error: SLACK_SIGNING_SECRET is required.");
  process.exit(1);
}
