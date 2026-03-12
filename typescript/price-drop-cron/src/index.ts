// RouteStack Price Drop Cron — Cloudflare Worker

export interface Env {
  ROUTESTACK_API_KEY: string;
  ROUTESTACK_MCP_URL: string;
  RESEND_API_KEY: string;
  NOTIFICATION_EMAIL: string;
  PRICE_CACHE: KVNamespace;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log("Price check triggered at", new Date(event.scheduledTime).toISOString());

    // TODO: Connect to RouteStack MCP
    // TODO: Check configured route price
    // TODO: Compare to last stored price in KV
    // TODO: Send notification if price dropped
    // TODO: Store new price in KV
  },

  async fetch(request: Request, env: Env) {
    return new Response("RouteStack Price Drop Cron Worker. Use cron triggers to activate.");
  },
};
