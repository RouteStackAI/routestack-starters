import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import crypto from "node:crypto";
import { config } from "./config.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

let client: Client | null = null;
let cachedPartnerToken: string | null = null;

async function getPartnerToken(): Promise<string> {
  if (cachedPartnerToken) return cachedPartnerToken;

  const { apiKey, apiSecret, mcpUrl } = config.routestack;
  if (!apiSecret) {
    return apiKey;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const hmac = crypto
    .createHmac("sha256", apiSecret)
    .update(`${apiKey}:${timestamp}:${nonce}`)
    .digest("base64url");

  const tokenUrl = new URL("/mcp/auth/partner-token", new URL(mcpUrl).origin);
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey, hmac, timestamp, nonce }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Partner-token request failed (${response.status}): ${text}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Partner-token response was not valid JSON: ${text}`);
  }

  const token =
    (json as { token?: string }).token ??
    (json as { accessToken?: string }).accessToken ??
    (json as { partnerToken?: string }).partnerToken ??
    (json as { jwt?: string }).jwt;

  if (!token || typeof token !== "string") {
    throw new Error(`Partner-token response missing token field: ${text}`);
  }

  cachedPartnerToken = token;
  return token;
}

export async function connectMcp(): Promise<void> {
  const url = new URL(config.routestack.mcpUrl);
  const token = await getPartnerToken();
  const headers = { Authorization: `Bearer ${token}` };

  client = new Client({ name: "routestack-ollama-local", version: "0.1.0" });

  try {
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
    });
    await client.connect(transport);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTransportMismatch =
      message.includes("404") ||
      message.includes("405") ||
      message.includes("Not Found") ||
      message.includes("Method Not Allowed");

    if (!isTransportMismatch) throw error;

    await client.close().catch(() => {});
    client = new Client({ name: "routestack-ollama-local", version: "0.1.0" });

    const transport = new SSEClientTransport(url, {
      requestInit: { headers },
    });
    await client.connect(transport);
  }
}

export async function listTools(): Promise<McpTool[]> {
  if (!client) throw new Error("MCP client not connected");

  const tools: McpTool[] = [];
  let cursor: string | undefined;

  do {
    const result = await client.listTools({ cursor });
    tools.push(
      ...result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
      })),
    );
    cursor = result.nextCursor;
  } while (cursor);

  return tools;
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  if (!client) throw new Error("MCP client not connected");

  const result = await client.callTool({ name, arguments: args });
  return {
    content: (result.content ?? []) as McpToolResult["content"],
    isError: result.isError as boolean | undefined,
  };
}

export async function disconnectMcp(): Promise<void> {
  if (!client) return;
  await client.close();
  client = null;
}
