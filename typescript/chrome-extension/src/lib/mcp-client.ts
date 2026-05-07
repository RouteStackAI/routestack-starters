import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { getSettings } from "./config.js";
import type { McpTool, McpToolResult } from "./types.js";

let client: Client | null = null;
let connectPromise: Promise<void> | null = null;
let cachedPartnerToken: string | null = null;

async function getPartnerToken(): Promise<string> {
  if (cachedPartnerToken) return cachedPartnerToken;

  const { apiKey, apiSecret, mcpUrl } = (await getSettings()).routestack;
  if (!apiSecret) {
    return apiKey;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const payload = `${apiKey}:${timestamp}:${nonce}`;
  const hmac = await signHmacSha256(apiSecret, payload);
  const baseUrl = new URL(mcpUrl);
  const tokenUrl = new URL("/mcp/auth/partner-token", baseUrl.origin);

  const response = await fetch(tokenUrl.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ apiKey, hmac, timestamp, nonce }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Partner-token request failed (${response.status}): ${text}`);
  }

  let data: {
    token?: string;
    accessToken?: string;
    partnerToken?: string;
    jwt?: string;
    message?: string;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(`Partner-token response was not JSON: ${text}`);
  }

  const token = data.token ?? data.accessToken ?? data.partnerToken ?? data.jwt;
  if (!token || typeof token !== "string") {
    throw new Error(data.message ?? `Partner-token response missing token field: ${text}`);
  }

  cachedPartnerToken = token;
  return token;
}

export async function connectMcp(): Promise<void> {
  if (client) return;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const { mcpUrl } = (await getSettings()).routestack;
    const url = new URL(mcpUrl);
    const token = await getPartnerToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    const nextClient = createClient();

    try {
      client = await connectWithPreferredTransport(nextClient, url, headers);
      console.info("[RouteStack MCP] connected", { mcpUrl });
    } catch (error) {
      await nextClient.close().catch(() => {});
      throw error;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

async function connectWithPreferredTransport(
  nextClient: Client,
  url: URL,
  headers: Record<string, string>,
): Promise<Client> {
  try {
    const streamableTransport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
    });
    await nextClient.connect(streamableTransport);
    return nextClient;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTransportMismatch =
      message.includes("404") ||
      message.includes("405") ||
      message.includes("Not Found") ||
      message.includes("Method Not Allowed") ||
      message.includes("text/event-stream") ||
      message.includes("SSE");

    if (!isTransportMismatch) {
      throw error;
    }

    await nextClient.close().catch(() => {});
    const sseClient = createClient();
    const sseTransport = new SSEClientTransport(url, {
      requestInit: { headers },
    });
    await sseClient.connect(sseTransport);
    return sseClient;
  }
}

export async function listTools(): Promise<McpTool[]> {
  await connectMcp();
  if (!client) throw new Error("MCP client not connected");

  const allTools: McpTool[] = [];
  let cursor: string | undefined;

  do {
    const result = await client.listTools({ cursor });
    allTools.push(
      ...result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
      })),
    );
    cursor = result.nextCursor;
  } while (cursor);

  return allTools;
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  await connectMcp();
  if (!client) throw new Error("MCP client not connected");

  console.info("[RouteStack MCP] calling tool", { name, args });
  const result = await client.callTool({ name, arguments: args });

  return {
    content: (result.content ?? []) as McpToolResult["content"],
    isError: result.isError as boolean | undefined,
  };
}

export async function disconnectMcp(): Promise<void> {
  if (connectPromise) {
    await connectPromise.catch(() => {});
  }

  if (client) {
    await client.close().catch(() => {});
    client = null;
  }
}

function createClient() {
  return new Client({
    name: "routestack-extension",
    version: "0.1.0",
  });
}

async function signHmacSha256(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  const binary = Array.from(new Uint8Array(signature), (byte) => String.fromCharCode(byte)).join("");

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
