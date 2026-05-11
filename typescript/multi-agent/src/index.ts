import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import chalk from "chalk";
import ora from "ora";

import { marked } from "marked";
import markedTerminal from "marked-terminal";

import { connectMcp, disconnectMcp, listTools } from "./mcp-client.js";
import { chat, type Message } from "./llm.js";
import type { ToolExecutionContext } from "./types.js";

function printBanner() {
  console.clear();

  console.log(
    chalk.cyanBright(`
╔══════════════════════════════════════════════╗
║           RouteStack Trip Planner            ║
╚══════════════════════════════════════════════╝
`),
  );

  console.log(chalk.gray("Natural language travel planning"));
  console.log(
    chalk.gray(
      'Example: "Plan a trip from Mumbai to Tokyo from 2026-06-10 to 2026-06-16 for 2 adults"\n',
    ),
  );
}

function printUser(text: string) {
  console.log(chalk.blueBright("You"));
  console.log(chalk.white(text));
  console.log();
}

function printAssistant(text: string) {
  console.log(chalk.greenBright("Assistant"));
  console.log(String(marked.parse(text)).trim());
  console.log();
}

function printTool(name: string, args: Record<string, unknown>) {
  console.log(chalk.yellow(`  ↳ tool: ${name}`));

  const formatted = JSON.stringify(args, null, 2)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

  console.log(chalk.gray(formatted));
  console.log();
}

marked.setOptions({
  renderer: new (markedTerminal as any)({
    code: chalk.gray,
    blockquote: chalk.gray,
  }),
});

async function main() {
  await connectMcp();

  const tools = await listTools();

  const rl = readline.createInterface({
    input,
    output,
  });

  let shuttingDown = false;

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    rl.close();
    await disconnectMcp();

    console.log(chalk.gray("\nGoodbye.\n"));
    process.exit(0);
  }

  process.on("SIGINT", async () => {
    await shutdown();
  });

  const messages: Message[] = [];

  const context: ToolExecutionContext = {
    hotel: {},
    flight: {},
    car: {}
  };

  printBanner();

  while (true) {
    let userInput: string;

    try {
      userInput = await rl.question(chalk.blue("> "));
    } catch (err: any) {
      if (err?.code === "ABORT_ERR") {
        await shutdown();
        return;
      }

      throw err;
    }

    if (!userInput.trim()) {
      continue;
    }

    if (
      userInput.toLowerCase() === "exit" ||
      userInput.toLowerCase() === "quit"
    ) {
      break;
    }

    messages.push({
      role: "user",
      content: userInput,
    });

    printUser(userInput);

    const spinner = ora({
      text: "Thinking...",
      discardStdin: false,
    }).start();

    try {
      const result = await chat(messages, tools, context, (toolName, args) => {
        spinner.stop();
        printTool(toolName, args);
        spinner.start("Working...");
      });

      spinner.stop();

      printAssistant(result.response);

      messages.push({
        role: "assistant",
        content: result.response,
      });
    } catch (err) {
      spinner.stop();

      console.log(chalk.redBright("Error"));
      console.log(chalk.red(err instanceof Error ? err.message : String(err)));
      console.log();
    }
  }

  rl.close();
  await disconnectMcp();

  console.log(chalk.gray("\nGoodbye.\n"));
}

main().catch(async (err: any) => {
  if (err?.code === "ABORT_ERR") {
    console.log(chalk.gray("\nGoodbye.\n"));
    process.exit(0);
  }

  console.error(err);
  await disconnectMcp();
  process.exit(1);
});
