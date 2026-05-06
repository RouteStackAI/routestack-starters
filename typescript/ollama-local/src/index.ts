import { createInterface } from "node:readline";
import { config } from "./config.js";
import { connectMcp, disconnectMcp, listTools } from "./mcp-client.js";
import {
  chatTurn,
  type ChatMessage,
  type ToolExecutionContext,
} from "./ollama-bridge.js";

async function main(): Promise<void> {
  console.log("\nRouteStack Ollama Local\n");
  console.log(`Ollama: ${config.ollama.model} @ ${config.ollama.baseUrl}`);
  console.log(`MCP: ${config.routestack.mcpUrl}\n`);

  console.log("Connecting to RouteStack MCP...");
  await connectMcp();
  const tools = await listTools();
  console.log(`Connected. Loaded ${tools.length} tool(s).\n`);

  if (tools.length > 0) {
    console.log(`Tools: ${tools.map((tool) => tool.name).join(", ")}\n`);
  }

  console.log('Enter a travel request. Commands: "tools", "clear", "exit".\n');

  const history: ChatMessage[] = [];
  const context: ToolExecutionContext = { hotel: {}, flight: {} };
  let busy = false;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "routestack (local)> ",
  });

  const shutdown = async () => {
    console.log("\nDisconnecting...");
    await disconnectMcp();
    console.log("Goodbye.\n");
    process.exit(0);
  };

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input === "exit" || input === "quit") {
      await shutdown();
      return;
    }

    if (input === "tools") {
      for (const tool of tools) {
        console.log(`- ${tool.name}: ${tool.description || "No description"}`);
      }
      console.log();
      rl.prompt();
      return;
    }

    if (input === "clear") {
      history.length = 0;
      context.hotel = {};
      context.flight = {};
      console.log("Conversation cleared.\n");
      rl.prompt();
      return;
    }

    if (busy) {
      console.log("Still processing the previous request.\n");
      rl.prompt();
      return;
    }

    busy = true;

    try {
      const result = await chatTurn(history, input, tools, context, (name, args) => {
        console.log(`[tool] ${name} ${JSON.stringify(args)}`);
      });

      history.length = 0;
      history.push(...result.messages);

      console.log(`\n${result.response}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nError: ${message}\n`);
    } finally {
      busy = false;
      rl.prompt();
    }
  });

  rl.on("close", shutdown);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal: ${message}`);
  await disconnectMcp().catch(() => {});
  process.exit(1);
});
