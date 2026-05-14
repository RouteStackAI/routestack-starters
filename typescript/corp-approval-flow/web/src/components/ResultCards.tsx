export function ResultCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      <div className="h-44 bg-white/10" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/10" />
        <div className="h-6 w-1/3 rounded bg-white/10" />
      </div>
    </div>
  );
}
