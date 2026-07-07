import "dotenv/config";
import { createServer } from "node:http";
import crypto from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

const serverPort = Number(process.env.PORT ?? 3080);
const apiKey = process.env.VITE_ROUTESTACK_API_KEY ?? "";
const apiSecret = process.env.VITE_ROUTESTACK_API_SECRET ?? "";
const mcpUrl = process.env.VITE_ROUTESTACK_MCP_URL ?? "https://mcp.routestack.ai/sse";

let client: Client | null = null;
let transportKind: "streamable-http" | "sse" | null = null;
let cachedPartnerToken: string | null = null;

async function getPartnerToken(): Promise<string> {
  if (cachedPartnerToken) return cachedPartnerToken;

  if (!apiKey) {
    throw new Error("ROUTESTACK_API_KEY is required.");
  }

  if (!apiSecret) {
    return apiKey;
  }

  const ts = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const hmac = crypto
    .createHmac("sha256", apiSecret)
    .update(`${apiKey}:${ts}:${nonce}`)
    .digest("base64url");

  const base = new URL(mcpUrl);
  const tokenUrl = new URL("/mcp/auth/partner-token", base.origin);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey, hmac, timestamp: ts, nonce }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Partner-token request failed (${response.status}): ${text}`);
  }

  const data = JSON.parse(text) as {
    token?: string;
    accessToken?: string;
    partnerToken?: string;
    jwt?: string;
  };

  const token =
    data.token ?? data.accessToken ?? data.partnerToken ?? data.jwt;

  if (!token) {
    throw new Error(`Partner-token response missing token field: ${text}`);
  }

  cachedPartnerToken = token;
  return token;
}

async function connectMcp(): Promise<void> {
  if (client) return;

  const url = new URL(mcpUrl);
  const token = await getPartnerToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  client = new Client({ name: "routestack-react-widget", version: "0.1.0" });

  try {
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
    });
    await client.connect(transport);
    transportKind = "streamable-http";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTransportMismatch =
      message.includes("404") ||
      message.includes("405") ||
      message.includes("Not Found") ||
      message.includes("Method Not Allowed");

    if (!isTransportMismatch) {
      client = null;
      throw err;
    }

    await disconnectMcp();
    client = new Client({ name: "routestack-react-widget", version: "0.1.0" });
    const transport = new SSEClientTransport(url, {
      requestInit: { headers },
    });
    await client.connect(transport);
    transportKind = "sse";
  }
}

async function disconnectMcp() {
  if (client) {
    await client.close().catch(() => {});
    client = null;
  }
  transportKind = null;
}

async function listTools(): Promise<McpTool[]> {
  await connectMcp();
  if (!client) throw new Error("MCP client not connected.");

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

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  await connectMcp();
  if (!client) throw new Error("MCP client not connected.");

  const result = await client.callTool({ name, arguments: args });
  return {
    content: (result.content ?? []) as McpToolResult["content"],
    isError: result.isError as boolean | undefined,
  };
}

function sendJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

const server = createServer(async (request, response) => {
  try {
    if (!request.url || !request.method) {
      sendJson(response, 400, { error: "Invalid request." });
      return;
    }

    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    if (request.url === "/api/health" && request.method === "GET") {
      const tools = await listTools();
      sendJson(response, 200, {
        status: "ok",
        transport: transportKind ?? "disconnected",
        tools: tools.length,
      });
      return;
    }

    if (request.url === "/api/tools" && request.method === "GET") {
      const tools = await listTools();
      sendJson(response, 200, { tools, transport: transportKind });
      return;
    }

    if (request.url === "/api/tool" && request.method === "POST") {
      const body = await readBody(request);
      const name = body.name;
      const args = body.args;

      if (typeof name !== "string" || typeof args !== "object" || !args) {
        sendJson(response, 400, { error: "Expected { name, args }." });
        return;
      }

      const result = await callTool(name, args as Record<string, unknown>);
      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(response, 500, { error: message });
  }
});

server.listen(serverPort, "127.0.0.1", () => {
  console.log(`RouteStack widget API listening on http://127.0.0.1:${serverPort}`);
});
