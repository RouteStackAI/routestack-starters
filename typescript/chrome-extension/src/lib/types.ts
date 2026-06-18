import type { ExtensionSettings } from "./config.js";

export interface PageContext {
  url: string;
  title: string;
  selection: string;
  description: string;
  headings: string[];
  travelHints: string[];
  textExcerpt: string;
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

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallTrace {
  name: string;
  args: Record<string, unknown>;
  summary: string;
}

export interface ResultItem {
  title: string;
  subtitle?: string;
  price?: string;
  meta?: string[];
  description?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  fareCode?: string;
  accent?: "hotel" | "flight" | "car" | "booking" | "info";
}

export interface ResultSection {
  title: string;
  kind: "hotel" | "flight" | "car" | "booking" | "info";
  items: ResultItem[];
}

export interface ChatResponsePayload {
  assistantMessage: string;
  resultSections: ResultSection[];
  toolCalls: ToolCallTrace[];
  pageContext: PageContext | null;
  settingsIssues: string[];
}

export type PanelRequest =
  | { type: "ROUTESTACK_BOOTSTRAP"; tabId: number }
  | { type: "ROUTESTACK_RESET"; tabId: number }
  | {
      type: "ROUTESTACK_CHAT";
      tabId: number;
      prompt: string;
      searchMode: "hotels" | "flights" | "cars";
    }
  | {
      type: "ROUTESTACK_SAVE_SETTINGS";
      settings: Partial<ExtensionSettings>;
    };

export type PanelResponse =
  | {
      ok: true;
      payload: ChatResponsePayload;
      settings: ExtensionSettings;
    }
  | {
      ok: false;
      error: string;
      settings?: ExtensionSettings;
    };
