import { SlashCommandBuilder } from "discord.js";

export const flightsCommand = new SlashCommandBuilder()
  .setName("flights")
  .setDescription("Search RouteStack flights and continue to checkout")
  .addStringOption((option) =>
    option
      .setName("origin")
      .setDescription("Origin city or airport code")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("destination")
      .setDescription("Destination city or airport code")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("departure")
      .setDescription("Departure date in YYYY-MM-DD")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("return")
      .setDescription("Return date in YYYY-MM-DD for round trips"),
  )
  .addIntegerOption((option) =>
    option.setName("adults").setDescription("Adults").setMinValue(1).setMaxValue(9),
  )
  .addIntegerOption((option) =>
    option.setName("children").setDescription("Children").setMinValue(0).setMaxValue(8),
  )
  .addIntegerOption((option) =>
    option.setName("infants").setDescription("Infants").setMinValue(0).setMaxValue(4),
  )
  .addStringOption((option) =>
    option
      .setName("cabin")
      .setDescription("Cabin class")
      .addChoices(
        { name: "Economy", value: "economy" },
        { name: "Premium economy", value: "premium_economy" },
        { name: "Business", value: "business" },
        { name: "First", value: "first" },
      ),
  );
