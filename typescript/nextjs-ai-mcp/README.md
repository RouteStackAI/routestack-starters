# RouteStack.ai — Next.js AI MCP

A Next.js App Router application using the Vercel AI SDK (`useChat`) wired to RouteStack MCP tools. The industry-standard stack for building AI web apps.

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- An LLM API key (OpenAI or Anthropic)

## Quick Start

```bash
cp .env.example .env
# Add your API keys to .env
pnpm install
pnpm dev
```

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint |
| `OPENAI_API_KEY` | Yes* | OpenAI API key (*or use Anthropic) |
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key (*or use OpenAI) |

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
