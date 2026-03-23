import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { callTool, type McpTool, type McpToolResult } from "./mcp-client.js";

const SYSTEM_PROMPT = `You are a travel search assistant powered by RouteStack. You help users find flights, hotels, and car rentals using the available tools. Be concise and helpful. Format prices in USD when available.`;

const MAX_TOOL_ITERATIONS = 10;

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  response: string;
  messages: Message[];
}

export type OnToolCall = (name: string, args: Record<string, unknown>) => void;

export async function chat(
  messages: Message[],
  tools: McpTool[],
  onToolCall?: OnToolCall,
): Promise<ChatResult> {
  if (config.llm.provider === "anthropic") {
    return chatAnthropic(messages, tools, onToolCall);
  }
  return chatOpenAI(messages, tools, onToolCall);
}

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

function mcpToolsToOpenAI(
  tools: McpTool[],
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

async function chatOpenAI(
  messages: Message[],
  tools: McpTool[],
  onToolCall?: OnToolCall,
): Promise<ChatResult> {
  const openai = new OpenAI({ apiKey: config.llm.openai.apiKey });
  const openaiTools = mcpToolsToOpenAI(tools);

  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await openai.chat.completions.create({
      model: config.llm.openai.model,
      messages: openaiMessages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
    });

    const choice = response.choices[0];
    if (!choice) throw new Error("No response from OpenAI");

    const assistantMessage = choice.message;
    openaiMessages.push(assistantMessage);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const text = assistantMessage.content ?? "";
      return {
        response: text,
        messages: [...messages, { role: "assistant", content: text }],
      };
    }

    for (const toolCall of assistantMessage.tool_calls) {
      const name = toolCall.function.name;

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      } catch {
        openaiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: "Error: tool arguments were not valid JSON",
        });
        continue;
      }

      onToolCall?.(name, args);

      const result = await callTool(name, args);
      const resultText = extractTextFromResult(result);

      openaiMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: resultText,
      });
    }
  }

  return {
    response: "Reached maximum tool call iterations. Please try a simpler query.",
    messages: [...messages, { role: "assistant", content: "Reached maximum tool call iterations." }],
  };
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

function mcpToolsToAnthropic(tools: McpTool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));
}

async function chatAnthropic(
  messages: Message[],
  tools: McpTool[],
  onToolCall?: OnToolCall,
): Promise<ChatResult> {
  const anthropic = new Anthropic({ apiKey: config.llm.anthropic.apiKey });
  const anthropicTools = mcpToolsToAnthropic(tools);

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: config.llm.anthropic.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: anthropicMessages,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    });

    if (response.stop_reason === "end_turn" || response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      return {
        response: text,
        messages: [...messages, { role: "assistant", content: text }],
      };
    }

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    anthropicMessages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      const args = (block.input ?? {}) as Record<string, unknown>;
      onToolCall?.(block.name, args);

      const result = await callTool(block.name, args);
      const resultText = extractTextFromResult(result);

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: resultText,
      });
    }

    anthropicMessages.push({ role: "user", content: toolResults });
  }

  return {
    response: "Reached maximum tool call iterations. Please try a simpler query.",
    messages: [...messages, { role: "assistant", content: "Reached maximum tool call iterations." }],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTextFromResult(result: McpToolResult): string {
  if (result.isError) {
    return `Error: ${result.content.map((c) => c.text ?? JSON.stringify(c)).join("\n")}`;
  }
  return result.content
    .map((c) => (c.type === "text" && c.text ? c.text : JSON.stringify(c)))
    .join("\n");
}
