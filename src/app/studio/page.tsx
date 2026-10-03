"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { GlyphMatrix, dissolveFront } from "@/components/ui/GlyphMatrix";
import { SweptTitle, CAPTION_STYLE } from "@/components/ui/SweptTitle";
import { AnnotatedText } from "@/components/ui/AnnotatedText";
import { StorefrontButton } from "@/components/ui/StorefrontButton";
import { Input } from "@/components/ui/Input";
import { useSession } from "@/components/SessionProvider";
import { api, type License } from "@/lib/api";

// ---------------------------------------------------------------------------
// /studio — the license-key demo, stripped to its argument: one hidden
// picture, one key field.
//
// Two layers, both made of 0s and 1s, cross-faded: an animated field of
// random glyphs (locked) over the hidden picture (unlocked). Because both
// sides of the fade are the same kind of mark, it reads as the noise settling
// into the picture rather than one image dissolving to expose another.
//
// An earlier version drove the picture out of the canvas itself, sampling its
// luminance into each cell's density. That is the right trick for a bold
// silhouette, but this source is ALREADY glyph art at roughly the same pitch
// as the grid, so resampling it aliased badly — the dodo arrived as a smudge
// no amount of curve tuning fixed. Showing the artwork directly is exact, and
// the fade is just as clean.
//
// The reveal is a dissolve, not a flat cross-fade: the noise clears from the
// centre outward cell by cell (GlyphMatrix), and the picture is uncovered
// through a radial mask driven by the SAME progress value every frame, so the
// dodo appears exactly where the glyphs have left. A slow focus-pull on the
// picture underneath carries it over the last stretch.
// ---------------------------------------------------------------------------

const HIDDEN_PICTURE = "/hidden-dodo.png";

/** Full dissolve, ms. Long enough to read as a resolve, short enough that the
 * payoff doesn't drag. */
const REVEAL_MS = 1800;

// Natural size of the PNG. It is shown at exactly this size, not stretched
// to the panel: its digits are typed at ~4.7px wide on a ~10px line, the
// same as the noise (8px glyphs on a 10px grid), so 1:1 is what makes the
// dodo's 0s and 1s match the field around it. Panels too short to fit it
// (phones) scale it down to fit.
const PICTURE_W = 515;
const PICTURE_H = 509;
// The lift re-centres the artwork, which sits slightly below the PNG's middle.
const PICTURE_FIT = "translateY(-1.5%)";
// Where the picture starts its focus-pull from: a touch closer and soft.
const PICTURE_FIT_HIDDEN = "translateY(-1.5%) scale(1.06)";

// Module-level so its identity is stable — GlyphMatrix restarts its loop
// when its config changes.
const GLYPH_ALPHA: [number, number] = [0.18, 0.72];

// Opaque at the cleared radius, clear at the front — the custom properties
// are written per frame by onDissolveProgress, never through React.
const REVEAL_MASK =
  "radial-gradient(ellipse farthest-corner at 50% 50%, #000 var(--reveal-inner, -50%), transparent var(--reveal-outer, -20%))";

// Deep enough to read on a white panel. Brand lime (#C6FE1E) is the accent
// everywhere else, but at the low alphas this field lives at it disappears
// against light backgrounds — this is the same hue, carried far enough down
// the ramp to hold contrast.
const GLYPH_GREEN = "#6d8e15";

export default function StudioPage() {
  const { identity, loading: sessionLoading, openAuthModal, setAppError } = useSession();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const pictureRef = useRef<HTMLDivElement>(null);

  // Runs every animation frame during a reveal, so it writes the mask
  // straight onto the element instead of round-tripping through state.
  const trackDissolve = useCallback((progress: number) => {
    const el = pictureRef.current;
    if (!el) return;
    const { inner, outer } = dissolveFront(progress);
    el.style.setProperty("--reveal-inner", `${(inner * 100).toFixed(2)}%`);
    el.style.setProperty("--reveal-outer", `${(outer * 100).toFixed(2)}%`);
  }, []);

  const load = useCallback(async () => {
    if (!identity) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.getLicenses();
      setLicenses(data.licenses);
      setUnlocked(data.unlocked);
    } finally {
      setLoading(false);
    }
  }, [identity]);

  useEffect(() => {
    if (sessionLoading) return;
    void load();
  }, [sessionLoading, load]);

  const activeKey = licenses.find((l) => l.status === "active")?.key ?? null;

  async function activate(event: React.FormEvent) {
    event.preventDefault();
    if (!identity) {
      openAuthModal();
      return;
    }
    setBusy(true);
    setAppError(null);
    try {
      await api.activateLicense(keyInput.trim());
      setKeyInput("");
      await load();
    } catch (e) {
      setAppError((e as Error).message, "License error");
    } finally {
      setBusy(false);
    }
  }

  async function lockAgain() {
    if (!activeKey) return;
    setBusy(true);
    setAppError(null);
    try {
      await api.deactivateLicense(activeKey);
      await load();
    } catch (e) {
      setAppError((e as Error).message, "License error");
    } finally {
      setBusy(false);
    }
  }

  const ready = !sessionLoading && !loading;

  return (
    // Same container as the pricing header, so STUDIO lands flush left in the
    // exact spot STORE does rather than floating in a narrower centred column.
    <main className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-16 md:pt-24">
      <SweptTitle
        word="STUDIO"
        // Lime rather than the STORE blue — the sweep is the shared gesture,
        // the colour is what tells the two pages apart. Ink text, since white
        // on lime is unreadable.
        highlightFill="#C6FE1E"
        highlightTextColor="#0c0f0c"
      />

      {/* Right-aligned, mirroring the pricing caption. Two hand-drawn marks
          in a retro orange/teal pair — a squiggle under the action, then a
          loop around the payoff — drawn one after the other so the caption
          reads like it was marked up with felt tips. */}
      <div className="mt-6 flex justify-end">
        <p className="max-w-sm text-right" style={CAPTION_STYLE}>
          One picture, hidden in the noise —{" "}
          <span className="font-semibold text-ink-900">
            <AnnotatedText variant="wavy" color="text-[#ff5a1f]" delay={0.4} duration={0.7}>
              activate a key
            </AnnotatedText>{" "}
            to{" "}
            <AnnotatedText variant="circle" color="text-[#0f9b8e]" delay={1.15} duration={0.8}>
              resolve it.
            </AnnotatedText>
          </span>
        </p>
      </div>

      {/* An explicit aspect ratio is required, not cosmetic: GlyphMatrix
          measures itself from clientHeight and would draw nothing inside a box
          of indefinite height. */}
      {/* Cream, not white: the panel is meant to sit in the page rather than
          on it, so the glyph field reads as printed onto the paper. */}
      {/* 4:3 on phones: at 16:9 a 375px-wide screen leaves the dodo barely
          200px tall. */}
      <div className="relative mt-10 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-brand-cream sm:aspect-[16/9]">
        {/* The hidden picture, uncovered through the dissolve mask.
            `mix-blend-multiply` is doing real work, not decoration: the asset
            has an OPAQUE white background (checked — alpha 255 in every
            corner), so over a cream panel it would land as a white rectangle
            with a dodo in it. Multiplying drops white to the backdrop and
            leaves only the digits. It sits on this wrapper, not the <Image>:
            a mask isolates its contents, so a blend inside it would only
            multiply against transparency and the white would come back. */}
        <div
          ref={pictureRef}
          className="absolute inset-0 mix-blend-multiply"
          style={{ maskImage: REVEAL_MASK, WebkitMaskImage: REVEAL_MASK }}
        >
          {/* Natural-size box, centred; max-h-full shrinks it (keeping the
              aspect ratio) only when the panel is shorter than the art. */}
          <div
            className="absolute left-1/2 top-1/2 max-h-full -translate-x-1/2 -translate-y-1/2"
            style={{ height: PICTURE_H, aspectRatio: `${PICTURE_W} / ${PICTURE_H}` }}
          >
            <Image
              src={HIDDEN_PICTURE}
              alt="The hidden artwork, drawn in ones and zeroes"
              fill
              sizes={`${PICTURE_W}px`}
              className="object-contain transition-[transform,filter] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: unlocked ? PICTURE_FIT : PICTURE_FIT_HIDDEN,
                filter: unlocked ? "blur(0px)" : "blur(6px)",
                transitionDuration: `${REVEAL_MS + 400}ms`,
              }}
              // Eager: lazy-loading could leave the dissolve opening onto an
              // image that hasn't arrived yet.
              loading="eager"
            />
          </div>
        </div>

        {/* The noise field. It clears itself away on unlock and stops
            drawing once gone, so it can stay mounted for the trip back. */}
        <div className="absolute inset-0">
          <GlyphMatrix
            glyphs="01"
            color={GLYPH_GREEN}
            cellSize={10}
            fadeBottom={0.25}
            // Raised well above the component default: that default assumes
            // a dark backdrop, and this panel is white.
            alphaRange={GLYPH_ALPHA}
            dissolved={unlocked}
            dissolveMs={REVEAL_MS}
            onDissolveProgress={trackDissolve}
          />
        </div>
      </div>

      <div className="mt-6">
        {!ready ? (
          <div className="h-10" />
        ) : unlocked ? (
          <button
            type="button"
            onClick={lockAgain}
            disabled={busy}
            className="text-xs font-semibold uppercase tracking-[0.13em] text-ink-500 underline-offset-4 transition-colors hover:text-ink-900 hover:underline disabled:opacity-50"
          >
            {busy ? "Releasing…" : "Lock again"}
          </button>
        ) : (
          <form onSubmit={activate} className="flex max-w-md items-center gap-2">
            <Input
              value={keyInput}
              onChange={setKeyInput}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="font-mono uppercase tracking-wider"
              aria-label="License key"
            />
            {/* Same control as the Hero's PRICING CTA — a .Btn--label pill in
                the blue variant, whose lime fill sweeps up on hover. It now
                renders a real <button> so it can submit this form. */}
            <StorefrontButton
              type="submit"
              label={busy ? "ACTIVATING…" : "ACTIVATE"}
              variant="blue"
              disabled={busy || !keyInput.trim()}
              ariaLabel="Activate license key"
            />
          </form>
        )}
      </div>
    </main>
  );
}
