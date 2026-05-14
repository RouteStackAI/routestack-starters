import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import crypto from "node:crypto";
import { config } from "./config.js";
import type { McpTool, McpToolResult } from "./types.js";

let client: Client | null = null;
let cachedPartnerToken: string | null = null;

async function getPartnerToken(): Promise<string> {
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
    body: JSON.stringify({ apiKey, hmac, timestamp: ts, nonce }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Partner-token request failed (${res.status}): ${text}`);

  const data = JSON.parse(text) as Record<string, unknown>;
  const token = data.token ?? data.accessToken ?? data.partnerToken ?? data.jwt;
  if (typeof token !== "string" || !token) {
    throw new Error(`Partner-token response missing token field: ${text}`);
  }

  cachedPartnerToken = token;
  return token;
}

export async function connectMcp(): Promise<void> {
  const url = new URL(config.routestack.mcpUrl);
  const token = await getPartnerToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  client = new Client({ name: "corp-approval-flow", version: "0.1.0" });

  try {
    const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers } });
    await client.connect(transport);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const mismatch = message.includes("404") || message.includes("405") || message.includes("Not Found");
    if (!mismatch) throw err;

    await client.close().catch(() => undefined);
    client = new Client({ name: "corp-approval-flow", version: "0.1.0" });
    const sse = new SSEClientTransport(url, { requestInit: { headers } });
    await client.connect(sse);
  }
}

export async function listTools(): Promise<McpTool[]> {
  if (!client) throw new Error("MCP client not connected");
  const all: McpTool[] = [];
  let cursor: string | undefined;

  do {
    const page = await client.listTools({ cursor });
    all.push(...page.tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
    })));
    cursor = page.nextCursor;
  } while (cursor);

  return all;
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  if (!client) throw new Error("MCP client not connected");
  const result = await client.callTool({ name, arguments: args });
  return {
    content: (result.content ?? []) as McpToolResult["content"],
    isError: result.isError as boolean | undefined,
  };
}

export async function disconnectMcp(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
