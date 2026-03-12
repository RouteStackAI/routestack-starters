import { createInterface } from "node:readline";
import { connectMcp, disconnectMcp } from "./mcp-client.js";
import "./config.js";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "routestack (local)> ",
});

async function main() {
  console.log("RouteStack + Ollama (Local LLM)");
  console.log("Your prompts stay local. Only tool calls reach RouteStack.\n");

  await connectMcp();

  // TODO: Connect to local Ollama instance
  // TODO: Register MCP tools with Ollama model

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

    // TODO: Send to Ollama → parse tool calls → bridge to MCP → return results
    console.log(`\nProcessing locally: "${input}"...\n`);
    console.log("TODO: Ollama bridge + MCP tool calls\n");

    rl.prompt();
  });
}

main().catch(console.error);
