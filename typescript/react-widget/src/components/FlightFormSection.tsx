import { type Dispatch, type SetStateAction } from "react";
import { CalendarDays, Plane, Search, Users } from "lucide-react";
import { FieldLabel } from "./FieldLabel";
import { PanelTitle } from "./PanelTitle";
import { ActionButton } from "./ActionButton";
import { FlightOffer, LookupOption } from "../types";
import LookupBlock from "./LookupBlock";

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

interface FlightFlowState {
  originOptions: LookupOption[];
  destinationOptions: LookupOption[];
  flights: FlightOffer[];
  selectedFlight: FlightOffer | null;
  revalidation: Record<string, unknown> | null;
  paymentUrl: string;
  session: Record<string, unknown> | null;
}
export default function FlightFormSection({
  form,
  flow,
  disabled,
  loadingOriginLookup,
  loadingDestinationLookup,
  loadingSearch,
  onChange,
  onLookup,
  onSearch,
}: {
  form: FlightFormState;
  flow: FlightFlowState;
  disabled: boolean;
  loadingOriginLookup: boolean;
  loadingDestinationLookup: boolean;
  loadingSearch: boolean;
  onChange: Dispatch<SetStateAction<FlightFormState>>;
  onLookup: (kind: "origin" | "destination") => void;
  onSearch: () => void;
}) {
  return (
    <div className="space-y-6">
      <PanelTitle
        eyebrow="Flight workflow"
        title="Lookup airports and search fares"
        copy="Flight search uses structured location lookup before it calls the RouteStack tools."
      />

      <div className="grid gap-4">
        <LookupBlock
          label="Origin"
          value={form.originQuery}
          loading={loadingOriginLookup}
          options={flow.originOptions}
          onValueChange={(value: any) =>
            onChange((current) => ({
              ...current,
              originQuery: value,
              selectedOrigin: null,
            }))
          }
          onLookup={() => onLookup("origin")}
          onSelect={(option: any) =>
            onChange((current) => ({
              ...current,
              originQuery: option.label,
              selectedOrigin: option,
            }))
          }
        />

        <LookupBlock
          label="Destination"
          value={form.destinationQuery}
          loading={loadingDestinationLookup}
          options={flow.destinationOptions}
          onValueChange={(value: any) =>
            onChange((current) => ({
              ...current,
              destinationQuery: value,
              selectedDestination: null,
            }))
          }
          onLookup={() => onLookup("destination")}
          onSelect={(option: any) =>
            onChange((current) => ({
              ...current,
              destinationQuery: option.label,
              selectedDestination: option,
            }))
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <FieldLabel label="Departure date" icon={CalendarDays}>
          <input
            type="date"
            value={form.departureDate}
            onChange={(event) =>
              onChange((current: any) => ({
                ...current,
                departureDate: event.target.value,
              }))
            }
            className="field-shell w-full"
          />
        </FieldLabel>
        <FieldLabel label="Return date" icon={CalendarDays}>
          <input
            type="date"
            value={form.returnDate}
            onChange={(event) =>
              onChange((current: any) => ({
                ...current,
                returnDate: event.target.value,
              }))
            }
            className="field-shell w-full"
          />
        </FieldLabel>
        <FieldLabel label="Cabin class" icon={Plane}>
          <select
            value={form.cabinClass}
            onChange={(event) =>
              onChange((current: any) => ({
                ...current,
                cabinClass: event.target.value,
              }))
            }
            className="field-shell w-full"
          >
            <option value="economy">Economy</option>
            <option value="premium_economy">Premium Economy</option>
            <option value="business">Business</option>
            <option value="first">First</option>
          </select>
        </FieldLabel>
        <FieldLabel label="Adults" icon={Users}>
          <input
            type="number"
            min={1}
            max={9}
            value={form.adults}
            onChange={(event) =>
              onChange((current: any) => ({
                ...current,
                adults: Math.max(1, Number(event.target.value) || 1),
              }))
            }
            className="field-shell w-full"
          />
        </FieldLabel>
        <FieldLabel label="Children" icon={Users}>
          <input
            type="number"
            min={0}
            max={6}
            value={form.children}
            onChange={(event) =>
              onChange((current: any) => ({
                ...current,
                children: Math.max(0, Number(event.target.value) || 0),
              }))
            }
            className="field-shell w-full"
          />
        </FieldLabel>
        <FieldLabel label="Infants" icon={Users}>
          <input
            type="number"
            min={0}
            max={4}
            value={form.infants}
            onChange={(event) =>
              onChange((current: any) => ({
                ...current,
                infants: Math.max(0, Number(event.target.value) || 0),
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
          Search flights
        </ActionButton>
      </div>
    </div>
  );
}
