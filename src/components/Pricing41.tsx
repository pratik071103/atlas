"use client";

import { useState } from "react";
import { Check } from "lucide-react";
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
  onBuy: () => void;
  // Receives the cycle state from the parent so inline checkout mode still
  // can read the selected cycle; each card owns its own local toggle too.
  onCycleChange: (cycle: "monthly" | "yearly") => void;
}

function PricingCard41({ product, tier, loading, cycle, onBuy, onCycleChange }: CardProps) {
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
        disabled={loading}
        className={`mt-5 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 disabled:opacity-60 ${
          tier.highlighted
            ? "bg-ink-900 text-white hover:bg-ink-800"
            : "border border-ink-200 bg-white text-ink-900 hover:bg-ink-50"
        }`}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          product.ctaLabel
        )}
      </button>

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
  onCycleChange: (tierId: string, cycle: "monthly" | "yearly") => void;
  onBuy: (product: Product, tier: PriceTier) => void;
}

export function Pricing41({
  shelf,
  loadingTier,
  globalCycle,
  onCycleChange,
  onBuy,
}: Pricing41Props) {
  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {shelf.map(({ product, tier }) => (
        <PricingCard41
          key={tier.id}
          product={product}
          tier={tier}
          loading={loadingTier === tier.id}
          cycle={globalCycle}
          onBuy={() => onBuy(product, tier)}
          onCycleChange={(c) => onCycleChange(tier.id, c)}
        />
      ))}
    </div>
  );
}
