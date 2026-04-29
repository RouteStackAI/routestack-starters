import { type Dispatch, type SetStateAction } from "react";
import { PanelTitle } from "./PanelTitle";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  LoaderCircle,
  MapPin,
  PencilLine,
  Search,
  Users,
} from "lucide-react";
import { FieldLabel } from "./FieldLabel";
import { ActionButton } from "./ActionButton";

export interface HotelListing {
  id: string;
  name: string;
  address: string;
  price?: number;
  currency?: string;
  starRating?: number;
  rating?: number;
  image?: string;
  latitude?: number;
  longitude?: number;
  token?: string;
  correlationId?: string;
  raw: Record<string, unknown>;
}

export interface HotelRoomOffer {
  id: string;
  name: string;
  recommendationId?: string;
  price?: number;
  currency?: string;
  refundable?: boolean;
  mealPlan?: string;
  description?: string;
  facilities?: string[];
  raw: Record<string, unknown>;
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

export interface HotelRoomOccupancy {
  adults: number;
  children: number;
  childAges?: number[];
}

export interface HotelLookupOption {
  city: string;
  type: string;
  referenceId: string;
  fullName: string;
  country: string;
  id: string;
  lat: number;
  long: number;
  raw: Record<string, unknown>;
}

interface HotelFormState {
  destinationQuery: string;
  selectedDestination: HotelLookupOption | null;
  checkIn: string;
  checkOut: string;
  rooms: HotelRoomOccupancy[];
}

export default function HotelFormSection({
  form,
  flow,
  disabled,
  loadingDestinationSearch,
  loadingHotelSearch,
  onChange,
  onSearch,
}: {
  form: HotelFormState;
  flow: HotelFlowState;
  disabled: boolean;
  loadingDestinationSearch: boolean;
  loadingHotelSearch: boolean;
  onChange: Dispatch<SetStateAction<HotelFormState>>;
  onSearch: () => void;
}) {
  return (
    <div className="space-y-6">
      <PanelTitle
        eyebrow="Hotel workflow"
        title="Search destination and stay inventory"
        copy="Seach destination using below input. Once selected, the field locks until you explicitly change it."
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-200">
            Destination
          </label>
          {form.selectedDestination && (
            <button
              type="button"
              className="secondary-btn h-9 rounded-xl px-3 text-xs"
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  destinationQuery: current.selectedDestination?.fullName ?? "",
                  selectedDestination: null,
                }))
              }
            >
              <PencilLine className="size-3.5" />
              Change
            </button>
          )}
        </div>

        <div className="relative">
          <div className="field-shell flex items-center gap-2 px-3">
            {/* Left icon */}
            <MapPin className="size-4 text-slate-500 shrink-0" />

            {/* Input */}
            <input
              value={
                form.selectedDestination
                  ? form.selectedDestination.fullName
                  : form.destinationQuery
              }
              disabled={Boolean(form.selectedDestination)}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  destinationQuery: event.target.value,
                  selectedDestination: null,
                }))
              }
              placeholder="Search by city, destination, or hotel name"
              className="w-full bg-transparent outline-none"
            />

            {/* Right icon */}
            {loadingDestinationSearch ? (
              <LoaderCircle className="size-4 animate-spin text-[#F5C542] shrink-0" />
            ) : (
              <Search className="size-4 text-slate-500 shrink-0" />
            )}
          </div>
        </div>

        {!form.selectedDestination && flow.destinationOptions.length > 0 && (
          <div className="animate-rise-in max-h-72 overflow-auto rounded-2xl border border-white/10 bg-[#F5C542]/5 p-2 shadow-2xl">
            {flow.destinationOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/6"
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    destinationQuery: option.fullName,
                    selectedDestination: option,
                  }))
                }
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {option.fullName}
                  </div>
                  <div className="truncate text-xs text-slate-400">
                    {option.type}
                  </div>
                </div>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-slate-500" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label="Check in" icon={CalendarDays}>
          <input
            type="date"
            value={form.checkIn}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                checkIn: event.target.value,
              }))
            }
            className="field-shell w-full"
          />
        </FieldLabel>
        <FieldLabel label="Check out" icon={CalendarDays}>
          <input
            type="date"
            value={form.checkOut}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                checkOut: event.target.value,
              }))
            }
            className="field-shell w-full"
          />
        </FieldLabel>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-200">Rooms</div>
            <div className="text-xs text-slate-400">
              Configure per-room occupancy for `search_hotels`.
            </div>
          </div>
          <button
            type="button"
            className="secondary-btn h-9 rounded-xl px-3 text-xs"
            disabled={disabled || form.rooms.length >= 6}
            onClick={() =>
              onChange((current) => ({
                ...current,
                rooms: [
                  ...current.rooms,
                  { adults: 2, children: 0, childAges: [] },
                ],
              }))
            }
          >
            <BedDouble className="size-3.5" />
            Add room
          </button>
        </div>

        <div className="space-y-3">
          {form.rooms.map((room, index) => (
            <div
              key={`room-${index}`}
              className="rounded-2xl border border-white/10 bg-black/15 p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  <Users className="size-4 text-[#F5C542]" />
                  Room {index + 1}
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-[#F5C542] transition hover:text-[#ffd970] disabled:opacity-40"
                  disabled={disabled || form.rooms.length === 1}
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      rooms: current.rooms.filter(
                        (_, roomIndex) => roomIndex !== index,
                      ),
                    }))
                  }
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Adults">
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={room.adults}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        rooms: current.rooms.map((entry, roomIndex) =>
                          roomIndex === index
                            ? {
                                ...entry,
                                adults: Math.max(
                                  1,
                                  Number(event.target.value) || 1,
                                ),
                              }
                            : entry,
                        ),
                      }))
                    }
                    className="field-shell w-full"
                  />
                </FieldLabel>
                <FieldLabel label="Children">
                  <input
                    type="number"
                    min={0}
                    max={4}
                    value={room.children}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        rooms: current.rooms.map((entry, roomIndex) =>
                          roomIndex === index
                            ? {
                                ...entry,
                                children: Math.max(
                                  0,
                                  Number(event.target.value) || 0,
                                ),
                              }
                            : entry,
                        ),
                      }))
                    }
                    className="field-shell w-full"
                  />
                </FieldLabel>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs leading-6 text-slate-400">
          Selected occupancy: {formatRoomSummary(form.rooms)}
        </div>
        <ActionButton
          onClick={onSearch}
          loading={loadingHotelSearch}
          disabled={disabled || !form.selectedDestination}
          icon={Search}
        >
          Search hotels
        </ActionButton>
      </div>
    </div>
  );
}

function formatRoomSummary(rooms: HotelRoomOccupancy[]) {
  return rooms
    .map(
      (room, index) => `Room ${index + 1}: ${room.adults}A/${room.children}C`,
    )
    .join(" • ");
}
