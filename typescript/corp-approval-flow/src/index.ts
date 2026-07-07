import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { config } from "./config.js";
import { callTool, connectMcp, disconnectMcp, listTools } from "./mcp-client.js";
import { searchTravelOptions } from "./search.js";
import { createApprovalLink, sendApprovalEmail } from "./approval.js";
import { verifyJwt } from "./deep-link.js";
import { createId, type ApprovalRecord, type EmployeeRequest, type McpTool, type TravelOption } from "./types.js";
import { normalizeOption } from "./option-utils.js";
import { fetchHotelRooms, prepareFlightCheckout, prepareHotelCheckout } from "./booking-flow.js";

const app = new Hono();
let tools: McpTool[] = [];
const approvals = new Map<string, ApprovalRecord>();

function extractJsonFromTool(result: Awaited<ReturnType<typeof callTool>>): unknown {
  for (const item of result.content) {
    if (typeof item.text === "string") {
      try {
        return JSON.parse(item.text);
      } catch {
        return item.text;
      }
    }
  }
  return null;
}

function validateRequest(input: Partial<EmployeeRequest>): asserts input is EmployeeRequest {
  if (!input.employeeName || !input.employeeEmail || !input.managerEmail || !input.purpose) {
    throw new Error("Employee, manager, and purpose fields are required.");
  }
  if (input.travelType !== "flight" && input.travelType !== "hotel") throw new Error("travelType must be flight or hotel.");
  if (!input.destination) throw new Error("Destination is required.");
  if (typeof input.travelers !== "number" || input.travelers < 1) throw new Error("Travelers must be at least 1.");
  if (typeof input.budget !== "number" || input.budget <= 0) throw new Error("Budget must be a positive number.");
  if (input.travelType === "flight" && (!input.origin || !input.departDate || !input.returnDate)) throw new Error("Flight requires origin, departDate, returnDate.");
  if (input.travelType === "hotel" && (!input.checkInDate || !input.checkOutDate)) throw new Error("Hotel requires checkInDate and checkOutDate.");
}

app.get("/health", (c) => c.json({ status: "ok", tools: tools.length, provider: config.llm.provider, model: config.llm.model }));

app.get("/api/lookups/flight", async (c) => {
  try {
    const term = c.req.query("term")?.trim();
    if (!term || term.length < 2) return c.json({ options: [] });
    const result = await callTool("flight_locations", { term });
    if (result.isError) return c.json({ options: [] });
    const json = extractJsonFromTool(result) as Record<string, unknown> | null;
    const list = Array.isArray(json?.result) ? (json?.result as Array<Record<string, unknown>>) : [];
    const options = list.slice(0, 8).map((item, index) => ({
      id: String(item.id ?? item.code ?? item.airportCode ?? `flight-${index}`),
      label: String(item.name ?? item.city ?? item.label ?? item.fullname ?? "Location"),
      code: String(item.code ?? item.airportCode ?? item.iata ?? ""),
      subtitle: String(item.fullname ?? item.country ?? ""),
      raw: item,
    }));
    return c.json({ options });
  } catch {
    return c.json({ options: [] });
  }
});

app.get("/api/lookups/hotel-destination", async (c) => {
  try {
    const query = c.req.query("query")?.trim();
    if (!query || query.length < 2) return c.json({ options: [] });
    const result = await callTool("hotel_search_destinations", { query, type: "DESTINATION" });
    if (result.isError) return c.json({ options: [] });
    const json = extractJsonFromTool(result) as Record<string, unknown> | null;
    const list = Array.isArray(json?.result) ? (json?.result as Array<Record<string, unknown>>) : [];
    const options = list.slice(0, 8).map((item, index) => ({
      id: String(item.id ?? item.referenceId ?? `dest-${index}`),
      label: String(item.fullName ?? item.city ?? item.name ?? "Destination"),
      subtitle: String(item.country ?? item.type ?? ""),
      lat: Number(item.lat ?? 0),
      long: Number(item.long ?? 0),
      raw: item,
    }));
    return c.json({ options });
  } catch {
    return c.json({ options: [] });
  }
});

app.post("/api/search", async (c) => {
  try {
    const request = await c.req.json<Partial<EmployeeRequest>>();
    validateRequest(request);
    const result = await searchTravelOptions(request, tools);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return c.json({ error: message }, 400);
  }
});

app.post("/api/flight/prepare-checkout", async (c) => {
  try {
    const body = await c.req.json<{ request: Partial<EmployeeRequest>; selectedOption: Record<string, unknown> }>();
    validateRequest(body.request);
    if (body.request.travelType !== "flight") throw new Error("Request must be flight type.");
    const selected = normalizeOption(body.selectedOption);
    const result = await prepareFlightCheckout(body.request, selected);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return c.json({ error: message }, 400);
  }
});

app.post("/api/hotel/rooms", async (c) => {
  try {
    const body = await c.req.json<{ request: Partial<EmployeeRequest>; selectedOption: Record<string, unknown> }>();
    validateRequest(body.request);
    if (body.request.travelType !== "hotel") throw new Error("Request must be hotel type.");
    const selected = normalizeOption(body.selectedOption);
    const result = await fetchHotelRooms(body.request, selected);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return c.json({ error: message }, 400);
  }
});

app.post("/api/hotel/prepare-checkout", async (c) => {
  try {
    const body = await c.req.json<{ request: Partial<EmployeeRequest>; selectedHotel: Record<string, unknown>; selectedRoom: Record<string, unknown> }>();
    validateRequest(body.request);
    if (body.request.travelType !== "hotel") throw new Error("Request must be hotel type.");
    const selectedHotel = normalizeOption(body.selectedHotel);
    const result = await prepareHotelCheckout(body.request, selectedHotel, body.selectedRoom);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return c.json({ error: message }, 400);
  }
});

app.post("/api/requests", async (c) => {
  try {
    const body = await c.req.json<{ request: Partial<EmployeeRequest>; selectedOption: Record<string, unknown> }>();
    validateRequest(body.request);

    const selected: TravelOption = normalizeOption(body.selectedOption);
    if (!selected.paymentUrl) throw new Error("Please prepare checkout first to generate payment URL.");

    const id = createId("approval");

    const record: ApprovalRecord = {
      id,
      createdAt: new Date().toISOString(),
      status: "pending",
      request: body.request,
      selectedOption: selected,
    };

    approvals.set(id, record);

    const approvalLink = createApprovalLink(id);
    await sendApprovalEmail(record, approvalLink);

    return c.json({ approvalId: id, approvalLink, message: "Approval email sent to manager." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return c.json({ error: message }, 400);
  }
});

app.get("/api/approvals/:token", (c) => {
  try {
    const payload = verifyJwt(c.req.param("token"), config.jwtSecret);
    const id = payload.approvalId;
    if (typeof id !== "string") throw new Error("Invalid approval token payload");
    const record = approvals.get(id);
    if (!record) return c.json({ error: "Approval not found" }, 404);
    return c.json({ record });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    return c.json({ error: message }, 400);
  }
});

app.post("/api/approvals/:token/approve", (c) => {
  try {
    const payload = verifyJwt(c.req.param("token"), config.jwtSecret);
    const id = payload.approvalId;
    if (typeof id !== "string") throw new Error("Invalid approval token payload");

    const record = approvals.get(id);
    if (!record) return c.json({ error: "Approval not found" }, 404);

    record.status = "approved";
    approvals.set(id, record);

    return c.json({
      status: "approved",
      paymentUrl: record.selectedOption.paymentUrl ?? null,
      message: record.selectedOption.paymentUrl ? "Approved. Continue to payment URL." : "Approved. No payment URL returned.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    return c.json({ error: message }, 400);
  }
});

app.use("/assets/*", serveStatic({ root: "./public" }));
app.get("/*", serveStatic({ path: "./public/index.html" }));

async function main() {
  await connectMcp();
  tools = await listTools();
  serve({ fetch: app.fetch, port: config.port }, () => {
    console.log(`Corporate Approval Flow running at http://localhost:${config.port}`);
  });
}

process.on("SIGINT", async () => {
  await disconnectMcp();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectMcp();
  process.exit(0);
});

main().catch(async (err) => {
  console.error(err);
  await disconnectMcp().catch(() => undefined);
  process.exit(1);
});
