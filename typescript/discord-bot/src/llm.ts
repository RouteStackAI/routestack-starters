import OpenAI from "openai";
import { config } from "./config.js";

export async function summarizeTravelOptions(input: {
  category: "hotels" | "flights" | "cars";
  userRequest: string;
  items: Array<Record<string, unknown>>;
}): Promise<string | null> {
  if (!config.llm.openaiApiKey || input.items.length === 0) {
    return null;
  }

  const client = new OpenAI({ apiKey: config.llm.openaiApiKey });
  const response = await client.chat.completions.create({
    model: config.llm.openaiModel,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are a concise travel booking assistant. Summarize the strongest options in 2 short bullet-style sentences with no markdown bullets.",
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || null;
}
