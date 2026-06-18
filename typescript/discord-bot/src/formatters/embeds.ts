import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import type {
  CarOffer,
  FlightOffer,
  TravelSession,
} from "../types.js";
import { formatPrice, formatRoomSummary, truncate } from "../utils.js";

function buildLinkRow(url: string, label: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(label),
  );
}

function buildCheckoutDelivery(
  url: string,
  label: string,
  shortUrl?: string,
) {
  if (!url) {
    return {
      content: undefined,
      components: [] as ActionRowBuilder<ButtonBuilder>[],
      files: [] as AttachmentBuilder[],
      note: "RouteStack did not return a checkout URL.",
    };
  }

  if (shortUrl && shortUrl.length <= 512) {
    return {
      content: undefined,
      components: [buildLinkRow(shortUrl, label)],
      files: [] as ActionRowBuilder<ButtonBuilder>[],
      note:
        "A secured checkout URL is here",
    };
  }

  if (url.length <= 512) {
    return {
      content: undefined,
      components: [buildLinkRow(url, label)],
      files: [] as AttachmentBuilder[],
      note: undefined,
    };
  }

  if (url.length <= 2000) {
    return {
      content: `[Continue to RouteStack checkout](${url})`,
      components: [] as ActionRowBuilder<ButtonBuilder>[],
      files: [] as AttachmentBuilder[],
      note:
        "The checkout URL is longer than Discord's 512 character button limit, so it is included in the message body instead.",
    };
  }

  return {
    content:
      "The checkout URL is too long for a Discord button or message body, so it has been attached as a text file.",
    components: [] as ActionRowBuilder<ButtonBuilder>[],
    files: [
      new AttachmentBuilder(Buffer.from(`${url}\n`, "utf8"), {
        name: "routestack-checkout-url.txt",
      }),
    ],
    note:
      "The checkout URL exceeded Discord's message limits and was attached as a text file.",
  };
}

function divider(text: string) {
  return `━━━━━━━━━━ ${text} ━━━━━━━━━━`;
}

function sessionMetaEmbed(
  title: string,
  accentColor: number,
  lines: Array<{ name: string; value: string; inline?: boolean }>,
) {
  return new EmbedBuilder()
    .setColor(accentColor)
    .setTitle(title)
    .addFields(lines.map((line) => ({ ...line, value: truncate(line.value, 1024) })));
}

function hotelSessionSummaryEmbed(session: TravelSession & { kind: "hotel" }) {
  const metadata = [
    {
      name: "Destination",
      value: session.data.selectedDestination?.fullName ?? session.data.query,
      inline: false,
    },
    {
      name: "Check-In",
      value: session.data.checkIn,
      inline: true,
    },
    {
      name: "Check-Out",
      value: session.data.checkOut,
      inline: true,
    },
    {
      name: "Guests",
      value: formatRoomSummary(session.data.rooms),
      inline: false,
    },
  ]

  return sessionMetaEmbed("Your hotel trip", 0x1d4ed8, metadata);
}

function flightSessionSummaryEmbed(session: TravelSession & { kind: "flight" }) {
  return sessionMetaEmbed("Your flight trip", 0x1d4ed8, [
    {
      name: "Route",
      value: `${session.data.origin?.code ?? session.data.originQuery} -> ${session.data.destination?.code ?? session.data.destinationQuery}`,
      inline: true,
    },
    {
      name: "Departure",
      value: session.data.departureDate,
      inline: true,
    },
    {
      name: "Return",
      value: session.data.returnDate ?? "One way",
      inline: true,
    },
    {
      name: "Travelers",
      value: `${session.data.adults} adult, ${session.data.children} child, ${session.data.infants} infant`,
      inline: true,
    },
    {
      name: "Cabin",
      value: session.data.cabinClass,
      inline: true,
    },
    {
      name: "Selected fare",
      value: session.data.selectedFlight
        ? flightLabel(session.data.selectedFlight)
        : "Not selected yet",
      inline: true,
    },
  ]).setFooter({ text: "This summary stays consistent while the next step loads below." });
}

function carSessionSummaryEmbed(session: TravelSession & { kind: "car" }) {
  return sessionMetaEmbed("Your car trip", 0x1d4ed8, [
    {
      name: "Pickup",
      value: `${session.data.pickup?.label ?? session.data.pickupQuery} on ${session.data.pickupDate}`,
      inline: true,
    },
    {
      name: "Dropoff",
      value: `${session.data.dropoff?.label ?? session.data.dropoffQuery} on ${session.data.dropoffDate}`,
      inline: true,
    },
    {
      name: "Driver age",
      value: `${session.data.driverAge}`,
      inline: true,
    },
    {
      name: "Selected car",
      value: session.data.selectedCar?.vehicleName ?? "Not selected yet",
      inline: false,
    },
  ]).setFooter({ text: "This summary stays consistent while the next step loads below." });
}

function sectionHeaderEmbed(title: string, color: number, description?: string) {
  const embed =  new EmbedBuilder()
    .setColor(color)
    .setTitle(title);

    if(description) {
      embed.setDescription(truncate(description, 4000))
    }

    return embed;
}

export function loadingMessage(
  session: TravelSession,
  label: string,
) {
  const summary =
    session.kind === "hotel"
      ? hotelSessionSummaryEmbed(session)
      : session.kind === "flight"
        ? flightSessionSummaryEmbed(session)
        : carSessionSummaryEmbed(session);

  return {
    embeds: [
      summary,
      sectionHeaderEmbed("Working on it...", 0xf59e0b),
    ],
    components: [],
  };
}

export function errorEmbed(message: string) {
  return new EmbedBuilder()
    .setColor(0xdc2626)
    .setTitle("RouteStack request failed")
    .setDescription(truncate(message, 4000));
}

export function destinationDiscoveryMessage(session: TravelSession & { kind: "hotel" }) {
  const embed = sectionHeaderEmbed(
    "Choose a RouteStack destination",
    0x2563eb,
    `Found ${session.data.destinationOptions.length} destination option(s) for **${session.data.query}**.`,
  )
  
  // .addFields(
  //   session.data.destinationOptions.slice(0, 5).map((option, index) => ({
  //     name: `${index + 1}. ${option.fullName}`,
  //     value: truncate(
  //       `${option.type || "Destination"}${option.country ? ` | ${option.country}` : ""}`,
  //       1024,
  //     ),
  //   })),
  // );

  const select = new StringSelectMenuBuilder()
    .setCustomId(`hotel:destination:${session.id}`)
    .setPlaceholder("Select a destination to search hotels")
    .addOptions(
      session.data.destinationOptions.slice(0, 10).map((option) => ({
        label: truncate(option.fullName, 100),
        description: truncate(option.type || option.country || "Destination", 100),
        value: option.id,
      })),
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  };
}

function getStarRating(rating: number) {
  let stars = "";

  if(rating > 0) {
    for(let i=0; i<=rating; i++) {
      stars += "⭐ "
    }
  }

  return stars
}

export function hotelResultsMessage(session: TravelSession & { kind: "hotel" }) {
  const overview = sectionHeaderEmbed(
    `Hotels in ${session.data.selectedDestination?.fullName ?? session.data.query}`,
    0x16a34a,
    `${
      session.data.aiNote ??
      `Found ${session.data.hotels.length} hotel option(s). Pick one to load details and live room rates.`
    }`,
  );

  const hotelEmbeds = session.data.hotels.map((hotel, index) => {
    const embed = new EmbedBuilder()
      .setColor(0x16a34a)
      .setTitle(`${index + 1}. ${hotel.name}`)
      .setDescription(
        truncate(
          [
            hotel.address,
            `From ${formatPrice(hotel.price, hotel.currency)}`,
            hotel.starRating ? `${getStarRating(hotel.starRating)}` : null,
            hotel.rating ? `Guest rating ${hotel.rating}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          4000,
        ),
      );

    if (hotel.image) {
      embed.setThumbnail(hotel.image);
    }

    return embed;
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`hotel:property:${session.id}`)
    .setPlaceholder("Select a hotel to view room rates")
    .addOptions(
      session.data.hotels.map((hotel) => ({
        label: truncate(hotel.name, 100),
        description: truncate(
          `${formatPrice(hotel.price, hotel.currency)} | ${hotel.address}`,
          100,
        ),
        value: hotel.id,
      })),
    );

  return {
    embeds: [hotelSessionSummaryEmbed(session), overview, ...hotelEmbeds],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  };
}

export function hotelDetailsMessage(session: TravelSession & { kind: "hotel" }) {
  const hotel = session.data.selectedHotel;
  if (!hotel) {
    return { embeds: [errorEmbed("No hotel is selected.")], components: [] };
  }

  const details = session.data.hotelDetails ?? {};
  const description =
    typeof details.description === "string"
      ? details.description
      : typeof details.shortDescription === "string"
        ? details.shortDescription
        : hotel.address;

  const detailIntro = sectionHeaderEmbed(
    "Selected hotel and room choices",
    0xf59e0b,
    `**${hotel.name}**\n${truncate(description, 3500)}`,
  ).addFields({
    name: "Location",
    value: truncate(hotel.address, 1024),
    inline: false,
  });

  if (hotel.image) {
    detailIntro.setThumbnail(hotel.image);
  }

  const roomsEmbed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("Available rooms")
    .setDescription(
      "Choose one of the live room and rate combinations below.",
    )
    .addFields(
      session.data.roomOffers.map((room, index) => ({
        name: `${index + 1}. ${room.name}`,
        value: truncate(
          [
            `Total: ${formatPrice(room.price, room.currency)}`,
            `Cancellation: ${
              room.refundable === true
                ? "Refundable"
                : room.refundable === false
                  ? "Non-refundable"
                  : "Check rate details"
            }`,
            `Meal plan: ${room.mealPlan ?? "Not specified"}`,
            `Highlights: ${
              room.facilities?.length
                ? room.facilities.join(" | ")
                : "Room highlights were not provided for this rate."
            }`,
            index < session.data.roomOffers.length - 1
              ? "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
          1024,
        ),
        inline: false,
      })),
    );

  const select = new StringSelectMenuBuilder()
    .setCustomId(`hotel:room:${session.id}`)
    .setPlaceholder("Select a room to prepare checkout")
    .addOptions(
      session.data.roomOffers.map((room) => ({
        label: truncate(room.name, 100),
        description: truncate(`${formatPrice(room.price, room.currency)} | ${room.refundable ? "Refundable" : "Non-refundable"}`, 100),
        value: `${room.id}___${room.recommendationId}`,
      })),
    );

  return {
    embeds: [
      hotelSessionSummaryEmbed(session),
      detailIntro,
      roomsEmbed,
    ],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  };
}

export function hotelCheckoutMessage(session: TravelSession & { kind: "hotel" }) {
  const hotel = session.data.selectedHotel;
  const room = session.data.selectedRoom;
  const location = session.data.selectedDestination?.fullName ?? session.data.query;

  const delivery = buildCheckoutDelivery(
    session.data.paymentUrl ?? "",
    "Open hotel checkout",
    session.data.shortPaymentUrl,
  );
  const embed = new EmbedBuilder()
    .setColor(0x0f766e)
    .setTitle("Hotel checkout ready")
    .setDescription(
      room && hotel
        ? `RouteStack prepared checkout for **${hotel.name}** and **${room.name}**.\n\n`
        : "RouteStack prepared hotel checkout.\n\n",
    )
    .addFields(
      hotel ? { name: "Hotel", value: hotel.name, inline: false } : { name: "Hotel", value: "N/A", inline: false },
      location ? { name: "Location", value: location, inline: false } : { name: "Location", value: "N/A", inline: false },
      room ? { name: "Room", value: room.name, inline: false } : { name: "Room", value: "N/A", inline: false },
      room ? { name: "Check-In", value: session.data.checkIn, inline: true } : { name: "Check-In", value: "N/A", inline: true },
      room ? { name: "Check-Out", value: session.data.checkOut, inline: true } : { name: "Check-Out", value: "N/A", inline: true },
      {
        name: "Price",
        value: formatPrice(room?.price ?? hotel?.price, room?.currency ?? hotel?.currency),
        inline: true,
      },
    );

  if (delivery.note) {
    embed.addFields({
      name: "\n\nCheckout delivery",
      value: truncate(delivery.note, 1024),
      inline: false,
    });
  }

  if (hotel?.image) {
    embed.setThumbnail(hotel.image);
  }

  return {
    content: delivery.content,
    embeds: [embed],
    components: delivery.components,
    files: delivery.files,
  };
}

function flightLabel(flight: FlightOffer) {
  return `${flight.airline} ${flight.flightNumber}`.trim();
}

export function flightResultsMessage(session: TravelSession & { kind: "flight" }) {
  if (session.data.flights.length === 0) {
    return {
      embeds: [
        flightSessionSummaryEmbed(session),
        sectionHeaderEmbed(
          "No flights found",
          0xdc2626,
          "RouteStack did not return any live fares for that route. Try another destination or travel date.",
        ),
      ],
      components: [],
    };
  }

  const overview = sectionHeaderEmbed(
    "Flight options",
    0x2563eb,
    `${
      session.data.aiNote ??
      `Found ${session.data.flights.length} fare option(s) from ${session.data.origin?.code ?? session.data.origin?.label} to ${session.data.destination?.code ?? session.data.destination?.label}.`
    }`,
  );

  const flightEmbeds = session.data.flights.map((flight, index) =>
    new EmbedBuilder()
      .setColor(0x2563eb)
      .setTitle(`${index + 1}. ${flightLabel(flight)}`)
      .setDescription(
        truncate(
          `${flight.routeSummary ?? `${flight.from} -> ${flight.to}`}\n${flight.departure} to ${flight.arrival}\n${formatPrice(flight.price, flight.currency)}`,
          4000,
        ),
      )
      .addFields(
        [
          flight.duration
            ? { name: "Duration", value: flight.duration, inline: true }
            : null,
          flight.stops !== undefined
            ? {
                name: "Stops",
                value:
                  flight.stops === 0
                    ? "Nonstop"
                    : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`,
                inline: true,
              }
            : null,
          flight.cabin
            ? { name: "Cabin", value: flight.cabin, inline: true }
            : null,
          flight.fareFamily
            ? { name: "Fare", value: flight.fareFamily, inline: true }
            : null,
          flight.remainingSeats
            ? {
                name: "Seats left",
                value: `${flight.remainingSeats}`,
                inline: true,
              }
            : null,
        ].filter((field): field is { name: string; value: string; inline: boolean } => Boolean(field)),
      ),
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId(`flight:fare:${session.id}`)
    .setPlaceholder("Select a flight to prepare checkout")
    .addOptions(
      session.data.flights.map((flight) => ({
        label: truncate(flightLabel(flight), 100),
        description: truncate(
          `${flight.routeSummary ?? `${flight.from} -> ${flight.to}`} | ${formatPrice(flight.price, flight.currency)}`,
          100,
        ),
        value: flight.id,
      })),
    );

  return {
    embeds: [flightSessionSummaryEmbed(session), overview, ...flightEmbeds],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  };
}

export function flightCheckoutMessage(session: TravelSession & { kind: "flight" }) {
  const flight = session.data.selectedFlight;
  const delivery = buildCheckoutDelivery(
    session.data.paymentUrl ?? "",
    "Open flight checkout",
    session.data.shortPaymentUrl,
  );
  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle("Flight checkout ready")
    .setDescription(
      flight
        ? `RouteStack repriced **${flightLabel(flight)}** and prepared a checkout link.`
        : "RouteStack prepared flight checkout.",
    )
    .addFields(
      flight
        ? { name: "Route", value: flight.routeSummary ?? `${flight.from} -> ${flight.to}`, inline: true }
        : { name: "Route", value: "N/A", inline: true },
      flight
        ? { name: "Schedule", value: `${flight.departure} to ${flight.arrival}`, inline: true }
        : { name: "Schedule", value: "N/A", inline: true },
      {
        name: "Price",
        value: formatPrice(flight?.price, flight?.currency),
        inline: true,
      },
    );

  if (delivery.note) {
    embed.addFields({
      name: "Checkout delivery",
      value: truncate(delivery.note, 1024),
      inline: false,
    });
  }

  return {
    content: delivery.content,
    embeds: [flightSessionSummaryEmbed(session), embed],
    components: delivery.components,
    files: delivery.files,
  };
}

function formatCarRateType(rateType?: string) {
  if (!rateType) return "";
  if (rateType === "prepaid") return "Prepaid";
  if (rateType === "postpaid") return "Pay Later";
  return rateType;
}

function buildCarDescription(car: CarOffer) {
  const lines = [
    car.vendor,
    `${formatPrice(car.price, car.currency)}${car.rateType ? ` (${formatCarRateType(car.rateType)})` : ""}`,
    car.transmission ? `Transmission: ${car.transmission}` : null,
    car.seats || car.doors || car.bags
      ? `Passengers: ${car.seats ?? "—"} | Doors: ${car.doors ?? "—"} | Bags: ${car.bags ?? "—"}`
      : null,
    car.fuelType ? `Fuel Type: ${car.fuelType}` : null,
    car.pickupLocation ? `Pickup: ${car.pickupLocation}` : null,
    car.dropoffLocation ? `Dropoff: ${car.dropoffLocation}` : null,
    car.freeCancellation !== undefined
      ? `Free Cancellation: ${car.freeCancellation ? "Yes" : "No"}`
      : null,
    car.mileage ? `Mileage: ${car.mileage}` : null,
    car.inclusions?.length ? `Inclusions: ${car.inclusions.join(", ")}` : null,
  ].filter(Boolean);

  return truncate(lines.join("\n"), 4000);
}

export function carResultsMessage(session: TravelSession & { kind: "car" }) {
  if (session.data.cars.length === 0) {
    return {
      embeds: [
        carSessionSummaryEmbed(session),
        sectionHeaderEmbed(
          "No cars found",
          0xdc2626,
          "RouteStack did not return rental cars for those locations and dates. Try nearby airports or different dates.",
        ),
      ],
      components: [],
    };
  }

  const overview = sectionHeaderEmbed(
    "Rental car options",
    0xea580c,
    `${
      session.data.aiNote ??
      `Found ${session.data.cars.length} car option(s) for ${session.data.pickup?.label ?? session.data.pickupQuery} to ${session.data.dropoff?.label ?? session.data.dropoffQuery}.`
    }`,
  );

  const carEmbeds = session.data.cars.map((car, index) => {
    const embed = new EmbedBuilder()
      .setColor(0xea580c)
      .setTitle(`${index + 1}. ${car.vehicleName}`)
      .setDescription(buildCarDescription(car));

    if (car.image) {
      embed.setImage(car.image);
    }

    return embed;
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`car:vehicle:${session.id}`)
    .setPlaceholder("Select a car to prepare checkout")
    .addOptions(
      session.data.cars.map((car) => ({
        label: truncate(car.vehicleName, 100),
        description: truncate(
          `${car.vendor} | ${formatPrice(car.price, car.currency)}`,
          100,
        ),
        value: car.id,
      })),
    );

  return {
    embeds: [carSessionSummaryEmbed(session), overview, ...carEmbeds],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  };
}

export function carCheckoutMessage(session: TravelSession & { kind: "car" }) {
  const car = session.data.selectedCar;
  const delivery = buildCheckoutDelivery(
    session.data.paymentUrl ?? "",
    "Open car checkout",
    session.data.shortPaymentUrl,
  );
  const embed = new EmbedBuilder()
    .setColor(0x0891b2)
    .setTitle("Car checkout ready")
    .setDescription(
      car
        ? `RouteStack repriced **${car.vehicleName}** and prepared a checkout link.`
        : "RouteStack prepared car checkout.",
    )
    .addFields(
      car ? { name: "Vehicle", value: car.vehicleName, inline: false } : { name: "Vehicle", value: "N/A", inline: false },
      car ? { name: "Vendor", value: car.vendor, inline: true } : { name: "Vendor", value: "N/A", inline: true },
      {
        name: "Price",
        value: `${formatPrice(car?.price, car?.currency)}${car?.rateType ? ` (${formatCarRateType(car.rateType)})` : ""}`,
        inline: true,
      },
      car?.pickupLocation
        ? { name: "Pickup", value: truncate(car.pickupLocation, 1024), inline: false }
        : { name: "Pickup", value: "N/A", inline: false },
      car?.mileage ? { name: "Mileage", value: car.mileage, inline: true } : { name: "Mileage", value: "N/A", inline: true },
    );

  if (car?.image) {
    embed.setThumbnail(car.image);
  }

  if (delivery.note) {
    embed.addFields({
      name: "Checkout delivery",
      value: truncate(delivery.note, 1024),
      inline: false,
    });
  }

  return {
    content: delivery.content,
    embeds: [carSessionSummaryEmbed(session), embed],
    components: delivery.components,
    files: delivery.files,
  };
}

export function bookingInfoMessage(data: Record<string, unknown>) {
  return new EmbedBuilder()
    .setColor(0x2563eb)
    .setTitle("Booking details")
    .setDescription("RouteStack returned the following booking summary.")
    .addFields(
      {
        name: "Booking ID",
        value: String(data.bookingId ?? data.id ?? "Unknown"),
        inline: true,
      },
      {
        name: "Status",
        value: String(data.bookingStatus ?? data.status ?? "Unknown"),
        inline: true,
      },
      {
        name: "Hotel",
        value: String(data.hotelName ?? data.name ?? "Unknown"),
        inline: true,
      },
      {
        name: "Dates",
        value: `${String(data.checkInDate ?? data.tripStartDate ?? "N/A")} to ${String(data.checkOutDate ?? data.tripEndDate ?? "N/A")}`,
        inline: false,
      },
      {
        name: "Confirmation",
        value: String(data.confirmationNumber ?? data.providerConfirmationNumber ?? "N/A"),
        inline: false,
      },
    );
}

export function cancellationMessage(data: Record<string, unknown>) {
  return new EmbedBuilder()
    .setColor(0xdc2626)
    .setTitle("Booking cancellation response")
    .setDescription(truncate(JSON.stringify(data, null, 2), 4000));
}
