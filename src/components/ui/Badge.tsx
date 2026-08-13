import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "lime" | "lime-solid" | "lavender" | "ink" | "dark" | "red" | "amber";

const TONE: Record<Tone, string> = {
  lime: "bg-lime-100 text-lime-800",
  "lime-solid": "bg-lime-400 text-ink-900",
  lavender: "bg-lavender-100 text-lavender-600",
  ink: "bg-ink-100 text-ink-600",
  dark: "bg-ink-900 text-white",
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-700",
};

interface Props {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

export function Badge({ children, tone = "lime", className }: Props) {
  return <span className={cn("pill", TONE[tone], className)}>{children}</span>;
}
