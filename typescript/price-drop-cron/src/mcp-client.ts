import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { RuntimeConfig } from "./config.js";

export interface McpToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

export class McpClientManager {
  private client: Client | null = null;
  private partnerToken: string | null = null;

  constructor(private readonly cfg: RuntimeConfig["routestack"]) {}

  private toBase64Url(bytes: Uint8Array): string {
    const raw = String.fromCharCode(...bytes);
    return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  private async signHmacSha256(message: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
    return this.toBase64Url(new Uint8Array(signature));
  }

  private async getPartnerToken(): Promise<string> {
    if (this.partnerToken) return this.partnerToken;
    if (!this.cfg.apiSecret) return this.cfg.apiKey;

    const ts = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomUUID();
    const hmac = await this.signHmacSha256(
      `${this.cfg.apiKey}:${ts}:${nonce}`,
      this.cfg.apiSecret,
    );

    const base = new URL(this.cfg.mcpUrl);
    const tokenUrl = new URL("/mcp/auth/partner-token", base.origin);

    const res = await fetch(tokenUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apiKey: this.cfg.apiKey,
        hmac,
        timestamp: ts,
        nonce,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Partner-token request failed (${res.status}): ${text}`);
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Partner-token response was not valid JSON: ${text}`);
    }
    const token =
      (typeof data.token === "string" && data.token) ||
      (typeof data.accessToken === "string" && data.accessToken) ||
      (typeof data.partnerToken === "string" && data.partnerToken) ||
      (typeof data.jwt === "string" && data.jwt) ||
      null;

    if (!token) {
      throw new Error("Partner-token response missing token field");
    }

    this.partnerToken = token;
    return token;
  }

  async connect(): Promise<void> {
    const url = new URL(this.cfg.mcpUrl);
    const token = await this.getPartnerToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

    this.client = new Client({ name: "routestack-price-drop-cron", version: "1.0.0" });

    try {
      const transport = new StreamableHTTPClientTransport(url, {
        requestInit: { headers },
      });
      await this.client.connect(transport);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTransportMismatch =
        message.includes("404") ||
        message.includes("405") ||
        message.includes("Not Found") ||
        message.includes("Method Not Allowed");

      if (!isTransportMismatch) throw error;

      await this.client.close().catch(() => undefined);
      this.client = new Client({ name: "routestack-price-drop-cron", version: "1.0.0" });
      const sseTransport = new SSEClientTransport(url, {
        requestInit: { headers },
      });
      await this.client.connect(sseTransport);
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    if (!this.client) {
      throw new Error("MCP client is not connected");
    }

    const result = await this.client.callTool({ name, arguments: args });
    return {
      content: (result.content ?? []) as McpToolResult["content"],
      isError: result.isError as boolean | undefined,
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close().catch(() => undefined);
      this.client = null;
    }
  }
}
