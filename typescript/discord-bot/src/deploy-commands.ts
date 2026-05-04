import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import { bookingInfoCommand, cancelBookingCommand } from "./commands/bookings.js";
import { carsCommand } from "./commands/cars.js";
import { flightsCommand } from "./commands/flights.js";
import { hotelsCommand } from "./commands/hotels.js";

const commands = [
  hotelsCommand,
  flightsCommand,
  carsCommand,
  bookingInfoCommand,
  cancelBookingCommand,
].map((command) => command.toJSON());

async function main() {
  const rest = new REST({ version: "10" }).setToken(config.discord.token);
  const route = config.discord.guildId
    ? Routes.applicationGuildCommands(
        config.discord.clientId,
        config.discord.guildId,
      )
    : Routes.applicationCommands(config.discord.clientId);

  await rest.put(route, { body: commands });

  console.log(
    `Registered ${commands.length} Discord command(s)${config.discord.guildId ? ` for guild ${config.discord.guildId}` : " globally"}.`,
  );
}

main().catch((error) => {
  console.error("Failed to deploy Discord commands.");
  if (typeof error === "object" && error && "status" in error && error.status === 401) {
    console.error(
      "Discord returned 401 Unauthorized. Check that DISCORD_TOKEN is the bot token from the Discord Developer Portal Bot tab, not the client secret, public key, or application ID.",
    );
  }
  console.error(error);
  process.exit(1);
});
