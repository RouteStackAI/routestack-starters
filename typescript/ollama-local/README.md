# RouteStack.ai — Ollama Local

Connect a local LLM (Llama 3, Mistral, Phi) running via Ollama to the remote RouteStack MCP server. Your prompts stay local — only structured tool calls leave your machine.

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- [Ollama](https://ollama.ai) installed with a model pulled

## Quick Start

```bash
# Install and start Ollama (if not already running)
ollama pull llama3.1
ollama serve

# In another terminal:
cp .env.example .env
# Add your RouteStack API key to .env
pnpm install
pnpm start
```

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint |
| `OLLAMA_MODEL` | No | Model name (default: `llama3.1`) |
| `OLLAMA_BASE_URL` | No | Ollama server URL (default: `http://localhost:11434`) |

## How It Works

```
┌─────────────────────┐     Tool Calls     ┌──────────────────────┐
│   Local Machine      │ ──────────────────→ │  RouteStack MCP      │
│                      │                     │  (Remote SSE)        │
│  ┌───────────────┐  │     Results         │                      │
│  │ Ollama        │  │ ←────────────────── │  search_flights()    │
│  │ (Llama 3.1)   │  │                     │  search_hotels()     │
│  └───────────────┘  │                     │  search_cars()       │
└─────────────────────┘                     └──────────────────────┘
```

- Your prompts never leave your machine
- Only structured tool calls (origin, destination, dates) are sent to RouteStack
- No conversation data, no user profiles, no tracking

## Recommended Models

| Model | Size | Tool Calling Support |
|:------|:-----|:---------------------|
| Llama 3.1 8B | 4.7 GB | Good |
| Mistral 7B | 4.1 GB | Good |
| Phi-3 Mini | 2.3 GB | Basic |

## Customization

- Change models by setting `OLLAMA_MODEL` in `.env`
- Modify tool parsing in `src/tool-parser.ts`
