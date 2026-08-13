"use client";

import { useState } from "react";
import { ArrowRight, Info } from "lucide-react";
import { SHELF, type PriceTier, type Product } from "@shared/catalog";
import { CheckoutModeSwitch, type CheckoutMode } from "@/components/CheckoutModeSwitch";
import { PricingCard } from "@/components/PricingCard";
import { PricingToggle } from "@/components/PricingToggle";
import { useSession } from "@/components/SessionProvider";
import { Card } from "@/components/ui/Card";

export default function PricingPage() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [mode, setMode] = useState<CheckoutMode>("redirect");
  const { identity, openAuthModal } = useSession();

  // Buying is gated on having an identity — but a guest counts, so the modal
  // offers "continue as guest" first. Creating the Dodo checkout session
  // itself is added by the checkout commit; this is the sign-in half.
  function handleBuy(_product: Product, _tier: PriceTier) {
    if (!identity) {
      openAuthModal();
      return;
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
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

      <div className="mt-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <PricingToggle value={cycle} onChange={setCycle} />
        <CheckoutModeSwitch value={mode} onChange={setMode} />
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
        <ArrowRight size={13} />
        Scroll to see every billing model, side by side
      </div>

      <div className="mt-4 -mx-6 px-6 flex gap-5 overflow-x-auto pb-6 snap-x snap-mandatory no-scrollbar">
        {SHELF.map(({ product, tier }) => (
          <PricingCard
            key={tier.id}
            productName={product.name}
            group={product.group}
            tier={tier}
            cycle={cycle}
            ctaLabel={product.ctaLabel}
            grantsLicense={product.grantsLicense}
            onBuy={() => handleBuy(product, tier)}
          />
        ))}
      </div>
    </main>
  );
}
