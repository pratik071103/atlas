"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// LinkPreview — hover a link, get a floating screenshot of where it goes,
// drifting slightly with the pointer.
//
// Adapted from Aceternity's component of the same name. The effect is kept;
// the plumbing is not. What changed and why:
//
//  * No microlink. The original builds an api.microlink.io URL and renders a
//    live screenshot of `url` from a third-party service. That ships the link
//    target to someone else's server, depends on their uptime and free-tier
//    rate limit for a decorative hover, and — because the preload <img> is
//    rendered on mount, not on hover — fires on every page load whether or
//    not anyone hovers. This takes a local image instead, which also drops
//    the `qss` dependency entirely.
//
//  * No Radix. The original wraps @radix-ui/react-hover-card, which this
//    project does not use anywhere else. We have exactly one trigger in a
//    known spot, so hand-rolling the positioning avoids a new dependency.
//    If this ever needs to work on arbitrary inline links in flowing text,
//    switch to Radix — collision detection is the thing you'd be buying.
//
//  * It renders no anchor of its own. `children` is already the link (the
//    storefront button), and the original's Trigger-plus-inner-<a> would
//    nest one anchor inside another.
//
//  * `event.target` → `event.currentTarget` for the pointer maths. The
//    original measures whatever child the pointer happens to be over, so the
//    drift jumps as you cross an inner element's boundary.
//
//  * Opens on focus too. A preview only reachable by hover is invisible to
//    keyboard users.
//
// The original's `quality` and `layout` props are dropped — `layout` was
// never read, and `quality` was declared but never passed into the microlink
// params, so neither did anything.
// ---------------------------------------------------------------------------

interface LinkPreviewProps {
  /** The element that triggers the preview — already a link. */
  children: ReactNode;
  /** Local image shown in the card, e.g. "/storefront-preview.png". */
  imageSrc: string;
  /** Rendered width/height of the card image, in px. */
  width?: number;
  height?: number;
  /** Caption under the image. Omit for image only. */
  caption?: string;
  alt?: string;
  className?: string;
}

export function LinkPreview({
  children,
  imageSrc,
  width = 260,
  height = 163,
  caption,
  alt = "Link preview",
  className,
}: LinkPreviewProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReduced = useReducedMotion();

  // Horizontal drift. Halved relative to the pointer's offset from centre so
  // the card leans rather than chases.
  const x = useMotionValue(0);
  const driftX = useSpring(x, { stiffness: 100, damping: 15 });

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  // Small delay so a pointer clipping the corner of the button doesn't make
  // the card flash in and straight back out.
  function hide() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  }

  return (
    <span
      className={cn("relative inline-block", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        x.set((event.clientX - rect.left - rect.width / 2) / 2);
      }}
    >
      {children}

      {/* Centring lives on this static wrapper, not on the motion element:
          Tailwind's -translate-x-1/2 and Motion's `x` both write `transform`,
          so putting them on one element makes them clobber each other. */}
      {/* `w-max` is load-bearing. An absolutely positioned box with `left`
          set and `right: auto` shrink-to-fits against the space left in its
          containing block — which here is the ~40px icon button, so the card
          collapsed to about 95px and the caption wrapped. max-content sizing
          ignores that available width and takes the image's own. */}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 w-max -translate-x-1/2">
        <AnimatePresence>
          {open && (
            <motion.span
              className="block overflow-hidden rounded-xl border border-ink-900 bg-white p-1 shadow-xl"
              style={{ x: prefersReduced ? 0 : driftX }}
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.7 }}
              animate={
                prefersReduced
                  ? { opacity: 1 }
                  : {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { type: "spring", stiffness: 260, damping: 20 },
                    }
              }
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.7 }}
            >
              <Image
                src={imageSrc}
                width={width}
                height={height}
                alt={alt}
                className="block rounded-lg"
              />
              {caption && (
                <span className="block px-1 pb-0.5 pt-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                  {caption}
                </span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </span>
  );
}
