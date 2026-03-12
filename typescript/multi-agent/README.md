# RouteStack.ai — Multi-Agent Trip Planner

A multi-agent orchestrator that coordinates flights, hotels, and cars into a complete trip plan using the Claude Agent SDK and RouteStack MCP tools.

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- An Anthropic API key

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
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |

## How It Works

```
You: "Plan a trip from NYC to Tokyo, Dec 15-22, 2 adults"

Planner Agent
  ├── Flight Agent → searches flights via RouteStack MCP
  ├── Hotel Agent  → searches hotels via RouteStack MCP
  └── Car Agent    → searches car rentals via RouteStack MCP

Result: Unified trip summary with options and total costs
```

1. The **Planner Agent** receives your request and delegates to sub-agents
2. Each sub-agent calls RouteStack MCP tools for its domain
3. The Planner compiles results into a unified trip summary

## Customization

- Swap Claude Agent SDK for LangChain or CrewAI in `src/agents/`
- Add budget constraints in `src/agents/planner-agent.ts`
- Extend with activity/restaurant agents
