# RouteStack.ai — Next.js AI MCP

A Next.js App Router application using the Vercel AI SDK (`useChat`) wired to RouteStack MCP tools. The industry-standard stack for building AI web apps.

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- An LLM API key (Mistral)

## Quick Start

```bash
cd typescript/nextjs-ai-mcp
cp .env.example .env
# Add your API keys to .env
pnpm install
pnpm dev
```

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | No | MCP server endpoint (defaults to `https://mcp.routestack.ai/sse`) |
| `MISTRAL_API_KEY` | Yes* | Mistral API key (*or use OpenAI) |
| `MISTRAL_MODEL` | No | Mistral LLM model (defaults to `mistral-small-latest`) |

## How It Works

1. Chat UI powered by Vercel AI SDK's `useChat` hook
2. Server-side API route connects to RouteStack MCP
3. LLM calls MCP tools to search flights, hotels, cars
4. Results stream back as rich cards in the chat

```
You: "Find me flights from SFO to London next Friday"
→ AI SDK calls RouteStack MCP search_flights tool
→ Flight cards stream into the chat UI
```

## Customization

- Switch LLM providers in `src/app/api/chat/route.ts`
- Add result card components in `src/components/`
- Deploy to Vercel with zero config
