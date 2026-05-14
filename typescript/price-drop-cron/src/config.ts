import type { Env, RouteConfig } from "./types.js";

const DEFAULT_MCP_URL = "https://mcp.routestack.ai/sse";
const DEFAULT_TOOL_NAME = "flight_search";
const DEFAULT_PRICE_FIELD_PATHS = [
  "price",
  "ourprice",
  "totalPrice",
  "fare.total",
  "data.price",
];

const DEFAULT_ROUTES: RouteConfig[] = [
  {
    id: "nyc-lhr-sample",
    origin: "JFK",
    destination: "LHR",
    departureDate: "2026-07-01",
    adults: 1,
    cabinClass: "economy",
    currency: "USD",
    thresholdPercent: 5,
  },
];

export interface RuntimeConfig {
  routestack: {
    apiKey: string;
    apiSecret?: string;
    mcpUrl: string;
  };
  notification: {
    resendApiKey?: string;
    email?: string;
    fromEmail: string;
  };
  priceCheck: {
    toolName: string;
    priceFieldPaths: string[];
    routes: RouteConfig[];
  };
}

function parseRoutes(json?: string): RouteConfig[] {
  if (!json) return DEFAULT_ROUTES;

  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("ROUTE_CONFIG_JSON must be a JSON array");
    }

    const routes = parsed.map((item, index) => {
      if (!item || typeof item !== "object") {
        throw new Error(`Route at index ${index} must be an object`);
      }
      const candidate = item as Partial<RouteConfig>;
      const route: RouteConfig = {
        id: String(candidate.id ?? `route-${index + 1}`),
        origin: String(candidate.origin ?? ""),
        destination: String(candidate.destination ?? ""),
        departureDate: String(candidate.departureDate ?? ""),
        returnDate: candidate.returnDate ? String(candidate.returnDate) : undefined,
        adults: Number(candidate.adults ?? 1),
        children: candidate.children === undefined ? undefined : Number(candidate.children),
        cabinClass: candidate.cabinClass ? String(candidate.cabinClass) : undefined,
        currency: candidate.currency ? String(candidate.currency) : undefined,
        thresholdPercent: Number(candidate.thresholdPercent ?? 5),
        toolArguments:
          candidate.toolArguments && typeof candidate.toolArguments === "object"
            ? (candidate.toolArguments as Record<string, unknown>)
            : undefined,
      };

      if (!route.origin || !route.destination || !route.departureDate) {
        throw new Error(`Route ${route.id} is missing required origin/destination/departureDate`);
      }
      if (!Number.isFinite(route.thresholdPercent) || route.thresholdPercent < 0) {
        throw new Error(`Route ${route.id} has invalid thresholdPercent`);
      }
      return route;
    });

    if (routes.length === 0) {
      throw new Error("At least one route is required");
    }

    return routes;
  } catch (error) {
    throw new Error(
      `Invalid ROUTE_CONFIG_JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function getConfig(env: Env): RuntimeConfig {
  if (!env.ROUTESTACK_API_KEY) {
    throw new Error("ROUTESTACK_API_KEY is required");
  }

  const routes = parseRoutes(env.ROUTE_CONFIG_JSON);
  const configuredPath = env.MCP_PRICE_FIELD_PATH?.trim();

  return {
    routestack: {
      apiKey: env.ROUTESTACK_API_KEY,
      apiSecret: env.ROUTESTACK_API_SECRET?.trim() || undefined,
      mcpUrl: env.ROUTESTACK_MCP_URL?.trim() || DEFAULT_MCP_URL,
    },
    notification: {
      resendApiKey: env.RESEND_API_KEY?.trim() || undefined,
      email: env.NOTIFICATION_EMAIL?.trim() || undefined,
      fromEmail: env.NOTIFICATION_FROM_EMAIL?.trim() || "onboarding@resend.dev",
    },
    priceCheck: {
      toolName: env.MCP_PRICE_TOOL_NAME?.trim() || DEFAULT_TOOL_NAME,
      priceFieldPaths: configuredPath
        ? configuredPath.split(",").map((p) => p.trim()).filter(Boolean)
        : DEFAULT_PRICE_FIELD_PATHS,
      routes,
    },
  };
}
