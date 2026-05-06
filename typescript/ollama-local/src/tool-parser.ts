import { config } from "./config.js";
import type { McpTool, McpToolResult } from "./mcp-client.js";

export function validateToolArgs(
  tool: McpTool,
  args: Record<string, unknown>,
): void {
  const required = Array.isArray(tool.inputSchema.required)
    ? tool.inputSchema.required.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  for (const field of required) {
    const value = args[field];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing required field "${field}" for tool "${tool.name}"`);
    }
  }
}

export function normalizeToolArgs(
  value: unknown,
  schema?: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = parseArgs(value);
  const properties = isRecord(schema?.properties) ? schema.properties : {};

  return Object.fromEntries(
    Object.entries(parsed).map(([key, item]) => {
      const propertySchema = isRecord(properties[key]) ? properties[key] : undefined;
      return [key, coerceValue(item, propertySchema)];
    }),
  );
}

export function sanitizeToolSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {
    type: typeof schema.type === "string" ? schema.type : "object",
  };

  if (Array.isArray(schema.required)) {
    sanitized.required = schema.required.filter(
      (value): value is string => typeof value === "string",
    );
  }

  if (isRecord(schema.properties)) {
    const properties: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema.properties)) {
      if (!isRecord(value)) continue;

      const property: Record<string, unknown> = {};
      if (typeof value.type === "string") property.type = value.type;
      if (typeof value.description === "string") property.description = value.description;
      if (Array.isArray(value.enum) && value.enum.length <= 20) property.enum = value.enum;

      if (isRecord(value.items)) {
        property.items = sanitizeToolSchema(value.items);
      }

      if (isRecord(value.properties)) {
        property.properties = sanitizeNestedProperties(value.properties);
      }

      properties[key] = property;
    }

    sanitized.properties = properties;
  }

  return sanitized;
}

export function summarizeTools(tools: McpTool[]): string {
  return tools
    .map((tool) => `- ${tool.name}`)
    .join("\n");
}

export function formatToolResultForModel(result: McpToolResult): string {
  if (result.isError) {
    return truncateText(`Error: ${JSON.stringify(result.content)}`);
  }

  const textParts = result.content
    .map((item) => {
      if (typeof item.text === "string" && item.text.trim()) {
        const trimmed = item.text.trim();
        try {
          return JSON.stringify(JSON.parse(trimmed));
        } catch {
          return trimmed;
        }
      }

      return JSON.stringify(item);
    })
    .filter(Boolean);

  if (textParts.length === 0) {
    return "Tool returned no content.";
  }

  return truncateText(textParts.join("\n"));
}

function truncateText(value: string): string {
  if (value.length <= config.ollama.maxToolResultChars) return value;
  return `${value.slice(0, config.ollama.maxToolResultChars)}\n...[truncated]`;
}

function parseArgs(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

function coerceValue(value: unknown, schema?: Record<string, unknown>): unknown {
  const type = typeof schema?.type === "string" ? schema.type : undefined;
  const schemaItems = isRecord(schema?.items) ? schema.items : undefined;
  const schemaProperties = isRecord(schema?.properties) ? schema.properties : undefined;

  if (type === "number" || type === "integer") {
    if (typeof value === "number") {
      return type === "integer" ? Math.trunc(value) : value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return type === "integer" ? Math.trunc(parsed) : parsed;
      }
    }
  }

  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }

  if (type === "array" && Array.isArray(value) && schemaItems) {
    return value.map((item) => coerceValue(item, schemaItems));
  }

  if (type === "object" && isRecord(value) && schemaProperties) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        const propertyValue = schemaProperties[key];
        const childSchema = isRecord(propertyValue) ? propertyValue : undefined;
        return [key, coerceValue(item, childSchema)];
      }),
    );
  }

  return value;
}

function sanitizeNestedProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!isRecord(value)) continue;

    sanitized[key] = {
      ...(typeof value.type === "string" ? { type: value.type } : {}),
      ...(typeof value.description === "string"
        ? { description: value.description }
        : {}),
    };
  }

  return sanitized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
