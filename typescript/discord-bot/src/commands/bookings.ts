import { SlashCommandBuilder } from "discord.js";

export const bookingInfoCommand = new SlashCommandBuilder()
  .setName("booking-info")
  .setDescription("Look up an existing RouteStack hotel booking")
  .addStringOption((option) =>
    option
      .setName("booking_id")
      .setDescription("Booking ID")
      .setRequired(true),
  );

export const cancelBookingCommand = new SlashCommandBuilder()
  .setName("cancel-booking")
  .setDescription("Cancel an existing RouteStack hotel booking")
  .addStringOption((option) =>
    option
      .setName("booking_id")
      .setDescription("Booking ID")
      .setRequired(true),
  );
