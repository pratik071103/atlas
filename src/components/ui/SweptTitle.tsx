"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SelectableWord } from "@/components/ui/SelectableWord";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// SweptTitle — the big Anton page title that sweeps a slanted blue slab across
// itself, letter by letter, shortly after mount and then stays highlighted.
//
// Extracted from the pricing page's "STORE" header so /studio can open the
// same way. It was ~40 lines of page-local constants, state, a mount timer and
// a useCallback; two copies of that would have drifted within a week.
// ---------------------------------------------------------------------------

/** Space Mono caption style — the small uppercase line that sits under or
 * beside a SweptTitle. Shared for the same reason the title is. */
export const CAPTION_STYLE = {
  fontFamily: "var(--font-space-mono)",
  fontSize: "12px",
  fontWeight: 400,
  letterSpacing: "0.13em",
  textTransform: "uppercase",
  color: "#555555",
  lineHeight: 2,
} as const;

// Matches Hero.tsx's tagline ("PRICING AT ITS FINEST") exactly. Anton has no
// Tailwind alias — only --font-display/body/mono are mapped in the config —
// so it has to be an inline style.
const TITLE_STYLE = {
  fontFamily: "var(--font-anton)",
  fontSize: "clamp(3rem, 9vw, 14rem)",
  lineHeight: 0.88,
  letterSpacing: "-0.01em",
  color: "#111111",
  textTransform: "uppercase",
} as const;

/** Delay before the sweep starts, so it reads as a deliberate entrance rather
 * than something that was already mid-animation when the page painted. */
const START_DELAY_MS = 300;

interface SweptTitleProps {
  word: string;
  /** Slab colour. Defaults to the STORE selection blue; /studio passes brand
   * lime so the two pages are told apart at a glance. */
  highlightFill?: string;
  /** Text on the slab — white on blue, ink on lime. */
  highlightTextColor?: string;
  /** Fires once the sweep has finished, for chaining a following animation
   * (the pricing caption's TextHighlight waits on this). */
  onDone?: () => void;
  className?: string;
}

export function SweptTitle({
  word,
  onDone,
  className,
  highlightFill,
  highlightTextColor,
}: SweptTitleProps) {
  const [trigger, setTrigger] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTrigger(true), START_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // SelectableWord lists `onDone` in its effect deps, so an unstable reference
  // restarts the sweep on every unrelated re-render of the parent — toggling
  // the pricing page's checkout mode used to replay it. Holding the callback
  // in a ref means what SelectableWord receives never changes identity, so
  // callers can pass a plain inline arrow: the stabilising happens here, once,
  // where it cannot be forgotten.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  const handleDone = useCallback(() => onDoneRef.current?.(), []);

  return (
    <div
      style={TITLE_STYLE}
      // Pulls back up against the header's own top padding — the title is
      // meant to sit close to the top of the page, near the sidebar logo.
      className={cn("-mt-10 sm:-mt-14 md:-mt-16", className)}
      aria-label={word}
    >
      <SelectableWord
        word={word}
        trigger={trigger}
        persist
        charDurationMs={110}
        highlightSkewDeg={-8}
        highlightFill={highlightFill}
        highlightTextColor={highlightTextColor}
        onDone={handleDone}
      />
    </div>
  );
}
