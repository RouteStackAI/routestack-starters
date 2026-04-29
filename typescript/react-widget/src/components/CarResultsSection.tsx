import { ArrowRight, CarFront, MapPin } from "lucide-react";
import CheckoutPanel from "./CheckoutPanel";
import EmptyState from "./EmptyState";
import { ActionButton } from "./ActionButton";
import { formatPrice } from "../utils";
import { PanelTitle } from "./PanelTitle";
import { CarOffer, LookupOption } from "../types";

interface CarFlowState {
  pickupOptions: LookupOption[];
  dropoffOptions: LookupOption[];
  cars: CarOffer[];
  selectedCar: CarOffer | null;
  revalidation: Record<string, unknown> | null;
  paymentUrl: string;
}

export default function CarResultsSection({
  flow,
  actionKey,
  onContinueCheckout,
}: {
  flow: CarFlowState;
  actionKey: string | null;
  onContinueCheckout: (car: CarOffer) => void;
}) {
  return (
    <div className="space-y-6">
      <PanelTitle
        eyebrow="Car results"
        title="Vehicle shortlist"
        copy="Review pickup and vehicle details, then revalidate before moving to checkout."
      />

      {flow.cars.length ? (
        <div className="grid gap-3">
          {flow.cars.map((car) => (
            <article
              key={car.id}
              className={`rounded-2xl border p-4 transition duration-200 ${
                flow.selectedCar?.id === car.id
                  ? "border-[#31d196]/35 bg-[#31d196]/8"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div>
                    <div className="text-base font-semibold text-white">
                      {car.vehicleName}
                    </div>
                    <div className="text-sm text-slate-300">{car.vendor}</div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                    {car.pickupLocation && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-4 text-[#31d196]" />
                        {car.pickupLocation}
                      </span>
                    )}
                    {car.transmission && (
                      <span className="inline-flex items-center gap-1">
                        <CarFront className="size-4 text-[#F5C542]" />
                        {car.transmission}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <div className="text-lg font-semibold text-white">
                    {formatPrice(car.price, car.currency)}
                  </div>
                  <ActionButton
                    onClick={() => onContinueCheckout(car)}
                    loading={actionKey === `car-checkout-${car.id}`}
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
          title="No cars yet"
          copy="Lookup pickup and dropoff locations, then run a car search to populate vehicles."
        />
      )}

      <CheckoutPanel
        paymentUrl={flow.paymentUrl}
        revalidation={flow.revalidation}
      />
    </div>
  );
}
