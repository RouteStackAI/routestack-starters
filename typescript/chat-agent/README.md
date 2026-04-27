# RouteStack.ai — Chat Agent

A browser-based chat UI where users type natural language travel queries and an AI agent responds using RouteStack MCP tools. Built with Hono and vanilla HTML/CSS/JS.

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
# Open http://localhost:3000
```

## Configuration

| Variable | Required | Description |
| :--- | :--- | :--- |
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | No | MCP server endpoint (default: `https://mcp.routestack.ai/sse`) |
| `LLM_PROVIDER` | No | `openai` (default), `anthropic`, or `mistral` |
| `OPENAI_API_KEY` | If using OpenAI | OpenAI API key |
| `OPENAI_MODEL` | No | OpenAI model (default: `gpt-4o`) |
| `ANTHROPIC_API_KEY` | If using Anthropic | Anthropic API key |
| `ANTHROPIC_MODEL` | No | Anthropic model (default: `claude-sonnet-4-5-latest`) |
| `MISTRAL_API_KEY` | If using Mistral | Mistral API key |
| `MISTRAL_MODEL` | No | Mistral model (default: `mistral-large-latest`) |
| `MISTRAL_BASE_URL` | No | Mistral API base URL (default: `https://api.mistral.ai/v1`) |
| `PORT` | No | Server port (default: `3000`) |

## Architecture

```text
Browser (public/index.html)
  ↕ POST /api/chat
Hono Server (src/server.ts)
  ├── config.ts      — Environment config + validation
  ├── mcp-client.ts  — MCP SDK connection (StreamableHTTP + SSE fallback)
  └── llm.ts         — LLM abstraction (OpenAI + Anthropic, tool-calling loop)
        ↕
RouteStack MCP Server (remote)
```

The server is stateless — conversation history lives in the browser and is sent with each request.

## How It Works

1. Server connects to RouteStack MCP and discovers available tools
2. Browser loads the chat UI and checks `/health` for connection status
3. You type a travel query in natural language
4. The LLM reasons about your request and calls MCP tools
5. Tool calls and the final response are displayed in the chat

## API Endpoints

**POST /api/chat** — Send a message and get a response

```json
// Request
{ "message": "Find flights from LAX to JFK", "history": [] }

// Response
{
  "response": "I found 3 flights from LAX to JFK...",
  "history": [
    { "role": "user", "content": "Find flights from LAX to JFK" },
    { "role": "assistant", "content": "I found 3 flights..." }
  ],
  "toolCalls": [
    { "name": "search_flights", "args": { "origin": "LAX", "destination": "JFK" } }
  ]
}
```

**GET /health** — Server status and tool count

```json
{ "status": "ok", "tools": 3, "provider": "openai" }
```

## Switching LLM Providers

Edit your `.env` file:

```bash
# Use OpenAI (default)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Use Anthropic
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Use Mistral
LLM_PROVIDER=mistral
MISTRAL_API_KEY=...
# MISTRAL_MODEL=mistral-large-latest
```

## Customization

- **Chat UI** — Edit `public/index.html` (self-contained HTML/CSS/JS, no build step)
- **System prompt** — Edit `SYSTEM_PROMPT` in `src/llm.ts`
- **Server routes** — Add endpoints in `src/server.ts` (Hono framework)
- **Tool handling** — Customize `src/mcp-client.ts` for specific tool responses

## Troubleshooting

**"Cannot reach server. Is it running?"**
The browser can't connect to the backend. Make sure `pnpm dev` is running.

**"ROUTESTACK_API_KEY is required"**
Copy `.env.example` to `.env` and add your RouteStack API key.

**Chat shows "Disconnected"**
The server started but failed to connect to the MCP server. Check `ROUTESTACK_MCP_URL` and server logs.

**Slow responses**
The LLM may be calling multiple tools in sequence. Check server logs for tool call activity (printed as `-> tool_name(...)`).
