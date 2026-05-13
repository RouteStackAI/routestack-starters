import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  LoggingMessageNotificationSchema,
  ResourceUpdatedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import crypto from "node:crypto";
import { config } from "./config.js";
import { logDebug, logError, logInfo, logWarn } from "./logger.js";

export interface McpEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

export type EventHandler = (event: McpEvent) => Promise<void>;

let client: Client | null = null;
let cachedPartnerToken: string | null = null;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getEventType(data: Record<string, unknown>, fallback: string): string {
  const maybeType = data.type;
  return typeof maybeType === "string" && maybeType.trim() ? maybeType : fallback;
}

function asEventData(data: unknown): Record<string, unknown> {
  if (isRecord(data)) return data;
  return { raw: data };
}

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

  const tokenUrl = new URL("/mcp/auth/partner-token", new URL(mcpUrl).origin);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey, hmac, timestamp: ts, nonce }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Partner token request failed (${response.status}): ${responseText}`);
  }

  let parsedResponse: unknown;
  try {
    parsedResponse = JSON.parse(responseText);
  } catch {
    throw new Error(`Partner token response was not valid JSON: ${responseText}`);
  }

  const token =
    (parsedResponse as { token?: string }).token ??
    (parsedResponse as { accessToken?: string }).accessToken ??
    (parsedResponse as { partnerToken?: string }).partnerToken ??
    (parsedResponse as { jwt?: string }).jwt;

  if (!token || typeof token !== "string") {
    throw new Error(`Partner token missing from response: ${responseText}`);
  }

  cachedPartnerToken = token;
  return token;
}

export async function connectMcp(onEvent: EventHandler): Promise<void> {
  const { mcpUrl, connectRetries, connectRetryDelayMs } = config.routestack;
  const url = new URL(mcpUrl);
  const token = await getPartnerToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= connectRetries; attempt++) {
    client = new Client({ name: "routestack-webhook-listener", version: "1.0.0" });

    try {
      const streamableTransport = new StreamableHTTPClientTransport(url, {
        requestInit: { headers },
      });
      await client.connect(streamableTransport);
      logInfo("Connected to MCP using Streamable HTTP transport");
      registerNotificationHandlers(client, onEvent);
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isTransportMismatch =
        message.includes("404") ||
        message.includes("405") ||
        message.includes("Not Found") ||
        message.includes("Method Not Allowed");

      await client.close().catch(() => {});

      if (!isTransportMismatch) {
        logWarn(`MCP Streamable HTTP connect attempt ${attempt}/${connectRetries} failed: ${message}`);
      } else {
        try {
          client = new Client({ name: "routestack-webhook-listener", version: "1.0.0" });
          const sseTransport = new SSEClientTransport(url, {
            requestInit: { headers },
          });
          await client.connect(sseTransport);
          logInfo("Connected to MCP using SSE fallback transport");
          registerNotificationHandlers(client, onEvent);
          return;
        } catch (sseError) {
          lastError = sseError;
          const sseMessage = sseError instanceof Error ? sseError.message : String(sseError);
          logWarn(`MCP SSE connect attempt ${attempt}/${connectRetries} failed: ${sseMessage}`);
          await client.close().catch(() => {});
        }
      }

      if (attempt < connectRetries) {
        const delay = connectRetryDelayMs * 2 ** (attempt - 1);
        logInfo(`Retrying MCP connection in ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `Unable to connect to MCP after ${connectRetries} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

function registerNotificationHandlers(mcpClient: Client, onEvent: EventHandler): void {
  const runHandlerSafely = async (event: McpEvent): Promise<void> => {
    try {
      await onEvent(event);
    } catch (error) {
      logError(`Event handler failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  mcpClient.setNotificationHandler(
    LoggingMessageNotificationSchema,
    async (notification) => {
      const { level, data } = notification.params;
      const eventData = asEventData(data);
      const eventType = getEventType(eventData, level ?? "unknown");

      logDebug(`Received logging notification event=${eventType}`);

      const event: McpEvent = {
        type: eventType,
        data: eventData,
        timestamp: new Date().toISOString(),
      };

      await runHandlerSafely(event);
    },
  );

  mcpClient.setNotificationHandler(
    ResourceUpdatedNotificationSchema,
    async (notification) => {
      logDebug(`Received resource update notification uri=${notification.params.uri}`);
      const event: McpEvent = {
        type: "resource.updated",
        data: { uri: notification.params.uri },
        timestamp: new Date().toISOString(),
      };

      await runHandlerSafely(event);
    },
  );
}

export async function disconnectMcp(): Promise<void> {
  if (client) {
    await client.close().catch((error) => {
      logWarn(`Error while closing MCP client: ${error instanceof Error ? error.message : String(error)}`);
    });
    client = null;
    logInfo("MCP client disconnected");
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
