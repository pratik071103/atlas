"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Info, X } from "lucide-react";
import { SHELF, tierPrice, type PriceTier, type Product } from "@shared/catalog";
import { CheckoutModeSwitch } from "@/components/CheckoutModeSwitch";
import { PricingCard } from "@/components/PricingCard";
import { PricingToggle } from "@/components/PricingToggle";
import { useSession } from "@/components/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import {
  closeCheckout,
  launchCheckout,
  INLINE_CHECKOUT_ELEMENT_ID,
  type CheckoutMode,
} from "@/lib/checkout";

export default function PricingPage() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [mode, setMode] = useState<CheckoutMode>("redirect");
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { identity, openAuthModal, inlineCheckoutOpen, setInlineCheckoutOpen } = useSession();
  const router = useRouter();

  async function handleBuy(product: Product, tier: PriceTier) {
    setError(null);

    // Buying is gated on having an identity — but a guest counts, so the modal
    // leads with "continue as guest" and resumes this exact purchase after.
    if (!identity) {
      openAuthModal({
        productId: product.id,
        productName: product.name,
        tierId: tier.id,
        tierLabel: tier.label,
        amount: tierPrice(tier, cycle),
        billingCycle: cycle,
        mode,
      });
      return;
    }

    setLoadingTier(tier.id);
    try {
      const session = await api.createCheckoutSession({
        productId: product.id,
        tierId: tier.id,
        billingCycle: cycle,
        mode,
      });
      // Inline mode swaps this page for the embedded checkout frame.
      if (mode === "inline") setInlineCheckoutOpen(true);
      await launchCheckout(session, mode, () => router.push("/dashboard"));
    } catch (e) {
      setInlineCheckoutOpen(false);
      setError((e as Error).message);
    } finally {
      setLoadingTier(null);
    }
  }

  async function closeInlineCheckout() {
    await closeCheckout();
    setInlineCheckoutOpen(false);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      {!inlineCheckoutOpen ? (
        <>
          <span className="eyebrow">Pricing</span>
          <h1 className="mt-4 text-4xl sm:text-6xl font-bold tracking-tight text-ink-900 max-w-3xl leading-[1.02]">
            Choose your creative journey
          </h1>
          <p className="mt-4 text-lg text-ink-600 max-w-xl">
            Flexible pricing for every type of creator — from pay-per-image to unlimited plans.
          </p>

          <Card className="mt-6 flex items-start gap-2.5 px-4 py-3 bg-lime-50 border-lime-100">
            <Info size={16} className="mt-0.5 shrink-0 text-lime-800" />
            <p className="text-sm text-lime-900">
              Dodo Payments demo: <strong>one-time packs</strong>,{" "}
              <strong>tiered subscriptions</strong>, <strong>usage-based metering</strong>,{" "}
              <strong>seat-based add-ons</strong>, <strong>on-demand top-ups</strong> and a{" "}
              <strong>license-key pass</strong> — every billing model in one catalog.
            </p>
          </Card>

          {error && (
            <Card className="mt-4 flex items-center justify-between gap-3 border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
              <button onClick={() => setError(null)} className="shrink-0 font-semibold">
                Dismiss
              </button>
            </Card>
          )}

          <div className="mt-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <PricingToggle value={cycle} onChange={setCycle} />
            <CheckoutModeSwitch
              value={mode}
              onChange={(m) => {
                // Leave any open inline frame behind when modes change.
                if (inlineCheckoutOpen) void closeInlineCheckout();
                setMode(m);
              }}
            />
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
            <ArrowRight size={13} />
            Scroll to see every billing model, side by side
          </div>

          <div className="stagger mt-4 -mx-6 px-6 flex gap-5 overflow-x-auto pb-6 snap-x snap-mandatory no-scrollbar">
            {SHELF.map(({ product, tier }) => (
              <PricingCard
                key={tier.id}
                productName={product.name}
                group={product.group}
                tier={tier}
                cycle={cycle}
                ctaLabel={product.ctaLabel}
                grantsLicense={product.grantsLicense}
                loading={loadingTier === tier.id}
                onBuy={() => handleBuy(product, tier)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="eyebrow">Inline checkout</span>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900">
              Complete your purchase
            </h1>
            <p className="mt-2 max-w-xl text-sm text-ink-600">
              The secure Dodo Payments checkout is embedded below. Closing it discards the
              session — you can start again from the pricing shelf.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={closeInlineCheckout}
            className="shrink-0 border border-ink-100"
          >
            <X size={16} />
            Cancel checkout
          </Button>
        </div>
      )}

      {/* The Dodo inline frame container. Kept mounted at the same position in
          the tree across both branches so the injected iframe survives React
          re-renders; it is simply hidden while the shelf is visible. */}
      <div
        id={INLINE_CHECKOUT_ELEMENT_ID}
        className={inlineCheckoutOpen ? "mt-8" : "hidden"}
        aria-label="Inline checkout"
      />
    </main>
  );
}
