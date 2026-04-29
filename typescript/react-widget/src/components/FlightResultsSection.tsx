import { ArrowRight, Clock3, Plane } from "lucide-react";
import { ActionButton } from "./ActionButton";
import CheckoutPanel from "./CheckoutPanel";
import EmptyState from "./EmptyState";
import { formatPrice } from "../utils";
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
  return (
    <div className="space-y-6">
      <PanelTitle
        eyebrow="Flight results"
        title="Fare shortlist"
        copy="Live fares show route, schedule, pricing, and direct checkout continuation."
      />

      {flow.flights.length ? (
        <div className="grid gap-3">
          {flow.flights.map((flight) => (
            <article
              key={flight.id}
              className={`rounded-2xl border p-4 transition duration-200 ${
                flow.selectedFlight?.id === flight.id
                  ? "border-[#31d196]/35 bg-[#31d196]/8"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div>
                    <div className="text-base font-semibold text-white">
                      {flight.airline} {flight.flightNumber}
                    </div>
                    <div className="text-sm text-slate-300">
                      {flight.from} to {flight.to}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-4 text-[#31d196]" />
                      {flight.departure} - {flight.arrival}
                    </span>
                    {flight.duration && (
                      <span className="inline-flex items-center gap-1">
                        <Plane className="size-4 text-[#F5C542]" />
                        {flight.duration}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <div className="text-lg font-semibold text-white">
                    {formatPrice(flight.price, flight.currency)}
                  </div>
                  <ActionButton
                    onClick={() => onContinueCheckout(flight)}
                    loading={actionKey === `flight-checkout-${flight.id}`}
                    disabled={Boolean(actionKey)}
                    icon={ArrowRight}
                  >
                    Continue
                  </ActionButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No flights yet"
          copy="Resolve both endpoints and run a flight search to populate fare results."
        />
      )}

      <CheckoutPanel
        paymentUrl={flow.paymentUrl}
        revalidation={flow.revalidation}
      />
    </div>
  );
}
