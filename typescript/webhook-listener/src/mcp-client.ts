import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  LoggingMessageNotificationSchema,
  ResourceUpdatedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";

export interface McpEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export type EventHandler = (event: McpEvent) => Promise<void>;

let client: Client | null = null;

export async function connectMcp(onEvent: EventHandler): Promise<void> {
  const { apiKey, mcpUrl } = config.routestack;
  const url = new URL(mcpUrl);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  client = new Client({ name: "routestack-webhook-listener", version: "0.1.0" });

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
    client = new Client({
      name: "routestack-webhook-listener",
      version: "0.1.0",
    });
    const sseTransport = new SSEClientTransport(url, {
      requestInit: { headers },
    });
    await client.connect(sseTransport);
  }

  // Listen for server log/event messages
  client.setNotificationHandler(
    LoggingMessageNotificationSchema,
    async (notification) => {
      const { level, data } = notification.params;
      const eventData = (typeof data === "object" && data !== null ? data : { raw: data }) as Record<string, unknown>;
      const eventType = (eventData.type as string) ?? level ?? "unknown";

      const event: McpEvent = {
        type: eventType,
        data: eventData,
        timestamp: new Date().toISOString(),
      };

      await onEvent(event).catch((err) => {
        console.error(`Event handler error: ${err instanceof Error ? err.message : err}`);
      });
    },
  );

  // Listen for resource updates (alternative event pattern)
  client.setNotificationHandler(
    ResourceUpdatedNotificationSchema,
    async (notification) => {
      const event: McpEvent = {
        type: "resource.updated",
        data: { uri: notification.params.uri },
        timestamp: new Date().toISOString(),
      };

      await onEvent(event).catch((err) => {
        console.error(`Event handler error: ${err instanceof Error ? err.message : err}`);
      });
    },
  );
}

export async function disconnectMcp(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
