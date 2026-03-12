# RouteStack.ai — CLI Agent

A terminal-based travel search tool that connects to the RouteStack MCP server. Search flights, hotels, and cars from the command line.

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- An LLM API key (OpenAI or Anthropic)

## Quick Start

```bash
cp .env.example .env
# Add your API keys to .env
pnpm install
pnpm start
```

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint (default: `https://mcp.routestack.ai/sse`) |
| `OPENAI_API_KEY` | Yes* | OpenAI API key (*or use Anthropic) |
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key (*or use OpenAI) |

## How It Works

1. Connects to the RouteStack MCP server via SSE
2. You type a travel query in natural language
3. The LLM reasons about your request and calls MCP tools
4. Results are pretty-printed in your terminal

```
> Find flights from LAX to JFK on December 15

Found 5 flights:
┌──────────┬────────────┬──────────┬────────┐
│ Airline  │ Departure  │ Arrival  │ Price  │
├──────────┼────────────┼──────────┼────────┤
│ Delta    │ 8:00 AM    │ 4:30 PM  │ $189   │
│ United   │ 10:15 AM   │ 6:45 PM  │ $205   │
└──────────┴────────────┴──────────┴────────┘
```

## Customization

- Switch LLM providers by changing the API key in `.env`
- Modify `src/formatter.ts` to customize terminal output
- Add new tool handlers in `src/mcp-client.ts`
