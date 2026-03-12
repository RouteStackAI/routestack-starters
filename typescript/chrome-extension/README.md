# RouteStack.ai — Chrome Extension

A Chrome extension with a side panel that reads the current webpage context and uses an AI agent to suggest travel options via RouteStack MCP.

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- An LLM API key (OpenAI or Anthropic)
- Chrome 114+ (for Side Panel API)

## Quick Start

```bash
cp .env.example .env
# Add your API keys to .env
pnpm install
pnpm build
```

Then load the extension in Chrome:

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` folder

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint |
| `OPENAI_API_KEY` | Yes | LLM API key for context extraction |

## How It Works

```
You visit an email: "Join us for Sarah's wedding in Austin, TX — June 14-16"
→ Click the RouteStack extension icon
→ Side panel: "I see a wedding in Austin, TX, June 14-16. Want me to find flights?"
→ You: "Yes, from Denver"
→ Agent calls RouteStack MCP → shows flight options
```

1. Content script extracts travel-relevant text from the current page
2. Service worker sends context to LLM with RouteStack tools
3. Results display as cards in the side panel

## Customization

- Modify extraction logic in `src/content/extractor.ts`
- Customize the side panel UI in `src/sidepanel/`
