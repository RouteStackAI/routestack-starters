import { Sparkles } from "lucide-react";

export default function EmptyState({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.025] p-6 text-center">
      <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-black/15">
        <Sparkles className="size-5 text-[#F5C542]" />
      </div>
      <div className="text-base font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-7 text-slate-400">{copy}</p>
    </div>
  );
}
