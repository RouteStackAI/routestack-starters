import { App } from "@slack/bolt";
import type { KnownBlock } from "@slack/types";
import { parseCarsCommand, carsUsage } from "./commands/cars.js";
import { parseFlightsCommand, flightsUsage } from "./commands/flights.js";
import { parseHotelsCommand, hotelsUsage } from "./commands/hotels.js";
import { config } from "./config.js";
import {
  carCheckoutResponse,
  carResultsResponse,
  destinationDiscoveryResponse,
  errorResponse,
  flightCheckoutResponse,
  flightResultsResponse,
  hotelCheckoutResponse,
  hotelDetailsResponse,
  hotelResultsResponse,
  loadingResponse,
} from "./formatters/slack-blocks.js";
import {
  carsSearchView,
  flightsSearchView,
  hotelsSearchView,
  parseViewMetadata,
} from "./formatters/slack-views.js";
import {
  connectMcp,
  disconnectMcp,
  getTransportKind,
  listTools,
} from "./mcp-client.js";
import {
  assertSessionOwner,
  cleanupExpiredSessions,
  createSession,
  getSession,
  updateSession,
} from "./session-store.js";
import {
  createCarSession,
  createFlightSession,
  createHotelDiscoverySession,
  inspectHotel,
  prepareCarCheckout,
  prepareFlightCheckout,
  prepareHotelCheckout,
  searchHotelsForDestination,
} from "./travel-service.js";
import type { TravelSession } from "./types.js";
import {
  hotelRoomOccupancyFromCounts,
  parseFlexibleDate,
  parseFlexibleDateRange,
} from "./utils.js";

const app = new App({
  token: config.slack.botToken,
  signingSecret: config.slack.signingSecret,
});

let availableToolNames: string[] = [];

type HotelTravelSession = Extract<TravelSession, { kind: "hotel" }>;
type FlightTravelSession = Extract<TravelSession, { kind: "flight" }>;
type CarTravelSession = Extract<TravelSession, { kind: "car" }>;

type RespondFn = (message: {
  text: string;
  blocks: KnownBlock[];
}) => Promise<void>;

function getActionSessionId(actionId: string, prefix: string) {
  return actionId.startsWith(prefix) ? actionId.slice(prefix.length) : null;
}

function getSelectedValue(action: unknown) {
  const candidate = action as { selected_option?: { value?: string } };
  return candidate.selected_option?.value ?? null;
}

function getViewInputValue(view: unknown, blockId: string) {
  const state = (
    view as {
      state?: {
        values?: Record<string, Record<string, unknown>>;
      };
    }
  ).state;
  const block = state?.values?.[blockId];
  if (!block) return "";
  const action = Object.values(block)[0] as
    | { selected_option?: { value?: string } | null; value?: string | null }
    | undefined;
  if (!action) return "";
  if (action.selected_option?.value) return action.selected_option.value;
  return action.value?.trim() ?? "";
}

function parseIntegerInput(value: string, fallback: number) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function postEphemeral(
  respond: RespondFn,
  payload: ReturnType<typeof errorResponse>,
) {
  await respond({
    text: payload.text,
    blocks: payload.blocks,
  });
}

async function runHotelSearch(
  userId: string,
  input: {
    query: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    rooms: number;
  },
  respond: RespondFn,
) {
  const sessionData = await createHotelDiscoverySession({
    query: input.query,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    rooms: hotelRoomOccupancyFromCounts(
      input.rooms,
      input.adults,
      input.children,
    ),
    currency: "USD",
  });

  const session = createSession({
    kind: "hotel",
    userId,
    data: sessionData,
  }) as HotelTravelSession;

  await postEphemeral(respond, destinationDiscoveryResponse(session));
}

async function runFlightSearch(
  userId: string,
  input: {
    originQuery: string;
    destinationQuery: string;
    departureDate: string;
    returnDate?: string;
    adults: number;
    children: number;
    infants: number;
    cabinClass: string;
  },
  respond: RespondFn,
) {
  const sessionData = await createFlightSession({
    originQuery: input.originQuery,
    destinationQuery: input.destinationQuery,
    departureDate: input.departureDate,
    returnDate: input.returnDate,
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    cabinClass: input.cabinClass,
    availableTools: availableToolNames,
  });

  const session = createSession({
    kind: "flight",
    userId,
    data: sessionData,
  }) as FlightTravelSession;

  await postEphemeral(respond, flightResultsResponse(session));
}

async function runCarSearch(
  userId: string,
  input: {
    pickupQuery: string;
    dropoffQuery: string;
    pickupDate: string;
    dropoffDate: string;
    driverAge: number;
  },
  respond: RespondFn,
) {
  const sessionData = await createCarSession({
    pickupQuery: input.pickupQuery,
    dropoffQuery: input.dropoffQuery,
    pickupDate: input.pickupDate,
    dropoffDate: input.dropoffDate,
    driverAge: input.driverAge,
  });

  const session = createSession({
    kind: "car",
    userId,
    data: sessionData,
  }) as CarTravelSession;

  await postEphemeral(respond, carResultsResponse(session));
}

async function withActionSession(
  actionId: string,
  prefix: string,
  userId: string,
  onSuccess: (session: TravelSession) => Promise<void>,
  onError: (message: string) => Promise<void>,
) {
  cleanupExpiredSessions();
  const sessionId = getActionSessionId(actionId, prefix);
  if (!sessionId) {
    await onError("That interaction could not be resolved.");
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    await onError("That travel session has expired. Run the slash command again.");
    return;
  }

  if (!assertSessionOwner(session, userId)) {
    await onError("That travel session belongs to another Slack user.");
    return;
  }

  await onSuccess(session);
}

app.command("/hotels", async ({ ack, command, respond, client }) => {
  await ack();

  try {
    cleanupExpiredSessions();
    if (!command.text.trim()) {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: hotelsSearchView({ channelId: command.channel_id }),
      });
      return;
    }

    const parsed = parseHotelsCommand(command.text);
    if (!parsed) {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: hotelsSearchView({ channelId: command.channel_id }),
      });
      return;
    }

    const dates = parseFlexibleDateRange(parsed.checkInInput, parsed.checkOutInput);
    if (!dates || dates.start >= dates.end) {
      await respond(
        errorResponse(
          "Hotel dates must be valid and checkout must be after checkin.",
        ),
      );
      return;
    }

    await runHotelSearch(
      command.user_id,
      {
        query: parsed.query,
        checkIn: dates.start,
        checkOut: dates.end,
        adults: parsed.adults,
        children: parsed.children,
        rooms: parsed.rooms,
      },
      async (payload) => {
        await respond({
          response_type: "ephemeral",
          replace_original: true,
          ...payload,
        });
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await respond(errorResponse(message));
  }
});

app.command("/flights", async ({ ack, command, respond, client }) => {
  await ack();

  try {
    cleanupExpiredSessions();
    if (!command.text.trim()) {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: flightsSearchView({ channelId: command.channel_id }),
      });
      return;
    }

    const parsed = parseFlightsCommand(command.text);
    if (!parsed) {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: flightsSearchView({ channelId: command.channel_id }),
      });
      return;
    }

    const departureDate = parseFlexibleDate(parsed.departureInput);
    const departureReference = departureDate
      ? new Date(`${departureDate}T00:00:00Z`)
      : new Date();
    const returnDate = parsed.returnInput
      ? parseFlexibleDate(parsed.returnInput, departureReference)
      : undefined;

    if (!departureDate || (parsed.returnInput && !returnDate)) {
      await respond(errorResponse("Flight dates must be valid calendar dates."));
      return;
    }

    if (returnDate && departureDate > returnDate) {
      await respond(
        errorResponse("Return date must be on or after the departure date."),
      );
      return;
    }

    const safeDepartureDate = departureDate;
    const safeReturnDate = returnDate ?? undefined;

    await runFlightSearch(
      command.user_id,
      {
        originQuery: parsed.originQuery,
        destinationQuery: parsed.destinationQuery,
        departureDate: safeDepartureDate,
        returnDate: safeReturnDate,
        adults: parsed.adults,
        children: parsed.children,
        infants: parsed.infants,
        cabinClass: parsed.cabinClass,
      },
      async (payload) => {
        await respond({
          response_type: "ephemeral",
          replace_original: true,
          ...payload,
        });
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await respond(errorResponse(message));
  }
});

app.command("/cars", async ({ ack, command, respond, client }) => {
  await ack();

  try {
    cleanupExpiredSessions();
    if (!command.text.trim()) {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: carsSearchView({ channelId: command.channel_id }),
      });
      return;
    }

    const parsed = parseCarsCommand(command.text);
    if (!parsed) {
      await respond(
        errorResponse(`${carsUsage} Or run \`/cars\` with no text to open a form.`),
      );
      return;
    }

    const dates = parseFlexibleDateRange(parsed.pickupInput, parsed.dropoffInput);
    if (!dates || dates.start > dates.end) {
      await respond(
        errorResponse(
          "Car rental dates must be valid and dropoff must be on or after pickup.",
        ),
      );
      return;
    }

    await runCarSearch(
      command.user_id,
      {
        pickupQuery: parsed.pickupQuery,
        dropoffQuery: parsed.dropoffQuery,
        pickupDate: dates.start,
        dropoffDate: dates.end,
        driverAge: parsed.driverAge,
      },
      async (payload) => {
        await respond({
          response_type: "ephemeral",
          replace_original: true,
          ...payload,
        });
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await respond(errorResponse(message));
  }
});

app.view("hotels_form", async ({ ack, body, view, client }) => {
  const query = getViewInputValue(view, "destination");
  const checkInInput = getViewInputValue(view, "checkin");
  const checkOutInput = getViewInputValue(view, "checkout");
  const adults = parseIntegerInput(getViewInputValue(view, "adults"), 2);
  const children = parseIntegerInput(getViewInputValue(view, "children"), 0);
  const rooms = parseIntegerInput(getViewInputValue(view, "rooms"), 1);

  const dates = parseFlexibleDateRange(checkInInput, checkOutInput);
  if (!query) {
    await ack({
      response_action: "errors",
      errors: { destination: "Destination is required." },
    });
    return;
  }
  if (!dates || dates.start >= dates.end) {
    await ack({
      response_action: "errors",
      errors: {
        checkin: "Enter a valid check-in date.",
        checkout: "Checkout must be after check-in.",
      },
    });
    return;
  }

  await ack();

  const metadata = parseViewMetadata(view.private_metadata);
  if (!metadata) return;

  await runHotelSearch(
    body.user.id,
    {
      query,
      checkIn: dates.start,
      checkOut: dates.end,
      adults,
      children,
      rooms,
    },
    async (payload) => {
      await client.chat.postEphemeral({
        channel: metadata.channelId,
        user: body.user.id,
        ...payload,
      });
    },
  );
});

app.view("flights_form", async ({ ack, body, view, client }) => {
  const originQuery = getViewInputValue(view, "origin");
  const destinationQuery = getViewInputValue(view, "destination");
  const departureInput = getViewInputValue(view, "departure");
  const returnInput = getViewInputValue(view, "return");
  const adults = parseIntegerInput(getViewInputValue(view, "adults"), 1);
  const children = parseIntegerInput(getViewInputValue(view, "children"), 0);
  const infants = parseIntegerInput(getViewInputValue(view, "infants"), 0);
  const cabinClass = getViewInputValue(view, "cabin") || "economy";

  const departureDate = parseFlexibleDate(departureInput);
  const returnDate = returnInput
    ? parseFlexibleDate(
        returnInput,
        departureDate ? new Date(`${departureDate}T00:00:00Z`) : new Date(),
      )
    : undefined;

  if (!originQuery) {
    await ack({
      response_action: "errors",
      errors: { origin: "Origin is required." },
    });
    return;
  }
  if (!destinationQuery) {
    await ack({
      response_action: "errors",
      errors: { destination: "Destination is required." },
    });
    return;
  }
  if (!departureDate || (returnInput && !returnDate)) {
    await ack({
      response_action: "errors",
      errors: {
        departure: "Enter a valid departure date.",
        ...(returnInput ? { return: "Enter a valid return date." } : {}),
      },
    });
    return;
  }
  if (returnDate && departureDate > returnDate) {
    await ack({
      response_action: "errors",
      errors: { return: "Return date must be on or after departure." },
    });
    return;
  }

  await ack();

  const metadata = parseViewMetadata(view.private_metadata);
  if (!metadata) return;

  await runFlightSearch(
    body.user.id,
    {
      originQuery,
      destinationQuery,
      departureDate,
      returnDate: returnDate ?? undefined,
      adults,
      children,
      infants,
      cabinClass,
    },
    async (payload) => {
      await client.chat.postEphemeral({
        channel: metadata.channelId,
        user: body.user.id,
        ...payload,
      });
    },
  );
});

app.view("cars_form", async ({ ack, body, view, client }) => {
  const pickupQuery = getViewInputValue(view, "pickup");
  const dropoffQuery = getViewInputValue(view, "dropoff") || pickupQuery;
  const pickupInput = getViewInputValue(view, "pickup_date");
  const dropoffInput = getViewInputValue(view, "dropoff_date");
  const driverAge = parseIntegerInput(getViewInputValue(view, "driver_age"), 30);

  const dates = parseFlexibleDateRange(pickupInput, dropoffInput);
  if (!pickupQuery) {
    await ack({
      response_action: "errors",
      errors: { pickup: "Pickup location is required." },
    });
    return;
  }
  if (!dates || dates.start > dates.end) {
    await ack({
      response_action: "errors",
      errors: {
        pickup_date: "Enter a valid pickup date.",
        dropoff_date: "Dropoff must be on or after pickup.",
      },
    });
    return;
  }

  await ack();

  const metadata = parseViewMetadata(view.private_metadata);
  if (!metadata) return;

  await runCarSearch(
    body.user.id,
    {
      pickupQuery,
      dropoffQuery,
      pickupDate: dates.start,
      dropoffDate: dates.end,
      driverAge,
    },
    async (payload) => {
      await client.chat.postEphemeral({
        channel: metadata.channelId,
        user: body.user.id,
        ...payload,
      });
    },
  );
});

app.action(/^hotel_destination__/, async ({ ack, body, action, respond }) => {
  await ack();

  await withActionSession(
    (action as { action_id: string }).action_id,
    "hotel_destination__",
    body.user.id,
    async (session) => {
      if (session.kind !== "hotel") {
        await respond(errorResponse("This selection does not belong to a hotel flow."));
        return;
      }

      await respond(loadingResponse("Searching hotels for your selected destination..."));
      const selectedId = getSelectedValue(action);
      const destination = session.data.destinationOptions.find(
        (option) => option.id === selectedId,
      );
      if (!destination) {
        await respond(errorResponse("Selected destination was not found."));
        return;
      }

      const updated = updateSession(session.id, {
        ...session,
        data: await searchHotelsForDestination(session.data, destination),
      });

      await respond(hotelResultsResponse(updated as HotelTravelSession));
    },
    async (message) => {
      await respond(errorResponse(message));
    },
  );
});

app.action(/^hotel_property__/, async ({ ack, body, action, respond }) => {
  await ack();

  await withActionSession(
    (action as { action_id: string }).action_id,
    "hotel_property__",
    body.user.id,
    async (session) => {
      if (session.kind !== "hotel") {
        await respond(errorResponse("This selection does not belong to a hotel flow."));
        return;
      }

      await respond(loadingResponse("Loading hotel details and live room rates..."));
      const selectedId = getSelectedValue(action);
      if (!selectedId) {
        await respond(errorResponse("Selected hotel was not provided."));
        return;
      }

      const updated = updateSession(session.id, {
        ...session,
        data: await inspectHotel(session.data, selectedId),
      });

      await respond(hotelDetailsResponse(updated as HotelTravelSession));
    },
    async (message) => {
      await respond(errorResponse(message));
    },
  );
});

app.action(/^hotel_room__/, async ({ ack, body, action, respond }) => {
  await ack();

  await withActionSession(
    (action as { action_id: string }).action_id,
    "hotel_room__",
    body.user.id,
    async (session) => {
      if (session.kind !== "hotel") {
        await respond(errorResponse("This selection does not belong to a hotel flow."));
        return;
      }

      await respond(
        loadingResponse("Revalidating the selected room and preparing checkout..."),
      );
      const selectedId = getSelectedValue(action);
      if (!selectedId) {
        await respond(errorResponse("Selected room was not provided."));
        return;
      }

      const updated = updateSession(session.id, {
        ...session,
        data: await prepareHotelCheckout(session.data, selectedId),
      });

      await respond(hotelCheckoutResponse(updated as HotelTravelSession));
    },
    async (message) => {
      await respond(errorResponse(message));
    },
  );
});

app.action(/^flight_fare__/, async ({ ack, body, action, respond }) => {
  await ack();

  await withActionSession(
    (action as { action_id: string }).action_id,
    "flight_fare__",
    body.user.id,
    async (session) => {
      if (session.kind !== "flight") {
        await respond(errorResponse("This selection does not belong to a flight flow."));
        return;
      }

      await respond(
        loadingResponse("Repricing the fare and preparing flight checkout..."),
      );
      const selectedId = getSelectedValue(action);
      if (!selectedId) {
        await respond(errorResponse("Selected fare was not provided."));
        return;
      }

      const updated = updateSession(session.id, {
        ...session,
        data: await prepareFlightCheckout(session.data, selectedId),
      });

      await respond(flightCheckoutResponse(updated as FlightTravelSession));
    },
    async (message) => {
      await respond(errorResponse(message));
    },
  );
});

app.action(/^car_vehicle__/, async ({ ack, body, action, respond }) => {
  await ack();

  await withActionSession(
    (action as { action_id: string }).action_id,
    "car_vehicle__",
    body.user.id,
    async (session) => {
      if (session.kind !== "car") {
        await respond(errorResponse("This selection does not belong to a car flow."));
        return;
      }

      await respond(
        loadingResponse("Revalidating the selected car and preparing checkout..."),
      );
      const selectedId = getSelectedValue(action);
      if (!selectedId) {
        await respond(errorResponse("Selected vehicle was not provided."));
        return;
      }

      const updated = updateSession(session.id, {
        ...session,
        data: await prepareCarCheckout(session.data, selectedId),
      });

      await respond(carCheckoutResponse(updated as CarTravelSession));
    },
    async (message) => {
      await respond(errorResponse(message));
    },
  );
});

app.error(async (error) => {
  console.error("Slack bot error:", error);
});

async function main() {
  await connectMcp();
  const tools = await listTools();
  availableToolNames = tools.map((tool) => tool.name);

  console.log(
    `Connected to RouteStack MCP via ${getTransportKind() ?? "unknown transport"} with ${tools.length} tool(s).`,
  );

  const stop = async () => {
    await app.stop().catch(() => undefined);
    await disconnectMcp().catch(() => undefined);
  };

  process.on("SIGINT", () => void stop().finally(() => process.exit(0)));
  process.on("SIGTERM", () => void stop().finally(() => process.exit(0)));

  await app.start(config.app.port);
  console.log(`Slack bot listening on port ${config.app.port}.`);
  console.log(
    "Configure each Slack slash command Request URL as https://8251-14-96-208-210.ngrok-free.app/slack/events",
  );
}

main().catch(async (error) => {
  console.error(error);
  await disconnectMcp().catch(() => undefined);
  process.exit(1);
});
