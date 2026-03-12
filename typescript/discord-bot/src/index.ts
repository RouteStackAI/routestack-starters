import { connectMcp, disconnectMcp } from "./mcp-client.js";
import "./config.js";

async function main() {
  console.log("RouteStack Discord Bot");

  await connectMcp();

  // TODO: Initialize Discord.js client
  // TODO: Register slash command handlers (/flights, /hotels, /cars)
  // TODO: Login and start listening for events

  console.log("TODO: Discord.js integration");
}

main().catch(console.error);
