"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "dark" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  dark: "btn-dark",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900 disabled:opacity-50 disabled:pointer-events-none",
  danger: "btn-secondary hover:border-red-300 hover:text-red-600 disabled:opacity-40",
};

const SIZE: Record<Size, string> = {
  sm: "px-4 py-2 text-xs",
  md: "",
  lg: "px-6 py-3.5 text-base",
};

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  /** Renders a next/link anchor instead of a <button>. */
  href?: string;
  type?: "button" | "submit" | "reset";
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  href,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = cn(VARIANT[variant], SIZE[size], fullWidth && "w-full", className);

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

const ARROW = (
  <span className="bc-cta__arrow" aria-hidden="true">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  </span>
);

interface CtaButtonProps {
  children: ReactNode;
  dark?: boolean;
  arrow?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function CtaButton({
  children,
  dark = false,
  arrow = false,
  loading = false,
  fullWidth = false,
  disabled = false,
  href,
  onClick,
  className,
}: CtaButtonProps) {
  const classes = cn("bc-cta", dark && "bc-cta--dark", !arrow && "bc-cta--centered", className);
  const style = fullWidth ? undefined : { width: "auto" };

  const label = (
    <span className="bc-cta__label">
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 size={15} className="animate-spin" />
          Working…
        </span>
      ) : (
        children
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={classes} style={style}>
        {label}
        {arrow && ARROW}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={classes}
      style={style}
    >
      {label}
      {arrow && ARROW}
    </button>
  );
}
