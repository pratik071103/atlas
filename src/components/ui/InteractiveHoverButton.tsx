"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// InteractiveHoverButton — a pill whose lime dot expands to flood the whole
// button while the resting label slides out and a label+arrow pair slides in.
//
// Adapted from MagicUI's component of the same name rather than copied. Four
// changes, each for a reason:
//
//  1. It renders a <span>, not a <button>. Its only caller right now is the
//     pricing card, and that card is ITSELF a role="button" — nesting a real
//     button inside would be invalid HTML, and the inner click would bubble
//     and fire the purchase twice. As a span it is purely presentational; the
//     click it receives belongs to the card. Pass `interactive` when dropping
//     it somewhere that is not already a control.
//
//  2. The label is rendered twice (that is how the swap works), so the second
//     copy is aria-hidden. Otherwise every screen reader announces the CTA
//     twice — the original ships this bug.
//
//  3. The dot's hover scale is 75, down from the original's 100.8. That
//     number is tuned to its own demo's width; ours only has to cover a
//     ~280px pill from a dot sitting at the left edge, which needs a radius
//     of at least 280px — a scale of about 70. The original would rasterise
//     an ~800px circle to paint a 280px one.
//     (Written out rather than quoted as a class: Tailwind scans comments,
//     so naming a utility here would emit a real, dead CSS rule.)
//
//  4. The incoming layer settles at translate-x-0 instead of the original's
//     `-translate-x-5`. That -5 is an unexplained nudge that leaves the
//     label+arrow visibly left of centre; `justify-center` already centres it.
//
// Reduced motion needs no handling here: globals.css already collapses every
// transition-duration to 0.01ms under `prefers-reduced-motion`, so the fill
// lands instantly instead of sweeping. That is the correct end state.
// ---------------------------------------------------------------------------

interface InteractiveHoverButtonProps {
  label: string;
  /** Swaps in a spinner and freezes the hover swap. */
  loading?: boolean;
  /** Loading copy; defaults to the label. */
  loadingLabel?: string;
  /**
   * Respond to this element's own hover as well as an ancestor `group/card`.
   * Leave off inside a clickable card — the card's hover already drives it,
   * and the two triggers are identical there since the pill sits inside it.
   */
  interactive?: boolean;
  className?: string;
}

export function InteractiveHoverButton({
  label,
  loading = false,
  loadingLabel = "Processing…",
  interactive = false,
  className,
}: InteractiveHoverButtonProps) {
  if (loading) {
    return (
      <span
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-full border border-ink-900 bg-white px-5 py-2 text-xs font-bold text-ink-900",
          className
        )}
      >
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        {loadingLabel}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "group/cta relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-full border border-ink-900 bg-white px-5 py-2 text-xs font-bold text-ink-900",
        className
      )}
    >
      {/* Resting layer — the dot that becomes the fill, plus the label. */}
      <span className="relative flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full bg-brand-lime transition-transform duration-300 group-hover/card:scale-[75]",
            interactive && "group-hover/cta:scale-[75]"
          )}
        />
        <span
          className={cn(
            "inline-block transition-all duration-300 group-hover/card:translate-x-8 group-hover/card:opacity-0",
            interactive && "group-hover/cta:translate-x-8 group-hover/cta:opacity-0"
          )}
        >
          {label}
        </span>
      </span>

      {/* Incoming layer — rides in over the lime fill. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 z-10 flex translate-x-8 items-center justify-center gap-1.5 opacity-0 transition-all duration-300",
          "group-hover/card:translate-x-0 group-hover/card:opacity-100",
          interactive && "group-hover/cta:translate-x-0 group-hover/cta:opacity-100"
        )}
      >
        {label}
        <ArrowRight size={14} />
      </span>
    </span>
  );
}
