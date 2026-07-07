# RouteStack.ai - Slack Bot

A working Slack Bolt app with slash commands (`/flights`, `/hotels`, `/cars`) that connects to the RouteStack MCP server, searches live travel inventory, and lets users continue through hotel, flight, and car booking flows inside Slack with Block Kit selects and checkout buttons.

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- A Slack workspace with permission to install apps

## Quick Start

```bash
cd typescript/slack-bot
cp .env.example .env
# Add your API keys to .env
pnpm install
pnpm start
```

## Slack App Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Enable **Slash Commands** and add: `/flights`, `/hotels`, `/cars`
3. Set each Request URL to `https://your-public-host/slack/events`
4. Install the app to your workspace
5. Copy the Bot Token and Signing Secret to `.env`

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_API_SECRET` | Sometimes | Required for partner-token based MCP deployments |
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint |
| `ROUTESTACK_PORTAL_URL` | No | Optional explicit portal URL for checkout tools |
| `SLACK_BOT_TOKEN` | Yes | Slack Bot User OAuth Token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Yes | Slack app signing secret |
| `PORT` | No | Local HTTP port for the Slack Bolt server |

## Usage

```text
/flights LAX to JFK Dec 15
/hotels Chicago Dec 20-22, 2 guests
/cars Miami Dec 1-5
```

You can also use ISO dates:

```text
/flights SFO to JFK 2026-06-10 return 2026-06-15, 2 adults, business
/hotels Chicago 2026-12-20 to 2026-12-22, 2 guests, 1 room
/cars JFK Airport to LGA Airport 2026-12-01 to 2026-12-05, 30 yo
```

## Flow Mapping

### Hotels

1. `/hotels` parses the Slack command text
2. The bot calls `hotel_search_destinations`
3. The user selects a destination in Slack
4. The bot calls `hotel_search`
5. The user selects a hotel
6. The bot calls `hotel_get_details` and `hotel_get_rooms_and_rates`
7. The user selects a room
8. The bot calls `hotel_revalidate_rate` and `hotel_get_checkout_url`

### Flights

1. `/flights` parses the Slack command text
2. The bot resolves airports with `flight_locations`
3. The bot optionally opens `flight_session` when available
4. The bot calls `flight_search`
5. The user selects a fare
6. The bot calls `flight_revalidate` and `flight_get_checkout_url`

### Cars

1. `/cars` parses the Slack command text
2. The bot resolves pickup and dropoff with `car_locations`
3. The bot calls `car_search`
4. The user selects a vehicle
5. The bot calls `car_revalidate` and `car_get_checkout_url`

## Customization

- Command text parsers live in `src/commands/`
- Travel orchestration lives in `src/travel-service.ts`
- Slack Block Kit rendering lives in `src/formatters/slack-blocks.ts`
