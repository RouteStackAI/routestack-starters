import { createInterface } from "node:readline";
import { connectMcp, callTool, disconnectMcp } from "./mcp-client.js";
import "./config.js";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "routestack> ",
});

async function main() {
  console.log("RouteStack CLI Agent");
  console.log("Type a travel query (e.g., 'Find flights from LAX to JFK on Dec 15')");
  console.log("Type 'exit' to quit.\n");

  await connectMcp();

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (input === "exit" || input === "quit") {
      await disconnectMcp();
      rl.close();
      process.exit(0);
    }

    if (!input) {
      rl.prompt();
      return;
    }

    // TODO: Send input to LLM with MCP tools, display results
    console.log(`\nSearching: "${input}"...\n`);
    console.log("TODO: LLM integration + MCP tool calls\n");

    rl.prompt();
  });

  rl.on("close", async () => {
    await disconnectMcp();
    process.exit(0);
  });
}

main().catch(console.error);
