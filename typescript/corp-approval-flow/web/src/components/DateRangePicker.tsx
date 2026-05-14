import { CalendarRange } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";

function toDate(input?: string): Date | undefined {
  if (!input) return undefined;
  const d = new Date(`${input}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toYmd(date?: Date): string | undefined {
  if (!date) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayRange(range?: DateRange): string {
  if (!range?.from) return "Select date range";
  const from = range.from.toLocaleDateString();
  if (!range.to) return `${from} - ...`;
  return `${from} - ${range.to.toLocaleDateString()}`;
}

export default function DateRangePicker({
  label,
  start,
  end,
  onChange,
}: {
  label: string;
  start?: string;
  end?: string;
  onChange: (start?: string, end?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = useMemo<DateRange | undefined>(
    () => ({ from: toDate(start), to: toDate(end) }),
    [start, end],
  );

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={wrapRef} className="grid gap-1 text-sm">
      <span className="inline-flex items-center gap-2 font-medium text-slate-200">
        <CalendarRange className="size-4 text-orange-200" />
        {label}
      </span>
      <button type="button" className="field text-left" onClick={() => setOpen((v) => !v)}>
        {displayRange(selected)}
      </button>
      {open && (
        <div
          className="animate-rise-in rounded-2xl border border-white/10 p-3 shadow-[0_16px_55px_rgba(0,0,0,0.34)] backdrop-blur-md"
          style={{
            background: "rgba(18, 18, 28, 0.92)",
            boxShadow:
              "0 16px 55px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
          }}
        >
          <DayPicker
            mode="range"
            className="corp-rdp-theme"
            selected={selected}
            onSelect={(range) => {
              onChange(toYmd(range?.from), toYmd(range?.to));
            }}
            numberOfMonths={1}
            disabled={{ before: new Date() }}
          />
          <div className="mt-2 flex justify-end border-t border-white/10 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
