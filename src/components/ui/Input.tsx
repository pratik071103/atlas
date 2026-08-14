"use client";

import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const SHAPE = {
  rounded:
    "w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-ink-800",
  pill: "w-full rounded-full border border-ink-200 px-4 py-2 text-sm outline-none focus:border-ink-900",
};

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  shape?: keyof typeof SHAPE;
  onChange?: (value: string) => void;
}

export function Input({ label, shape = "rounded", className, onChange, ...rest }: Props) {
  const field = (
    <input
      {...rest}
      className={cn(SHAPE[shape], label && "mt-1", className)}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );

  if (!label) return field;

  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-600">{label}</span>
      {field}
    </label>
  );
}
