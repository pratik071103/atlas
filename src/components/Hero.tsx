"use client";

import { motion, animate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { StorefrontButton } from "@/components/ui/StorefrontButton";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Milliseconds per character for each word — slow → fast → slow arc
const CHAR_MS: Record<string, number> = {
  PRICING: 110, // slowest  (7 chars × 110ms = 770ms sweep)
  AT:      85,  // picks up (2 chars × 85ms  = 170ms)
  ITS:     65,  // fastest  (3 chars × 65ms  = 195ms)
  FINEST:  100, // slows    (6 chars × 100ms = 600ms)
};

const HOLD_MS  = 320; // pause at full-word selection before deselecting
const EXIT_S   = 0.18; // deselect animation duration (seconds)

// ── Brand (FOUNDRY . STUDIO) reveal ─────────────────────────────────────
// The dot is the loading marker first: it stays centred, dims + dips like a
// loading pulse, then FOUNDRY unrolls out of it, then STUDIO. The tagline
// word sweep starts the moment FOUNDRY is rendered.
const DOT_LOAD_S     = 1.8;                    // dot "loading" pulse duration (s)
const BRAND_UNROLL_S = 1.15;                   // one word's unroll duration (s)
const FOUNDRY_START  = DOT_LOAD_S + 0.15;      // FOUNDRY starts once loading ends
const FOUNDRY_END    = FOUNDRY_START + BRAND_UNROLL_S;   // FOUNDRY is fully drawn
const TAGLINE_START  = FOUNDRY_END - 0.15;     // tagline enters as FOUNDRY lands — FOUNDRY reads first
const STUDIO_START   = TAGLINE_START + 1 + 0.15;        // STUDIO after the tagline is fully in
const START_MS       = STUDIO_START * 1000;    // sweep when STUDIO starts rendering

// ── Brand (FOUNDRY . STUDIO) ────────────────────────────────────────────
// Anton (same as the tagline) on a lime (#C6FE1E) slanted "highlighter" box
// (.Brand-highlight draws the slanted colour via ::before). Words are brand
// blue (#1264FF); the dot stays pure white. Shared by both words + the dot;
// per-word font-size overrides below. The words are baseline-aligned — one
// line, heights only.
const BRAND_STYLE = {
  fontFamily: "var(--font-anton)",
  fontSize: "clamp(3rem, 10vw, 13rem)",
  color: "#ffffff",
  padding: "0.05em 0.14em 0.07em",
  letterSpacing: "0.02em",
  lineHeight: 1,
} as const;

// FOUNDRY — the lead word, bumped up a little vs the old shared size.
const FOUNDRY_STYLE = {
  ...BRAND_STYLE,
  fontSize: "clamp(3.4rem, 11vw, 14rem)",
  color: "#1264FF",
} as const;

// studio — set noticeably smaller than FOUNDRY.
const STUDIO_STYLE = {
  ...BRAND_STYLE,
  fontSize: "clamp(2rem, 6.5vw, 8.5rem)",
  color: "#1264FF",
} as const;

// ---------------------------------------------------------------------------
// SelectableWord — letter-by-letter highlight, hold, then deselect
// ---------------------------------------------------------------------------

function SelectableWord({
  word,
  trigger,
  persist = false,
  onDone,
}: {
  word: string;
  trigger: boolean;
  persist?: boolean;
  onDone: () => void;
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
      const charDur = CHAR_MS[word] / 1000;

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
  }, [trigger, word, persist, onDone]);

  return (
    <span className="relative inline-block">
      {/* Layer 1 — permanent black text */}
      {word}

      {/* Layer 2 — selection reveal, clips from left */}
      <span
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-full overflow-hidden"
        style={{ width: "0%" }}
      >
        {/* White text on blue — same typography, clipped by parent width */}
        <span
          className="block whitespace-nowrap"
          style={{
            color: "#ffffff",
            background: "rgba(55, 97, 230, 0.88)",
            fontFamily: "inherit",
            fontSize: "inherit",
            fontWeight: "inherit",
            letterSpacing: "inherit",
            lineHeight: "inherit",
            textTransform: "inherit",
          }}
        >
          {word}
        </span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Masked slide-up line reveal
// ---------------------------------------------------------------------------

function HeadingLine({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div className="overflow-hidden" style={{ lineHeight: 0.88 }}>
      <motion.div
        initial={{ y: "110%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 1, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export function Hero() {
  // -1 = not started yet, 0–3 = animating that word, 4 = all done
  const [currentWord, setCurrentWord] = useState(-1);

  useEffect(() => {
    const t = setTimeout(() => setCurrentWord(0), START_MS);
    return () => clearTimeout(t);
  }, []);

  const advance = () => setCurrentWord((w) => Math.min(w + 1, 4));

  return (
    <section
      className="relative flex min-h-screen w-full flex-col overflow-hidden"
      style={{ backgroundColor: "#F2E9DB" }}
      aria-label="Hero"
    >
      {/* ── 1. Brand — FOUNDRY . STUDIO ─────────────────────────── */}
      {/* Anton on slanted lime highlighters. The dot loads first (slow dim +
          dip), then FOUNDRY unrolls out of it, then STUDIO. */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex w-[min(94vw,72rem)] items-baseline">
          <motion.span
            className="Brand-highlight flex flex-1 justify-end"
            initial={{ clipPath: "inset(0 0 0 100%)" }}
            animate={{ clipPath: "inset(0 0 0 0%)" }}
            transition={{ duration: BRAND_UNROLL_S, delay: FOUNDRY_START, ease: [0.16, 1, 0.3, 1] }}
            style={FOUNDRY_STYLE}
          >
            FOUNDRY
          </motion.span>
          <motion.span
            initial={{ opacity: 1, scale: 1, y: 0 }}
            animate={{
              opacity: [1, 0.6, 1],
              scale: [1, 0.96, 1],
              y: [0, 2.5, 0],
            }}
            transition={{
              duration: DOT_LOAD_S,
              delay: 0.15,
              ease: "easeInOut",
            }}
            className="Brand-highlight mx-[0.09em]"
            style={BRAND_STYLE}
            aria-hidden
          >
            .
          </motion.span>
          <motion.span
            className="Brand-highlight flex flex-1 justify-start"
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: BRAND_UNROLL_S, delay: STUDIO_START, ease: [0.16, 1, 0.3, 1] }}
            style={STUDIO_STYLE}
          >
            STUDIO
          </motion.span>
        </div>
      </div>

      {/* ── 3. Tagline — letter-by-letter selection ───────────────── */}
      <div
        className="w-full pb-3 text-center sm:pb-4"
        style={{
          fontFamily: "var(--font-anton)",
          fontSize: "clamp(3rem, 9vw, 14rem)",
          lineHeight: 0.88,
          letterSpacing: "-0.01em",
          color: "#111111",
          textTransform: "uppercase",
        }}
        aria-label="Pricing at its finest"
      >
        {/* Line 1 — enters as FOUNDRY lands, so FOUNDRY clearly comes first */}
        <HeadingLine delay={TAGLINE_START}>
          <SelectableWord word="PRICING" trigger={currentWord === 0} onDone={advance} />
        </HeadingLine>

        {/* Line 2 */}
        <HeadingLine delay={TAGLINE_START + 0.14}>
          <SelectableWord word="AT"     trigger={currentWord === 1} onDone={advance} />
          {" "}
          <SelectableWord word="ITS"    trigger={currentWord === 2} onDone={advance} />
          {" "}
          <SelectableWord word="FINEST" trigger={currentWord === 3} persist onDone={advance} />
          <StorefrontButton
            href="/pricing"
            label="PRICING"
            variant="blue"
            ariaLabel="View pricing"
            className="ml-4 align-bottom sm:ml-6"
          />
        </HeadingLine>
      </div>

      {/* ── 4. Footer ─────────────────────────────────────────────── */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.9 }}
        className="flex w-full shrink-0 items-center justify-between px-5 pb-5 pt-1 sm:px-7 sm:pb-6"
      >
        {(
          [
            { text: "OPENSOURCE",                        pos: "left"   },
            { text: "ORIGINALLY MADE FOR DODO PAYMENTS", pos: "center" },
            { text: "NEXT.JS",                           pos: "right"  },
          ] as { text: string; pos: "left" | "center" | "right" }[]
        ).map(({ text, pos }) => (
          <span
            key={text}
            className={[
              pos === "center" && "hidden flex-1 text-center sm:block",
              pos === "left"   && "flex-1",
              pos === "right"  && "flex-1 text-right",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              fontFamily: "var(--font-space-mono)",
              fontSize: "10px",
              fontWeight: 400,
              letterSpacing: "0.13em",
              textTransform: "uppercase",
              color: "#555555",
            }}
          >
            {text}
          </span>
        ))}
      </motion.footer>
    </section>
  );
}