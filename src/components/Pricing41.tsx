"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
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
      return "/ API call";
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

const INLINE_CHECKOUT_SNIPPET = `DodoPayments.Initialize({
  mode: "test",
  displayType: "inline",
  onEvent: (event) => console.log(event),
});

DodoPayments.Checkout.open({
  checkoutUrl,
  elementId: "dodo-inline-checkout",
});`;

interface CardProps {
  product: Product;
  tier: PriceTier;
  loading: boolean;
  cycle: "monthly" | "yearly";
  inlineOpen: boolean;
  snippetOpen: boolean;
  inlineElementId: string;
  onBuy: () => void;
  onToggleSnippet: () => void;
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
  snippetOpen,
  inlineElementId,
  onBuy,
  onToggleSnippet,
  onCloseInlineCheckout,
  onCycleChange,
}: CardProps) {
  const reduceMotion = useReducedMotion();
  const cycleSensitive = isCycleSensitive(product.group);
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.8 };

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
  const expanded = inlineOpen || snippetOpen;
  const sideExpanded = expanded;

  return (
    <motion.article
      layout
      transition={transition}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`${product.name} ${tier.label}${expanded ? ", expanded" : ""}`}
      aria-selected={expanded}
      onClick={() => {
        if (!inlineOpen) onToggleSnippet();
      }}
      onKeyDown={(event) => {
        if (inlineOpen) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onToggleSnippet();
      }}
      className={`cursor-pointer rounded-2xl border bg-white p-6 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 ${
        sideExpanded ? "grid gap-6 md:grid-cols-[272px_minmax(0,1fr)]" : "flex flex-col"
      } ${
        tier.highlighted
          ? "border-ink-900 shadow-sm ring-1 ring-ink-900"
          : "border-ink-100"
      }`}
    >
      <motion.div layout className="flex min-w-0 flex-col">
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

        {/* Billing toggle - only shown for cycle-sensitive products */}
        {cycleSensitive && (
          <div className="mt-4" onClick={(event) => event.stopPropagation()}>
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
          onClick={(event) => {
            event.stopPropagation();
            onBuy();
          }}
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
      </motion.div>

      <AnimatePresence initial={false}>
        {inlineOpen && (
          <motion.div
            layout
            key="inline-checkout"
            initial={reduceMotion ? false : { opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }}
            transition={transition}
            className="min-w-0 border-t border-ink-100 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">Complete checkout</p>
                <p className="text-xs text-ink-500">Secure payment by Dodo Payments</p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseInlineCheckout();
                }}
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
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="popLayout">
        {snippetOpen && !inlineOpen && (
          <motion.div
            layout
            key="code-snippet"
            onClick={(event) => event.stopPropagation()}
            initial={reduceMotion ? false : { opacity: 0, x: 24, filter: "blur(4px)" }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, filter: "blur(4px)" }}
            transition={transition}
            className="min-w-0 border-t border-ink-100 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">Inline checkout code</p>
                <p className="text-xs text-ink-500">The Dodo SDK call used when this card checks out inline.</p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSnippet();
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink-200 text-ink-600 transition hover:bg-ink-50 hover:text-ink-900"
                aria-label="Collapse card"
              >
                <X size={15} />
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-ink-900 p-4 font-mono text-xs leading-relaxed text-white">
              <code>{INLINE_CHECKOUT_SNIPPET}</code>
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
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
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [snippetTierId, setSnippetTierId] = useState<string | null>(null);
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.8 };

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
    if (!emblaApi || (!inlineTierId && !snippetTierId)) return;
    const targetTierId = inlineTierId ?? snippetTierId;
    const index = shelf.findIndex(({ tier }) => tier.id === targetTierId);
    emblaApi.reInit();
    if (index >= 0) emblaApi.scrollTo(index);
  }, [emblaApi, inlineTierId, shelf, snippetTierId]);

  const prev = () => emblaApi && emblaApi.scrollPrev();
  const next = () => emblaApi && emblaApi.scrollNext();
  const scrollTo = (index: number) => emblaApi && emblaApi.scrollTo(index);

  return (
    <div className="relative">
      <LayoutGroup>
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex -ml-4">
            {shelf.map(({ product, tier }) => {
              const inlineOpen = inlineTierId === tier.id;
              const snippetOpen = snippetTierId === tier.id;
              const expanded = inlineOpen || snippetOpen;

              return (
                <motion.div
                  layout
                  transition={transition}
                  key={tier.id}
                  className={`min-w-0 shrink-0 grow-0 pl-4 ${
                    expanded ? "w-[min(92vw,960px)]" : "w-[320px]"
                  }`}
                >
                  <PricingCard41
                    product={product}
                    tier={tier}
                    loading={loadingTier === tier.id}
                    cycle={globalCycle}
                    inlineOpen={inlineOpen}
                    snippetOpen={snippetOpen}
                    inlineElementId={inlineElementId}
                    onBuy={() => {
                      setSnippetTierId(null);
                      onBuy(product, tier);
                    }}
                    onToggleSnippet={() =>
                      setSnippetTierId((current) => (current === tier.id ? null : tier.id))
                    }
                    onCloseInlineCheckout={onCloseInlineCheckout}
                    onCycleChange={(c) => onCycleChange(tier.id, c)}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      </LayoutGroup>

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
