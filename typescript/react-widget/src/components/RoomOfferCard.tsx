import DOMPurify from "dompurify";
import { CheckCircle2, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import { ActionButton } from "./ActionButton";
import { formatPrice } from "../utils";
import { HotelRoomOffer } from "../types";
import { useState } from "react";

export default function RoomOfferCard({
  room,
  currency,
  active,
  loading,
  disabled,
  onContinueCheckout,
}: {
  room: HotelRoomOffer;
  currency?: string;
  active: boolean;
  loading: boolean;
  disabled: boolean;
  onContinueCheckout: (room: HotelRoomOffer) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasLongDescription = Boolean(
    room.description && room.description.length > 140,
  );
  const facilities = room.facilities?.filter(Boolean).slice(0, 6) ?? [];

  return (
    <article
      className={`rounded-2xl border p-4 transition duration-200 ${
        active
          ? "border-[#31d196]/35 bg-[#31d196]/8"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="text-lg font-semibold text-white">{room.name}</div>
            {room.description && (
              <div className="max-w-3xl text-sm leading-6 text-slate-300">
                <p className={expanded ? "" : "line-clamp-2"}>
                  {renderHtmlText({ html: room.description })}
                </p>
                {hasLongDescription && (
                  <button
                    type="button"
                    className="mt-1 text-xs font-medium text-[#F5C542] transition hover:text-[#ffd970]"
                    onClick={() => setExpanded((value) => !value)}
                  >
                    {expanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#F5C542]/15 bg-gradient-to-br from-[#F5C542]/14 to-[#F5C542]/6 px-4 py-3 sm:min-w-[120px] sm:text-right">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#F5C542]">
              total stay
            </div>
            <div className="mt-1 text-xl font-semibold text-white">
              {formatPrice(room.price, room.currency ?? currency)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {room.refundable !== undefined && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
                room.refundable
                  ? "bg-[#31d196]/12 text-[#bff6de]"
                  : "bg-rose-500/12 text-rose-200"
              }`}
            >
              {room.refundable ? (
                <ShieldCheck className="size-3.5 text-[#31d196]" />
              ) : (
                <ShieldAlert className="size-3.5 text-rose-400" />
              )}
              {room.refundable ? "Refundable" : "Non-refundable"}
            </span>
          )}
          {room.mealPlan && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F5C542]/12 px-3 py-1 text-xs text-[#fde7a0]">
              <CheckCircle2 className="size-3.5 text-[#F5C542]" />
              {room.mealPlan}
            </span>
          )}
        </div>

        {facilities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {facilities.map((facility: any) => (
              <span
                key={`${room.id}-${facility}`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-black/12 px-3 py-2 text-xs text-slate-300"
              >
                <CheckCircle2 className="size-3.5 shrink-0 text-[#31d196]" />
                {facility}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex justify-end pt-2">
          <ActionButton
            onClick={() => onContinueCheckout(room)}
            loading={loading}
            disabled={disabled}
            icon={Wallet}
          >
            Continue to checkout
          </ActionButton>
        </div>
      </div>
    </article>
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
