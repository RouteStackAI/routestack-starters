import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
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

export async function connectMcp(): Promise<void> {
  const { apiKey, mcpUrl } = config.routestack;
  const url = new URL(mcpUrl);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  client = new Client({ name: "routestack-chat", version: "0.1.0" });

  try {
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
    });
    await client.connect(transport);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTransportMismatch =
      message.includes("404") ||
      message.includes("405") ||
      message.includes("Not Found") ||
      message.includes("Method Not Allowed");

    if (!isTransportMismatch) throw err;

    await client.close().catch(() => {});
    client = new Client({ name: "routestack-chat", version: "0.1.0" });
    const sseTransport = new SSEClientTransport(url, {
      requestInit: { headers },
    });
    await client.connect(sseTransport);
  }
}

export async function listTools(): Promise<McpTool[]> {
  if (!client) throw new Error("MCP client not connected");

  const allTools: McpTool[] = [];
  let cursor: string | undefined;

  do {
    const result = await client.listTools({ cursor });
    allTools.push(
      ...result.tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
      })),
    );
    cursor = result.nextCursor;
  } while (cursor);

  return allTools;
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
  if (client) {
    await client.close();
    client = null;
  }
}
