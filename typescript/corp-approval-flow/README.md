# RouteStack.ai — Corporate Approval Flow

An AI agent that searches flights for employees and emails a JWT-signed Deep Link to their manager for one-click approval and booking.

## Prerequisites

- Node.js >= 20
- A RouteStack API key ([get one at routestack.ai](https://routestack.ai))
- An LLM API key (OpenAI or Anthropic)
- A Resend API key (for approval emails)

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
| `OPENAI_API_KEY` | Yes | LLM API key |
| `RESEND_API_KEY` | Yes | Resend key for sending emails |
| `JWT_SECRET` | Yes | Secret for signing Deep Links |

## How It Works

```
Employee: "I need a flight from Denver to NYC, March 20-22"
    ↓
AI Agent → RouteStack MCP (search_flights)
    ↓
Select best option → Generate JWT-signed Deep Link
    ↓
Email to manager: "Approve this trip?"
    ↓
Manager clicks "Approve & Book" → Checkout page (pre-filled)
```

1. Employee submits a travel request
2. AI agent searches RouteStack MCP for options
3. A Deep Link is generated with a JWT-signed checkout URL
4. Manager receives an email with trip details and an "Approve & Book" button
5. Clicking the link opens the checkout with a pre-filled cart

## Customization

- Customize the email template in `src/templates/approval-email.html`
- Modify search criteria in `src/search.ts`
- Add expense policy rules in `src/types.ts`
