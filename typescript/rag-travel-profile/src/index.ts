import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import ora, { type Ora } from "ora";
import chalk from "chalk";
import { marked } from "marked";
import markedTerminal from "marked-terminal";

import { connectMcp, disconnectMcp } from "./mcp-client.js";
import { runTravelAgent, ToolExecutionContext } from "./agent/planner.js";

marked.setOptions({
  renderer: new (markedTerminal as any)({
    code: chalk.gray,
    blockquote: chalk.gray,
  }),
});

let activeSpinner: Ora | null = null;

function humanizeToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toolMessage(name: string): string {
  const toolMessages: Record<string, string> = {
    hotel_search_destinations: "Finding destinations...",
    hotel_search: "Searching hotels...",
    hotel_get_details: "Loading hotel details...",
    hotel_get_rooms_and_rates: "Fetching room availability...",
    hotel_revalidate_rate: "Revalidating selected room...",

    flight_session: "Starting flight session...",
    flight_locations: "Resolving airport locations...",
    flight_search: "Searching flights...",
    flight_revalidate: "Revalidating selected fare...",

    car_locations: "Resolving pickup/dropoff locations...",
    car_search: "Searching rental cars...",
    car_revalidate: "Revalidating selected vehicle...",
  };

  return toolMessages[name] ?? `Running ${humanizeToolName(name)}...`;
}

function startToolSpinner(name: string) {
  const message = toolMessage(name);

  if (!activeSpinner) {
    activeSpinner = ora({
      text: message,
      discardStdin: false,
    }).start();
    return;
  }

  activeSpinner.text = message;
}

function stopToolSpinner(success = true) {
  if (!activeSpinner) return;

  if (success) {
    activeSpinner.stop();
  } else {
    activeSpinner.fail();
  }

  activeSpinner = null;
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


function printBanner() {
  console.clear();

  const banner = `
██████╗  ██████╗ ██╗   ██╗████████╗███████╗███████╗████████╗ █████╗  ██████╗██╗  ██╗
██╔══██╗██╔═══██╗██║   ██║╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
██████╔╝██║   ██║██║   ██║   ██║   █████╗  ███████╗   ██║   ███████║██║     █████╔╝
██╔══██╗██║   ██║██║   ██║   ██║   ██╔══╝  ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
██║  ██║╚██████╔╝╚██████╔╝   ██║   ███████╗███████║   ██║   ██║  ██║╚██████╗██║  ██╗
╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   ╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
`;

  console.log(chalk.cyan(banner));
  console.log(chalk.bold.white("RouteStack AI RAG Travel Agent"));
  console.log(chalk.gray("RAG-powered travel planning with RouteStack MCP\n"));

  console.log(chalk.yellow("Examples:"));
  console.log(chalk.gray("  • Find me a flight from Mumbai to Chicago next week"));
  console.log(chalk.gray("  • Show me Marriott hotels in Dubai for 3 nights"));
  console.log(chalk.gray("  • Find me rental cars in Los Angeles next weekend"));
  console.log();

  console.log(
    chalk.gray("Type ") +
      chalk.bold("exit") +
      chalk.gray(" or ") +
      chalk.bold("quit") +
      chalk.gray(" to leave.\n"),
  );
}

function printUserMessage(message: string) {
  console.log(chalk.blue.bold("\nYou"));
  console.log(chalk.blue("─".repeat(60)));
  console.log(message.trim());
}

function printAssistantMessage(message: string) {
  console.log(chalk.green.bold("\nRouteStack Assistant"));
  console.log(chalk.green("─".repeat(60)));

  const rendered = String(marked.parse(message)).trim();
  console.log(rendered);
  console.log();
}

function printError(err: unknown) {
  const message =
    err instanceof Error ? err.message : String(err);

  console.log(chalk.red.bold("\nError"));
  console.log(chalk.red("─".repeat(60)));
  console.log(chalk.red(message));
  console.log();
}

function buildPrompt() {
  return chalk.cyan("routestack") + chalk.gray(" > ");
}

async function main() {
  await connectMcp();

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

  const history: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [];

  const context: ToolExecutionContext = {
    hotel: {},
    flight: {},
    car: {},
  };

  printBanner();

  while (true) {
    let userInput: string;

    try {
      userInput = await rl.question(buildPrompt());
    } catch (err: any) {
      if (err?.code === "ABORT_ERR") {
        await shutdown();
        return;
      }

      throw err;
    }

    const trimmed = userInput.trim();

    if (!trimmed) {
      continue;
    }

    if (
      trimmed.toLowerCase() === "exit" ||
      trimmed.toLowerCase() === "quit"
    ) {
      break;
    }

    printUserMessage(trimmed);

    history.push({
      role: "user",
      content: trimmed,
    });

    try {
      const answer = await runTravelAgent(
        trimmed,
        history,
        context,
        (toolName, args) => {
          // stopToolSpinner();
          // printTool(toolName, args);
          startToolSpinner(toolName);
        },
      );

      stopToolSpinner(true);

      printAssistantMessage(answer);

      history.push({
        role: "assistant",
        content: answer,
      });
    } catch (err) {
      stopToolSpinner(false);
      printError(err);
    }
  }

  await shutdown();
}

main().catch(async (err) => {
  if ((err as any)?.code === "ABORT_ERR") {
    console.log(chalk.gray("\nGoodbye.\n"));
    process.exit(0);
  }

  printError(err);
  await disconnectMcp();
  process.exit(1);
});