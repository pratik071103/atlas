"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// TextHighlight — a highlighter-marker sweep behind text, led by a small
// pointer/cursor icon that travels from just before the text to just past
// it (like a hand dragging a highlighter across the line), then the whole
// thing resets and loops. Slow and clearly visible per feedback: the
// earlier box+cursor version looked messy and was hard to see; this is a
// simpler background reveal + a bigger, slower-moving pointer.
// ---------------------------------------------------------------------------

interface TextHighlightProps {
  children: ReactNode;
  className?: string;
  highlightClassName?: string;
  /** The reveal won't start until this is true, even once scrolled into view
   * — lets a caller sequence this after another animation finishes. */
  startWhen?: boolean;
  /** `false` paints the slab once and leaves it: no sweep, no repeat, and no
   * travelling pointer icon. /studio uses this — one moving highlighter on a
   * page is an accent, two competing for attention is noise. */
  animated?: boolean;
  /** Marker colour. A named tone rather than a class override because `cn` in
   * this project is a plain join, not tailwind-merge — passing a competing
   * `bg-*` through `highlightClassName` would leave both classes on the
   * element and let stylesheet order decide the winner. */
  tone?: "lime" | "blue";
}

const TONE_BG: Record<"lime" | "blue", string> = {
  lime: "bg-brand-lime",
  // The same selection blue as the STORE title and the sidebar pill.
  blue: "bg-brand-highlight",
};

export function TextHighlight({
  children,
  className,
  highlightClassName,
  startWhen = true,
  animated = true,
  tone = "lime",
}: TextHighlightProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  // `once: false` deliberately: this is a `repeat: Infinity` loop, so with
  // `once: true` the sweep and its pointer icon kept animating forever after
  // the first reveal, including while scrolled far off-screen. Unmounting the
  // two motion spans when the line leaves the viewport stops that work; the
  // sweep simply replays if you scroll back up to it.
  const isInView = useInView(containerRef, { amount: 0.6 });
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => setSize({ width: el.offsetWidth, height: el.offsetHeight });
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shouldPlay = isInView && startWhen && size.width > 0;

  const padX = 4;
  const padY = 3;
  const boxW = size.width + padX * 2;
  const boxH = size.height + padY * 2;
  // The pointer starts just before the text and ends past its right edge —
  // matching the reference: it keeps moving after the highlight is painted,
  // like a highlighter pen continuing its drag.
  const pointerStart = -18;
  const pointerEnd = boxW + 8;

  // Static variant: the slab is a plain padded background behind the text, so
  // there is no measuring, no motion element and no infinite loop to stop.
  if (!animated) {
    return (
      <span
        className={cn(
          "relative inline-block rounded-md px-1 py-0.5",
          TONE_BG[tone],
          highlightClassName,
          className
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <span ref={containerRef} className={cn("relative inline-block", className)}>
      {shouldPlay && (
        <>
          <motion.span
            aria-hidden
            className={cn("absolute rounded-md", TONE_BG[tone], highlightClassName)}
            style={{ left: -padX, top: -padY, width: boxW, height: boxH, transformOrigin: "left center" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: [0, 1, 1, 0] }}
            transition={{
              duration: 4,
              times: [0, 0.32, 0.85, 1],
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 0.8,
            }}
          />
          <motion.span
            aria-hidden
            className="pointer-events-none absolute z-10 top-1/2"
            style={{ left: 0 }}
            initial={{ x: pointerStart, y: "-50%", opacity: 0 }}
            animate={{
              x: [pointerStart, pointerEnd, pointerEnd, pointerStart],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 4,
              times: [0, 0.32, 0.85, 1],
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 0.8,
            }}
          >
            <PointerCursorIcon className="h-6 w-6 -rotate-12 text-amber-400 drop-shadow-md" />
          </motion.span>
        </>
      )}
      <span className="relative">{children}</span>
    </span>
  );
}

function PointerCursorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="white"
      strokeWidth={1}
      className={className}
      aria-hidden
    >
      <path d="M4 2.5 L20 12.5 L12.8 13.8 L16.5 21 L13.2 22.5 L9.6 15.2 L4 20.5 Z" />
    </svg>
  );
}
