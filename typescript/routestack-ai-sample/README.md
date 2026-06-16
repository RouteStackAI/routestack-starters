# RouteStack AI Sample

A React + Vite application using the Vercel AI SDK (`useChat`) wired to RouteStack MCP tools, with [Streamdown](https://streamdown.ai) for streaming markdown in the chat UI.

## Prerequisites

- Node.js >= 20
- pnpm (recommended)
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- A Mistral API key

## Quick Start

```bash
cd typescript/routestack-ai-sample
cp .env.example .env
# Add your API keys to .env
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` to the Node API on port `3001`.

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_API_SECRET` | No | HMAC secret for partner token auth |
| `ROUTESTACK_MCP_URL` | No | MCP server endpoint |
| `MISTRAL_API_KEY` | Yes | Mistral API key |
| `MISTRAL_MODEL` | No | Mistral model (default: `mistral-small-latest`) |
| `PORT` | No | API server port (default: `3001`) |

## How It Works

1. **Client** — React chat UI with `useChat` and Streamdown for assistant markdown (handles incomplete tokens while streaming).
2. **API** — Hono server at `src/server.ts` exposes `POST /api/chat`.
3. **MCP** — Server connects to RouteStack MCP and registers tools for the LLM.
4. **LLM** — Mistral streams tool calls and final answers back to the browser.

```
You: "Find me flights from SFO to London next Friday"
→ AI SDK calls RouteStack MCP flight_search
→ Markdown tables and cards stream into the chat via Streamdown
```

## Scripts

| Script | Description |
|:-------|:------------|
| `pnpm dev` | API server + Vite dev client |
| `pnpm dev:client` | Vite only |
| `pnpm dev:server` | API server only (watch mode) |
| `pnpm build` | Typecheck + production client build |
| `pnpm start` | Run API server |

## Customization

- Switch LLM providers in `src/server/chat.ts`
- Adjust Streamdown rendering in `src/components/chat-message.tsx`
- Extend tool handling in `src/server/chat.ts` and `src/lib/mcp-client.ts`
