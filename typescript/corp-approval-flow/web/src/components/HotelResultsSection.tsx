import { ArrowRight, BedDouble, CheckCircle2, LoaderCircle, MapPin, ShieldCheck, Star } from "lucide-react";
import type { RoomOption, TravelOption } from "../types";
import { getImage } from "../types";
import { formatPrice, hotelStarRating, readString } from "../utils";
import { ResultCardSkeleton } from "./ResultCards";
import DOMPurify from "dompurify";

export default function HotelResultsSection({
  options,
  selectedIndex,
  roomOptions,
  selectedRoomIndex,
  actionKey,
  onLoadRooms,
  onSelectRoom,
  onPrepareHotelRoom,
  preparedRoomId,
  searchLoading,
}: {
  options: TravelOption[];
  selectedIndex: number | null;
  roomOptions: RoomOption[];
  selectedRoomIndex: number | null;
  actionKey: string | null;
  onLoadRooms: (hotelIndex: number) => void;
  onSelectRoom: (index: number) => void;
  onPrepareHotelRoom: (hotelIndex: number, room: RoomOption) => void;
  preparedRoomId: string | null;
  searchLoading: boolean;
}) {
  const selectedHotel = selectedIndex !== null ? options[selectedIndex] ?? null : null;

  return (
    <div className="space-y-6 lg:h-full lg:overflow-y-auto lg:pr-2">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-200">Hotel results</div>
        <h3 className="mt-1 text-lg font-semibold text-white">Choose a hotel and continue</h3>
        <p className="mt-1 text-sm text-slate-400">
          Cards show imagery, location, star rating, and from-price. Load rooms on the card you want to book.
        </p>
      </div>

      {searchLoading && options.length === 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <ResultCardSkeleton />
          <ResultCardSkeleton />
        </div>
      ) : options.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {options.map((hotel, index) => {
            const active = selectedIndex === index;
            const image = getImage(hotel.raw);
            const address =
              readString(hotel.raw, ["address", "fullAddress", "location"]) ?? hotel.description;
            const stars = hotelStarRating(hotel.raw);
            const inspectKey = `hotel-rooms:${index}`;
            const loadingRooms = actionKey === inspectKey;

            return (
              <article
                key={`${hotel.title}-${index}`}
                className={`animate-rise-in overflow-hidden rounded-3xl border ${
                  active ? "border-orange-400/40 bg-orange-400/[0.08]" : "border-white/10 bg-white/[0.035]"
                } transition duration-200`}
                style={{ animationDelay: `${index * 35}ms` }}
              >
                <div className="relative h-48 overflow-hidden bg-slate-900">
                  {image ? (
                    <img
                      src={image}
                      alt={hotel.title}
                      className="h-full w-full object-cover transition duration-500 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#10272D] to-[#0F1F25] text-slate-400">
                      <BedDouble className="size-10" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <div className="mb-2 flex items-center gap-2">
                      {Array.from({ length: Math.max(1, Math.min(5, stars)) }).map((_, starIndex) => (
                        <Star
                          key={`${hotel.title}-star-${starIndex}`}
                          className="size-3.5 fill-orange-300 text-orange-300"
                        />
                      ))}
                    </div>
                    <h3 className="text-lg font-semibold text-white">{hotel.title}</h3>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <div className="inline-flex items-start gap-2 text-sm text-slate-300">
                        <MapPin className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                        <span className="line-clamp-3">{address}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 text-sm text-slate-400">
                        <ShieldCheck className="size-4 text-orange-300" />
                        Live inventory via RouteStack
                      </div>
                    </div>
                    <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-right">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-orange-200">from</div>
                      <div className="text-lg font-semibold text-white">
                        {formatPrice(hotel.totalPrice, hotel.currency)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary w-full"
                    onClick={() => onLoadRooms(index)}
                    disabled={Boolean(actionKey)}
                  >
                    {loadingRooms ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Loading rooms…
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
        <div className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-slate-400">
          Pick a destination from suggestions, then search to populate hotel cards.
        </div>
      )}

      {selectedHotel && (roomOptions.length > 0 || actionKey?.startsWith("hotel-rooms:")) && (
        <section className="space-y-4 rounded-3xl border border-white/10 bg-black/15 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-200">Selected hotel</div>
              <h3 className="text-xl font-semibold text-white">{selectedHotel.title}</h3>
            </div>
            {roomOptions.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                Rooms loaded:{" "}
                <span className="font-semibold text-white">{roomOptions.length}</span>
              </div>
            )}
          </div>

          {roomOptions.length > 0 ? (
            <div className="grid gap-3">
              {roomOptions.map((room, index) => {
                const prepareKey = `hotel-prepare:${room.id}`;
                const preparing = actionKey === prepareKey;
                const roomCurrency = readString(room.raw, ["currency"]) ?? selectedHotel.currency ?? "USD";
                const meal = readString(room.raw, ["mealPlan", "board"]);
                const preparedHere = preparedRoomId === room.id;

                return (
                  <div
                    key={`${room.id}-${index}`}
                    className={`rounded-2xl border p-4 ${
                      selectedRoomIndex === index ? "border-orange-400/50 bg-orange-400/10" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <button type="button" className="w-full text-left" onClick={() => onSelectRoom(index)}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-white">{room.name}</p>
                        {preparedHere && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                            <CheckCircle2 className="size-3" /> Ready
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{ renderHtmlText({ html: room.description }) || "Room details from provider"}</p>
                      {meal && <p className="mt-1 text-xs text-slate-500">{meal}</p>}
                      <p className="mt-2 text-lg font-semibold text-orange-200">
                        {formatPrice(room.publishedRate, roomCurrency)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{room.refundable ? "Refundable" : "Non-refundable"}</p>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary mt-3 w-full"
                      onClick={() => {
                        onSelectRoom(index);
                        if (selectedIndex !== null) onPrepareHotelRoom(selectedIndex, room);
                      }}
                      disabled={Boolean(actionKey)}
                    >
                      {preparing ? (
                        <>
                          <LoaderCircle className="size-4 animate-spin" />
                          Revalidating room…
                        </>
                      ) : (
                        <>
                          <ArrowRight className="size-4" />
                          Revalidate room &amp; prepare checkout
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : actionKey?.startsWith("hotel-rooms:") ? (
            <div className="inline-flex items-center gap-2 text-sm text-orange-200">
              <LoaderCircle className="size-4 animate-spin" />
              Fetching room rates…
            </div>
          ) : (
            <p className="text-sm text-slate-400">Use &quot;View rooms and rates&quot; on a hotel card above.</p>
          )}
        </section>
      )}
    </div>
  );
}

function renderHtmlText({ html }: { html: string }) {
  const cleanHtml = DOMPurify.sanitize(html);

  return (
    <div
      className="description"
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
}
