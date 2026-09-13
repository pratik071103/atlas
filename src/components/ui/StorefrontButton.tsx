"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface StorefrontButtonProps {
  href: string;
  label?: string;
  icon?: LucideIcon;
  variant?: "ink" | "blue";
  tooltip?: string;
  target?: string;
  rel?: string;
  ariaLabel?: string;
  className?: string;
}

export function StorefrontButton({
  href,
  label,
  icon: Icon,
  variant = "ink",
  tooltip,
  target,
  rel,
  ariaLabel,
  className,
}: StorefrontButtonProps) {
  return (
    <div className={cn("storefront-btn-wrapper", className)}>
      <Link
        href={href}
        target={target}
        rel={rel}
        aria-label={ariaLabel ?? label}
        className={cn("Btn", variant === "blue" && "Btn--blue", label && "Btn--label")}
      >
        <span className="svgContainer">
          {label ? label : Icon ? <Icon size={18} strokeWidth={2.2} /> : null}
        </span>
        <span className="BG" />
      </Link>
      {tooltip && <span className="storefront-tooltip">{tooltip}</span>}
    </div>
  );
}