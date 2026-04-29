import { ArrowRight, Wallet } from "lucide-react";

export default function CheckoutPanel({
  paymentUrl,
  revalidation,
}: {
  paymentUrl: string;
  revalidation: Record<string, unknown> | null;
}) {
  if (!paymentUrl && !revalidation) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#F5C542]/10 to-transparent p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F5C542]">
            Checkout
          </div>
          <h3 className="mt-1 text-lg font-semibold text-white">
            Complete your booking
          </h3>
        </div>
        <Wallet className="size-5 text-[#31d196]" />
      </div>

      {/* Revalidation */}
      {revalidation && (
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
          <div className="h-2 w-2 rounded-full bg-green-400" />
          <span>Price & availability verified</span>
        </div>
      )}

      {/* CTA */}
      {paymentUrl ? (
        <a
          href={paymentUrl}
          target="_blank"
          rel="noreferrer"
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#F5C542] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
        >
          Continue to payment
          <ArrowRight className="size-4 transition group-hover:translate-x-1" />
        </a>
      ) : (
        <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          Unable to generate checkout link. Please try again.
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 text-center text-xs text-slate-500">
        Secure payment powered by RouteStack
      </div>
    </section>
  );
}
