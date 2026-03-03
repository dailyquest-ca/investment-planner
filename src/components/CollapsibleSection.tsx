import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-700/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-3 text-left text-sm font-medium text-slate-300 hover:text-slate-100 transition"
      >
        {title}
        <span className="text-slate-500 transition transform" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▼
        </span>
      </button>
      {open && <div className="pb-3 space-y-3">{children}</div>}
    </div>
  );
}
