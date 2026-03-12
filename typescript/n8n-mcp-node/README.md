# RouteStack.ai — n8n MCP Node

A custom n8n community node that connects RouteStack MCP tools to n8n workflows. Drag-and-drop travel search into any automation.

## Prerequisites

- Node.js >= 20
- [n8n](https://n8n.io) installed (self-hosted or desktop)
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))

## Quick Start

```bash
# Install as a community node in n8n
cd ~/.n8n/custom
pnpm install /path/to/this/directory

# Restart n8n
n8n start
```

## Configuration

Add your RouteStack credentials in n8n's Credentials UI:

| Field | Description |
|:------|:------------|
| API Key | Your RouteStack API key |
| MCP URL | MCP server endpoint (`https://mcp.routestack.ai/sse`) |

## Available Actions

| Action | Description |
|:-------|:------------|
| Search Flights | Search flights by origin, destination, dates |
| Search Hotels | Search hotels by city, dates, guests |
| Search Cars | Search car rentals by city, dates |

## Example Workflows

Import the example workflows from `workflows/`:

- **travel-alert-to-slack.json** — Calendar event triggers flight search, posts to Slack
- **daily-price-check.json** — Daily cron checks a route's price, emails if it drops

## Customization

- Add new actions in `nodes/RouteStack/actions/`
- Modify the credential type in `credentials/RouteStackApi.credentials.ts`
