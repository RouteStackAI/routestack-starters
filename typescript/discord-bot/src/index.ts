import { Client, Events, GatewayIntentBits, REST, Routes } from "discord.js";
import { bookingInfoCommand, cancelBookingCommand } from "./commands/bookings.js";
import { carsCommand } from "./commands/cars.js";
import { flightsCommand } from "./commands/flights.js";
import { hotelsCommand } from "./commands/hotels.js";
import { config } from "./config.js";
import {
  bookingInfoMessage,
  cancellationMessage,
  carCheckoutMessage,
  carResultsMessage,
  destinationDiscoveryMessage,
  errorEmbed,
  flightCheckoutMessage,
  flightResultsMessage,
  hotelCheckoutMessage,
  hotelDetailsMessage,
  hotelResultsMessage,
  loadingMessage,
} from "./formatters/embeds.js";
import {
  connectMcp,
  disconnectMcp,
  getTransportKind,
  listTools,
} from "./mcp-client.js";
import { createShortCheckoutUrl, startShortLinkServer } from "./short-links.js";
import {
  assertSessionOwner,
  cleanupExpiredSessions,
  createSession,
  getSession,
  updateSession,
} from "./session-store.js";
import {
  cancelBooking,
  createCarSession,
  createFlightSession,
  createHotelDiscoverySession,
  getBookingInfo,
  hotelRoomOccupancyFromCounts,
  inspectHotel,
  prepareCarCheckout,
  prepareFlightCheckout,
  prepareHotelCheckout,
  searchHotelsForDestination,
} from "./travel-service.js";
import type { TravelSession } from "./types.js";

const commands = [
  hotelsCommand,
  flightsCommand,
  carsCommand,
  bookingInfoCommand,
  cancelBookingCommand,
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

let availableToolNames: string[] = [];

type HotelTravelSession = Extract<TravelSession, { kind: "hotel" }>;
type FlightTravelSession = Extract<TravelSession, { kind: "flight" }>;
type CarTravelSession = Extract<TravelSession, { kind: "car" }>;

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseComponentId(customId: string) {
  const [kind, action, sessionId] = customId.split(":");
  return { kind, action, sessionId };
}

async function ensureCommandsRegistered() {
  const rest = new REST({ version: "10" }).setToken(config.discord.token);
  const route = config.discord.guildId
    ? Routes.applicationGuildCommands(
        config.discord.clientId,
        config.discord.guildId,
      )
    : Routes.applicationCommands(config.discord.clientId);

  await rest.put(route, {
    body: commands.map((command) => command.toJSON()),
  });
}

async function handleHotels(interaction: any) {
  const city = interaction.options.getString("city", true);
  const checkIn = interaction.options.getString("checkin", true);
  const checkOut = interaction.options.getString("checkout", true);
  const adults = interaction.options.getInteger("adults") ?? 2;
  const children = interaction.options.getInteger("children") ?? 0;
  const rooms = interaction.options.getInteger("rooms") ?? 1;
  const currency = "USD";

  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) {
    await interaction.editReply({
      embeds: [errorEmbed("Dates must be provided in YYYY-MM-DD format.")],
    });
    return;
  }

  const sessionData = await createHotelDiscoverySession({
    userRequest: `Hotels in ${city} from ${checkIn} to ${checkOut}`,
    query: city,
    checkIn,
    checkOut,
    rooms: hotelRoomOccupancyFromCounts(rooms, adults, children),
    currency,
  });

  const session = createSession({
    kind: "hotel",
    userId: interaction.user.id,
    data: sessionData,
  }) as HotelTravelSession;

  await interaction.editReply(destinationDiscoveryMessage(session));
}

async function handleFlights(interaction: any) {
  const originQuery = interaction.options.getString("origin", true);
  const destinationQuery = interaction.options.getString("destination", true);
  const departureDate = interaction.options.getString("departure", true);
  const returnDate = interaction.options.getString("return") ?? undefined;
  const adults = interaction.options.getInteger("adults") ?? 1;
  const children = interaction.options.getInteger("children") ?? 0;
  const infants = interaction.options.getInteger("infants") ?? 0;
  const cabinClass = interaction.options.getString("cabin") ?? "economy";

  if (!isIsoDate(departureDate) || (returnDate && !isIsoDate(returnDate))) {
    await interaction.editReply({
      embeds: [errorEmbed("Dates must be provided in YYYY-MM-DD format.")],
    });
    return;
  }

  const sessionData = await createFlightSession({
    originQuery,
    destinationQuery,
    departureDate,
    returnDate,
    adults,
    children,
    infants,
    cabinClass,
    availableTools: availableToolNames,
  });

  const session = createSession({
    kind: "flight",
    userId: interaction.user.id,
    data: sessionData,
  }) as FlightTravelSession;

  await interaction.editReply(flightResultsMessage(session));
}

async function handleCars(interaction: any) {
  const pickupQuery = interaction.options.getString("pickup", true);
  const dropoffQuery = interaction.options.getString("dropoff", true);
  const pickupDate = interaction.options.getString("pickup_date", true);
  const dropoffDate = interaction.options.getString("dropoff_date", true);
  const driverAge = interaction.options.getInteger("driver_age") ?? 30;

  if (!isIsoDate(pickupDate) || !isIsoDate(dropoffDate)) {
    await interaction.editReply({
      embeds: [errorEmbed("Dates must be provided in YYYY-MM-DD format.")],
    });
    return;
  }

  const sessionData = await createCarSession({
    userRequest: `Cars from ${pickupQuery} to ${dropoffQuery} between ${pickupDate} and ${dropoffDate}`,
    pickupQuery,
    dropoffQuery,
    pickupDate,
    dropoffDate,
    driverAge,
  });

  const session = createSession({
    kind: "car",
    userId: interaction.user.id,
    data: sessionData,
  }) as CarTravelSession;

  await interaction.editReply(carResultsMessage(session));
}

async function handleBookingInfo(interaction: any) {
  const bookingId = interaction.options.getString("booking_id", true);
  const data = await getBookingInfo(bookingId);
  await interaction.editReply({ embeds: [bookingInfoMessage(data)] });
}

async function handleCancelBooking(interaction: any) {
  const bookingId = interaction.options.getString("booking_id", true);
  const data = await cancelBooking(bookingId);
  await interaction.editReply({ embeds: [cancellationMessage(data)] });
}

async function handleSelectMenu(interaction: any) {
  const { kind, action, sessionId } = parseComponentId(interaction.customId);
  if (!kind || !action || !sessionId) return;

  const session = getSession(sessionId);
  if (!session) {
    await interaction.reply({
      ephemeral: true,
      embeds: [errorEmbed("That travel session has expired. Run the slash command again.")],
    });
    return;
  }

  if (!assertSessionOwner(session, interaction.user.id)) {
    await interaction.reply({
      ephemeral: true,
      embeds: [errorEmbed("That travel session belongs to another user.")],
    });
    return;
  }

  if (kind === "hotel" && action === "destination" && session.kind === "hotel") {
    await interaction.deferUpdate();
    await interaction.editReply(
      loadingMessage(session, "Searching hotels for your selected destination..."),
    );
    const selectedId = interaction.values[0];
    const destination = session.data.destinationOptions.find(
      (option) => option.id === selectedId,
    );
    if (!destination) {
      await interaction.editReply({
        embeds: [errorEmbed("Selected destination was not found in the session.")],
        components: [],
      });
      return;
    }

    const updated = updateSession(session.id, {
      ...session,
      data: await searchHotelsForDestination(session.data, destination),
    });

    await interaction.editReply(hotelResultsMessage(updated as HotelTravelSession));
    return;
  }

  if (kind === "hotel" && action === "property" && session.kind === "hotel") {
    await interaction.deferUpdate();
    await interaction.editReply(
      loadingMessage(session, "Loading hotel details and live room rates..."),
    );
    const updated = updateSession(session.id, {
      ...session,
      data: await inspectHotel(session.data, interaction.values[0]),
    });
    await interaction.editReply(hotelDetailsMessage(updated as HotelTravelSession));
    return;
  }

  if (kind === "hotel" && action === "room" && session.kind === "hotel") {
    await interaction.deferUpdate();
    await interaction.editReply(
      loadingMessage(session, "Revalidating the selected room and preparing checkout..."),
    );
    const hotelData = await prepareHotelCheckout(
      session.data,
      interaction.values[0],
    );
    hotelData.shortPaymentUrl = createShortCheckoutUrl(hotelData.paymentUrl);
    const updated = updateSession(session.id, {
      ...session,
      data: hotelData,
    });
    await interaction.editReply(hotelCheckoutMessage(updated as HotelTravelSession));
    return;
  }

  if (kind === "flight" && action === "fare" && session.kind === "flight") {
    await interaction.deferUpdate();
    await interaction.editReply(
      loadingMessage(session, "Repricing the fare and preparing flight checkout..."),
    );
    const flightData = await prepareFlightCheckout(
      session.data,
      interaction.values[0],
    );
    flightData.shortPaymentUrl = createShortCheckoutUrl(flightData.paymentUrl);
    const updated = updateSession(session.id, {
      ...session,
      data: flightData,
    });
    await interaction.editReply(
      flightCheckoutMessage(updated as FlightTravelSession),
    );
    return;
  }

  if (kind === "car" && action === "vehicle" && session.kind === "car") {
    await interaction.deferUpdate();
    await interaction.editReply(
      loadingMessage(session, "Revalidating the selected car and preparing checkout..."),
    );
    const carData = await prepareCarCheckout(session.data, interaction.values[0]);
    carData.shortPaymentUrl = createShortCheckoutUrl(carData.paymentUrl);
    const updated = updateSession(session.id, {
      ...session,
      data: carData,
    });
    await interaction.editReply(carCheckoutMessage(updated as CarTravelSession));
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Discord bot logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    cleanupExpiredSessions();
    
    if (interaction.isChatInputCommand()) {
      await interaction.deferReply({ ephemeral: true });
      
      switch (interaction.commandName) {
        case "hotels":
          await handleHotels(interaction);
          return;
        case "flights":
          await handleFlights(interaction);
          return;
        case "cars":
          await handleCars(interaction);
          return;
        case "booking-info":
          await handleBookingInfo(interaction);
          return;
        case "cancel-booking":
          await handleCancelBooking(interaction);
          return;
        default:
          await interaction.editReply({
            embeds: [errorEmbed(`Unknown command: ${interaction.commandName}`)],
          });
          return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction
          .editReply({ embeds: [errorEmbed(message)], components: [] })
          .catch(() => undefined);
      } else {
        await interaction
          .reply({ ephemeral: true, embeds: [errorEmbed(message)] })
          .catch(() => undefined);
      }
    }
    console.error(error);
  }
});

async function main() {
  await connectMcp();
  const tools = await listTools();
  availableToolNames = tools.map((tool) => tool.name);

  console.log(
    `Connected to RouteStack MCP via ${getTransportKind() ?? "unknown transport"} with ${tools.length} tool(s).`,
  );

  startShortLinkServer();

  if (process.env.DISCORD_AUTO_DEPLOY === "true") {
    await ensureCommandsRegistered();
    console.log("Discord commands deployed automatically on startup.");
  }

  const stop = async () => {
    await disconnectMcp().catch(() => undefined);
    client.destroy();
  };

  process.on("SIGINT", () => void stop().finally(() => process.exit(0)));
  process.on("SIGTERM", () => void stop().finally(() => process.exit(0)));

  await client.login(config.discord.token);
}

main().catch(async (error) => {
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    error.code === "TokenInvalid"
  ) {
    console.error(
      "Discord rejected DISCORD_TOKEN. Use the bot token from the Discord Developer Portal Bot tab and make sure there are no extra quotes or spaces in .env.",
    );
  }
  console.error(error);
  await disconnectMcp().catch(() => undefined);
  process.exit(1);
});
