# RouteStack.ai — Price Drop Cron

A headless Cloudflare Worker that checks a flight route's price on a daily schedule and sends notifications when the price drops.

## Prerequisites

- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- A Cloudflare account with Workers enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed
- A Resend API key (for email) or Twilio (for SMS)

## Quick Start

```bash
cp .env.example .env
# Add your API keys to .env
pnpm install
pnpm dev          # Local development with wrangler
```

## Deploy

```bash
wrangler d1 create routestack-price-cache    # Create KV namespace (first time only)
# Update wrangler.toml with the KV namespace ID
wrangler deploy
```

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint |
| `RESEND_API_KEY` | Yes* | Resend key (*or use Twilio) |
| `NOTIFICATION_EMAIL` | Yes* | Email to notify (*or use SMS) |

## How It Works

1. Cron trigger fires daily at 9am UTC
2. Worker checks the configured route's current price via RouteStack MCP
3. Compares to the last stored price in KV
4. If price dropped by more than the threshold, sends a notification
5. Stores the new price for the next check

## Customization

- Change the schedule in `wrangler.toml` (`crons` field)
- Configure routes and thresholds in `src/config.ts`
- Add SMS notifications via Twilio in `src/notifier.ts`
