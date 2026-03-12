import { config } from "./config.js";

/**
 * RouteStack MCP Client
 *
 * Connects to the RouteStack MCP server via SSE and provides
 * access to travel tools (flights, hotels, cars).
 *
 * TODO: Replace with actual MCP client implementation when
 * the RouteStack MCP server endpoint is finalized.
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: unknown;
  isError?: boolean;
}

export async function connectMcp(): Promise<void> {
  const { apiKey, mcpUrl } = config.routestack;

  console.log(`Connecting to RouteStack MCP at ${mcpUrl}...`);

  // TODO: Initialize MCP client connection via SSE
  // const client = new McpClient({ url: mcpUrl, apiKey });
  // await client.connect();

  console.log("Connected to RouteStack MCP server.");
}

export async function listTools(): Promise<McpTool[]> {
  // TODO: Fetch available tools from MCP server
  return [];
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  // TODO: Call MCP tool and return result
  console.log(`Calling tool: ${name}`, args);
  return { content: null };
}

export async function disconnectMcp(): Promise<void> {
  // TODO: Gracefully close MCP connection
  console.log("Disconnected from RouteStack MCP server.");
}

