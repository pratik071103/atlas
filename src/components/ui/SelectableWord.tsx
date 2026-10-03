"use client";

import { animate } from "motion/react";
import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// SelectableWord — letter-by-letter highlight, hold, then deselect (or stay
// selected forever when `persist` is set). Extracted from Hero.tsx's tagline
// ("PRICING AT ITS FINEST") so it can be reused elsewhere (e.g. the pricing
// page's "STORE" title) with the exact same mechanic and "blue highlight"
// look — Hero.tsx now imports this instead of defining its own copy.
// ---------------------------------------------------------------------------

// The selection slab's fill. Mirrors the `brand.highlight` Tailwind token
// (tailwind.config.js) — it can't be a class here because the skewed variant
// below needs the raw colour for its own background. Keep the two in step:
// the pricing cards' hover slab uses the token form of this exact fill so a
// card hover reads as the same highlighter gesture as the STORE sweep.
const HIGHLIGHT_FILL = "rgba(55, 97, 230, 0.88)";

/** Text colour that sits on HIGHLIGHT_FILL. A caller passing a light fill
 * (the lime STUDIO title) must pass a dark one of its own. */
const HIGHLIGHT_TEXT = "#ffffff";

const HOLD_MS = 320; // pause at full-word selection before deselecting
const EXIT_S = 0.18; // deselect animation duration (seconds)
const DEFAULT_CHAR_MS = 90;

export function SelectableWord({
  word,
  trigger,
  persist = false,
  onDone,
  charDurationMs = DEFAULT_CHAR_MS,
  highlightSkewDeg = 0,
  highlightFill = HIGHLIGHT_FILL,
  highlightTextColor = HIGHLIGHT_TEXT,
}: {
  word: string;
  trigger: boolean;
  persist?: boolean;
  onDone: () => void;
  /** Milliseconds per character for the sweep — defaults to a steady 90ms/char. */
  charDurationMs?: number;
  /** Skews ONLY the blue highlight layer (not the base text) — matches the
   * slanted .Brand-highlight look used for FOUNDRY/STUDIO in Hero.tsx. 0 = no
   * skew (Hero's PRICING/AT/ITS/FINEST usage, unchanged). */
  highlightSkewDeg?: number;
  /** Slab colour. Defaults to the selection blue; STUDIO passes brand lime. */
  highlightFill?: string;
  /** Colour of the text sitting on the slab — must be legible against
   * `highlightFill`. White on blue, ink on lime. */
  highlightTextColor?: string;
}) {
  const overlayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!trigger) return;

    const el = overlayRef.current;
    if (!el) return;

    let stopped = false;

    const wait = (ms: number) =>
      new Promise<void>((res) => setTimeout(res, ms));

    async function run() {
      const n = word.length;
      const charPct = 100 / n;
      const charDur = charDurationMs / 1000;

      // ── Letter-by-letter expansion ───────────────────────────────
      for (let i = 1; i <= n; i++) {
        if (stopped) return;
        await animate(
          el,
          { width: `${(i * charPct).toFixed(2)}%` },
          { duration: charDur, ease: "linear" }
        );
      }

      // ── Hold at full-word coverage ───────────────────────────────
      if (stopped) return;
      await wait(HOLD_MS);

      // ── Deselect — return to original black text ─────────────────
      // persist words (e.g. FINEST) skip the deselect and stay selected.
      if (!persist) {
        if (stopped) return;
        await animate(el, { width: "0%" }, { duration: EXIT_S, ease: [0.4, 0, 1, 1] });
      }

      if (!stopped) onDone();
    }

    run();

    return () => {
      stopped = true;
    };
  }, [trigger, word, persist, onDone, charDurationMs]);

  // Rough degrees→clip-path-percentage conversion — exact physical accuracy
  // doesn't matter here, just a visually convincing slant.
  const skewInsetPct = Math.min(12, Math.abs(highlightSkewDeg) * 0.6);

  return (
    <span
      className="relative inline-block"
      style={{
        // This wrapper's own box is what layer 2's `width: 100%` resolves
        // against (it's the nearest positioned ancestor). Padding added only
        // to layer 2's inner span doesn't grow THIS box, so layer 2 clips
        // its own padded content at the unpadded boundary — the padding has
        // to live here too so "100%" actually includes it. Layer 1 (plain
        // text) just sits slightly inset inside it, imperceptible since it's
        // only ever visible for the instant before the sweep covers it.
        padding: highlightSkewDeg ? "0.05em 0.14em 0.07em" : undefined,
      }}
    >
      {/* Layer 1 — permanent base text */}
      {word}

      {/* Layer 2 — selection reveal, clips from left */}
      <span
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-full overflow-hidden"
        style={{ width: "0%" }}
      >
        {/* White text on blue — same typography, clipped by parent width.
            Text itself always stays upright (matching .Brand-highlight's "text
            stays upright" rule). The background is a self-contained slanted
            parallelogram via clip-path, not a skewX transform — a transform
            overshoots the box and gets cut off by this same element's own
            overflow-hidden ancestor (the letter-reveal clip), which cancelled
            the slant out entirely. clip-path has no such overshoot: the shape
            is defined within its own box, so it survives the reveal clip. */}
        <span
          className="relative block whitespace-nowrap"
          style={{
            // z-index:0 (not "auto") is required here: it's what makes this
            // span an actual stacking context, so the child's -z-10 below
            // stays contained to "behind this span's own content" instead of
            // escaping to fight z-index elsewhere on the page — without it,
            // the negative z-index child rendered behind THE WHOLE PAGE
            // background and vanished entirely.
            zIndex: 0,
            color: highlightTextColor,
            fontFamily: "inherit",
            fontSize: "inherit",
            fontWeight: "inherit",
            letterSpacing: "inherit",
            lineHeight: "inherit",
            textTransform: "inherit",
            // Must match the outer wrapper's padding exactly — that padding
            // only grows how much room layer 2 has (its width:100% resolves
            // against the wrapper); the actual glyphs here also need the same
            // inset or they render flush at layer 2's edge while layer 1's
            // text sits shifted by the wrapper's padding, drifting apart.
            padding: highlightSkewDeg ? "0.05em 0.14em 0.07em" : undefined,
          }}
        >
          {highlightSkewDeg ? (
            <span
              aria-hidden
              className="absolute -z-10 inset-0"
              style={{
                background: highlightFill,
                clipPath: `polygon(${skewInsetPct}% 0%, 100% 0%, ${100 - skewInsetPct}% 100%, 0% 100%)`,
              }}
            />
          ) : (
            <span
              aria-hidden
              className="absolute -z-10 inset-0"
              style={{ background: highlightFill }}
            />
          )}
          {word}
        </span>
      </span>
    </span>
  );
}
