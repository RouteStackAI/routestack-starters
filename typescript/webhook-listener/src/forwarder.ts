import { config } from "./config.js";
import { logWarn } from "./logger.js";

export interface ForwardResult {
  success: boolean;
  attempts: number;
  statusCode?: number;
  error?: string;
}

export async function forwardEvent(payload: unknown): Promise<ForwardResult> {
  const { url, maxRetries, retryDelayMs, timeoutMs } = config.forwarding;
  const body = JSON.stringify(payload);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "routestack-webhook-listener/1.0.0",
        },
        body,
        signal: controller.signal,
      });

      if (response.ok) {
        return { success: true, attempts: attempt, statusCode: response.status };
      }

      const responseBody = await response.text().catch(() => "");
      logWarn(
        `Forward attempt ${attempt}/${maxRetries} failed: HTTP ${response.status} ${responseBody.slice(0, 200)}`,
      );

      if (response.status >= 400 && response.status < 500) {
        return {
          success: false,
          attempts: attempt,
          statusCode: response.status,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logWarn(`Forward attempt ${attempt}/${maxRetries} failed: ${errMsg}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (attempt < maxRetries) {
      const baseDelay = retryDelayMs * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * 250);
      const delay = baseDelay + jitter;
      await sleep(delay);
    }
  }

  return {
    success: false,
    attempts: maxRetries,
    error: "All retry attempts exhausted",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
