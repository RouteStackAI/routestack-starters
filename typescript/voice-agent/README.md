# RouteStack.ai — Voice Agent

Connect RouteStack MCP to a voice AI platform to build a phone-based AI travel agent. Supports OpenAI Realtime API, Vapi, and Retell.

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- An OpenAI API key (for Realtime API)
- Optional: Twilio account for phone number provisioning

## Quick Start

```bash
cp .env.example .env
# Add your API keys to .env
pnpm install
pnpm start
```

## Configuration

| Variable | Required | Description |
|:---------|:---------|:------------|
| `ROUTESTACK_API_KEY` | Yes | Your RouteStack API key |
| `ROUTESTACK_MCP_URL` | Yes | MCP server endpoint |
| `OPENAI_API_KEY` | Yes | OpenAI API key (for Realtime API) |
| `TWILIO_ACCOUNT_SID` | No | Twilio account SID (for phone) |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | No | Twilio phone number |

## How It Works

1. Connects to OpenAI Realtime API via WebSocket
2. Registers RouteStack MCP tools for the voice session
3. User speaks a travel query
4. Voice AI calls MCP tools and speaks the results

```
You (speaking): "I need a flight from Chicago to Miami this weekend"
Agent (speaking): "I found 3 flights. The cheapest is United at $189..."
```

## Alternatives

- **Vapi:** Simpler setup with managed telephony. See `src/alternatives/vapi-setup.ts`
- **Retell:** Enterprise-grade voice AI. See `src/alternatives/retell-setup.ts`
