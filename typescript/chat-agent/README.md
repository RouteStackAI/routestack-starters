# RouteStack.ai — Chat Agent

A browser-based chat UI where users type natural language travel queries and an AI agent responds using RouteStack MCP tools.

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

1. Opens a chat interface in your browser
2. You type a travel query in natural language
3. The AI agent calls RouteStack MCP tools (flights, hotels, cars)
4. Results render as rich cards in the chat

## Customization

- Modify `src/ui/` to customize the chat interface
- Switch LLM providers by changing the API key in `.env`
- Add new result card types in `src/ui/`
