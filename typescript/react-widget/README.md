# RouteStack.ai — React Widget

An embeddable React component (`<TravelSearch />`) that any web app can drop in to add travel search. Think "Stripe Elements but for travel."

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))

## Quick Start

```bash
cp .env.example .env
# Add your API key to .env
pnpm install
pnpm dev        # Run the demo page
```

## Usage

```tsx
import { TravelSearch } from '@routestack/widget';

function App() {
  return (
    <TravelSearch
      apiKey="your_routestack_api_key"
      onResult={(result) => console.log(result)}
    />
  );
}
```

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint |

## How It Works

1. Renders a search form with destination, dates, and traveler inputs
2. Connects to RouteStack MCP server via SSE
3. Displays flight, hotel, and car results as cards
4. Emits results via callback for your app to handle

## Customization

- Modify components in `src/components/` for custom card designs
- Build as a library: `pnpm build` outputs a standalone bundle
- See `demo/index.html` for embedding examples
