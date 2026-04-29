import { useEffect, useRef } from "react";
import { PanelTitle } from "./PanelTitle";
import {
  ArrowRight,
  BedDouble,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import EmptyState from "./EmptyState";
import RoomOfferCard from "./RoomOfferCard";
import { formatPrice, formatRoomSummary, readStringRecord } from "../utils";
import CheckoutPanel from "./CheckoutPanel";

interface HotelFormState {
  destinationQuery: string;
  selectedDestination: HotelLookupOption | null;
  checkIn: string;
  checkOut: string;
  rooms: HotelRoomOccupancy[];
}

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

export default function HotelResultsSection({
  form,
  flow,
  actionKey,
  onInspectHotel,
  onContinueCheckout,
}: {
  form: HotelFormState;
  flow: HotelFlowState;
  actionKey: string | null;
  onInspectHotel: (hotel: HotelListing) => void;
  onContinueCheckout: (room: HotelRoomOffer) => void;
}) {
  const roomsSectionRef = useRef<HTMLElement | null>(null);
  const checkoutRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (flow.selectedHotel && flow.roomOffers.length > 0) {
      roomsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [flow.selectedHotel, flow.roomOffers.length]);

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
        eyebrow="Hotel results"
        title="Choose a hotel and continue"
        copy="Cards surface imagery, location, pricing, room availability, and checkout readiness."
      />

      {flow.hotels.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {flow.hotels.map((hotel, index) => {
            const active = flow.selectedHotel?.id === hotel.id;
            return (
              <article
                key={hotel.id}
                className={`animate-rise-in overflow-hidden rounded-3xl border ${
                  active
                    ? "border-[#F5C542]/35 bg-[#F5C542]/8"
                    : "border-white/10 bg-white/[0.035]"
                } transition duration-200`}
                style={{ animationDelay: `${index * 35}ms` }}
              >
                <div className="relative h-48 overflow-hidden bg-slate-900">
                  {hotel.image ? (
                    <img
                      src={hotel.image}
                      alt={hotel.name}
                      className="h-full w-full object-cover transition duration-500 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#10272D] to-[#0F1F25] text-slate-400">
                      <BedDouble className="size-10" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <div className="mb-2 flex items-center gap-2">
                      {Array.from({
                        length: Math.max(
                          1,
                          Math.min(5, Math.round(hotel.starRating ?? 4)),
                        ),
                      }).map((_, starIndex) => (
                        <Star
                          key={`${hotel.id}-star-${starIndex}`}
                          className="size-3.5 fill-[#F5C542] text-[#F5C542]"
                        />
                      ))}
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      {hotel.name}
                    </h3>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <div className="inline-flex items-center gap-2 text-sm text-slate-300">
                        <MapPin className="size-6 text-[#31d196]" />
                        <span className="line-clamp-2">{hotel.address}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 text-sm text-slate-400">
                        <ShieldCheck className="size-4 text-[#F5C542]" />
                        Live inventory via RouteStack
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#F5C542]/15 bg-[#F5C542]/10 px-3 py-2 text-right">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-[#F5C542]">
                        from
                      </div>
                      <div className="text-lg font-semibold text-white">
                        {formatPrice(hotel.price, hotel.currency)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="secondary-btn w-full"
                    onClick={() => onInspectHotel(hotel)}
                    disabled={Boolean(actionKey)}
                  >
                    {actionKey === `hotel-inspect-${hotel.id}` ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Loading rooms
                      </>
                    ) : (
                      <>
                        <ArrowRight className="size-4" />
                        View rooms and rates
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No hotels yet"
          copy="Pick a destination from the dropdown, then run a hotel search to populate these cards."
        />
      )}

      {flow.selectedHotel && (
        <section
          ref={roomsSectionRef}
          className="space-y-4 rounded-3xl border border-white/10 bg-black/15 p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F5C542]">
                Selected hotel
              </div>
              <h3 className="text-xl font-semibold text-white">
                {flow.selectedHotel.name}
              </h3>
              <div className="inline-flex items-center gap-2 text-sm text-slate-300">
                <Users className="size-4 text-[#31d196]" />
                {formatRoomSummary(form.rooms)}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
              Rooms loaded:{" "}
              <span className="font-semibold text-white">
                {flow.roomOffers.length}
              </span>
            </div>
          </div>

          {flow.hotelDetails && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-7 text-slate-300">
              {readStringRecord(flow.hotelDetails, [
                "description",
                "shortDescription",
                "address",
              ]) ?? flow.selectedHotel.address}
            </div>
          )}

          {flow.roomOffers.length ? (
            <div className="grid gap-3">
              {flow.roomOffers.map((room, index) => (
                <RoomOfferCard
                  key={`${room.id}-${index}`}
                  room={room}
                  currency={flow.selectedHotel?.currency}
                  active={
                    flow.selectedRoom?.recommendationId ===
                    room.recommendationId
                  }
                  loading={actionKey === `hotel-checkout-${room.id}`}
                  disabled={Boolean(actionKey)}
                  onContinueCheckout={onContinueCheckout}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No room inventory available"
              copy="Choose any other hotel above to fetch room and rate data."
            />
          )}
        </section>
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
