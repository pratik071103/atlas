"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { SHELF, tierPrice, type BillingModel, type PriceTier, type Product } from "@shared/catalog";
import { CheckoutModeSwitch } from "@/components/CheckoutModeSwitch";
import { Pricing41 } from "@/components/Pricing41";
import { useSession } from "@/components/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import {
  closeCheckout,
  launchCheckout,
  INLINE_CHECKOUT_ELEMENT_ID,
  type CheckoutMode,
} from "@/lib/checkout";

const ORDER: BillingModel[] = ["one_time", "subscription", "usage_based", "seat_based"];
const customShelf = [...SHELF]
  .filter((item) => ORDER.includes(item.product.group))
  .sort((a, b) => ORDER.indexOf(a.product.group) - ORDER.indexOf(b.product.group));

// The seat-based card is shown separately with its own stepper.

export default function PricingPage() {
  const [globalCycle, setGlobalCycle] = useState<"monthly" | "yearly">("monthly");
  const [mode, setMode] = useState<CheckoutMode>("redirect");
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [inlineTierId, setInlineTierId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seatQty, setSeatQty] = useState(1);
  const [seatBuying, setSeatBuying] = useState(false);
  const [seatInlineOpen, setSeatInlineOpen] = useState(false);
  const { identity, openAuthModal, inlineCheckoutOpen, setInlineCheckoutOpen } = useSession();
  const router = useRouter();

  // Unique element id for the seat inline checkout (different from the Pricing41 one).
  const SEAT_INLINE_ID = "dodo-inline-checkout-seats";

  function handleCycleChange(_tierId: string, cycle: "monthly" | "yearly") {
    setGlobalCycle(cycle);
  }

  async function handleBuy(product: Product, tier: PriceTier) {
    setError(null);
    const cycle = globalCycle;

    if (product.group === "seat_based") {
      await handleBuySeats();
      return;
    }

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

  async function handleBuySeats() {
    setError(null);
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
        setSeatInlineOpen(true);
        setInlineCheckoutOpen(true);
      }

      const session = await api.createSeatsCheckout(seatQty, mode);

      if (mode === "inline") {
        // Wait one frame so the div mounts before the SDK tries to find it.
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      await launchCheckout(
        session,
        mode,
        () => router.push("/team"),
        SEAT_INLINE_ID
      );

      if (session.simulated) router.push("/team");
    } catch (e) {
      setSeatInlineOpen(false);
      setInlineCheckoutOpen(false);
      setError((e as Error).message);
    } finally {
      setSeatBuying(false);
    }
  }

  async function closeSeatInlineCheckout() {
    await closeCheckout();
    setSeatInlineOpen(false);
    setInlineCheckoutOpen(false);
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
        seatQty={seatQty}
        onSeatQtyChange={setSeatQty}
      />

      {/* Seat-based section with quantity stepper + inline checkout support */}
      {false && (
        <section className="mt-16">
          <div className="mb-6">
            <span className="inline-block rounded-full bg-lavender-100 px-3 py-1 text-xs font-semibold text-lavender-700">
              Team
            </span>
            <h2 className="mt-2 text-2xl font-bold text-ink-900">Seat-based pricing</h2>
            <p className="mt-1 text-ink-500">Add teammates to your workspace. Each seat = 20 credits / month.</p>
          </div>

          {/* Card expands right into the inline checkout frame, same as Pricing41 cards */}
          <div className={`rounded-2xl border border-lavender-200 bg-white p-6 transition-all ${
            seatInlineOpen ? "grid gap-6 md:grid-cols-[340px_minmax(0,1fr)]" : "max-w-md"
          }`}>
            {/* Left column — always visible */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink-900">Extra Seats</p>
                  <p className="text-sm text-ink-500">$8 / seat / month · 20 credits each</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    id="seat-qty-dec"
                    onClick={() => setSeatQty((q) => Math.max(1, q - 1))}
                    disabled={seatInlineOpen}
                    className="grid h-9 w-9 place-items-center rounded-full border border-ink-200 bg-white hover:bg-ink-50 transition-colors disabled:opacity-40"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-lg font-bold text-ink-900">{seatQty}</span>
                  <button
                    id="seat-qty-inc"
                    onClick={() => setSeatQty((q) => Math.min(50, q + 1))}
                    disabled={seatInlineOpen}
                    className="grid h-9 w-9 place-items-center rounded-full border border-ink-200 bg-white hover:bg-ink-50 transition-colors disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-lavender-50 px-4 py-3">
                <span className="text-sm text-lavender-700">
                  {seatQty} seat{seatQty !== 1 ? "s" : ""} × $8
                </span>
                <span className="text-lg font-bold text-lavender-900">
                  ${seatQty * 8}<span className="text-sm font-normal">/month</span>
                </span>
              </div>

              <ul className="mt-4 space-y-1.5">
                {["20 plan credits / seat / month", "Unique invite link per seat", "Remove members anytime", "Credits refresh each billing cycle"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-ink-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-lavender-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {seatInlineOpen ? (
                <button
                  onClick={closeSeatInlineCheckout}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50 transition-colors"
                >
                  ✕ Close checkout
                </button>
              ) : (
                <Button
                  id="buy-seats-btn"
                  onClick={handleBuySeats}
                  loading={seatBuying}
                  className="mt-5 w-full"
                >
                  Get {seatQty} seat{seatQty !== 1 ? "s" : ""} — ${seatQty * 8}/mo
                </Button>
              )}
            </div>

            {/* Right column — inline checkout frame (only when mode=inline) */}
            {seatInlineOpen && (
              <div
                id={SEAT_INLINE_ID}
                className="min-h-[480px] overflow-hidden rounded-xl border border-ink-100 bg-ink-50"
              />
            )}
          </div>
        </section>
      )}
    </main>
  );
}
