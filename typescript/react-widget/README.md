# RouteStack.ai - React Widget

A working React sample for RouteStack travel search. The UI runs in Vite, and a small local Node bridge connects to the RouteStack MCP server so browser code never imports the MCP SDK directly.

## What This Sample Includes

- A reusable `<TravelSearch />` React component
- A Vite demo page in `src/main.tsx`
- A local Node API bridge for RouteStack MCP
- RouteStack MCP connection logic with `StreamableHTTP` and SSE fallback
- Flexible tool argument mapping for `search_flights`, `hotel_search`, and `search_cars`
- Result cards for flights, hotels, and cars

## Prerequisites

- Node.js >= 20
- A RouteStack API key

## Quick Start

```bash
cd typescript/react-widget
cp .env.example .env
# Add your RouteStack API key
pnpm install
pnpm dev
```

Open the local Vite URL shown in the terminal. If `5173` is busy, Vite will choose the next port.

## Configuration

| Variable | Required | Description |
| :--- | :--- | :--- |
| `ROUTESTACK_API_KEY` | Yes | RouteStack API key used by the local Node bridge |
| `ROUTESTACK_API_SECRET` | Recommended | RouteStack API secret for partner-token auth |
| `ROUTESTACK_MCP_URL` | No | MCP server URL, defaults to `https://mcp.routestack.ai/sse` |
| `PORT` | No | Local API bridge port, defaults to `3001` |
| `VITE_API_BASE_URL` | No | Override frontend API base URL if the bridge runs elsewhere |

## Usage

```tsx
import { TravelSearch } from "./src";

export function App() {
  return (
    <TravelSearch
      apiBaseUrl="http://127.0.0.1:3001"
      onResult={(result) => {
        console.log("Travel results", result);
      }}
    />
  );
}
```

## How It Works

1. The frontend calls the local `/api` bridge.
2. The Node bridge connects to RouteStack MCP and lists the available tools.
3. Users choose `All`, `Flights`, `Hotels`, or `Cars`.
4. The widget maps form inputs onto each MCP tool's schema.
5. Tool responses are normalized into flight, hotel, and car cards.

## Files To Start With

- `src/TravelSearch.tsx` - widget logic and result normalization
- `src/mcp-client.ts` - browser client for the local API bridge
- `src/server.ts` - Node bridge to RouteStack MCP
- `src/components/` - search form and result cards
- `src/main.tsx` - demo app entry

## Notes

- The MCP connection pattern on the Node side follows `typescript/chat-agent/src/mcp-client.ts`.
- This browser-safe structure is also the recommended production shape for embedded widgets.
