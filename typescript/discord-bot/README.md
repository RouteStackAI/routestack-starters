# RouteStack.ai — Discord Bot

A Discord bot with slash commands for searching flights, hotels, and cars via the RouteStack MCP server. Results are posted as rich embeds.

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- A Discord server with permission to add bots

## Quick Start

```bash
cp .env.example .env
# Add your API keys to .env
pnpm install
pnpm run deploy-commands   # Register slash commands with Discord
pnpm start
```

## Discord App Setup

1. Go to [discord.com/developers](https://discord.com/developers/applications) and create a new application
2. Create a Bot under the application
3. Copy the Bot Token and Client ID to `.env`
4. Invite the bot to your server with the `applications.commands` and `bot` scopes

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint |
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `DISCORD_CLIENT_ID` | Yes | Discord application client ID |

## Usage

```
/flights origin:LAX destination:JFK date:2025-12-15
/hotels city:Chicago checkin:2025-12-20 checkout:2025-12-22
/cars city:Miami pickup:2025-12-01 dropoff:2025-12-05
```

## Customization

- Add new commands in `src/commands/`
- Customize embed formatting in `src/formatters/embeds.ts`
