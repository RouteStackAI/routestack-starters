import { type Dispatch, type SetStateAction } from "react";
import {
  ArrowRightLeft,
  CalendarDays,
  Clock3,
  LoaderCircle,
  MapPin,
  Plane,
  Search,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { FieldLabel } from "./FieldLabel";
import { PanelTitle } from "./PanelTitle";
import { ActionButton } from "./ActionButton";
import { FlightOffer, LookupOption } from "../types";
import { formatTravelerSummary } from "../utils";

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
  onSearch,
}: {
  form: FlightFormState;
  flow: FlightFlowState;
  disabled: boolean;
  loadingOriginLookup: boolean;
  loadingDestinationLookup: boolean;
  loadingSearch: boolean;
  onChange: Dispatch<SetStateAction<FlightFormState>>;
  onSearch: () => void;
}) {
  const readyToSearch = Boolean(
    form.selectedOrigin &&
      form.selectedDestination &&
      form.departureDate &&
      (!form.returnDate || form.returnDate >= form.departureDate),
  );

  return (
    <div className="space-y-6">
      <PanelTitle
        eyebrow="Flight workflow"
        title="Search route, compare fares, and continue"
        copy="Start with airport or city search, lock in both endpoints, then search live fares before continuing to checkout."
      />

      <div className="rounded-3xl border border-[#31d196]/15 bg-gradient-to-br from-[#31d196]/10 via-transparent to-[#F5C542]/10 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
          <FlightLocationField
            label="Flying from"
            placeholder="Search airport or city"
            value={form.originQuery}
            selectedOption={form.selectedOrigin}
            loading={loadingOriginLookup}
            options={flow.originOptions}
            disabled={disabled}
            onReset={() =>
              onChange((current) => ({
                ...current,
                originQuery: current.selectedOrigin?.label ?? "",
                selectedOrigin: null,
              }))
            }
            onValueChange={(value) =>
              onChange((current) => ({
                ...current,
                originQuery: value,
                selectedOrigin: null,
              }))
            }
            onSelect={(option) =>
              onChange((current) => ({
                ...current,
                originQuery: option.label,
                selectedOrigin: option,
              }))
            }
          />

          <button
            type="button"
            className="secondary-btn h-12 w-full lg:w-12 lg:px-0"
            disabled={disabled}
            onClick={() =>
              onChange((current) => ({
                ...current,
                originQuery:
                  current.selectedDestination?.label ??
                  current.destinationQuery,
                destinationQuery:
                  current.selectedOrigin?.label ?? current.originQuery,
                selectedOrigin: current.selectedDestination,
                selectedDestination: current.selectedOrigin,
              }))
            }
          >
            <ArrowRightLeft className="size-4" />
            <span className="lg:hidden">Swap</span>
          </button>

          <FlightLocationField
            label="Flying to"
            placeholder="Choose destination airport"
            value={form.destinationQuery}
            selectedOption={form.selectedDestination}
            loading={loadingDestinationLookup}
            options={flow.destinationOptions}
            disabled={disabled}
            onReset={() =>
              onChange((current) => ({
                ...current,
                destinationQuery: current.selectedDestination?.label ?? "",
                selectedDestination: null,
              }))
            }
            onValueChange={(value) =>
              onChange((current) => ({
                ...current,
                destinationQuery: value,
                selectedDestination: null,
              }))
            }
            onSelect={(option) =>
              onChange((current) => ({
                ...current,
                destinationQuery: option.label,
                selectedDestination: option,
              }))
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <FieldLabel label="Departure date" icon={CalendarDays}>
          <input
            type="date"
            value={form.departureDate}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                departureDate: event.target.value,
                returnDate:
                  current.returnDate && current.returnDate < event.target.value
                    ? event.target.value
                    : current.returnDate,
              }))
            }
            className="field-shell w-full"
          />
        </FieldLabel>
        <FieldLabel label="Return date" icon={CalendarDays}>
          <input
            type="date"
            min={form.departureDate}
            value={form.returnDate}
            onChange={(event) =>
              onChange((current) => ({
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
              onChange((current) => ({
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
              onChange((current) => ({
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
              onChange((current) => ({
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
              onChange((current) => ({
                ...current,
                infants: Math.max(0, Number(event.target.value) || 0),
              }))
            }
            className="field-shell w-full"
          />
        </FieldLabel>
      </div>

      <div className="flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs leading-6 text-slate-400">
          Travelers:{" "}
          {formatTravelerSummary(form.adults, form.children, form.infants)}
        </div>
        <ActionButton
          onClick={onSearch}
          loading={loadingSearch}
          disabled={disabled || !readyToSearch}
          icon={Search}
        >
          Search flights
        </ActionButton>
      </div>
    </div>
  );
}

function FlightLocationField({
  label,
  placeholder,
  value,
  selectedOption,
  loading,
  options,
  disabled,
  onReset,
  onValueChange,
  onSelect,
}: {
  label: string;
  placeholder: string;
  value: string;
  selectedOption: LookupOption | null;
  loading: boolean;
  options: LookupOption[];
  disabled: boolean;
  onReset: () => void;
  onValueChange: (value: string) => void;
  onSelect: (option: LookupOption) => void;
}) {
  const inputValue = selectedOption ? selectedOption.label : value;

  return (
    <div className="relative space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-200">{label}</label>
        {selectedOption && (
          <button
            type="button"
            className="secondary-btn h-9 rounded-xl px-3 text-xs"
            disabled={disabled}
            onClick={onReset}
          >
            Change
          </button>
        )}
      </div>

      <div className="relative">
        <div className="field-shell flex items-center gap-2 px-3">
          <MapPin className="size-4 shrink-0 text-slate-500" />
          <input
            value={inputValue}
            disabled={Boolean(selectedOption) || disabled}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent outline-none disabled:cursor-not-allowed"
          />
          {loading ? (
            <LoaderCircle className="size-4 shrink-0 animate-spin text-[#31d196]" />
          ) : (
            <Search className="size-4 shrink-0 text-slate-500" />
          )}
        </div>
      </div>

      {!selectedOption && options.length > 0 && (
        <div className="animate-rise-in absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-[#09161B]/95 p-2 shadow-2xl backdrop-blur">
          {options.map((option) => (
            <button
              key={`${label}-${option.id}`}
              type="button"
              className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/6"
              onClick={() => onSelect(option)}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">
                  {option.label}
                </div>
                <div className="truncate text-xs text-slate-400">
                  {option.code ?? option.subtitle ?? option.id}
                </div>
              </div>
              <Plane className="mt-0.5 size-4 shrink-0 text-slate-500" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FlowPill({
  icon: Icon,
  title,
  copy,
  active,
}: {
  icon: typeof MapPin;
  title: string;
  copy: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        active
          ? "border-[#31d196]/30 bg-[#31d196]/10"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="mb-2 inline-flex size-9 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
        <Icon className={active ? "size-4 text-[#31d196]" : "size-4 text-slate-400"} />
      </div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs leading-6 text-slate-400">{copy}</div>
    </div>
  );
}
