import type { RuntimeConfig } from "./config.js";
import type { PriceCheckOutcome, RouteConfig } from "./types.js";

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string,
): Promise<T> {
  let timeoutHandle: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`${context} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    ) as unknown as number;
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

export async function sendPriceDropNotification(
  cfg: RuntimeConfig,
  route: RouteConfig,
  outcome: PriceCheckOutcome,
): Promise<void> {
  const apiKey = cfg.notification.resendApiKey;
  const recipient = cfg.notification.email;

  if (!apiKey || !recipient) {
    console.log(
      `Notification skipped for route ${route.id}: missing RESEND_API_KEY or NOTIFICATION_EMAIL`,
    );
    return;
  }

  const drop = outcome.dropPercent?.toFixed(2) ?? "0.00";
  const previous = outcome.previousPrice?.toFixed(2) ?? "N/A";
  const current = outcome.currentPrice.toFixed(2);

  const body = {
    from: cfg.notification.fromEmail,
    to: [recipient],
    subject: `Price dropped: ${route.origin} -> ${route.destination}`,
    html: `<h2>Price Drop Alert</h2>
<p>Route: <strong>${route.origin} -> ${route.destination}</strong></p>
<p>Departure: <strong>${route.departureDate}</strong></p>
<p>Previous Price: <strong>${previous} ${outcome.currency}</strong></p>
<p>Current Price: <strong>${current} ${outcome.currency}</strong></p>
<p>Drop: <strong>${drop}%</strong> (threshold: ${route.thresholdPercent}%)</p>`,
  };

  const sendPromise = fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const response = await withTimeout(sendPromise, 10_000, "Resend request");
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 403) {
      throw new Error(
        `Resend rejected sender (${cfg.notification.fromEmail}). Set NOTIFICATION_FROM_EMAIL to a verified Resend sender/domain or use onboarding@resend.dev for testing. Raw response: ${text}`,
      );
    }
    throw new Error(`Resend request failed (${response.status}): ${text}`);
  }
}
