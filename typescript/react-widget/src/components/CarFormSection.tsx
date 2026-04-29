import { type Dispatch, type SetStateAction } from "react";
import { CalendarDays, Search, Users } from "lucide-react";
import { ActionButton } from "./ActionButton";
import { FieldLabel } from "./FieldLabel";
import LookupBlock from "./LookupBlock";
import { CarOffer, LookupOption } from "../types";
import { PanelTitle } from "./PanelTitle";

interface CarFormState {
  pickupQuery: string;
  dropoffQuery: string;
  selectedPickup: LookupOption | null;
  selectedDropoff: LookupOption | null;
  pickupDate: string;
  dropoffDate: string;
  driverAge: number;
}

interface CarFlowState {
  pickupOptions: LookupOption[];
  dropoffOptions: LookupOption[];
  cars: CarOffer[];
  selectedCar: CarOffer | null;
  revalidation: Record<string, unknown> | null;
  paymentUrl: string;
}

export default function CarFormSection({
  form,
  flow,
  disabled,
  loadingPickupLookup,
  loadingDropoffLookup,
  loadingSearch,
  onChange,
  onLookup,
  onSearch,
}: {
  form: CarFormState;
  flow: CarFlowState;
  disabled: boolean;
  loadingPickupLookup: boolean;
  loadingDropoffLookup: boolean;
  loadingSearch: boolean;
  onChange: Dispatch<SetStateAction<CarFormState>>;
  onLookup: (kind: "pickup" | "dropoff") => void;
  onSearch: () => void;
}) {
  return (
    <div className="space-y-6">
      <PanelTitle
        eyebrow="Car workflow"
        title="Resolve locations and search vehicles"
        copy="Use RouteStack location lookup before car search and revalidation."
      />

      <div className="grid gap-4">
        <LookupBlock
          label="Pickup location"
          value={form.pickupQuery}
          loading={loadingPickupLookup}
          options={flow.pickupOptions}
          onValueChange={(value: any) =>
            onChange((current: any) => ({
              ...current,
              pickupQuery: value,
              selectedPickup: null,
            }))
          }
          onLookup={() => onLookup("pickup")}
          onSelect={(option) =>
            onChange((current: any) => ({
              ...current,
              pickupQuery: option.label,
              selectedPickup: option,
            }))
          }
        />

        <LookupBlock
          label="Dropoff location"
          value={form.dropoffQuery}
          loading={loadingDropoffLookup}
          options={flow.dropoffOptions}
          onValueChange={(value: any) =>
            onChange((current: any) => ({
              ...current,
              dropoffQuery: value,
              selectedDropoff: null,
            }))
          }
          onLookup={() => onLookup("dropoff")}
          onSelect={(option) =>
            onChange((current: any) => ({
              ...current,
              dropoffQuery: option.label,
              selectedDropoff: option,
            }))
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FieldLabel label="Pickup date" icon={CalendarDays}>
          <input
            type="date"
            value={form.pickupDate}
            onChange={(event) =>
              onChange((current: any) => ({
                ...current,
                pickupDate: event.target.value,
              }))
            }
            className="field-shell w-full"
          />
        </FieldLabel>
        <FieldLabel label="Dropoff date" icon={CalendarDays}>
          <input
            type="date"
            value={form.dropoffDate}
            onChange={(event) =>
              onChange((current: any) => ({
                ...current,
                dropoffDate: event.target.value,
              }))
            }
            className="field-shell w-full"
          />
        </FieldLabel>
        <FieldLabel label="Driver age" icon={Users}>
          <input
            type="number"
            min={18}
            max={80}
            value={form.driverAge}
            onChange={(event) =>
              onChange((current: any) => ({
                ...current,
                driverAge: Math.max(18, Number(event.target.value) || 18),
              }))
            }
            className="field-shell w-full"
          />
        </FieldLabel>
      </div>

      <div className="flex justify-end border-t border-white/8 pt-5">
        <ActionButton
          onClick={onSearch}
          loading={loadingSearch}
          disabled={disabled}
          icon={Search}
        >
          Search cars
        </ActionButton>
      </div>
    </div>
  );
}
