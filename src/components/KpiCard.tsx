import type { LucideIcon } from "lucide-react";
import { Card } from "./ui/Card";

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "lime" | "lavender" | "ink";
}

const TONE = {
  lime: "bg-lime-100 text-lime-800",
  lavender: "bg-lavender-100 text-lavender-600",
  ink: "bg-ink-100 text-ink-600",
};

export function KpiCard({ label, value, hint, icon: Icon, tone = "lime" }: Props) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${TONE[tone]}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 truncate text-3xl font-semibold font-display text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </Card>
  );
}
