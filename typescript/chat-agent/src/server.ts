import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import chalk from "chalk";
import { config } from "./config.js";
import {
  connectMcp,
  listTools,
  disconnectMcp,
  type McpTool,
} from "./mcp-client.js";
import { chat, type Message } from "./llm.js";

const app = new Hono();
let tools: McpTool[] = [];

// Health check
app.get("/health", (c) =>
  c.json({
    status: "ok",
    tools: tools.length,
    provider: config.llm.provider,
  }),
);

// Chat endpoint
app.post("/api/chat", async (c) => {
  try {
    const body = await c.req.json<{
      message: string;
      history: Message[];
    }>();

    const { message, history = [] } = body;

    if (!message || typeof message !== "string") {
      return c.json({ error: "message is required" }, 400);
    }

    if (message.length > 4000) {
      return c.json({ error: "Message too long (max 4000 characters)" }, 400);
    }

    // Sanitize history: only allow valid roles, cap length
    const safeHistory = (Array.isArray(history) ? history : [])
      .filter(
        (m): m is Message =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
      .slice(-20);

    const messages: Message[] = [
      ...safeHistory,
      { role: "user", content: message },
    ];

    const toolCalls: Array<{ name: string; args: Record<string, unknown> }> =
      [];

    const result = await chat(messages, tools, (name, args) => {
      toolCalls.push({ name, args });
      console.log(chalk.dim(`  -> ${name}(${JSON.stringify(args)})`));
    });

    return c.json({
      response: result.response,
      history: result.messages,
      toolCalls,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Chat error: ${errMsg}`));
    return c.json({ error: "An error occurred processing your request. Check server logs." }, 500);
  }
});

// Serve static files from public/
app.use("/*", serveStatic({ root: "./public" }));

// Startup
async function main() {
  console.log(chalk.bold("\nRouteStack Chat Agent\n"));
  console.log(
    chalk.dim(
      `LLM: ${config.llm.provider} (${config.llm.provider === "openai" ? config.llm.openai.model : config.llm.anthropic.model})`,
    ),
  );
  console.log(chalk.dim(`MCP: ${config.routestack.mcpUrl}\n`));

  console.log("Connecting to MCP server...");
  await connectMcp();
  tools = await listTools();
  console.log(
    chalk.green(
      `Connected — ${tools.length} tool${tools.length === 1 ? "" : "s"} available`,
    ),
  );

  if (tools.length > 0) {
    console.log(chalk.dim(`Tools: ${tools.map((t) => t.name).join(", ")}`));
  }

  serve({ fetch: app.fetch, port: config.port }, () => {
    console.log(
      chalk.bold(`\nChat UI: http://localhost:${config.port}\n`),
    );
  });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log(chalk.dim("\nShutting down..."));
  await disconnectMcp();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectMcp();
  process.exit(0);
});

main().catch((err) => {
  console.error(
    chalk.red(`Fatal: ${err instanceof Error ? err.message : err}`),
  );
  process.exit(1);
});
