import http from "node:http";
import crypto from "node:crypto";
import { config } from "./config.js";

interface ShortLinkRecord {
  targetUrl: string;
  createdAt: number;
}

const SHORT_LINK_TTL_MS = 1000 * 60 * 60 * 24;
const shortLinks = new Map<string, ShortLinkRecord>();
let serverStarted = false;

function cleanupExpiredLinks() {
  const now = Date.now();
  for (const [token, record] of shortLinks.entries()) {
    if (now - record.createdAt > SHORT_LINK_TTL_MS) {
      shortLinks.delete(token);
    }
  }
}

export function createShortCheckoutUrl(targetUrl?: string) {
  if (!targetUrl || !config.app.publicBaseUrl) {
    return undefined;
  }

  cleanupExpiredLinks();
  const token = crypto.randomBytes(6).toString("base64url");
  shortLinks.set(token, {
    targetUrl,
    createdAt: Date.now(),
  });

  const base = new URL(config.app.publicBaseUrl);
  const shortUrl = new URL(`/go/${token}`, base);
  return shortUrl.toString();
}

export function startShortLinkServer() {
  if (serverStarted || !config.app.publicBaseUrl) {
    return;
  }

  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("Missing request URL.");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    if (!url.pathname.startsWith("/go/")) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found.");
      return;
    }

    const token = url.pathname.slice("/go/".length);
    const record = shortLinks.get(token);

    if (!record) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("This short checkout link has expired or does not exist.");
      return;
    }

    res.writeHead(302, {
      Location: record.targetUrl,
      "cache-control": "no-store",
    });
    res.end();
  });

  server.listen(config.app.port, () => {
    console.log(
      `Short link server listening on port ${config.app.port}${config.app.publicBaseUrl ? ` using ${config.app.publicBaseUrl}` : ""}.`,
    );
  });

  serverStarted = true;
}
