import { getConfig } from "./config.js";
import { McpClientManager } from "./mcp-client.js";
import { sendPriceDropNotification } from "./notifier.js";
import {
  evaluatePriceDrop,
  fetchCurrentPrice,
  loadStoredState,
  saveStoredState,
} from "./price-checker.js";
import type { Env, StoredPriceState } from "./types.js";

async function runPriceCheck(env: Env): Promise<{ checked: number; notified: number; failures: number }> {
  const cfg = getConfig(env);
  const client = new McpClientManager(cfg.routestack);

  let checked = 0;
  let notified = 0;
  let failures = 0;

  try {
    await client.connect();

    for (const route of cfg.priceCheck.routes) {
      checked += 1;

      try {
        const current = await fetchCurrentPrice(route, cfg, client.callTool.bind(client));
        const previous = await loadStoredState(env, route.id);
        const outcome = evaluatePriceDrop(route, current.price, previous);

        if (outcome.shouldNotify) {
          await sendPriceDropNotification(cfg, route, outcome);
          notified += 1;
        }

        const nextState: StoredPriceState = {
          routeId: route.id,
          lastPrice: current.price,
          currency: current.currency,
          observedAt: current.observedAt,
          notifiedAt: outcome.shouldNotify ? new Date().toISOString() : previous?.notifiedAt,
        };

        await saveStoredState(env, nextState);
      } catch (error) {
        failures += 1;
        console.error(`Price check failed for route ${route.id}:`, error);
      }
    }
  } finally {
    await client.disconnect();
  }

  return { checked, notified, failures };
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runPriceCheck(env)
        .then((summary) => {
          console.log(
            JSON.stringify({
              type: "price-check-summary",
              scheduledAt: new Date(event.scheduledTime).toISOString(),
              ...summary,
            }),
          );
        })
        .catch((error) => {
          console.error("Scheduled price check run failed", error);
        }),
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "routestack-price-drop-cron" });
    }

    if (url.pathname === "/run" && request.method === "POST") {
      const summary = await runPriceCheck(env);
      return Response.json({ status: "completed", ...summary });
    }

    return Response.json(
      {
        service: "routestack-price-drop-cron",
        endpoints: {
          health: "GET /health",
          run: "POST /run",
        },
      },
      { status: 200 },
    );
  },
};
