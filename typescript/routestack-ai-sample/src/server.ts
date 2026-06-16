import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { handleChatPost } from "./server/chat.js";

const port = Number(process.env.PORT ?? 3001);

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: ["http://127.0.0.1:5173", "http://localhost:5173"],
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.post("/api/chat", async (c) => handleChatPost(c.req.raw));

app.get("/health", (c) => c.json({ ok: true }));

serve({ fetch: app.fetch, port }, () => {
  console.log(`API server listening on http://127.0.0.1:${port}`);
});
