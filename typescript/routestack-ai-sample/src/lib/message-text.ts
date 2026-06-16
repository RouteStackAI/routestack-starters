import type { Message } from "ai";

export function getMessageText(message: Message): string {
  if (message.role !== "assistant") {
    return typeof message.content === "string" ? message.content : "";
  }

  if (typeof message.content === "string" && message.content) {
    return message.content;
  }

  const parts = message.parts;
  if (!parts?.length) return "";

  return parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}
