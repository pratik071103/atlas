"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SHELF, tierPrice, type BillingModel, type PriceTier, type Product } from "@shared/catalog";
import { CheckoutModeSwitch } from "@/components/CheckoutModeSwitch";
import { InlineCheckoutPanel } from "@/components/InlineCheckoutPanel";
import { HeroParallax } from "@/components/ui/HeroParallax";
import { CanvasText } from "@/components/ui/CanvasText";
import { TextHighlight } from "@/components/ui/TextHighlight";
import { AnnotatedText } from "@/components/ui/AnnotatedText";
import { SweptTitle, CAPTION_STYLE } from "@/components/ui/SweptTitle";
import { useSession } from "@/components/SessionProvider";
import { useSidebarState } from "@/components/SidebarContext";
import { api } from "@/lib/api";
import {
  closeCheckout,
  launchCheckout,
  INLINE_CHECKOUT_ELEMENT_ID,
  type CheckoutMode,
} from "@/lib/checkout";

// Three rows, in this order: One-Time, Subscription, then everything else
// ("Extra") bifurcated by its own billing model — usage-based, seat-based —
// each still labeled by its GROUP_META pill per card. Credit Top-Up
// (on_demand) is deliberately excluded from the pricing page per product
// decision — the catalog entry itself stays intact (untouched elsewhere).
const EXTRA_ORDER: BillingModel[] = ["usage_based", "seat_based"];

const oneTimeShelf = SHELF.filter(({ product }) => product.group === "one_time");
const subscriptionShelf = SHELF.filter(({ product }) => product.group === "subscription");
const extraShelf = [...SHELF]
  .filter(({ product }) => EXTRA_ORDER.includes(product.group))
  .sort((a, b) => EXTRA_ORDER.indexOf(a.product.group) - EXTRA_ORDER.indexOf(b.product.group));

const ROWS = [oneTimeShelf, subscriptionShelf, extraShelf];

// No more Monthly/Yearly toggle — subscription pricing is monthly-only now.
const CYCLE = "monthly" as const;

// The site's two brand accent colors — blue (#1264FF, Hero.tsx's FOUNDRY
// wordmark) and lime (#C6FE1E, the Hero dot / .Brand-highlight) — interleaved
// so the animated lines inside "transparent pricing" show both tones, not
// just shades of one blue. (A green-fill/blue-lines version was tried and
// reverted — the solid green fill read poorly.)
const BRAND_TEXT_COLORS = Array.from({ length: 10 }, (_, i) => {
  const alpha = (1 - Math.floor(i / 2) * 0.2).toFixed(1);
  return i % 2 === 0 ? `rgba(18, 100, 255, ${alpha})` : `rgba(198, 254, 30, ${alpha})`;
});



export default function PricingPage() {
  const [mode, setMode] = useState<CheckoutMode>("redirect");
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [inlineTierId, setInlineTierId] = useState<string | null>(null);
  const [seatQty, setSeatQty] = useState(1);
  const [seatBuying, setSeatBuying] = useState(false);
  const [storeDone, setStoreDone] = useState(false);
  const {
    identity,
    openAuthModal,
    inlineCheckoutOpen,
    setInlineCheckoutOpen,
    setAppError,
  } = useSession();
  const { unlockSidebar } = useSidebarState();
  const router = useRouter();


  async function handleBuy(product: Product, tier: PriceTier) {
    // Unlock the sidebar as soon as any buy CTA is clicked.
    unlockSidebar();
    setAppError(null);

    if (product.group === "seat_based") {
      await handleBuySeats(tier);
      return;
    }

    if (!identity) {
      openAuthModal({
        productId: product.id,
        productName: product.name,
        tierId: tier.id,
        tierLabel: tier.label,
        amount: tierPrice(tier, CYCLE),
        billingCycle: CYCLE,
        mode,
      });
      return;
    }

    setLoadingTier(tier.id);
    try {
      if (mode === "inline") {
        if (inlineCheckoutOpen) await closeCheckout();
        setInlineTierId(tier.id);
        setInlineCheckoutOpen(true);
      }

      const session = await api.createCheckoutSession({
        productId: product.id,
        tierId: tier.id,
        billingCycle: CYCLE,
        mode,
      });
      if (mode === "inline") await new Promise((resolve) => requestAnimationFrame(resolve));
      await launchCheckout(session, mode, () => router.push("/dashboard"));
    } catch (e) {
      setInlineCheckoutOpen(false);
      setInlineTierId(null);
      setAppError((e as Error).message, "Checkout error");
    } finally {
      setLoadingTier(null);
    }
  }

  async function closeInlineCheckout() {
    await closeCheckout();
    setInlineCheckoutOpen(false);
    setInlineTierId(null);
  }

  async function handleBuySeats(tier: PriceTier) {
    // Unlock the sidebar as soon as any buy CTA is clicked.
    unlockSidebar();
    setAppError(null);
    if (!identity) {
      openAuthModal();
      return;
    }
    setSeatBuying(true);
    try {
      // Close any other inline checkout that may be open.
      if (inlineCheckoutOpen) {
        await closeCheckout();
        setInlineCheckoutOpen(false);
        setInlineTierId(null);
      }

      if (mode === "inline") {
        setInlineTierId(tier.id);
        setInlineCheckoutOpen(true);
      }

      const session = await api.createSeatsCheckout(seatQty, mode);

      if (mode === "inline") {
        // Wait one frame so the div mounts before the SDK tries to find it.
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      await launchCheckout(session, mode, () => router.push("/team"));

      if (session.simulated) router.push("/team");
    } catch (e) {
      setInlineCheckoutOpen(false);
      setInlineTierId(null);
      setAppError((e as Error).message, "Checkout error");
    } finally {
      setSeatBuying(false);
    }
  }

  const header = (
    <div className="relative mx-auto w-full max-w-6xl px-6 pb-8 pt-16 md:pt-24">
      <SweptTitle word="STORE" onDone={() => setStoreDone(true)} />

      <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl md:text-5xl">
        Simple,{" "}
        <CanvasText
          text="transparent pricing"
          backgroundClassName="bg-brand-blue"
          colors={BRAND_TEXT_COLORS}
          lineGap={4}
          animationDuration={20}
        />
      </h1>

      <div className="mt-6 flex justify-end">
        <p className="max-w-sm text-right" style={CAPTION_STYLE}>
          Flexible plans built for{" "}
          {/* A quiet hand-drawn underline — the same retro orange as the
              studio caption's squiggle, kept thin so the lime marker on the
              last phrase stays the loudest thing here. */}
          <AnnotatedText variant="underline" color="text-[#ff5a1f]/70" delay={0.8}>
            creators of all sizes
          </AnnotatedText>
          . Choose the perfect tier for your creative journey —{" "}
          <TextHighlight startWhen={storeDone}>
            <span className="font-semibold text-ink-900">every card here is a one-click buy.</span>
          </TextHighlight>
        </p>
      </div>

      <div className="mt-8 flex justify-end">
        <CheckoutModeSwitch
          value={mode}
          onChange={(m) => {
            if (inlineCheckoutOpen) void closeInlineCheckout();
            setMode(m);
          }}
        />
      </div>
    </div>
  );

  return (
    <main className="relative w-full min-w-0">
      {header}
      <HeroParallax
        rows={ROWS}
        cycle={CYCLE}
        loadingTier={loadingTier}
        onBuy={handleBuy}
        seatQty={seatQty}
        onSeatQtyChange={setSeatQty}
      />
      <InlineCheckoutPanel
        open={inlineCheckoutOpen}
        elementId={INLINE_CHECKOUT_ELEMENT_ID}
        onClose={closeInlineCheckout}
      />
    </main>
  );
}
