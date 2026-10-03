"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Minus, Plus } from "lucide-react";
import {
  formatPrice,
  GROUP_META,
  type BillingModel,
  type PriceTier,
  type Product,
} from "@shared/catalog";
import { Badge } from "@/components/ui/Badge";
import { InteractiveHoverButton } from "@/components/ui/InteractiveHoverButton";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Small pure helpers — ported from an earlier pricing carousel, which used
// to be the only place these lived.
// ---------------------------------------------------------------------------

function isCycleSensitive(group: BillingModel) {
  return group === "subscription";
}

function unitSuffix(group: BillingModel) {
  switch (group) {
    case "one_time":
    case "on_demand":
      return "one-time";
    case "usage_based":
      return "/ API call";
    case "seat_based":
      return "/ seat / mo";
    case "subscription":
      return "/ mo";
  }
}

// A static green marker slab behind a product name. Reuses `.Brand-highlight`
// (globals.css), the same primitive the Hero draws FOUNDRY/STUDIO with — a
// skewX(-8deg) lime ::before sitting behind the text — so the angle and the
// colour live in exactly one place rather than being re-typed here.
//
// Static by design: the STORE title sweeps because it is the page's entrance
// moment, but seven product names all sweeping at once would be noise.
//
// The slab is skewed; the text inside it stays upright. That is the same rule
// the Hero's FOUNDRY/STUDIO wordmarks follow — the lean belongs to the marker
// stroke, not to the word, and italicising both made the name harder to read
// at this size for no extra character.
function NameHighlight({ children }: { children: React.ReactNode }) {
  return <span className="Brand-highlight inline-block px-1.5 py-0.5">{children}</span>;
}

// The scroll-driven 3D wall is desktop-only: on a phone there is no hover, the
// three cards of a row can't fit side by side, and a `sticky h-screen` stage
// inside a 200vh runway makes the page feel broken (you scroll and nothing
// moves). Below this width we render the exact same cards as a plain,
// wrapping, fully static grid. Defaults to `false` on the server so the first
// paint is always the cheap static one — the 3D upgrade happens after mount,
// on desktop only.
function useParallaxEnabled() {
  const prefersReduced = useReducedMotion();
  const [wideEnough, setWideEnough] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWideEnough(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return wideEnough && !prefersReduced;
}

// ---------------------------------------------------------------------------
// ProductCard — text-only, direct-buy. No image, no expand step: the whole
// card IS the buy button. Name + price are always visible (never hover-gated
// — hover doesn't exist on touch devices); hover only lifts the card and
// emphasizes the CTA line.
// ---------------------------------------------------------------------------

interface ProductCardProps {
  product: Product;
  tier: PriceTier;
  cycle: "monthly" | "yearly";
  loading: boolean;
  onBuy: () => void;
  seatQty?: number;
  onSeatQtyChange?: (qty: number) => void;
}

function ProductCard({
  product,
  tier,
  cycle,
  loading,
  onBuy,
  seatQty,
  onSeatQtyChange,
}: ProductCardProps) {
  const cycleSensitive = isCycleSensitive(product.group);
  const displayAmount = cycleSensitive
    ? cycle === "yearly"
      ? tier.yearly / 12
      : tier.monthly
    : tier.monthly;
  const isSeatBased =
    product.group === "seat_based" && seatQty !== undefined && !!onSeatQtyChange;

  function activate() {
    if (loading) return;
    onBuy();
  }

  return (
    // A plain div, not a motion.div: the hover lift now lives on the INNER
    // card below, so this wrapper's box never moves. That is the fix for the
    // flicker — with the lift applied here, hovering near the card's bottom
    // edge slid the element out from under the pointer, firing mouseleave →
    // the card dropped back → mouseenter → an endless enter/leave loop that
    // read as the card vibrating.
    <div className="group/card relative w-full max-w-xs shrink-0 p-2 lg:w-72">
      {/* The blue hover slab — `brand.highlight` at 88%, the exact fill
          SelectableWord paints behind STORE. It was `bg-brand-blue/15`, which
          at 15% over the cream page washed out to a pale grey-lavender that
          read as a shadow artifact rather than an accent.

          Previously a `layoutId` shared-layout element
          inside <AnimatePresence>: Motion's layout projection measures real
          page coordinates, which are meaningless under this section's
          rotateX/rotateZ/perspective ancestor and its spring-driven x offset,
          so the halo would fly diagonally across the wall, land off-register,
          or briefly stack two copies mid-morph. A per-card opacity fade needs
          no measurement at all and cannot desync. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 block rounded-3xl bg-brand-highlight/[0.88] opacity-0 transition-opacity duration-150 group-hover/card:opacity-100"
      />
      <div
        role="button"
        tabIndex={0}
        aria-label={`${product.name} — ${tier.label}, ${formatPrice(displayAmount)} ${unitSuffix(product.group)}`}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          activate();
        }}
        className={cn(
          // Every card now carries the heavy black outline that used to mark
          // only the "Popular" tier — border + a 1px ring on the same colour,
          // which is what gives it the ~2px weight without the border eating
          // a second pixel of inner width.
          "relative z-20 flex h-full min-h-[13rem] cursor-pointer flex-col justify-between rounded-2xl border border-ink-900 bg-white p-5 text-left shadow-soft outline-none ring-1 ring-ink-900",
          "transition-[transform,box-shadow] duration-200 group-hover/card:-translate-y-2.5 group-hover/card:shadow-md",
          // The focus ring has to shift off ink-900 now that the resting
          // border IS ink-900 — an identical-colour focus ring on an
          // already-black outline is invisible. Brand blue reads clearly
          // against both the card and the cream page.
          "focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2",
          "motion-reduce:transition-none motion-reduce:group-hover/card:translate-y-0"
        )}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <Badge tone="ink" className="text-[10px]">
              {GROUP_META[product.group].label}
            </Badge>
          </div>
          {/* `tier.highlighted` is still set on the Standard plan in the
              catalog — it just no longer renders a "Popular" badge, now that
              every card carries the same black outline the badge used to
              accompany. Left in place because the flag is read elsewhere. */}
          <h3 className="mt-3 text-base font-bold leading-snug text-ink-900">
            <NameHighlight>{product.name}</NameHighlight>
          </h3>
          <p className="text-xs text-ink-500">{tier.label}</p>
          <p className="mt-1.5 line-clamp-2 text-xs text-ink-500">{tier.description}</p>
        </div>

        <div className="mt-4">
          {isSeatBased && (
            <div
              className="mb-3 flex items-center gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onSeatQtyChange!(Math.max(1, seatQty! - 1))}
                className="grid h-6 w-6 place-items-center rounded-full border border-ink-200 text-ink-600 hover:bg-ink-50"
                aria-label="Fewer seats"
              >
                <Minus size={11} />
              </button>
              <span className="w-5 text-center text-xs font-bold text-ink-900">{seatQty}</span>
              <button
                type="button"
                onClick={() => onSeatQtyChange!(Math.min(50, seatQty! + 1))}
                className="grid h-6 w-6 place-items-center rounded-full border border-ink-200 text-ink-600 hover:bg-ink-50"
                aria-label="More seats"
              >
                <Plus size={11} />
              </button>
              <span className="text-[11px] text-ink-400">seat{seatQty === 1 ? "" : "s"}</span>
            </div>
          )}

          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-ink-900">
              {formatPrice(displayAmount)}
            </span>
            <span className="text-[11px] text-ink-400">{unitSuffix(product.group)}</span>
          </div>

          {/* Driven by the CARD's hover, not its own: the pill sits inside a
              role="button" card, so hovering it necessarily hovers the card
              and a second trigger would be redundant. It stays a <span> for
              the same reason — a real <button> here would nest one control
              inside another and fire the purchase twice on click. */}
          <div className="mt-4">
            <InteractiveHoverButton label={product.ctaLabel} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  items: { product: Product; tier: PriceTier }[];
  /** Horizontal drift for the whole row. `undefined` on the static
   * (mobile / reduced-motion) path. */
  translate?: MotionValue<number>;
  /** Display the row right-to-left. Done by reversing the ARRAY, not with
   * `flex-row-reverse`: the CSS version leaves DOM order untouched, so
   * keyboard tab order ran backwards against the visual order. */
  reversed: boolean;
  cycle: "monthly" | "yearly";
  loadingTier: string | null;
  onBuy: (product: Product, tier: PriceTier) => void;
  seatQty: number;
  onSeatQtyChange: (qty: number) => void;
}

function Row({
  items,
  translate,
  reversed,
  cycle,
  loadingTier,
  onBuy,
  seatQty,
  onSeatQtyChange,
}: RowProps) {
  const ordered = reversed ? [...items].reverse() : items;

  return (
    // One animated element per ROW instead of one per CARD. The x offset was
    // identical for every card in a row anyway, so the old version ran seven
    // separate springs to produce a single motion — and each card's transform
    // then competed with the hover lift on that same element.
    <motion.div
      style={translate ? { x: translate } : undefined}
      className="mb-4 flex flex-wrap items-stretch justify-center gap-4 px-4 lg:mb-5 lg:flex-nowrap lg:gap-6 lg:px-6"
    >
      {ordered.map(({ product, tier }) => (
        <ProductCard
          key={tier.id}
          product={product}
          tier={tier}
          cycle={cycle}
          loading={loadingTier === tier.id}
          onBuy={() => onBuy(product, tier)}
          seatQty={product.group === "seat_based" ? seatQty : undefined}
          onSeatQtyChange={product.group === "seat_based" ? onSeatQtyChange : undefined}
        />
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// HeroParallax — the scroll-driven 3D wall. Three rows (One-Time /
// Subscription / Extra), each sliding a different direction as you scroll;
// the whole stack tilts flat and stops moving by the time you're half done
// scrolling through the section.
//
// The row stack sits in a `sticky top-0` stage nested inside the tall `ref`
// scroll-runway. That's the fix for cards being clipped/hard to click once
// "settled": without the sticky stage, the rows are just normal content in a
// very tall container, so ordinary scrolling keeps carrying them up past the
// viewport top at the same time the tilt is resolving — there is no scroll
// position where they're both flat AND fully on-screen. Pinning the stage
// means once the transforms finish, the cards stay put (not scrolling away)
// for the rest of the runway, giving a real, stable, clickable resting state.
// The header lives outside this component entirely (see PricingPage) so it
// scrolls away normally above the pinned stage instead of sharing its
// transform/perspective context.
// ---------------------------------------------------------------------------

export interface HeroParallaxProps {
  /** Exactly 3 groups, in display order: One-Time, Subscription, Extra. */
  rows: { product: Product; tier: PriceTier }[][];
  cycle: "monthly" | "yearly";
  loadingTier: string | null;
  onBuy: (product: Product, tier: PriceTier) => void;
  seatQty: number;
  onSeatQtyChange: (qty: number) => void;
}

export function HeroParallax({
  rows,
  cycle,
  loadingTier,
  onBuy,
  seatQty,
  onSeatQtyChange,
}: HeroParallaxProps) {
  const [firstRow, secondRow, thirdRow] = rows;
  const ref = useRef<HTMLDivElement>(null);
  const parallax = useParallaxEnabled();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // A plain physical spring — no `bounce` mixed in. Motion's spring resolver
  // treats {stiffness, damping} and {duration, bounce} as two different config
  // shapes; mixing bounce into a stiffness/damping spring (as the pasted demo
  // code did, bounce: 100 — way outside its expected ~0-1 range) left
  // rotateX/rotateZ unable to fully converge to 0, so cards stayed visibly
  // tilted no matter how far you scrolled.
  //
  // `restDelta` matters too: without it the springs idle a hair away from
  // their target indefinitely, which keeps a sub-pixel transform live on the
  // 3D ancestor — every card stays on its own compositor layer and the text
  // re-rasterises, which is the faint shimmer on otherwise "settled" cards.
  const springConfig = { stiffness: 300, damping: 30, restDelta: 0.001 };

  // Every transform (tilt AND horizontal drift) settles within the SAME
  // [0, 0.3] window, so once resolved the cards are both flat and fully
  // stationary. Cards slide IN from an offset TO center (ending at 0) — NOT
  // away from center — otherwise rows stay permanently shifted sideways once
  // "settled", clipping the outer cards forever.
  //
  // IMPORTANT: this section is the last thing on the page (nothing follows
  // it), and with offset ["start start", "end start"] scrollYProgress can only
  // ever reach `1 - viewport/containerHeight` — it mathematically cannot reach
  // 1 here, since reaching 1 would require scrolling this container's bottom
  // edge past the viewport, which needs content below it to scroll into. With
  // the container at h-[200vh] and the sticky stage at one viewport tall, the
  // achievable ceiling is 1 - 100/200 = 0.5. SETTLE's end (0.3) must stay
  // safely under that ceiling — it was previously 0.5, exactly AT the
  // (unreachable) ceiling, so the animation could never fully finish:
  // scrolling to the true bottom of the page only ever got to ~0.44 progress,
  // leaving cards permanently ~89% tilted and faded.
  const SETTLE: [number, number] = [0, 0.3];
  const translateX = useSpring(useTransform(scrollYProgress, SETTLE, [300, 0]), springConfig);
  const translateXReverse = useSpring(
    useTransform(scrollYProgress, SETTLE, [-300, 0]),
    springConfig
  );
  const rotateX = useSpring(useTransform(scrollYProgress, SETTLE, [15, 0]), springConfig);
  // Opens at 0.35 rather than 0.2: this wall is the page's only purchase UI,
  // and on a short viewport (where the runway barely scrolls) a starting
  // opacity that low read as "the page failed to load".
  const opacity = useSpring(useTransform(scrollYProgress, SETTLE, [0.35, 1]), springConfig);
  const rotateZ = useSpring(useTransform(scrollYProgress, SETTLE, [8, 0]), springConfig);

  const rowProps = { cycle, loadingTier, onBuy, seatQty, onSeatQtyChange };

  const stack = (
    <>
      <Row items={firstRow} translate={parallax ? translateX : undefined} reversed {...rowProps} />
      <Row
        items={secondRow}
        translate={parallax ? translateXReverse : undefined}
        reversed={false}
        {...rowProps}
      />
      <Row items={thirdRow} translate={parallax ? translateX : undefined} reversed {...rowProps} />
    </>
  );

  // Static path — mobile, tablet and prefers-reduced-motion. No runway, no
  // sticky stage, no perspective: just the cards in normal document flow,
  // wrapping as the viewport allows.
  if (!parallax) {
    return (
      <div ref={ref} className="w-full min-w-0 pb-16">
        {stack}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative h-[200vh] w-full min-w-0">
      {/* h-[100svh] not h-screen: on mobile browsers `vh` resolves to the
          tallest possible viewport, so with the URL bar showing the stage is
          taller than what you can actually see and the bottom row sits below
          the fold, cut off by this element's own overflow-hidden. */}
      <div className="sticky top-0 flex h-[100svh] w-full min-w-0 flex-col items-center justify-center overflow-hidden antialiased [perspective:1000px] [transform-style:preserve-3d]">
        <motion.div style={{ rotateX, rotateZ, opacity }} className="w-full">
          {stack}
        </motion.div>
      </div>
    </div>
  );
}
