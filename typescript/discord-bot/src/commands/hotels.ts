import { SlashCommandBuilder } from "discord.js";

export const hotelsCommand = new SlashCommandBuilder()
  .setName("hotels")
  .setDescription("Search RouteStack hotels and continue to checkout")
  .addStringOption((option) =>
    option
      .setName("city")
      .setDescription("Destination city or hotel area")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("checkin")
      .setDescription("Check-in date in YYYY-MM-DD")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("checkout")
      .setDescription("Check-out date in YYYY-MM-DD")
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("adults")
      .setDescription("Total adults")
      .setMinValue(1)
      .setMaxValue(8),
  )
  .addIntegerOption((option) =>
    option
      .setName("children")
      .setDescription("Total children")
      .setMinValue(0)
      .setMaxValue(6),
  )
  .addIntegerOption((option) =>
    option
      .setName("rooms")
      .setDescription("Number of rooms")
      .setMinValue(1)
      .setMaxValue(4),
  )
  // .addStringOption((option) =>
  //   option
  //     .setName("currency")
  //     .setDescription("Preferred currency, for example USD")
  //     .setMaxLength(3),
  // );
