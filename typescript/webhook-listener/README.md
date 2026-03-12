# RouteStack.ai — Webhook Listener

A lightweight server that subscribes to RouteStack booking events via SSE and forwards them to any endpoint (Slack, email, webhook URL, database).

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- A webhook endpoint to forward events to

## Quick Start

```bash
cp .env.example .env
# Add your API key and forwarding URL to .env
pnpm install
pnpm start
```

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint |
| `FORWARD_URL` | Yes | URL to forward events to |

## Supported Events

| Event | Description |
|:------|:------------|
| `booking.confirmed` | A booking was successfully completed |
| `booking.cancelled` | A booking was cancelled |
| `price.changed` | A tracked route's price changed |

## How It Works

1. Connects to RouteStack's SSE endpoint
2. Listens for booking and price events
3. Forwards event payloads to your configured webhook URL
4. Retries failed forwards with exponential backoff

## Customization

- Add event handlers in `src/handlers/`
- Modify forwarding logic in `src/forwarder.ts`
- Filter events by type or booking details
