import { connectMcp, disconnectMcp } from "./mcp-client.js";
import "./config.js";

async function main() {
  console.log("RouteStack RAG Travel Profile Agent");

  await connectMcp();

  // TODO: Connect to vector DB (Pinecone/Chroma)
  // TODO: Retrieve user preferences for query context
  // TODO: Inject preferences into LLM system prompt
  // TODO: Search RouteStack MCP with preference-filtered context
  // TODO: Present personalized results

  console.log("TODO: Implement preference retrieval + filtered search");

  await disconnectMcp();
}

main().catch(console.error);
