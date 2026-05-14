# RouteStack.ai - Price Drop Cron

A production-ready Cloudflare Worker cron app that checks configured flight routes through RouteStack MCP, stores last seen prices in KV, and sends notifications when prices drop past your threshold.

## Features

- Daily cron execution (configurable in `wrangler.toml`)
- RouteStack MCP client with auth + Streamable HTTP/SSE fallback
- KV-backed state per route (`lastPrice`, currency, timestamps)
- Robust price extraction from varied MCP payload shapes
- Resend email notifications on qualifying price drops
- Health endpoint (`GET /health`) and manual trigger (`POST /run`)

## Prerequisites

- RouteStack API key (`ROUTESTACK_API_KEY`)
- Cloudflare Workers + KV namespace bound as `PRICE_CACHE`
- Resend API key + destination email (for notifications)

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

## Required Wrangler Setup

1. Create a KV namespace:

```bash
npm run kv:create
```

2. Add namespace binding in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "PRICE_CACHE"
id = "<your-namespace-id>"
```

## Environment Variables

- `ROUTESTACK_API_KEY` (required)
- `ROUTESTACK_API_SECRET` (required; used for partner-token auth flow)
- `ROUTESTACK_MCP_URL` (optional; defaults to `https://mcp.routestack.ai/sse`)
- `ROUTE_CONFIG_JSON` (optional; JSON array of routes)
- `MCP_PRICE_TOOL_NAME` (optional; defaults to `flight_search`)
- `MCP_PRICE_FIELD_PATH` (optional; comma-separated extraction paths)
- `RESEND_API_KEY` + `NOTIFICATION_EMAIL` (optional but required for email alerts)
- `NOTIFICATION_FROM_EMAIL` (optional; defaults to `onboarding@resend.dev`, use verified domain for production)

## Route Config Example

```json
[
  {
    "id": "jfk-lhr",
    "origin": "JFK",
    "destination": "LHR",
    "departureDate": "2026-07-01",
    "adults": 1,
    "cabinClass": "economy",
    "currency": "USD",
    "thresholdPercent": 5
  }
]
```

## Deploy

```bash
npm run deploy
```
