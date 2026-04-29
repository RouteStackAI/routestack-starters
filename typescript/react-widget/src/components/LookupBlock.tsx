import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { LookupOption } from "../types";

export default function LookupBlock({
  label,
  value,
  loading,
  options,
  onValueChange,
  onLookup,
  onSelect,
}: {
  label: string;
  value: string;
  loading: boolean;
  options: LookupOption[];
  onValueChange: (value: string) => void;
  onLookup: () => void;
  onSelect: (option: LookupOption) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/8 bg-black/10 p-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-200">{label}</label>
        <button
          type="button"
          className="secondary-btn h-9 rounded-xl px-3 text-xs"
          onClick={onLookup}
        >
          {loading ? (
            <>
              <LoaderCircle className="size-3.5 animate-spin" />
              Searching
            </>
          ) : (
            <>
              <Search className="size-3.5" />
              Lookup
            </>
          )}
        </button>
      </div>
      <input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={`Search ${label.toLowerCase()}`}
        className="field-shell w-full"
      />
      {options.length > 0 && (
        <div className="grid gap-2">
          {options.slice(0, 4).map((option) => (
            <button
              key={option.id}
              type="button"
              className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 text-left transition hover:bg-white/[0.06]"
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
              <ArrowRight className="size-4 shrink-0 text-slate-500" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
