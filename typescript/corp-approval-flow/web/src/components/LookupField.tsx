import { ChevronsUpDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import type { DestinationOption, LookupOption } from "../types";

export default function LookupField({
  label,
  value,
  onChange,
  onSelect,
  options,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: LookupOption) => void;
  options: Array<LookupOption | DestinationOption>;
  icon?: ComponentType<{ className?: string }>;
}) {
  const Icon = icon;
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="grid gap-1 text-sm">
      <span className="inline-flex items-center gap-2 font-medium text-slate-200">
        {Icon ? <Icon className="size-4 text-orange-200" /> : null}
        {label}
      </span>
      <div className="relative">
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="field pr-10"
        />
        <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        {open && options.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#171722] p-1 shadow-lg animate-rise-in"
          >
            {options.map((option) => (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  className="w-full rounded-lg px-2 py-2 text-left text-sm text-slate-200 hover:bg-white/10"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect({
                      id: option.id,
                      label: option.label,
                      code: "code" in option ? option.code : undefined,
                      subtitle: option.subtitle,
                      raw: option.raw,
                    });
                    setOpen(false);
                  }}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-slate-400">
                    {option.subtitle || ("code" in option ? option.code : "")}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
