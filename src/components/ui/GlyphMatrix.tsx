"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// GlyphMatrix — an animated grid of subtly shifting glyphs on a canvas.
//
// Adapted from MagicUI's component of the same name. The effect is theirs;
// four things about how it runs are not:
//
//  1. It pauses off-screen. The original's `tick` reschedules rAF every frame
//     forever — even though it only repaints every `interval` ms — and never
//     stops when scrolled out of view. rAF pauses for a backgrounded TAB, not
//     for content merely scrolled past.
//
//  2. It honours prefers-reduced-motion: one static frame, then stop. The
//     global reset in globals.css collapses CSS transition durations, which
//     cannot touch a canvas animation loop.
//
//  3. No per-cell rgba() string. The original builds a template literal fill
//     colour for every cell on every repaint — thousands of throwaway strings
//     a second, each of which the canvas then parses. fillStyle is set once
//     and globalAlpha carries the per-cell value.
//
//  4. Grid state lives in refs, not effect locals, so a re-render never
//     reshuffles a field that is already on screen. The original reseeds
//     inside `resize()`, so every ResizeObserver fire re-randomises the lot.
//
// This deliberately does NOT know how to resolve into a picture. That was
// tried — sampling an image's luminance into the per-cell density — and it
// only works for sources with a bold silhouette and no fine texture. Against
// a photograph it produced a tonal haze, and against art that is itself made
// of glyphs it produced aliasing, because resampling one dither pattern
// through another of similar pitch destroys both. Cross-fading this field
// against the real picture (see /studio) is simpler and exact.
//
// What it CAN do is clear itself away. With `dissolved` set, cells drop out
// from the centre outward — each on its own slightly jittered schedule, with a
// brief brighten as it goes — so the field thins out like settling noise
// rather than fading as one sheet. `onDissolveProgress` reports the same eased
// 0–1 value every frame so a caller can open a matching mask over whatever
// sits underneath (see /studio). The reverse runs when `dissolved` drops.
//
// Integration note: the canvas is width/height 100% and measures itself from
// clientWidth/clientHeight, so it draws nothing inside a parent of indefinite
// height. Give the wrapper an explicit size or aspect ratio.
// ---------------------------------------------------------------------------

interface GlyphMatrixProps extends React.HTMLAttributes<HTMLCanvasElement> {
  /** Characters to randomly pick from. */
  glyphs?: string;
  /** Cell size in px (also the font size). */
  cellSize?: number;
  /** Probability (0-1) that a cell mutates each tick. */
  mutationRate?: number;
  /** Tick interval in ms. */
  interval?: number;
  /** Fade out toward the bottom (0 = no fade). */
  fadeBottom?: number;
  /** Glyph colour — any CSS colour. */
  color?: string;
  /** [min, max] opacity of the field. The original's 0.05–0.4 is tuned for
   * glyphs on a dark background; over a light panel that range is close to
   * invisible, so a light-background caller must raise it. */
  alphaRange?: [number, number];
  /** Clear the field away (centre-out). Flipping back brings it home. */
  dissolved?: boolean;
  /** Length of a full dissolve, ms. A part-way reversal takes proportionally less. */
  dissolveMs?: number;
  /** Called with the eased dissolve progress (0 = full field, 1 = clear)
   * on every animated frame, and once on settle. */
  onDissolveProgress?: (progress: number) => void;
}

const DEFAULT_COLOR = "#6B7280";

/** How much of the 0–1 timeline a single cell spends on its way out. Wider is
 * softer; narrower reads as a hard ring sweeping across. */
const DISSOLVE_BAND = 0.22;
/** Share of a cell's schedule that is random rather than distance-driven.
 * Zero is a perfect expanding ellipse; this much frays its edge. */
const DISSOLVE_JITTER = 0.25;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Normalised elliptical distance from the centre: 0 at the middle, 1 at the
 * corners — the same metric as a CSS `radial-gradient(ellipse farthest-corner)`,
 * which is what lets a caller's mask track the cells exactly. */
export function dissolveDistance(x: number, y: number, w: number, h: number) {
  const dx = (x - w / 2) / (w / 2);
  const dy = (y - h / 2) / (h / 2);
  return Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
}

/** Where the dissolve front sits at `progress`, in `dissolveDistance` units:
 * inside `inner` the cells have (on average) fully cleared; beyond `outer`
 * they have not started. A radial mask running opaque at `inner` to clear at
 * `outer` therefore opens in step with the field. */
export function dissolveFront(progress: number) {
  const sweep = progress * (1 + DISSOLVE_BAND);
  const spread = 1 - DISSOLVE_JITTER;
  const meanJitter = DISSOLVE_JITTER / 2;
  return {
    inner: (sweep - DISSOLVE_BAND - meanJitter) / spread,
    outer: (sweep - meanJitter) / spread,
  };
}

export function GlyphMatrix({
  glyphs = "01·•+*/\\<>=",
  cellSize = 14,
  mutationRate = 0.04,
  interval = 90,
  className,
  fadeBottom = 0.6,
  color = DEFAULT_COLOR,
  alphaRange = [0.05, 0.4],
  dissolved = false,
  dissolveMs = 1800,
  onDissolveProgress,
  style,
  ...props
}: GlyphMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [inView, setInView] = useState(true);
  const [alphaLo, alphaHi] = alphaRange;

  // Dissolve timeline. In refs, like the grid, so an unrelated re-render
  // mid-dissolve (the page's busy flag clearing, say) continues the same
  // curve instead of restarting it from rest — which reads as a stutter.
  const progressRef = useRef(dissolved ? 1 : 0);
  const timelineRef = useRef({ from: progressRef.current, to: progressRef.current, start: 0 });
  const onProgressRef = useRef(onDissolveProgress);
  onProgressRef.current = onDissolveProgress;

  // Current glyph colour as RGB. Kept in a ref so a colour change recolours
  // the next frame without restarting the animation.
  const rgbRef = useRef({ r: 107, g: 114, b: 128, a: 1 });

  // Grid state, held across effect re-runs so nothing reshuffles mid-view.
  // `seeds` is each cell's fixed random share of its dissolve schedule —
  // fixed so the reverse retraces the same frayed edge.
  const gridRef = useRef({
    cols: 0,
    rows: 0,
    cells: [] as string[],
    alphas: [] as number[],
    seeds: [] as number[],
  });

  // Resolve the CSS colour string (handles hex, rgb, hsl, oklch, ...).
  useEffect(() => {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    const probeCtx = probe.getContext("2d");
    if (!probeCtx) return;
    // Seed with the default so an invalid colour falls back to it: the 2d
    // context keeps the previous fillStyle when assigned an invalid value
    // instead of silently turning black.
    probeCtx.fillStyle = DEFAULT_COLOR;
    probeCtx.fillStyle = color;
    probeCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probeCtx.getImageData(0, 0, 1, 1).data;
    rgbRef.current = { r, g, b, a: a / 255 };
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "100px" }
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = 0;
    let stopped = false;

    const randomGlyph = () => glyphs[Math.floor(Math.random() * glyphs.length)];
    const randomAlpha = () => alphaLo + Math.random() * (alphaHi - alphaLo);

    // A new direction starts a new leg from wherever the field is now, so a
    // reversal mid-dissolve turns around rather than jumping.
    const target = dissolved ? 1 : 0;
    const timeline = timelineRef.current;
    if (timeline.to !== target) {
      timeline.from = progressRef.current;
      timeline.to = target;
      timeline.start = performance.now();
    }

    const report = () => onProgressRef.current?.(progressRef.current);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth: w, clientHeight: h } = canvas;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cols = Math.ceil(w / cellSize);
      const rows = Math.ceil(h / cellSize);
      const grid = gridRef.current;

      // Only reseed when the grid actually changed shape. Rebuilding on every
      // observer fire made the field visibly jump on each layout pass.
      if (cols !== grid.cols || rows !== grid.rows) {
        const total = cols * rows;
        grid.cols = cols;
        grid.rows = rows;
        grid.cells = new Array(total).fill(0).map(randomGlyph);
        grid.alphas = new Array(total).fill(0).map(randomAlpha);
        grid.seeds = new Array(total).fill(0).map(Math.random);
      }
    };

    const draw = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      const { cols, rows, cells, alphas, seeds } = gridRef.current;
      const progress = progressRef.current;

      ctx.clearRect(0, 0, w, h);
      if (progress >= 1) return;

      ctx.font = `${cellSize - 2}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "top";

      const { r, g, b, a: colorAlpha } = rgbRef.current;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

      // Stretched by one band so that at progress 1 even the last-scheduled
      // cell has finished leaving, not just started.
      const sweep = progress * (1 + DISSOLVE_BAND);
      const half = cellSize / 2;

      for (let y = 0; y < rows; y++) {
        const fade = fadeBottom > 0 ? 1 - (y / rows) * fadeBottom : 1;
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          let visibility = 1;
          if (progress > 0) {
            const at =
              (1 - DISSOLVE_JITTER) * dissolveDistance(x * cellSize + half, y * cellSize + half, w, h) +
              DISSOLVE_JITTER * seeds[i];
            const k = (sweep - at) / DISSOLVE_BAND;
            if (k >= 1) continue;
            // Flare, then go: the brighten at the front is what makes the
            // dissolve read as a wave moving through rather than a fade.
            if (k > 0) visibility = (1 - k) * (1 + 1.2 * Math.sin(Math.PI * k));
          }
          ctx.globalAlpha = Math.min(1, alphas[i] * fade * colorAlpha * visibility);
          ctx.fillText(cells[i], x * cellSize, y * cellSize);
        }
      }
      ctx.globalAlpha = 1;
    };

    // Advances the dissolve timeline; true while it still has ground to cover.
    const step = (t: number) => {
      const { from, to, start } = timelineRef.current;
      if (progressRef.current === to) return false;
      const duration = dissolveMs * Math.abs(to - from);
      const k = duration > 0 ? Math.min(1, Math.max(0, (t - start) / duration)) : 1;
      progressRef.current = k === 1 ? to : from + (to - from) * easeInOutCubic(k);
      return true;
    };

    const tick = (t: number) => {
      if (stopped) return;

      // While dissolving, repaint every frame — the 90ms mutation cadence is
      // fine for idle shimmer but makes a moving front visibly step.
      const dissolving = step(t);
      let dirty = dissolving;

      if (t - last >= interval) {
        last = t;
        const { cols, rows, cells, alphas } = gridRef.current;
        const total = cols * rows;
        const mutations = Math.max(1, Math.floor(total * mutationRate));
        for (let n = 0; n < mutations; n++) {
          const i = Math.floor(Math.random() * total);
          cells[i] = randomGlyph();
          alphas[i] = randomAlpha();
        }
        dirty = true;
      }

      if (dirty) draw();
      if (dissolving) report();

      // Fully cleared and staying that way: nothing left to animate, so stop
      // rather than spin. Flipping `dissolved` back re-runs this effect.
      if (!dissolving && progressRef.current === 1) return;
      raf = requestAnimationFrame(tick);
    };

    resize();

    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);

    // Off-screen, or the visitor asked for less motion: the field is painted
    // once and left alone, and a pending dissolve lands immediately. Nothing
    // anyone can see is moving, so nothing should be burning frames.
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || !inView) {
      progressRef.current = timeline.to;
      timeline.from = timeline.to;
      draw();
    } else {
      draw();
      raf = requestAnimationFrame(tick);
    }
    report();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [
    glyphs,
    cellSize,
    mutationRate,
    interval,
    fadeBottom,
    alphaLo,
    alphaHi,
    inView,
    dissolved,
    dissolveMs,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none", className)}
      style={{ width: "100%", height: "100%", display: "block", ...style }}
      aria-hidden="true"
      {...props}
    />
  );
}
