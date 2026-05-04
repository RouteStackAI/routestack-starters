import { SlashCommandBuilder } from "discord.js";

export const carsCommand = new SlashCommandBuilder()
  .setName("cars")
  .setDescription("Search RouteStack rental cars and continue to checkout")
  .addStringOption((option) =>
    option
      .setName("pickup")
      .setDescription("Pickup city, airport, or station")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("dropoff")
      .setDescription("Dropoff city, airport, or station")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("pickup_date")
      .setDescription("Pickup date in YYYY-MM-DD")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("dropoff_date")
      .setDescription("Dropoff date in YYYY-MM-DD")
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("driver_age")
      .setDescription("Driver age")
      .setMinValue(18)
      .setMaxValue(80),
  );
