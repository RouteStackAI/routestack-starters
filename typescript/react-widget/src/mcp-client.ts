export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

let apiBaseUrl = "";

function apiPath(path: string) {
  return `${apiBaseUrl}${path}`;
}

export function setApiBaseUrl(baseUrl?: string) {
  apiBaseUrl = (baseUrl ?? "").replace(/\/$/, "");
}

export async function connectMcp(): Promise<void> {
  const response = await fetch(apiPath("/api/health"));
  if (!response.ok) {
    throw new Error(`Widget backend is unavailable (${response.status}).`);
  }
}

export async function listTools(): Promise<McpTool[]> {
  const response = await fetch(apiPath("/api/tools"));
  if (!response.ok) {
    throw new Error(`Failed to load tools (${response.status}).`);
  }

  const payload = (await response.json()) as { tools?: McpTool[] };
  return payload.tools ?? [];
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  const response = await fetch(apiPath("/api/tool"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ name, args }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Tool request failed (${response.status}).`);
  }

  return (await response.json()) as McpToolResult;
}

export async function disconnectMcp(): Promise<void> {
  return Promise.resolve();
}

export function getTransportKind() {
  return "server-bridge";
}
