import { CalendarDays } from "lucide-react";

export function FieldLabel({
    label,
    icon: Icon,
    children,
  }: {
    label: string;
    icon?: typeof CalendarDays;
    children: React.ReactNode;
  }) {
    return (
      <label className="grid gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-200">
          {Icon ? <Icon className="size-4 text-[#F5C542]" /> : null}
          {label}
        </span>
        {children}
      </label>
    );
  }