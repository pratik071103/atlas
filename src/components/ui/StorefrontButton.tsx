"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// StorefrontButton — the pill CTA from the Hero ("PRICING"): a solid capsule
// whose fill sweeps up from scale(0) on hover while the label flips to the
// base colour. Styling lives in globals.css under .Btn / .Btn--blue /
// .Btn--label.
//
// Renders a link when `href` is given and a real <button> otherwise, so the
// same control can submit a form. The alternative was reproducing the .Btn
// styles on a second component, which would have put the hover sweep in two
// places to drift apart.
// ---------------------------------------------------------------------------

interface StorefrontButtonProps {
  /** Renders a next/link anchor. Omit to get a <button>. */
  href?: string;
  label?: string;
  icon?: LucideIcon;
  variant?: "ink" | "blue";
  tooltip?: string;
  target?: string;
  rel?: string;
  ariaLabel?: string;
  className?: string;
  /** Button mode only. */
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
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
  type = "button",
  onClick,
  disabled,
}: StorefrontButtonProps) {
  const btnClass = cn("Btn", variant === "blue" && "Btn--blue", label && "Btn--label");

  const inner = (
    <>
      <span className="svgContainer">
        {label ? label : Icon ? <Icon size={18} strokeWidth={2.2} /> : null}
      </span>
      <span className="BG" />
    </>
  );

  return (
    <div className={cn("storefront-btn-wrapper", className)}>
      {href ? (
        <Link
          href={href}
          target={target}
          rel={rel}
          aria-label={ariaLabel ?? label}
          className={btnClass}
        >
          {inner}
        </Link>
      ) : (
        <button
          type={type}
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          className={btnClass}
        >
          {inner}
        </button>
      )}
      {tooltip && <span className="storefront-tooltip">{tooltip}</span>}
    </div>
  );
}
