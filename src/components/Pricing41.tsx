"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import {
  formatPrice,
  GROUP_META,
  type BillingModel,
  type PriceTier,
  type Product,
} from "@shared/catalog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCycleSensitive(group: BillingModel) {
  return group === "subscription" || group === "seat_based";
}

function unitSuffix(group: BillingModel, cycle: "monthly" | "yearly") {
  switch (group) {
    case "one_time":
    case "on_demand":
      return "one-time";
    case "usage_based":
      return "/ image";
    case "seat_based":
      return cycle === "yearly" ? "/ seat / mo" : "/ seat / mo";
    case "subscription":
      return "/ mo";
  }
}

function savingsLabel(tier: PriceTier): string | null {
  if (tier.monthly === 0 || tier.yearly === 0) return null;
  const monthly12 = tier.monthly * 12;
  if (tier.yearly >= monthly12) return null;
  const pct = Math.round((1 - tier.yearly / monthly12) * 100);
  return `Save ${pct}%`;
}

// ---------------------------------------------------------------------------
// Per-card billing toggle (the signature of pricing-41)
// ---------------------------------------------------------------------------

function BillingSwitch({
  value,
  onChange,
  savings,
}: {
  value: "monthly" | "yearly";
  onChange: (v: "monthly" | "yearly") => void;
  savings: string | null;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <button
        onClick={() => onChange("monthly")}
        className={`transition-colors ${
          value === "monthly" ? "text-ink-900" : "text-ink-400 hover:text-ink-600"
        }`}
      >
        Monthly
      </button>
      {/* pill toggle */}
      <button
        onClick={() => onChange(value === "monthly" ? "yearly" : "monthly")}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
          value === "yearly" ? "bg-ink-900" : "bg-ink-200"
        }`}
        role="switch"
        aria-checked={value === "yearly"}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            value === "yearly" ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
      <button
        onClick={() => onChange("yearly")}
        className={`flex items-center gap-1 transition-colors ${
          value === "yearly" ? "text-ink-900" : "text-ink-400 hover:text-ink-600"
        }`}
      >
        Yearly
        {savings && (
          <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-semibold text-ink-900 leading-none">
            {savings}
          </span>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single card
// ---------------------------------------------------------------------------

interface CardProps {
  product: Product;
  tier: PriceTier;
  loading: boolean;
  cycle: "monthly" | "yearly";
  inlineOpen: boolean;
  inlineElementId: string;
  onBuy: () => void;
  onCloseInlineCheckout: () => void;
  // Receives the cycle state from the parent so inline checkout mode still
  // can read the selected cycle; each card owns its own local toggle too.
  onCycleChange: (cycle: "monthly" | "yearly") => void;
}

function PricingCard41({
  product,
  tier,
  loading,
  cycle,
  inlineOpen,
  inlineElementId,
  onBuy,
  onCloseInlineCheckout,
  onCycleChange,
}: CardProps) {
  const cycleSensitive = isCycleSensitive(product.group);

  function handleCycle(v: "monthly" | "yearly") {
    onCycleChange(v);
  }

  const displayAmount = cycleSensitive
    ? cycle === "yearly"
      ? tier.yearly / 12
      : tier.monthly
    : tier.monthly;

  const showStrikethrough =
    cycleSensitive && cycle === "yearly" && tier.yearly < tier.monthly * 12;

  const savings = cycleSensitive ? savingsLabel(tier) : null;

  return (
    <div
      className={`flex flex-col rounded-2xl border bg-white p-6 transition-shadow hover:shadow-md ${
        tier.highlighted
          ? "border-ink-900 shadow-sm ring-1 ring-ink-900"
          : "border-ink-100"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="inline-block rounded-full border border-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
            {GROUP_META[product.group].label}
          </span>
          <h3 className="mt-3 text-base font-bold text-ink-900">{product.name}</h3>
          <p className="mt-0.5 text-xs text-ink-500">{tier.label}</p>
        </div>
        {tier.highlighted && (
          <span className="shrink-0 rounded-full bg-lime-400 px-2.5 py-0.5 text-[11px] font-semibold text-ink-900">
            Popular
          </span>
        )}
      </div>

      {/* Billing toggle — only shown for cycle-sensitive products */}
      {cycleSensitive && (
        <div className="mt-4">
          <BillingSwitch value={cycle} onChange={handleCycle} savings={savings} />
        </div>
      )}

      {/* Price */}
      <div className="mt-5 flex items-baseline gap-2">
        {showStrikethrough && (
          <span className="text-sm text-ink-400 line-through">{formatPrice(tier.monthly)}</span>
        )}
        <span className="text-4xl font-bold tracking-tight text-ink-900">
          {formatPrice(displayAmount)}
        </span>
        <span className="text-xs text-ink-400">{unitSuffix(product.group, cycle)}</span>
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-ink-500">{tier.description}</p>

      {/* CTA */}
      <button
        onClick={onBuy}
        disabled={loading || inlineOpen}
        className={`mt-5 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 disabled:opacity-60 ${
          tier.highlighted
            ? "bg-ink-900 text-white hover:bg-ink-800"
            : "border border-ink-200 bg-white text-ink-900 hover:bg-ink-50"
        }`}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          inlineOpen ? "Checkout open" : product.ctaLabel
        )}
      </button>

      {inlineOpen && (
        <div className="mt-5 border-t border-ink-100 pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">Complete checkout</p>
              <p className="text-xs text-ink-500">Secure payment by Dodo Payments</p>
            </div>
            <button
              type="button"
              onClick={onCloseInlineCheckout}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink-200 text-ink-600 transition hover:bg-ink-50 hover:text-ink-900"
              aria-label="Cancel checkout"
            >
              <X size={15} />
            </button>
          </div>
          <div
            id={inlineElementId}
            className="min-h-[620px] overflow-hidden rounded-xl border border-ink-100 bg-white"
            aria-label="Inline checkout"
          />
        </div>
      )}

      {/* Divider */}
      <div className="my-5 border-t border-ink-100" />

      {/* Features */}
      <ul className="space-y-2.5">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-ink-700">
            <Check
              size={14}
              className="mt-0.5 shrink-0 text-lime-600"
              strokeWidth={2.5}
            />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual carousel — no auto-scroll, arrow + dot navigation
// ---------------------------------------------------------------------------

interface Pricing41Props {
  shelf: { product: Product; tier: PriceTier }[];
  loadingTier: string | null;
  globalCycle: "monthly" | "yearly";
  inlineTierId: string | null;
  inlineElementId: string;
  onCycleChange: (tierId: string, cycle: "monthly" | "yearly") => void;
  onBuy: (product: Product, tier: PriceTier) => void;
  onCloseInlineCheckout: () => void;
}

import useEmblaCarousel from "embla-carousel-react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";

export function Pricing41({
  shelf,
  loadingTier,
  globalCycle,
  inlineTierId,
  inlineElementId,
  onCycleChange,
  onBuy,
  onCloseInlineCheckout,
}: Pricing41Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { align: "start", loop: false },
    [WheelGesturesPlugin()]
  );
  const [active, setActive] = useState(0);

  const total = shelf.length;

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setActive(emblaApi.selectedScrollSnap());
    };
    emblaApi.on("select", onSelect);
    onSelect();
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || !inlineTierId) return;
    const index = shelf.findIndex(({ tier }) => tier.id === inlineTierId);
    emblaApi.reInit();
    if (index >= 0) emblaApi.scrollTo(index);
  }, [emblaApi, inlineTierId, shelf]);

  const prev = () => emblaApi && emblaApi.scrollPrev();
  const next = () => emblaApi && emblaApi.scrollNext();
  const scrollTo = (index: number) => emblaApi && emblaApi.scrollTo(index);

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-4">
          {shelf.map(({ product, tier }) => {
            const inlineOpen = inlineTierId === tier.id;

            return (
              <div
                key={tier.id}
                className={`min-w-0 shrink-0 grow-0 pl-4 transition-[width] duration-300 ${
                  inlineOpen ? "w-[min(92vw,720px)]" : "w-[320px]"
                }`}
              >
                <PricingCard41
                  product={product}
                  tier={tier}
                  loading={loadingTier === tier.id}
                  cycle={globalCycle}
                  inlineOpen={inlineOpen}
                  inlineElementId={inlineElementId}
                  onBuy={() => onBuy(product, tier)}
                  onCloseInlineCheckout={onCloseInlineCheckout}
                  onCycleChange={(c) => onCycleChange(tier.id, c)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          onClick={prev}
          disabled={active === 0}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-700 transition hover:bg-ink-50 disabled:opacity-30"
          aria-label="Previous"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="flex items-center gap-1.5">
          {shelf.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`rounded-full transition-all ${
                i === active
                  ? "h-2 w-5 bg-ink-900"
                  : "h-2 w-2 bg-ink-200 hover:bg-ink-400"
              }`}
              aria-label={`Go to card ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={next}
          disabled={active === total - 1}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-700 transition hover:bg-ink-50 disabled:opacity-30"
          aria-label="Next"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
