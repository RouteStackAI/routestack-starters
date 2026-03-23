import chalk from "chalk";
import { config } from "./config.js";

export interface ForwardResult {
  success: boolean;
  attempts: number;
  statusCode?: number;
  error?: string;
}

const FORWARD_TIMEOUT_MS = 10_000;

export async function forwardEvent(payload: unknown): Promise<ForwardResult> {
  const { url, maxRetries, retryDelayMs } = config.forwarding;
  const body = JSON.stringify(payload);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });

      if (response.ok) {
        return { success: true, attempts: attempt, statusCode: response.status };
      }

      const responseBody = await response.text().catch(() => "");
      console.log(
        chalk.yellow(
          `  Attempt ${attempt}/${maxRetries} failed: HTTP ${response.status} ${responseBody.slice(0, 100)}`,
        ),
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
      console.log(
        chalk.yellow(`  Attempt ${attempt}/${maxRetries} failed: ${errMsg}`),
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (attempt < maxRetries) {
      const delay = retryDelayMs * 2 ** (attempt - 1);
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
