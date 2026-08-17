"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SHELF, tierPrice, type BillingModel, type PriceTier, type Product } from "@shared/catalog";
import { CheckoutModeSwitch } from "@/components/CheckoutModeSwitch";
import { Pricing41 } from "@/components/Pricing41";
import { useSession } from "@/components/SessionProvider";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import {
  closeCheckout,
  launchCheckout,
  INLINE_CHECKOUT_ELEMENT_ID,
  type CheckoutMode,
} from "@/lib/checkout";

const ORDER: BillingModel[] = ["one_time", "subscription", "usage_based"];
const customShelf = [...SHELF]
  .filter((item) => ORDER.includes(item.product.group))
  .sort((a, b) => ORDER.indexOf(a.product.group) - ORDER.indexOf(b.product.group));

export default function PricingPage() {
  const [globalCycle, setGlobalCycle] = useState<"monthly" | "yearly">("monthly");
  const [mode, setMode] = useState<CheckoutMode>("redirect");
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [inlineTierId, setInlineTierId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { identity, openAuthModal, inlineCheckoutOpen, setInlineCheckoutOpen } = useSession();
  const router = useRouter();

  function handleCycleChange(_tierId: string, cycle: "monthly" | "yearly") {
    setGlobalCycle(cycle);
  }

  async function handleBuy(product: Product, tier: PriceTier) {
    setError(null);
    const cycle = globalCycle;

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
      if (mode === "inline") {
        if (inlineCheckoutOpen) await closeCheckout();
        setInlineTierId(tier.id);
        setInlineCheckoutOpen(true);
      }

      const session = await api.createCheckoutSession({
        productId: product.id,
        tierId: tier.id,
        billingCycle: cycle,
        mode,
      });
      if (mode === "inline") await new Promise((resolve) => requestAnimationFrame(resolve));
      await launchCheckout(session, mode, () => router.push("/dashboard"));
    } catch (e) {
      setInlineCheckoutOpen(false);
      setInlineTierId(null);
      setError((e as Error).message);
    } finally {
      setLoadingTier(null);
    }
  }

  async function closeInlineCheckout() {
    await closeCheckout();
    setInlineCheckoutOpen(false);
    setInlineTierId(null);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      {error && (
        <Card className="mb-6 flex items-center justify-between gap-3 border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="shrink-0 font-semibold">
            Dismiss
          </button>
        </Card>
      )}

      <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-lg text-ink-600">
            Flexible plans built for creators of all sizes. Choose the perfect tier for your creative journey.
          </p>
        </div>

        <div className="shrink-0">
          <CheckoutModeSwitch
            value={mode}
            onChange={(m) => {
              if (inlineCheckoutOpen) void closeInlineCheckout();
              setMode(m);
            }}
          />
        </div>
      </div>

      <Pricing41
        shelf={customShelf}
        loadingTier={loadingTier}
        globalCycle={globalCycle}
        inlineTierId={inlineCheckoutOpen ? inlineTierId : null}
        inlineElementId={INLINE_CHECKOUT_ELEMENT_ID}
        onCycleChange={handleCycleChange}
        onBuy={handleBuy}
        onCloseInlineCheckout={closeInlineCheckout}
      />
    </main>
  );
}
