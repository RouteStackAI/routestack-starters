# RouteStack.ai — Slack Bot

A Slack app with slash commands (`/flights`, `/hotels`, `/cars`) that queries the RouteStack MCP server and posts results as rich Block Kit messages.

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- A Slack workspace with permission to install apps

## Quick Start

```bash
cp .env.example .env
# Add your API keys to .env
pnpm install
pnpm start
```

## Slack App Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Enable **Slash Commands** and add: `/flights`, `/hotels`, `/cars`
3. Set the Request URL to your server's public URL
4. Install the app to your workspace
5. Copy the Bot Token and Signing Secret to `.env`

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint |
| `SLACK_BOT_TOKEN` | Yes | Slack Bot User OAuth Token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Yes | Slack app signing secret |

## Usage

```
/flights LAX to JFK Dec 15
/hotels Chicago Dec 20-22, 2 guests
/cars Miami Dec 1-5
```

## Customization

- Add new commands in `src/commands/`
- Customize card formatting in `src/formatters/slack-blocks.ts`
