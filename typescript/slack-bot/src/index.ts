import { connectMcp, disconnectMcp } from "./mcp-client.js";
import "./config.js";

async function main() {
  console.log("RouteStack Slack Bot");

  await connectMcp();

  // TODO: Initialize Slack Bolt app
  // TODO: Register slash command handlers (/flights, /hotels, /cars)
  // TODO: Start listening for events

  console.log("TODO: Slack Bolt integration");
}

main().catch(console.error);
