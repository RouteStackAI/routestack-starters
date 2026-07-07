# RouteStack.ai - Discord Bot

A production-style Discord sample that connects directly to the RouteStack.ai MCP server and walks users through hotel, flight, and car booking flows with slash commands plus interactive select menus.

## Features

- `/hotels` searches destinations first, then lets the user pick a destination, hotel, and room
- `/flights` resolves origin and destination, searches fares, and prepares checkout for the selected fare
- `/cars` resolves pickup and dropoff, searches vehicles, and prepares checkout for the selected car
- `/booking-info` fetches an existing hotel booking by `bookingId`
- `/cancel-booking` cancels an existing hotel booking
- optional OpenAI summaries for quick recommendation notes on top results
- optional built-in short redirect links for long RouteStack checkout URLs

## Prerequisites

- Node.js 20+
- RouteStack API credentials
- A Discord application and bot token

## Quick Start

```bash
cd typescript/discord-bot
cp .env.example .env
pnpm install
pnpm run deploy-commands
pnpm start
```

## Discord App Setup

1. Create an application at `https://discord.com/developers/applications`
2. Create a bot for that application
3. Copy `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` into `.env`
4. Invite the bot using the `bot` and `applications.commands` scopes
5. For development, set `DISCORD_GUILD_ID` so command registration is fast

## Environment Variables

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | RouteStack API key |
| `ROUTESTACK_API_SECRET` | Sometimes | Required for partner-token based MCP deployments |
| `ROUTESTACK_MCP_URL` | Yes | RouteStack MCP endpoint |
| `ROUTESTACK_PORTAL_URL` | No | Optional explicit portal URL for checkout tools |
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `DISCORD_CLIENT_ID` | Yes | Discord application client ID |
| `DISCORD_GUILD_ID` | No | Guild ID for local command registration |
| `DISCORD_AUTO_DEPLOY` | No | Set `true` to deploy commands automatically on startup |
| `PORT` | No | Port used by the built-in short link redirect server |
| `PUBLIC_BASE_URL` | No | Public base URL for short checkout links, for example `https://your-bot.example.com` |
| `OPENAI_API_KEY` | No | Enables AI recommendation snippets |
| `OPENAI_MODEL` | No | OpenAI model used for those snippets |

## Commands

```text
/hotels city:Chicago checkin:2026-05-20 checkout:2026-05-23 adults:2 rooms:1
/flights origin:SFO destination:JFK departure:2026-06-10 return:2026-06-15 adults:1
/cars pickup:JFK Airport dropoff:JFK Airport pickup_date:2026-06-10 dropoff_date:2026-06-13
/booking-info booking_id:BOOKING123
/cancel-booking booking_id:BOOKING123
```

## RouteStack Flow Mapping

### Hotels

1. `/hotels` calls `hotel_search_destinations`
2. The user chooses a destination in Discord
3. The bot calls `hotel_search`
4. The user chooses a hotel
5. The bot calls `hotel_get_details` and `hotel_get_rooms_and_rates`
6. The user chooses a room
7. The bot calls `hotel_revalidate_rate` and `hotel_get_checkout_url`

### Flights

1. `/flights` resolves endpoints with `flight_locations`
2. The bot optionally opens `flight_session` when available
3. The bot calls `flight_search`
4. The user chooses a fare
5. The bot calls `flight_revalidate` and `flight_get_checkout_url`

### Cars

1. `/cars` resolves locations with `car_locations`
2. The bot calls `car_search`
3. The user chooses a vehicle
4. The bot calls `car_revalidate` and `car_get_checkout_url`

## Notes

- Sessions are kept in memory for 30 minutes to keep the sample simple.
- Replies are ephemeral so checkout links remain private to the requesting user.
- If you want production durability, swap the in-memory session store for Redis or a database.
- Long checkout URLs can be shortened without altering the real RouteStack URL by setting `PUBLIC_BASE_URL`. The bot will generate a compact `/go/<token>` link and redirect to the exact original checkout URL with HTTP 302.
- For short links to work from Discord, `PUBLIC_BASE_URL` must be reachable from the public internet. A localhost-only URL will not be clickable for real users outside your machine.
