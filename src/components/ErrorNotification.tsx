"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

interface ErrorNotificationProps {
  message: string | null;
  onDismiss: () => void;
  /** Kicker above the message. It used to be hardcoded to "Checkout error",
   * which was accurate when checkout was the only thing that could fail into
   * this card; it now carries license errors too. */
  title?: string;
}

const AUTO_DISMISS_MS = 4000;

// The whole card — icon strip AND white message area — is clipped to one
// parallelogram (SKEW_PX offset top vs. bottom), not a rectangle with only
// the icon internally skewed. That was leaving a dead rectangular white
// block on the right before the screen edge; clipping the full card removes
// it and makes "the right side a parallelogram too", per feedback. Direction
// matches .Brand-highlight's own skewX(-8deg) (top edge extends further
// right, bottom edge further left) so the icon's internal lime/white split
// and the card's outer edges lean the same way.
const SKEW_PX = 12;
const CARD_CLIP = `polygon(${SKEW_PX}px 0, 100% 0, calc(100% - ${SKEW_PX}px) 100%, 0 100%)`;

// Border width, in px. The frame is an SVG stroke laid over the card, not a
// CSS `border` and not a second clipped box behind it.
//
//   * A real border is no good: clip-path clips the element's border along
//     with everything else it paints, so it survives on the flat top and
//     bottom edges and vanishes along both diagonals.
//   * Nesting a black clipped box behind a white one was the first fix, and
//     it left the diagonals looking pixelated — two independently
//     antialiased edges 2px apart, each blending against the other, so the
//     soft pixels of one fight the soft pixels of the next.
//
// A stroked path is a single antialiased edge, which is what a diagonal at
// this width needs. The polygon is inset by half the stroke so the whole
// width sits inside the clip instead of half of it being cut away.
const BORDER_PX = 2;

const REST_SHADOW =
  "0 0 0 0 rgba(18,100,255,0), 0 1px 2px rgba(12,15,12,0.04), 0 8px 24px rgba(12,15,12,0.06)";
const GLOW_SHADOW =
  "0 0 0 6px rgba(18,100,255,0.35), 0 1px 2px rgba(12,15,12,0.04), 0 8px 24px rgba(12,15,12,0.06)";

// Replaces the old inline red <Card> banner. Anchored top-right (fixed, so it
// survives page scroll), pinned flush against the viewport's right edge with
// zero gap — the card's own rightmost clip point sits exactly at the screen
// edge. Slides in from further right rather than popping/scaling in, with a
// brief blue glow (via an animated box-shadow ring) on both the way in and
// the way out; auto-dismisses after AUTO_DISMISS_MS unless the user closes
// it first.
export function ErrorNotification({
  message,
  onDismiss,
  title = "Something went wrong",
}: ErrorNotificationProps) {
  // The clip mixes px (the skew) with % (the edges), which an SVG polygon
  // cannot express — so the card is measured and the outline drawn in exact
  // pixels against it.
  const cardRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className="pointer-events-none fixed left-4 right-0 top-5 z-[70] flex justify-end">
      <AnimatePresence>
        {message && (
          <motion.div
            layout
            initial={{ opacity: 0, x: 64, boxShadow: REST_SHADOW }}
            animate={{ opacity: 1, x: 0, boxShadow: [GLOW_SHADOW, GLOW_SHADOW, REST_SHADOW] }}
            exit={{ opacity: 0, x: 56, boxShadow: GLOW_SHADOW }}
            transition={{
              x: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.3 },
              boxShadow: { duration: 0.7, times: [0, 0.35, 1], ease: "easeOut" },
            }}
            ref={(node) => {
              cardRef.current = node;
              if (node) setSize({ w: node.offsetWidth, h: node.offsetHeight });
            }}
            style={{ clipPath: CARD_CLIP, WebkitClipPath: CARD_CLIP }}
            className="pointer-events-auto relative max-w-[24rem] bg-white"
            role="alert"
          >
            <div className="flex items-stretch">
            <div className="Brand-highlight flex w-10 shrink-0 items-center justify-center sm:w-12">
              <span className="block aspect-square w-[34%] shrink-0 rounded-full bg-white" />
            </div>
            <div className="min-w-0 flex-1 py-4 pl-4 pr-6">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
                  {title}
                </p>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-900"
                  aria-label="Dismiss error"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="mt-1 text-sm text-ink-800">{message}</p>
            </div>
            </div>

            {size.w > 0 && (
              <svg
                aria-hidden
                className="pointer-events-none absolute inset-0"
                width={size.w}
                height={size.h}
                viewBox={`0 0 ${size.w} ${size.h}`}
              >
                <polygon
                  points={[
                    `${SKEW_PX + BORDER_PX / 2},${BORDER_PX / 2}`,
                    `${size.w - BORDER_PX / 2},${BORDER_PX / 2}`,
                    `${size.w - SKEW_PX - BORDER_PX / 2},${size.h - BORDER_PX / 2}`,
                    `${BORDER_PX / 2},${size.h - BORDER_PX / 2}`,
                  ].join(" ")}
                  fill="none"
                  stroke="#0c0f0c"
                  strokeWidth={BORDER_PX}
                  strokeLinejoin="miter"
                />
              </svg>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
