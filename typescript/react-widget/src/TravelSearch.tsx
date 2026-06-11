import {
  BedDouble,
  CarFront,
  LoaderCircle,
  Plane,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  callTool,
  connectMcp,
  disconnectMcp,
  getTransportKind,
  listTools,
  setApiBaseUrl,
} from "./mcp-client.js";
import type {
  CarOffer,
  FlightOffer,
  HotelListing,
  HotelRoomOccupancy,
  HotelRoomOffer,
  LookupOption,
  HotelLookupOption,
  SearchMode,
  ToolState,
  TravelSearchProps,
} from "./types.js";
import HotelFormSection from "./components/HotelFormSection.js";
import HotelResultsSection from "./components/HotelResultsSection.js";
import {
  extractJson,
  extractPaymentUrl,
  extractText,
  formatRoomSummary,
  formatToolError,
  getFutureDate,
  hasTool,
  normalizeCarOffers,
  normalizeFlightOffers,
  normalizeHotelListings,
  normalizeHotelLookupOptions,
  normalizeHotelRoomOffers,
  normalizeLookupOptions,
  readStringRecord,
} from "./utils.js";
import FlightFormSection from "./components/FlightFormSection.js";
import CarFormSection from "./components/CarFormSection.js";
import FlightResultsSection from "./components/FlightResultsSection.js";
import CarResultsSection from "./components/CarResultsSection.js";

interface HotelFormState {
  destinationQuery: string;
  selectedDestination: HotelLookupOption | null;
  checkIn: string;
  checkOut: string;
  rooms: HotelRoomOccupancy[];
}

interface FlightFormState {
  originQuery: string;
  destinationQuery: string;
  selectedOrigin: LookupOption | null;
  selectedDestination: LookupOption | null;
  departureDate: string;
  returnDate: string;
  adults: number;
  children: number;
  infants: number;
  cabinClass: string;
}

interface CarFormState {
  pickupQuery: string;
  dropoffQuery: string;
  selectedPickup: LookupOption | null;
  selectedDropoff: LookupOption | null;
  pickupDate: string;
  dropoffDate: string;
  driverAge: number;
}

interface HotelFlowState {
  token: string | null;
  correlationId: string | null;
  destinationOptions: HotelLookupOption[];
  hotels: HotelListing[];
  selectedHotel: HotelListing | null;
  hotelDetails: Record<string, unknown> | null;
  roomOffers: HotelRoomOffer[];
  selectedRoom: HotelRoomOffer | null;
  revalidation: Record<string, unknown> | null;
  paymentUrl: string;
}

interface FlightFlowState {
  originOptions: LookupOption[];
  destinationOptions: LookupOption[];
  flights: FlightOffer[];
  selectedFlight: FlightOffer | null;
  revalidation: Record<string, unknown> | null;
  paymentUrl: string;
  session: Record<string, unknown> | null;
}

interface CarFlowState {
  pickupOptions: LookupOption[];
  dropoffOptions: LookupOption[];
  cars: CarOffer[];
  selectedCar: CarOffer | null;
  revalidation: Record<string, unknown> | null;
  paymentUrl: string;
}

interface ActionState {
  key: string | null;
  label: string;
}

const MODES: Array<{
  value: SearchMode;
  label: string;
  icon: typeof BedDouble;
  tagline: string;
}> = [
  {
    value: "hotels",
    label: "Hotels",
    icon: BedDouble,
    tagline: "Destination search, live rates, and checkout handoff",
  },
  {
    value: "flights",
    label: "Flights",
    icon: Plane,
    tagline: "Airport lookup, fare search, and revalidation",
  },
  {
    value: "cars",
    label: "Cars",
    icon: CarFront,
    tagline: "Location lookup, vehicle pricing, and booking continuation",
  },
];

const DEFAULT_HOTEL_FORM: HotelFormState = {
  destinationQuery: "",
  selectedDestination: null,
  checkIn: getFutureDate(14),
  checkOut: getFutureDate(17),
  rooms: [{ adults: 2, children: 0, childAges: [] }],
};

const DEFAULT_FLIGHT_FORM: FlightFormState = {
  originQuery: "",
  destinationQuery: "",
  selectedOrigin: null,
  selectedDestination: null,
  departureDate: getFutureDate(14),
  returnDate: getFutureDate(18),
  adults: 1,
  children: 0,
  infants: 0,
  cabinClass: "economy",
};

const DEFAULT_CAR_FORM: CarFormState = {
  pickupQuery: "JFK Airport",
  dropoffQuery: "JFK Airport",
  selectedPickup: null,
  selectedDropoff: null,
  pickupDate: getFutureDate(14),
  dropoffDate: getFutureDate(18),
  driverAge: 30,
};

const EMPTY_HOTEL_FLOW: HotelFlowState = {
  token: null,
  correlationId: null,
  destinationOptions: [],
  hotels: [],
  selectedHotel: null,
  hotelDetails: null,
  roomOffers: [],
  selectedRoom: null,
  revalidation: null,
  paymentUrl: "",
};

const EMPTY_FLIGHT_FLOW: FlightFlowState = {
  originOptions: [],
  destinationOptions: [],
  flights: [],
  selectedFlight: null,
  revalidation: null,
  paymentUrl: "",
  session: null,
};

const EMPTY_CAR_FLOW: CarFlowState = {
  pickupOptions: [],
  dropoffOptions: [],
  cars: [],
  selectedCar: null,
  revalidation: null,
  paymentUrl: "",
};

export function TravelSearch({
  apiBaseUrl,
  title = "RouteStack booking workspace",
  subtitle = "Structured hotel, flight, and car workflows with live MCP tool actions and checkout continuation.",
  defaultMode = "hotels",
  onResult,
}: TravelSearchProps) {
  const [mode, setMode] = useState<SearchMode>(defaultMode);
  const [toolState, setToolState] = useState<ToolState>({
    connected: false,
    transport: "disconnected",
    tools: [],
  });
  const [actionState, setActionState] = useState<ActionState>({
    key: null,
    label: "",
  });
  const [error, setError] = useState("");

  const [hotelForm, setHotelForm] =
    useState<HotelFormState>(DEFAULT_HOTEL_FORM);
  const [flightForm, setFlightForm] =
    useState<FlightFormState>(DEFAULT_FLIGHT_FORM);
  const [carForm, setCarForm] = useState<CarFormState>(DEFAULT_CAR_FORM);

  const [hotelFlow, setHotelFlow] = useState<HotelFlowState>(EMPTY_HOTEL_FLOW);
  const [flightFlow, setFlightFlow] =
    useState<FlightFlowState>(EMPTY_FLIGHT_FLOW);
  const [carFlow, setCarFlow] = useState<CarFlowState>(EMPTY_CAR_FLOW);

  const debouncedHotelQuery = useDebouncedValue(
    hotelForm.destinationQuery,
    450,
  );
  const debouncedFlightOriginQuery = useDebouncedValue(flightForm.originQuery, 450);
  const debouncedFlightDestinationQuery = useDebouncedValue(
    flightForm.destinationQuery,
    450,
  );

  useEffect(() => {
    setApiBaseUrl(apiBaseUrl);
    void initialize();

    return () => {
      void disconnectMcp();
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (mode !== "hotels") return;
    if (hotelForm.selectedDestination) return;
    if (debouncedHotelQuery.trim().length < 2) {
      setHotelFlow((current) => ({ ...current, destinationOptions: [] }));
      return;
    }

    void searchHotelDestinations(debouncedHotelQuery);
  }, [debouncedHotelQuery, hotelForm.selectedDestination, mode]);

  useEffect(() => {
    if (mode !== "flights") return;
    if (flightForm.selectedOrigin) return;
    if (debouncedFlightOriginQuery.trim().length < 2) {
      setFlightFlow((current) => ({ ...current, originOptions: [] }));
      return;
    }

    void lookupFlightLocations("origin", debouncedFlightOriginQuery);
  }, [debouncedFlightOriginQuery, flightForm.selectedOrigin, mode]);

  useEffect(() => {
    if (mode !== "flights") return;
    if (flightForm.selectedDestination) return;
    if (debouncedFlightDestinationQuery.trim().length < 2) {
      setFlightFlow((current) => ({ ...current, destinationOptions: [] }));
      return;
    }

    void lookupFlightLocations("destination", debouncedFlightDestinationQuery);
  }, [debouncedFlightDestinationQuery, flightForm.selectedDestination, mode]);

  const modeInfo = useMemo(
    () => MODES.find((entry) => entry.value === mode) ?? MODES[0],
    [mode],
  );

  async function initialize() {
    try {
      setError("");
      await disconnectMcp();
      await connectMcp();
      const tools = await listTools();
      setToolState({
        connected: true,
        transport: getTransportKind() ?? "connected",
        tools,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setToolState({
        connected: false,
        transport: "failed",
        tools: [],
      });
    }
  }

  function isLoading(actionKey: string) {
    return actionState.key === actionKey;
  }

  async function execute<T>(
    actionKey: string,
    actionLabel: string,
    callback: () => Promise<T>,
  ): Promise<T | undefined> {
    setActionState({ key: actionKey, label: actionLabel });
    setError("");
    try {
      return await callback();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return undefined;
    } finally {
      setActionState({ key: null, label: "" });
    }
  }

  async function callToolJson(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const result = await callTool(toolName, args);
    if (result.isError) {
      throw new Error(formatToolError(result));
    }
    return extractJson(result) ?? extractText(result);
  }

  async function searchHotelDestinations(query: string) {
    const payload = await execute(
      "hotel-destination-search",
      "Searching destinations",
      async () => {
        const json = (await callToolJson("search_destinations", {
          query,
          type: "DESTINATION",
        })) as { result: any[] };
        const options = normalizeHotelLookupOptions(json, "destination");
        setHotelFlow((current) => ({
          ...current,
          destinationOptions: options,
        }));
        return options;
      },
    );

    if (payload) {
      onResult?.({
        mode: "hotels",
        payload: { query },
        results: { destinationOptions: payload },
      });
    }
  }

  async function searchHotels() {
    const destination =
      hotelForm.selectedDestination ?? hotelFlow.destinationOptions[0] ?? null;
    if (!destination) {
      setError("Select a destination suggestion before searching hotels.");
      return;
    }

    const payload = await execute(
      "hotel-search",
      "Searching hotels",
      async () => {
        const args = {
          destinationId: destination.id,
          checkIn: hotelForm.checkIn,
          checkOut: hotelForm.checkOut,
          rooms: hotelForm.rooms,
          lat: destination.lat ?? 0,
          long: destination.long ?? 0,
          currency: "USD",
          page: 1,
          limit: 20,
        };

        const json = await callToolJson("search_hotels", args);
        const normalized = normalizeHotelListings(json, destination.fullName);

        setHotelFlow((current) => ({
          ...current,
          token: normalized.token,
          correlationId: normalized.correlationId,
          hotels: normalized.hotels,
          selectedHotel: null,
          hotelDetails: null,
          roomOffers: [],
          selectedRoom: null,
          revalidation: null,
          paymentUrl: "",
        }));

        return { args, normalized, raw: json };
      },
    );

    if (payload) {
      onResult?.({
        mode: "hotels",
        payload: payload.args,
        results: {
          hotels: payload.normalized.hotels,
          raw: payload.raw as Record<string, unknown>,
        },
      });
    }
  }

  async function inspectHotel(hotel: HotelListing) {
    const payload = await execute(
      `hotel-inspect-${hotel.id}`,
      "Loading hotel details",
      async () => {
        const details = (await callToolJson("get_hotel_details", {
          hotelId: hotel.id,
        })) as Record<string, unknown>;

        const roomsRaw = await callToolJson("get_rooms_and_rates", {
          hotelId: hotel.id,
          token: hotelFlow.token,
          correlationId: hotelFlow.correlationId,
          checkIn: hotelForm.checkIn,
          checkOut: hotelForm.checkOut,
          rooms: hotelForm.rooms.map((room) => ({
            adults: room.adults,
            children: room.children,
          })),
          hotelName: hotel.name,
          publishedRate: hotel.price,
        });

        const roomOffers = normalizeHotelRoomOffers(roomsRaw);

        setHotelFlow((current) => ({
          ...current,
          selectedHotel: hotel,
          hotelDetails: details,
          roomOffers,
          selectedRoom: null,
          revalidation: null,
          paymentUrl: "",
        }));

        return { details, roomOffers, roomsRaw };
      },
    );

    if (payload) {
      onResult?.({
        mode: "hotels",
        payload: { hotelId: hotel.id },
        results: {
          hotelDetails: payload.details,
          roomOffers: payload.roomOffers,
          raw: payload.roomsRaw as Record<string, unknown>,
        },
      });
    }
  }

  async function continueHotelCheckout(room: HotelRoomOffer) {
    if (!hotelFlow.selectedHotel) return;
    const hotel = hotelFlow.selectedHotel;

    const payload = await execute(
      `hotel-checkout-${room.id}`,
      "Preparing hotel checkout",
      async () => {
        const revalidation = (await callToolJson("revalidate", {
          hotelId: hotel.id,
          recommendationId: room.recommendationId,
          token: hotelFlow.token,
          correlationId: hotelFlow.correlationId,
          publishedRate: room.price ?? hotel.price,
        })) as Record<string, unknown>;

        const paymentArgs = {
          hotelId: hotel.id,
          recommendationId: room.recommendationId,
          token: hotelFlow.token,
          checkIn: hotelForm.checkIn,
          checkOut: hotelForm.checkOut,
          roomId: room.id,
          hotelName: hotel.name,
          hotelAddress: hotel.address,
          hotelImage: hotel.image ?? "",
          hotelLatitude: hotel.latitude ?? 0,
          hotelLongitude: hotel.longitude ?? 0,
          hotelStarRating: hotel.starRating ?? 0,
          hotelRating: hotel.rating ?? hotel.starRating ?? 0,
          correlationId: hotelFlow.correlationId ?? "",
          travellers: formatRoomSummary(hotelForm.rooms),
          destination: hotelForm.selectedDestination?.fullName ?? hotel.address,
          displayedPrice: room.price ?? hotel.price ?? 0,
          priceCheckResult: revalidation,
        };

        const paymentJson = await callToolJson(
          "hotel_get_payment_url",
          paymentArgs,
        );
        const paymentUrl = extractPaymentUrl(paymentJson);

        setHotelFlow((current) => ({
          ...current,
          selectedRoom: room,
          revalidation,
          paymentUrl,
        }));

        return { paymentArgs, revalidation, paymentUrl };
      },
    );

    if (payload) {
      onResult?.({
        mode: "hotels",
        payload: payload.paymentArgs,
        results: {
          revalidation: payload.revalidation,
          paymentUrl: payload.paymentUrl,
        },
      });
    }
  }

  async function lookupFlightLocations(
    kind: "origin" | "destination",
    termOverride?: string,
  ) {
    const term =
      termOverride ??
      (kind === "origin" ? flightForm.originQuery : flightForm.destinationQuery);

    if (term.trim().length < 2) {
      setFlightFlow((current) => ({
        ...current,
        originOptions: kind === "origin" ? [] : current.originOptions,
        destinationOptions:
          kind === "destination" ? [] : current.destinationOptions,
      }));
      return;
    }

    const payload = await execute(
      `flight-lookup-${kind}`,
      `Looking up ${kind}`,
      async () => {
        const json = await callToolJson("flight_locations", { term });
        const options = normalizeLookupOptions(json, "flight");
        setFlightFlow((current) => ({
          ...current,
          originOptions: kind === "origin" ? options : current.originOptions,
          destinationOptions:
            kind === "destination" ? options : current.destinationOptions,
        }));
        return { term, options };
      },
    );

    if (payload) {
      onResult?.({
        mode: "flights",
        payload: { term: payload.term, kind },
        results: { options: payload.options },
      });
    }
  }

  async function searchFlights() {
    const origin =
      flightForm.selectedOrigin ?? flightFlow.originOptions[0] ?? null;
    const destination =
      flightForm.selectedDestination ??
      flightFlow.destinationOptions[0] ??
      null;

    if (!origin || !destination) {
      setError("Select both origin and destination before searching flights.");
      return;
    }

    const payload = await execute(
      "flight-search",
      "Searching flights",
      async () => {
        const session = hasTool(toolState.tools, "flight_session")
          ? ((await callToolJson("flight_session", {})) as Record<
              string,
              unknown
            >)
          : null;

        const filter = {
          origin: origin.code ?? origin.label,
          destination: destination.code ?? destination.label,
          departureDate: flightForm.departureDate,
          returnDate: flightForm.returnDate || undefined,
          adults: flightForm.adults,
          // children: flightForm.children,
          // infants: flightForm.infants,
          cabinClass: flightForm.cabinClass,
          tripType: flightForm.returnDate ? "round_trip" : "one_way",
          originLocation: origin.raw,
          destinationLocation: destination.raw,
        };

        const json = await callToolJson("flight_search", { filter });
        const flights = normalizeFlightOffers(json);

        setFlightFlow((current) => ({
          ...current,
          flights,
          selectedFlight: null,
          revalidation: null,
          paymentUrl: "",
          session,
        }));

        return { filter, flights, raw: json };
      },
    );

    if (payload) {
      onResult?.({
        mode: "flights",
        payload: { filter: payload.filter },
        results: {
          flights: payload.flights,
          raw: payload.raw as Record<string, unknown>,
        },
      });
    }
  }

  async function continueFlightCheckout(flight: FlightOffer) {
    const origin =
      flightForm.selectedOrigin ?? flightFlow.originOptions[0] ?? null;
    const destination =
      flightForm.selectedDestination ??
      flightFlow.destinationOptions[0] ??
      null;
    if (!origin || !destination) return;

    const payload = await execute(
      `flight-checkout-${flight.id}`,
      "Preparing flight checkout",
      async () => {
        const revalidation = (await callToolJson("flight_revalidate", {
          fareSourceCode: flight.fareSourceCode ?? flight.id,
          searchListPrice: flight.price,
          searchFilterObj: flight.searchFilterObj,
          correlationId: flight.correlationId,
        })) as Record<string, unknown>;

        const paymentArgs = {
          flight: flight.raw,
          origin: origin.code ?? origin.label,
          destination: destination.code ?? destination.label,
          departureDate: flightForm.departureDate,
          returnDate: flightForm.returnDate || undefined,
          adults: flightForm.adults,
          children: flightForm.children,
          infants: flightForm.infants,
          correlationId: flight.correlationId,
          searchFilterObj: flight.searchFilterObj,
          sessionId:
            flight.sessionId ??
            readStringRecord(flightFlow.session, ["sessionId", "id"]),
        };

        const paymentJson = await callToolJson(
          "flight_get_payment_url",
          paymentArgs,
        );
        const paymentUrl = extractPaymentUrl(paymentJson);

        setFlightFlow((current) => ({
          ...current,
          selectedFlight: flight,
          revalidation,
          paymentUrl,
        }));

        return { paymentArgs, revalidation, paymentUrl };
      },
    );

    if (payload) {
      onResult?.({
        mode: "flights",
        payload: payload.paymentArgs,
        results: {
          revalidation: payload.revalidation,
          paymentUrl: payload.paymentUrl,
        },
      });
    }
  }

  async function lookupCarLocations(kind: "pickup" | "dropoff") {
    const term = kind === "pickup" ? carForm.pickupQuery : carForm.dropoffQuery;
    const payload = await execute(
      `car-lookup-${kind}`,
      `Looking up ${kind}`,
      async () => {
        const json = await callToolJson("car_locations", { term });
        const options = normalizeLookupOptions(json, "car");
        setCarFlow((current) => ({
          ...current,
          pickupOptions: kind === "pickup" ? options : current.pickupOptions,
          dropoffOptions: kind === "dropoff" ? options : current.dropoffOptions,
        }));
        return { term, options };
      },
    );

    if (payload) {
      onResult?.({
        mode: "cars",
        payload: { term: payload.term, kind },
        results: { options: payload.options },
      });
    }
  }

  async function searchCars() {
    const pickup = carForm.selectedPickup ?? carFlow.pickupOptions[0] ?? null;
    const dropoff =
      carForm.selectedDropoff ?? carFlow.dropoffOptions[0] ?? null;
    if (!pickup || !dropoff) {
      setError("Select both pickup and dropoff before searching cars.");
      return;
    }

    const payload = await execute("car-search", "Searching cars", async () => {
      const filter = {
        pickup: pickup.code ?? pickup.label,
        dropoff: dropoff.code ?? dropoff.label,
        pickupDate: carForm.pickupDate,
        dropoffDate: carForm.dropoffDate,
        driverAge: carForm.driverAge,
        pickupLocation: pickup.raw,
        dropoffLocation: dropoff.raw,
      };

      const json = await callToolJson("car_search", { filter });
      const cars = normalizeCarOffers(json);

      setCarFlow((current) => ({
        ...current,
        cars,
        selectedCar: null,
        revalidation: null,
        paymentUrl: "",
      }));

      return { filter, cars, raw: json };
    });

    if (payload) {
      onResult?.({
        mode: "cars",
        payload: { filter: payload.filter },
        results: {
          cars: payload.cars,
          raw: payload.raw as Record<string, unknown>,
        },
      });
    }
  }

  async function continueCarCheckout(car: CarOffer) {
    const pickup = carForm.selectedPickup ?? carFlow.pickupOptions[0] ?? null;
    const dropoff =
      carForm.selectedDropoff ?? carFlow.dropoffOptions[0] ?? null;
    if (!pickup || !dropoff) return;

    const payload = await execute(
      `car-checkout-${car.id}`,
      "Preparing car checkout",
      async () => {
        const revalidation = (await callToolJson("car_revalidate", {
          fareCode: car.fareCode ?? car.id,
          correlationId: car.correlationId,
        })) as Record<string, unknown>;

        const paymentArgs = {
          pickup: pickup.code ?? pickup.label,
          dropoff: dropoff.code ?? dropoff.label,
          pickupDate: carForm.pickupDate,
          dropoffDate: carForm.dropoffDate,
          car: car.raw,
        };

        const paymentJson = await callToolJson(
          "car_get_payment_url",
          paymentArgs,
        );
        const paymentUrl = extractPaymentUrl(paymentJson);

        setCarFlow((current) => ({
          ...current,
          selectedCar: car,
          revalidation,
          paymentUrl,
        }));

        return { paymentArgs, revalidation, paymentUrl };
      },
    );

    if (payload) {
      onResult?.({
        mode: "cars",
        payload: payload.paymentArgs,
        results: {
          revalidation: payload.revalidation,
          paymentUrl: payload.paymentUrl,
        },
      });
    }
  }

  return (
    <section className="glass-panel relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#F5C542] via-[#f8df8d] to-[#31d196]" />

      <header className="flex flex-col gap-6 border-b border-white/8 px-5 py-6 sm:px-7 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#F5C542]/20 bg-[#F5C542]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F5C542]">
            <Sparkles className="size-3.5" />
            RouteStack.ai
          </div>
          <div className="space-y-2">
            <h2 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-3xl">
              {title}
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:min-w-[250px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span
                className={
                  toolState.connected
                    ? "inline-flex items-center gap-2 rounded-full bg-[#31d196]/15 px-3 py-1 text-xs font-semibold text-[#7ff1c7] animate-glow-pulse"
                    : "inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-slate-200"
                }
              >
                <span className="size-2 rounded-full bg-current" />
                {toolState.connected ? "Connected" : "Disconnected"}
              </span>
              <span className="text-xs text-slate-400">
                {toolState.transport}
              </span>
            </div>
            <div className="grid gap-1 text-sm text-slate-300">
              <span>Tools detected: {toolState.tools.length}</span>
              <span>
                Active workspace:{" "}
                <span className="font-medium text-white">{modeInfo.label}</span>
              </span>
            </div>
          </div>

          {actionState.key && (
            <div className="animate-rise-in inline-flex items-center gap-2 rounded-2xl border border-[#31d196]/15 bg-[#31d196]/10 px-4 py-3 text-sm text-[#bff7e2]">
              <LoaderCircle className="size-4 animate-spin" />
              {actionState.label}
            </div>
          )}
        </div>
      </header>

      <nav className="grid gap-3 border-b border-white/8 px-5 py-5 sm:grid-cols-3 sm:px-7">
        {MODES.map((entry) => {
          const Icon = entry.icon;
          const active = mode === entry.value;
          return (
            <button
              key={entry.value}
              type="button"
              className={`tab-button ${active ? "tab-button-active" : ""}`}
              onClick={() => setMode(entry.value)}
            >
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                <Icon
                  className={
                    active ? "size-5 text-[#31d196]" : "size-5 text-slate-200"
                  }
                />
              </div>
              <div className="space-y-1">
                <div className="text-base font-semibold text-white">
                  {entry.label}
                </div>
                <p className="text-sm leading-6 text-slate-400">
                  {entry.tagline}
                </p>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="grid gap-5 px-5 py-5 sm:px-7 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
        <div className="glass-panel animate-rise-in border-white/8 p-5 lg:h-[calc(100vh-15rem)] lg:overflow-y-auto">
          {mode === "hotels" && (
            <HotelFormSection
              form={hotelForm}
              flow={hotelFlow}
              loadingDestinationSearch={isLoading("hotel-destination-search")}
              loadingHotelSearch={isLoading("hotel-search")}
              disabled={!toolState.connected || Boolean(actionState.key)}
              onChange={setHotelForm}
              onSearch={searchHotels}
            />
          )}

          {mode === "flights" && (
            <FlightFormSection
              form={flightForm}
              flow={flightFlow}
              disabled={!toolState.connected || Boolean(actionState.key)}
              loadingOriginLookup={isLoading("flight-lookup-origin")}
              loadingDestinationLookup={isLoading("flight-lookup-destination")}
              loadingSearch={isLoading("flight-search")}
              onChange={setFlightForm}
              onSearch={searchFlights}
            />
          )}

          {mode === "cars" && (
            <CarFormSection
              form={carForm}
              flow={carFlow}
              disabled={!toolState.connected || Boolean(actionState.key)}
              loadingPickupLookup={isLoading("car-lookup-pickup")}
              loadingDropoffLookup={isLoading("car-lookup-dropoff")}
              loadingSearch={isLoading("car-search")}
              onChange={setCarForm}
              onLookup={lookupCarLocations}
              onSearch={searchCars}
            />
          )}

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
              {error}
            </div>
          )}
        </div>

        <div className="glass-panel animate-rise-in border-white/8 p-5 lg:h-[calc(100vh-15rem)] lg:overflow-hidden">
          {mode === "hotels" && (
            <HotelResultsSection
              form={hotelForm}
              flow={hotelFlow}
              actionKey={actionState.key}
              onInspectHotel={inspectHotel}
              onContinueCheckout={continueHotelCheckout}
            />
          )}

          {mode === "flights" && (
            <FlightResultsSection
              flow={flightFlow}
              actionKey={actionState.key}
              onContinueCheckout={continueFlightCheckout}
            />
          )}

          {mode === "cars" && (
            <CarResultsSection
              flow={carFlow}
              actionKey={actionState.key}
              onContinueCheckout={continueCarCheckout}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debouncedValue;
}
