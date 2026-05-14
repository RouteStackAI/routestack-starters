# RouteStack.ai - Corporate Approval Flow

Corporate travel approval workflow with:
- employee booking UI (flight/hotel),
- MCP-powered search and checkout preparation,
- manager approval via signed deep links (JWT),
- approval email delivery via Resend.

## Tech stack

- Backend: `Hono` + `@hono/node-server` + TypeScript
- Frontend: `React` + `Vite` + `Tailwind CSS`
- LLM providers: `OpenAI`, `Anthropic`, `Mistral`
- Tool orchestration: RouteStack MCP (`/sse`)

## Setup

```bash
cp .env.example .env
pnpm install
pnpm dev
```

`pnpm dev` starts the Hono server on `PORT` (default `3000`) and serves the built web app from `public/`.

## Build and run scripts

- `pnpm dev`: run backend in dev mode (`tsx src/index.ts`)
- `pnpm dev:web`: run Vite dev server for frontend-only development
- `pnpm build`: build backend (`tsc`) and frontend (`vite build`)
- `pnpm build:server`: build backend only
- `pnpm build:web`: build frontend only
- `pnpm start`: run backend (`tsx src/index.ts`)

## Environment variables

Required:
- `ROUTESTACK_API_KEY`
- `ROUTESTACK_API_SECRET`
- `LLM_API_KEY`
- `LLM_MODEL`
- `RESEND_API_KEY`
- `JWT_SECRET`

Optional with defaults:
- `ROUTESTACK_MCP_URL` (default `https://mcp.routestack.ai/sse`)
- `LLM_PROVIDER` (`openai` | `anthropic` | `mistral`, default `openai`)
- `MISTRAL_BASE_URL` (default `https://api.mistral.ai/v1`)
- `RESEND_FROM_EMAIL` (default `approval@updates.routestack.ai`)
- `APP_BASE_URL` (default `http://localhost:3000`)
- `PORT` (default `3000`)

Reference: `.env.example`.

## API endpoints

- `GET /health`: service health + loaded tool count + active LLM provider/model
- `GET /api/lookups/flight?term=...`: flight location autocomplete
- `GET /api/lookups/hotel-destination?query=...`: hotel destination autocomplete
- `POST /api/search`: search travel options from employee request
- `POST /api/flight/prepare-checkout`: revalidate selected flight and return checkout/payment URL
- `POST /api/hotel/rooms`: load room options for selected hotel
- `POST /api/hotel/prepare-checkout`: revalidate selected room and return checkout/payment URL
- `POST /api/requests`: create approval request and email manager link
- `GET /api/approvals/:token`: fetch approval details by signed token
- `POST /api/approvals/:token/approve`: approve request and return payment URL (if available)

## UI routes

- `/`: employee booking and approval submission interface
- `/approve?token=...`: manager approval screen

## Notes

- Approval records are currently kept in-memory (`Map`) and reset on server restart.
- Manager links are JWT-signed using `JWT_SECRET`.
