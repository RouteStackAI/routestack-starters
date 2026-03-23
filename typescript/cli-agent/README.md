# RouteStack.ai — CLI Agent

A terminal-based travel search tool that connects to the RouteStack MCP server. Search flights, hotels, and cars from the command line using natural language.

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
| :--------- | :--------- | :------------ |
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | No | MCP server endpoint (default: `https://mcp.routestack.ai/sse`) |
| `LLM_PROVIDER` | No | `openai` (default) or `anthropic` |
| `OPENAI_API_KEY` | If using OpenAI | OpenAI API key |
| `OPENAI_MODEL` | No | OpenAI model (default: `gpt-4o`) |
| `ANTHROPIC_API_KEY` | If using Anthropic | Anthropic API key |
| `ANTHROPIC_MODEL` | No | Anthropic model (default: `claude-sonnet-4-5-latest`) |

## How It Works

1. Connects to the RouteStack MCP server via SSE
2. Discovers available travel tools (flights, hotels, cars)
3. You type a travel query in natural language
4. The LLM reasons about your request and calls MCP tools
5. Results are displayed in your terminal

```bash
RouteStack CLI Agent

LLM: openai (gpt-4o)
MCP: https://mcp.routestack.ai/sse

Connected to https://mcp.routestack.ai/sse — 3 tools available
Tools: search_flights, search_hotels, search_cars

Type a travel query (e.g., "Find flights from LAX to JFK on Dec 15")
Type "exit" to quit.

routestack> Find flights from LAX to JFK on December 15
  -> search_flights(origin=LAX, destination=JFK, date=2026-12-15)

I found 5 flights from LAX to JFK on December 15:

- Delta DL402: Departs 8:00 AM, arrives 4:30 PM — $189
- United UA1522: Departs 10:15 AM, arrives 6:45 PM — $205
- JetBlue B6116: Departs 12:30 PM, arrives 9:00 PM — $172
- American AA178: Departs 2:00 PM, arrives 10:15 PM — $195
- Delta DL918: Departs 6:00 PM, arrives 2:15 AM+1 — $165

The cheapest option is Delta DL918 at $165 (evening departure).

routestack> What about hotels near Times Square?
  -> search_hotels(location=Times Square, New York, check_in=2026-12-15)

Here are hotels near Times Square:

- Marriott Marquis: $245/night ★★★★
- Hilton Times Square: $220/night ★★★★
- Pod Times Square: $129/night ★★★

routestack> exit

Disconnecting...
Goodbye.
```

## Commands

| Command | Description |
| :-------- | :------------ |
| `tools` | List all available MCP tools |
| `clear` | Clear conversation history |
| `exit` | Disconnect and quit |

## Switching LLM Providers

Edit your `.env` file to switch between OpenAI and Anthropic:

```bash
# Use OpenAI (default)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Use Anthropic
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

## Customization

- **System prompt** — Edit `SYSTEM_PROMPT` in `src/llm.ts` to change the agent's behavior
- **Terminal formatting** — Modify `src/formatter.ts` to customize output styles
- **Tool handling** — Add custom logic in `src/mcp-client.ts` for specific tool responses
- **Max iterations** — Adjust `MAX_TOOL_ITERATIONS` in `src/llm.ts` (default: 10)

## Troubleshooting

**"ROUTESTACK_API_KEY is required"**
Copy `.env.example` to `.env` and add your RouteStack API key.

**"OPENAI_API_KEY is required"**
Add your OpenAI key to `.env`, or switch to Anthropic by setting `LLM_PROVIDER=anthropic`.

**Connection timeout**
The MCP server may be unreachable. Check `ROUTESTACK_MCP_URL` in your `.env` file and verify the server is running.

**"No tools available"**
The MCP server connected but has no tools registered. Contact your RouteStack admin.
