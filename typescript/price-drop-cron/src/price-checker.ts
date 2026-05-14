import type { RuntimeConfig } from "./config.js";
import type { Env, PriceCheckOutcome, PriceResult, RouteConfig, StoredPriceState } from "./types.js";
import type { McpToolResult } from "./mcp-client.js";

const CACHE_PREFIX = "route-price";

function getByPath(input: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, input);
}

function parseJsonTextBlocks(content: McpToolResult["content"]): unknown[] {
  const parsed: unknown[] = [];

  for (const block of content) {
    if (block.type !== "text" || typeof block.text !== "string") continue;

    try {
      parsed.push(JSON.parse(block.text));
    } catch {
      // Ignore non-JSON text blocks.
    }
  }

  return parsed;
}

function extractNumericPrice(candidate: unknown): number | null {
  if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;

  if (typeof candidate === "string") {
    const cleaned = candidate.replace(/[^0-9.\-]/g, "");
    const value = Number(cleaned);
    if (Number.isFinite(value)) return value;
  }

  return null;
}

function findPrice(payloads: unknown[], fieldPaths: string[]): number | null {
  for (const payload of payloads) {
    for (const path of fieldPaths) {
      const value = getByPath(payload, path);
      const price = extractNumericPrice(value);
      if (price !== null && price > 0) return price;
    }

    if (Array.isArray(payload)) {
      const nested = findPrice(payload, fieldPaths);
      if (nested !== null) return nested;
    }

    if (payload && typeof payload === "object") {
      const values = Object.values(payload as Record<string, unknown>);
      const nested = findPrice(values, fieldPaths);
      if (nested !== null) return nested;
    }
  }

  return null;
}

function normalizeToolArguments(route: RouteConfig): Record<string, unknown> {
  const defaults: Record<string, unknown> = {
    origin: route.origin,
    destination: route.destination,
    departureDate: route.departureDate,
    adults: route.adults ?? 1,
  };

  if (route.returnDate) defaults.returnDate = route.returnDate;
  if (route.children !== undefined) defaults.children = route.children;
  if (route.cabinClass) defaults.cabinClass = route.cabinClass;
  if (route.currency) defaults.currency = route.currency;

  return {
    filter: {
      ...defaults,
      ...(route.toolArguments ?? {}),
    }
  };
}

function cacheKey(routeId: string): string {
  return `${CACHE_PREFIX}:${routeId}`;
}

export async function fetchCurrentPrice(
  route: RouteConfig,
  cfg: RuntimeConfig,
  callTool: (name: string, args: Record<string, unknown>) => Promise<McpToolResult>,
): Promise<PriceResult> {
  const toolName = cfg.priceCheck.toolName;
  const toolArguments = normalizeToolArguments(route);
  const raw = await callTool(toolName, toolArguments);

  if (raw.isError) {
    throw new Error(`MCP tool \"${toolName}\" returned an error for route ${route.id}`);
  }

  const payloads: unknown[] = [raw.content, ...parseJsonTextBlocks(raw.content)];
  const price = findPrice(payloads, cfg.priceCheck.priceFieldPaths);
  if (price === null) {
    throw new Error(`Could not extract price for route ${route.id} from MCP response`);
  }

  return {
    route,
    toolName,
    toolArguments,
    rawResponse: raw.content,
    price,
    currency: route.currency ?? "USD",
    observedAt: new Date().toISOString(),
  };
}

export async function loadStoredState(env: Env, routeId: string): Promise<StoredPriceState | null> {
  const raw = await env.PRICE_CACHE.get(cacheKey(routeId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredPriceState;
  } catch {
    return null;
  }
}

export async function saveStoredState(env: Env, state: StoredPriceState): Promise<void> {
  await env.PRICE_CACHE.put(cacheKey(state.routeId), JSON.stringify(state));
}

export function evaluatePriceDrop(
  route: RouteConfig,
  currentPrice: number,
  previous: StoredPriceState | null,
): PriceCheckOutcome {
  if (!previous || previous.lastPrice <= 0) {
    return {
      routeId: route.id,
      previousPrice: previous?.lastPrice,
      currentPrice,
      currency: route.currency ?? previous?.currency ?? "USD",
      shouldNotify: false,
    };
  }

  const dropPercent = ((previous.lastPrice - currentPrice) / previous.lastPrice) * 100;
  const shouldNotify = currentPrice < previous.lastPrice && dropPercent >= route.thresholdPercent;

  return {
    routeId: route.id,
    previousPrice: previous.lastPrice,
    currentPrice,
    currency: route.currency ?? previous.currency,
    dropPercent,
    shouldNotify,
  };
}
