# RouteStack.ai — Webhook Listener

A lightweight event subscriber that connects to the RouteStack MCP server, listens for travel events (bookings, price changes), and forwards them to any webhook endpoint with retry logic.

No LLM required — this is pure event processing.

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
| :--- | :--- | :--- |
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_API_SECRET` | Yes | Your RouteStack API secret |
| `ROUTESTACK_MCP_URL` | No | MCP server endpoint (default: `https://mcp.routestack.ai/sse`) |
| `FORWARD_URL` | Yes | URL to forward events to (e.g., Slack webhook, API endpoint) |
| `EVENT_FILTER` | No | Comma-separated event types to listen for (default: all) |
| `MAX_RETRIES` | No | Max forwarding retry attempts (default: `3`) |
| `RETRY_DELAY_MS` | No | Base retry delay in ms, doubles each attempt (default: `1000`) |

## Architecture

```text
RouteStack MCP Server
  ↓ SSE notifications
MCP Client (mcp-client.ts)
  ↓ event routing
Event Router (index.ts)
  ↓ typed events
Handlers (handlers/*.ts)
  ↓ transformed payload
Forwarder (forwarder.ts)
  ↓ HTTP POST with retry
Your Webhook URL
```

## Supported Events

| Event | Handler | Description |
| :--- | :--- | :--- |
| `booking.confirmed` | `handlers/booking-confirmed.ts` | A booking was successfully completed |
| `booking.cancelled` | `handlers/booking-cancelled.ts` | A booking was cancelled |
| `price.changed` | `handlers/price-change.ts` | A tracked flight/hotel price changed |

Unknown event types are forwarded as-is without transformation.

## How It Works

1. Connects to RouteStack MCP server via SSE
2. Subscribes to server notifications
3. Routes events to typed handlers for transformation
4. Forwards transformed payloads to `FORWARD_URL` via HTTP POST
5. Retries failed forwards with exponential backoff (1s, 2s, 4s)

## Forwarded Payload Format

Each event is POSTed to your `FORWARD_URL` as JSON:

```json
{
  "event": "booking.confirmed",
  "data": {
    "type": "booking.confirmed",
    "bookingId": "BK-12345",
    "passenger": "John Doe",
    "origin": "LAX",
    "destination": "JFK",
    "date": "2026-12-15",
    "price": 189
  },
  "timestamp": "2026-03-23T14:30:00.000Z",
  "source": "routestack"
}
```

## Terminal Output

```bash
RouteStack Webhook Listener

MCP: https://mcp.routestack.ai/sse
Forward: https://your-webhook.com/events
Retries: 3 (1000ms base delay)
Filter: all events

Connected. Listening for events...

[2:30:15 PM] Event: booking.confirmed
  Forwarded (200, 1 attempt)
[2:31:02 PM] Event: price.changed
  Forwarded (200, 1 attempt)
[2:33:45 PM] Event: booking.cancelled
  Attempt 1/3 failed: HTTP 503
  Attempt 2/3 failed: HTTP 503
  Forwarded (200, 3 attempts)

^C
Shutting down...
Events: 3 received, 3 forwarded, 0 failed
Goodbye.
```

## Event Filtering

Only listen for specific events by setting `EVENT_FILTER`:

```bash
# Only booking events (skip price changes)
EVENT_FILTER=booking.confirmed,booking.cancelled

# Only price alerts
EVENT_FILTER=price.changed
```

## Testing Without Live Notifications

If your MCP server is connected but not pushing notifications yet, you can still test end-to-end:

### 1) Synthetic Dev Events

```bash
DEV_FAKE_EVENTS=true
DEV_FAKE_EVENTS_INTERVAL_MS=5000
```

This emits sample `booking.confirmed`, `booking.cancelled`, and `price.changed` events and forwards them to your `FORWARD_URL`.

### 2) Polling Fallback Mode

```bash
MCP_POLLING_FALLBACK=true
MCP_POLL_INTERVAL_MS=15000
MCP_POLL_TOOL_NAME=list_events
MCP_POLL_TOOL_ARGS={"limit":20}
MCP_POLL_RESULT_EVENTS_PATH=events
```

How polling mode works:

1. Connects to MCP and waits for real notifications
2. If none arrive within one poll interval, polling starts
3. Calls `MCP_POLL_TOOL_NAME` with `MCP_POLL_TOOL_ARGS`
4. Converts returned JSON into event objects
5. Forwards each event through normal handlers + retry pipeline

Notes:

- `MCP_POLL_TOOL_NAME` is optional. If omitted, the listener tries to auto-select a likely tool from `listTools()`.
- `MCP_POLL_RESULT_EVENTS_PATH` is optional. Use dot-path syntax (example: `data.events`) when your tool response wraps events under a nested field.

## Customization

- **Add event handlers** — Create a new file in `src/handlers/` and add a case to `routeEvent()` in `src/index.ts`
- **Change forwarding logic** — Edit `src/forwarder.ts` to add custom headers, auth tokens, or batch events
- **Filter events** — Return `null` from a handler to skip forwarding, or use `EVENT_FILTER` env var
- **Custom retry strategy** — Adjust `MAX_RETRIES` and `RETRY_DELAY_MS` in `.env`

## Troubleshooting

**"FORWARD_URL is required"**
Set `FORWARD_URL` in your `.env` file. Use any endpoint that accepts HTTP POST (e.g., `https://httpbin.org/post` for testing).

**"Connection timeout" or "fetch failed"**
The MCP server is unreachable. Check `ROUTESTACK_MCP_URL` and verify the server is running.

**Events received but forwarding fails**
Check that `FORWARD_URL` is accessible and accepts POST requests with `Content-Type: application/json`.

**No events appearing**
The MCP server may not be sending notifications yet. Check server logs to confirm events are being emitted.
