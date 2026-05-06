type CommandContext = {
  channelId: string;
};

function metadata(context: CommandContext) {
  return JSON.stringify(context);
}

export function parseViewMetadata(raw: string | undefined): CommandContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CommandContext>;
    if (!parsed.channelId || typeof parsed.channelId !== "string") return null;
    return { channelId: parsed.channelId };
  } catch {
    return null;
  }
}

export function hotelsSearchView(context: CommandContext) {
  return {
    type: "modal" as const,
    callback_id: "hotels_form",
    private_metadata: metadata(context),
    title: {
      type: "plain_text" as const,
      text: "Search Hotels",
    },
    submit: {
      type: "plain_text" as const,
      text: "Search",
    },
    close: {
      type: "plain_text" as const,
      text: "Cancel",
    },
    blocks: [
      {
        type: "input" as const,
        block_id: "destination",
        label: {
          type: "plain_text" as const,
          text: "Destination",
        },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          placeholder: {
            type: "plain_text" as const,
            text: "Chicago or Tokyo",
          },
        },
      },
      {
        type: "input" as const,
        block_id: "checkin",
        label: {
          type: "plain_text" as const,
          text: "Check-in",
        },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          placeholder: {
            type: "plain_text" as const,
            text: "2026-12-20 or Dec 20",
          },
        },
      },
      {
        type: "input" as const,
        block_id: "checkout",
        label: {
          type: "plain_text" as const,
          text: "Check-out",
        },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          placeholder: {
            type: "plain_text" as const,
            text: "2026-12-22 or Dec 22",
          },
        },
      },
      {
        type: "input" as const,
        block_id: "adults",
        optional: true,
        label: {
          type: "plain_text" as const,
          text: "Adults",
        },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          initial_value: "2",
        },
      },
      {
        type: "input" as const,
        block_id: "children",
        optional: true,
        label: {
          type: "plain_text" as const,
          text: "Children",
        },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          initial_value: "0",
        },
      },
      {
        type: "input" as const,
        block_id: "rooms",
        optional: true,
        label: {
          type: "plain_text" as const,
          text: "Rooms",
        },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          initial_value: "1",
        },
      },
    ],
  };
}

export function flightsSearchView(context: CommandContext) {
  return {
    type: "modal" as const,
    callback_id: "flights_form",
    private_metadata: metadata(context),
    title: {
      type: "plain_text" as const,
      text: "Search Flights",
    },
    submit: {
      type: "plain_text" as const,
      text: "Search",
    },
    close: {
      type: "plain_text" as const,
      text: "Cancel",
    },
    blocks: [
      {
        type: "input" as const,
        block_id: "origin",
        label: { type: "plain_text" as const, text: "Origin" },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          placeholder: {
            type: "plain_text" as const,
            text: "SFO or San Francisco",
          },
        },
      },
      {
        type: "input" as const,
        block_id: "destination",
        label: { type: "plain_text" as const, text: "Destination" },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          placeholder: {
            type: "plain_text" as const,
            text: "JFK or New York",
          },
        },
      },
      {
        type: "input" as const,
        block_id: "departure",
        label: { type: "plain_text" as const, text: "Departure date" },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          placeholder: {
            type: "plain_text" as const,
            text: "2026-06-10 or Jun 10",
          },
        },
      },
      {
        type: "input" as const,
        block_id: "return",
        optional: true,
        label: { type: "plain_text" as const, text: "Return date" },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          placeholder: {
            type: "plain_text" as const,
            text: "Optional",
          },
        },
      },
      {
        type: "input" as const,
        block_id: "adults",
        optional: true,
        label: { type: "plain_text" as const, text: "Adults" },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          initial_value: "1",
        },
      },
      {
        type: "input" as const,
        block_id: "children",
        optional: true,
        label: { type: "plain_text" as const, text: "Children" },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          initial_value: "0",
        },
      },
      {
        type: "input" as const,
        block_id: "infants",
        optional: true,
        label: { type: "plain_text" as const, text: "Infants" },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          initial_value: "0",
        },
      },
      {
        type: "input" as const,
        block_id: "cabin",
        optional: true,
        label: { type: "plain_text" as const, text: "Cabin class" },
        element: {
          type: "static_select" as const,
          action_id: "value",
          initial_option: {
            text: { type: "plain_text" as const, text: "Economy" },
            value: "economy",
          },
          options: [
            { text: { type: "plain_text" as const, text: "Economy" }, value: "economy" },
            { text: { type: "plain_text" as const, text: "Premium economy" }, value: "premium_economy" },
            { text: { type: "plain_text" as const, text: "Business" }, value: "business" },
            { text: { type: "plain_text" as const, text: "First" }, value: "first" },
          ],
        },
      },
    ],
  };
}

export function carsSearchView(context: CommandContext) {
  return {
    type: "modal" as const,
    callback_id: "cars_form",
    private_metadata: metadata(context),
    title: {
      type: "plain_text" as const,
      text: "Search Cars",
    },
    submit: {
      type: "plain_text" as const,
      text: "Search",
    },
    close: {
      type: "plain_text" as const,
      text: "Cancel",
    },
    blocks: [
      {
        type: "input" as const,
        block_id: "pickup",
        label: { type: "plain_text" as const, text: "Pickup location" },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          placeholder: {
            type: "plain_text" as const,
            text: "JFK Airport",
          },
        },
      },
      {
        type: "input" as const,
        block_id: "dropoff",
        optional: true,
        label: { type: "plain_text" as const, text: "Dropoff location" },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          placeholder: {
            type: "plain_text" as const,
            text: "Leave blank to use pickup location",
          },
        },
      },
      {
        type: "input" as const,
        block_id: "pickup_date",
        label: { type: "plain_text" as const, text: "Pickup date" },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          placeholder: {
            type: "plain_text" as const,
            text: "2026-12-01 or Dec 1",
          },
        },
      },
      {
        type: "input" as const,
        block_id: "dropoff_date",
        label: { type: "plain_text" as const, text: "Dropoff date" },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          placeholder: {
            type: "plain_text" as const,
            text: "2026-12-05 or Dec 5",
          },
        },
      },
      {
        type: "input" as const,
        block_id: "driver_age",
        optional: true,
        label: { type: "plain_text" as const, text: "Driver age" },
        element: {
          type: "plain_text_input" as const,
          action_id: "value",
          initial_value: "30",
        },
      },
    ],
  };
}
