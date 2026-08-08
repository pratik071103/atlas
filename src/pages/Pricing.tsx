import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Info, ArrowRight } from "lucide-react";
import { CATALOG, PriceTier, Product } from "../lib/catalog";
import { PricingToggle } from "../components/PricingToggle";
import { CheckoutModeSwitch, CheckoutMode } from "../components/CheckoutModeSwitch";
import { PricingCard } from "../components/PricingCard";
import { useApp } from "../lib/AppContext";
import { api } from "../lib/api";

export function Pricing() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [mode, setMode] = useState<CheckoutMode>("redirect");
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const { identity, openAuthModal } = useApp();
  const navigate = useNavigate();

  async function handleBuy(product: Product, tier: PriceTier) {
    const intent = {
      productId: product.id,
      productName: product.name,
      tierId: tier.id,
      tierLabel: tier.label,
      amount: cycle === "yearly" ? tier.yearly : tier.monthly,
      billingCycle: cycle,
      mode,
    };

    if (!identity) {
      openAuthModal(intent);
      return;
    }

    setLoadingTier(tier.id);
    try {
      await api.createCheckoutSession({
        productId: product.id,
        tierId: tier.id,
        billingCycle: cycle,
        mode,
      });
      navigate("/dashboard");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoadingTier(null);
    }
  }

  // Flatten every product/tier pair into a single shelf so the whole
  // catalog scrolls in one horizontal line, in the order the product brief
  // specifies (one-time, subscription, usage-based, seat-based, on-demand).
  const shelf = CATALOG.flatMap((product) =>
    product.tiers.map((tier) => ({ product, tier }))
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <span className="eyebrow">Pricing</span>
      <h1 className="mt-4 text-4xl sm:text-6xl font-bold tracking-tight text-ink-900 max-w-3xl leading-[1.02]">
        Choose your creative journey
      </h1>
      <p className="mt-4 text-lg text-ink-600 max-w-xl">
        Flexible pricing for every type of creator — from pay-per-image to unlimited plans.
      </p>

      <div className="mt-6 card flex items-start gap-2.5 px-4 py-3 bg-lime-50 border-lime-100">
        <Info size={16} className="mt-0.5 shrink-0 text-lime-800" />
        <p className="text-sm text-lime-900">
          Dodo Payments demo: <strong>one-time packs</strong>, <strong>tiered subscriptions</strong>,{" "}
          <strong>usage-based metering</strong>, <strong>seat-based add-ons</strong>, and{" "}
          <strong>on-demand top-ups</strong> — all live against a local reference server.
        </p>
      </div>

      <div className="mt-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <PricingToggle value={cycle} onChange={setCycle} />
        <CheckoutModeSwitch value={mode} onChange={setMode} />
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
        <ArrowRight size={13} />
        Scroll to see every billing model, side by side
      </div>

      <div className="mt-4 -mx-6 px-6 flex gap-5 overflow-x-auto pb-6 snap-x snap-mandatory no-scrollbar">
        {shelf.map(({ product, tier }) => (
          <PricingCard
            key={tier.id}
            productName={product.name}
            group={product.group}
            tier={tier}
            cycle={cycle}
            ctaLabel={product.ctaLabel}
            loading={loadingTier === tier.id}
            onBuy={() => handleBuy(product, tier)}
          />
        ))}
      </div>
    </main>
  );
}
