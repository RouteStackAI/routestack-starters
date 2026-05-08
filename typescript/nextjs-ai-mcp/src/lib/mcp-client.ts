import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import crypto from "node:crypto";
import { config } from "./config";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

let client: Client | null = null;
let cachedPartnerToken: string | null = null;

async function getPartnerToken() {
  if (cachedPartnerToken) return cachedPartnerToken;

  const { apiKey, apiSecret, mcpUrl } = config.routestack;

  if (!apiSecret) return apiKey;

  const ts = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();

  const hmac = crypto
    .createHmac("sha256", apiSecret)
    .update(`${apiKey}:${ts}:${nonce}`)
    .digest("base64url");

  const base = new URL(mcpUrl);
  const tokenUrl = new URL("/mcp/auth/partner-token", base.origin);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      apiKey,
      hmac,
      timestamp: ts,
      nonce,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to get partner token");
  }

  const json = await res.json();

  const token =
    json.token ||
    json.accessToken ||
    json.partnerToken ||
    json.jwt;

  if (!token) {
    throw new Error("Partner token missing");
  }

  cachedPartnerToken = token;

  return token;
}

export async function connectMcp() {
  if (client) return client;

  const token = await getPartnerToken();
  const { mcpUrl } = config.routestack;

  client = new Client({
    name: "routestack-next-chat",
    version: "0.1.0",
  });

  try {
    const transport = new StreamableHTTPClientTransport(
      new URL(mcpUrl),
      {
        requestInit: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    await client.connect(transport);
  } catch {
    await client.close().catch(() => {});
    client = new Client({
      name: "routestack-next-chat",
      version: "0.1.0",
    });

    const transport = new SSEClientTransport(
      new URL(mcpUrl),
      {
        requestInit: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    await client.connect(transport);
  }

  return client;
}

export async function listTools(): Promise<McpTool[]> {
  const client = await connectMcp();

  const result = await client.listTools();

  return result.tools.map((t) => ({
    name: t.name,
    description: t.description || "",
    inputSchema: (t.inputSchema || {}) as Record<string, unknown>,
  }));
}

export async function callTool(
  name: string,
  args: Record<string, unknown>
) {
  const client = await connectMcp();

  const result = await client.callTool({
    name,
    arguments: args,
  });

  return result;
}