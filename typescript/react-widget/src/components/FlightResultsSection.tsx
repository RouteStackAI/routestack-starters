import { useEffect, useRef } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Plane,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { ActionButton } from "./ActionButton";
import CheckoutPanel from "./CheckoutPanel";
import EmptyState from "./EmptyState";
import {
  formatDurationMinutes,
  formatFlightStops,
  formatPrice,
  formatIsoDateTime,
} from "../utils";
import { PanelTitle } from "./PanelTitle";
import { FlightOffer, LookupOption } from "../types";

interface FlightFlowState {
  originOptions: LookupOption[];
  destinationOptions: LookupOption[];
  flights: FlightOffer[];
  selectedFlight: FlightOffer | null;
  revalidation: Record<string, unknown> | null;
  paymentUrl: string;
  session: Record<string, unknown> | null;
}

export default function FlightResultsSection({
  flow,
  actionKey,
  onContinueCheckout,
}: {
  flow: FlightFlowState;
  actionKey: string | null;
  onContinueCheckout: (flight: FlightOffer) => void;
}) {
  const checkoutRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (flow.paymentUrl || flow.revalidation) {
      checkoutRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [flow.paymentUrl, flow.revalidation]);

  return (
    <div className="space-y-6 lg:h-full lg:overflow-y-auto lg:pr-2">
      <PanelTitle
        eyebrow="Flight results"
        title="Choose a fare and continue"
        copy="Results now use the actual itinerary structure from `flight_search`, so route, segments, layovers, and pricing stay readable."
      />

      {flow.flights.length ? (
        <div className="grid gap-4">
          {flow.flights.map((flight, index) => {
            const active = flow.selectedFlight?.id === flight.id;

            return (
              <article
                key={flight.id}
                className={`animate-rise-in overflow-hidden rounded-3xl border ${
                  active
                    ? "border-[#31d196]/35 bg-[#31d196]/8"
                    : "border-white/10 bg-white/[0.03]"
                } transition duration-200`}
                style={{ animationDelay: `${index * 35}ms` }}
              >
                <div className="border-b border-white/8 bg-gradient-to-r from-white/[0.04] to-transparent px-5 py-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <AirlineBadge flight={flight} />
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-white">
                          {flight.airline}
                        </div>
                        <div className="truncate text-sm text-slate-400">
                          {flight.flightNumber}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ResultChip icon={Plane} label={formatFlightStops(flight.stops)} />
                      {flight.cabinClass && (
                        <ResultChip icon={Ticket} label={flight.cabinClass} />
                      )}
                      {flight.fareFamily && (
                        <ResultChip icon={BriefcaseBusiness} label={flight.fareFamily} />
                      )}
                      {flight.refundable !== undefined && (
                        <ResultChip
                          icon={ShieldCheck}
                          label={flight.refundable ? "Refundable" : "Non-refundable"}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-5 py-5">
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] md:items-center">
                      <AirportTimeBlock
                        code={flight.originCode ?? flight.from}
                        city={flight.departureCity ?? flight.from}
                        airport={flight.originAirport}
                        time={flight.departure}
                        align="left"
                      />

                      <div className="space-y-2 text-center">
                        <div className="text-sm font-medium text-slate-300">
                          {flight.duration ?? "Duration pending"}
                        </div>
                        <div className="relative mx-auto flex max-w-[120px] items-center justify-center">
                          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                          <div className="absolute inline-flex size-9 items-center justify-center rounded-full">
                            <Plane className="size-4 text-[#31d196]" />
                          </div>
                        </div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          {formatFlightStops(flight.stops)}
                        </div>
                      </div>

                      <AirportTimeBlock
                        code={flight.destinationCode ?? flight.to}
                        city={flight.arrivalCity ?? flight.to}
                        airport={flight.destinationAirport}
                        time={flight.arrival}
                        align="right"
                      />
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                      <InfoPanel
                        icon={Clock3}
                        label="Layover"
                        value={flight.layoverSummary ?? "No layover"}
                      />
                      <InfoPanel
                        icon={Users}
                        label="Seats left"
                        value={
                          flight.remainingSeats
                            ? `${flight.remainingSeats} seat${
                                flight.remainingSeats === 1 ? "" : "s"
                              } left`
                            : "Seat count not provided"
                        }
                      />
                      <InfoPanel
                        icon={ShieldCheck}
                        label="Fare notes"
                        value={
                          flight.baggageText ??
                          "Baggage and final fare rules continue in checkout"
                        }
                      />
                    </div>

                    {flight.segments && flight.segments.length > 0 && (
                      <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
                          Flight segments
                        </div>
                        <div className="grid gap-3">
                          {flight.segments.map((segment, segmentIndex) => (
                            <div
                              key={`${flight.id}-segment-${segmentIndex}`}
                              className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 lg:grid-cols-[minmax(0,1fr)_auto]"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">
                                  {segment.airline} {segment.flightNumber}
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {segment.departureCity ?? segment.from} ({segment.from}) to{" "}
                                  {segment.arrivalCity ?? segment.to} ({segment.to})
                                </div>
                              </div>
                              <div className="text-left text-sm text-slate-300 lg:text-right">
                                <div>{formatIsoDateTime(segment.departureTime)} - {formatIsoDateTime(segment.arrivalTime)}</div>
                                <div className="text-xs text-slate-500">
                                  {formatDurationMinutes(segment.durationMinutes) ?? "Duration pending"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-[#F5C542]/15 p-4 mt-5">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#F5C542]">
                      total fare
                    </div>
                    <div className="mt-2 break-words text-3xl font-semibold text-white">
                      {formatPrice(flight.price, flight.currency)}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">
                      Revalidation runs before handoff so price and availability are checked one more time.
                    </div>
                    <div className="mt-5">
                      <ActionButton
                        variant="tertiary"
                        onClick={() => onContinueCheckout(flight)}
                        loading={actionKey === `flight-checkout-${flight.id}`}
                        disabled={Boolean(actionKey)}
                        icon={ArrowRight}
                      >
                        Continue booking
                      </ActionButton>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No flights yet"
          copy="Pick both airports from the dropdown suggestions, then run a flight search to populate itinerary cards."
        />
      )}

      <div ref={checkoutRef}>
        <CheckoutPanel
          paymentUrl={flow.paymentUrl}
          revalidation={flow.revalidation}
        />
      </div>
    </div>
  );
}

function AirlineBadge({ flight }: { flight: FlightOffer }) {
  const initials =
    flight.airlineCode?.slice(0, 2).toUpperCase() ??
    flight.airline
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]">
      {flight.airlineLogo ? (
        <img
          src={flight.airlineLogo}
          alt={flight.airline}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#10272D] to-[#15343D] text-sm font-semibold tracking-[0.18em] text-[#bcefe2]">
          {initials}
        </div>
      )}
    </div>
  );
}

function AirportTimeBlock({
  code,
  city,
  airport,
  time,
  align,
}: {
  code: string;
  city: string;
  airport?: string;
  time: string;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "min-w-0 text-left md:text-right" : "min-w-0 text-left"}>
      <div className="truncate text-3xl font-semibold tracking-tight text-white">
        {code}
      </div>
      <div className="mt-1 truncate text-sm text-slate-300">{city}</div>
      {airport && <div className="truncate text-xs text-slate-500">{airport}</div>}
      <div className="mt-3 text-lg font-medium text-slate-200">{time}</div>
    </div>
  );
}

function ResultChip({
  icon: Icon,
  label,
}: {
  icon: typeof Plane;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-xs text-slate-300">
      <Icon className="size-3.5 shrink-0 text-[#31d196]" />
      <span className="max-w-[180px] truncate">{label}</span>
    </span>
  );
}

function InfoPanel({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Plane;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#F5C542]">
        <Icon className="size-3.5 shrink-0 text-[#F5C542]" />
        {label}
      </div>
      <div className="text-sm leading-6 break-words text-slate-300">{value}</div>
    </div>
  );
}
