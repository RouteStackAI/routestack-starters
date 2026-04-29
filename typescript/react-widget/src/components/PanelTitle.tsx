export function PanelTitle({
    eyebrow,
    title,
    copy,
  }: {
    eyebrow: string;
    title: string;
    copy: string;
  }) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F5C542]">
          {eyebrow}
        </div>
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="text-sm leading-7 text-slate-400">{copy}</p>
      </div>
    );
  }