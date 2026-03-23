import { createInterface } from "node:readline";
import chalk from "chalk";
import { config } from "./config.js";
import { connectMcp, listTools, disconnectMcp } from "./mcp-client.js";
import { chat, type Message } from "./llm.js";
import {
  formatToolCall,
  formatAssistant,
  formatError,
  formatConnected,
} from "./formatter.js";

async function main() {
  console.log(chalk.bold("\nRouteStack CLI Agent\n"));
  console.log(
    chalk.dim(
      `LLM: ${config.llm.provider} (${config.llm.provider === "openai" ? config.llm.openai.model : config.llm.anthropic.model})`,
    ),
  );
  console.log(chalk.dim(`MCP: ${config.routestack.mcpUrl}\n`));

  console.log("Connecting...");
  await connectMcp();
  const tools = await listTools();
  console.log(formatConnected(tools.length, config.routestack.mcpUrl));

  if (tools.length > 0) {
    console.log(
      chalk.dim(
        `Tools: ${tools.map((t) => t.name).join(", ")}`,
      ),
    );
  }

  console.log(
    '\nType a travel query (e.g., "Find flights from LAX to JFK on Dec 15")',
  );
  console.log('Type "exit" to quit.\n');

  const messages: Message[] = [];
  let busy = false;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "routestack> ",
  });

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
      console.log(
        chalk.dim(
          tools
            .map((t) => `  ${chalk.white(t.name)} — ${t.description}`)
            .join("\n"),
        ),
      );
      console.log();
      rl.prompt();
      return;
    }

    if (input === "clear") {
      messages.length = 0;
      console.log(chalk.dim("Conversation cleared.\n"));
      rl.prompt();
      return;
    }

    if (busy) {
      console.log(chalk.dim("Processing previous query, please wait...\n"));
      return;
    }

    busy = true;
    messages.push({ role: "user", content: input });

    try {
      const result = await chat(messages, tools, (name, args) => {
        console.log(formatToolCall(name, args));
      });

      messages.length = 0;
      messages.push(...result.messages);

      console.log("\n" + formatAssistant(result.response) + "\n");
    } catch (err) {
      console.log(
        formatError(err instanceof Error ? err.message : String(err)) + "\n",
      );
    } finally {
      busy = false;
      rl.prompt();
    }
  });

  rl.on("close", shutdown);

  async function shutdown() {
    console.log(chalk.dim("\nDisconnecting..."));
    await disconnectMcp();
    console.log(chalk.dim("Goodbye.\n"));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(chalk.red(`Fatal: ${err instanceof Error ? err.message : err}`));
  process.exit(1);
});
