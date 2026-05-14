export interface Env {
  ROUTESTACK_API_KEY: string;
  ROUTESTACK_API_SECRET?: string;
  ROUTESTACK_MCP_URL: string;
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL?: string;
  NOTIFICATION_FROM_EMAIL?: string;
  ROUTE_CONFIG_JSON?: string;
  MCP_PRICE_TOOL_NAME?: string;
  MCP_PRICE_FIELD_PATH?: string;
  PRICE_CACHE: KVNamespace;
}

export interface RouteConfig {
  id: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  cabinClass?: string;
  currency?: string;
  thresholdPercent: number;
  toolArguments?: Record<string, unknown>;
}

export interface PriceResult {
  route: RouteConfig;
  toolName: string;
  toolArguments: Record<string, unknown>;
  rawResponse: unknown;
  price: number;
  currency: string;
  observedAt: string;
}

export interface StoredPriceState {
  routeId: string;
  lastPrice: number;
  currency: string;
  observedAt: string;
  notifiedAt?: string;
}

export interface PriceCheckOutcome {
  routeId: string;
  previousPrice?: number;
  currentPrice: number;
  currency: string;
  dropPercent?: number;
  shouldNotify: boolean;
}
