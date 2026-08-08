import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
}

export function KpiCard({ label, value, hint, icon: Icon }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          {label}
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime-100 text-lime-800">
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold font-display text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
