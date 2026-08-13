"use client";

import Link from "next/link";
import { Lock, PackageOpen } from "lucide-react";
import { findTier, SHELF } from "@shared/catalog";
import type { Purchase } from "@/lib/api";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { ProductArt } from "./ProductArt";

// ---------------------------------------------------------------------------
// The customer's library: everything they own, rendered as its artwork.
//
// Below it sits the rest of the catalog, blurred — the same <ProductArt> with
// `blurred` set, so "locked" and "owned" are the same component in two states
// rather than two different cards.
// ---------------------------------------------------------------------------

const STATUS_TONE: Record<string, "lime" | "lavender" | "ink" | "red"> = {
  active: "lime",
  scheduled_cancel: "lavender",
  pending: "ink",
  processing: "ink",
  failed: "red",
  cancelled: "red",
  refunded: "red",
  disputed: "red",
};

interface Props {
  purchases: Purchase[];
}

export function PurchaseLibrary({ purchases }: Props) {
  const owned = purchases.filter((p) => p.status === "active" || p.status === "scheduled_cancel");
  const ownedTierIds = new Set(owned.map((p) => p.tierId));
  const locked = SHELF.filter(({ tier }) => !ownedTierIds.has(tier.id));

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink-900">Your library</h2>
        {owned.length > 0 && (
          <span className="text-xs font-medium text-ink-400">
            {owned.length} of {SHELF.length} unlocked
          </span>
        )}
      </div>

      {owned.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-lime-50 text-lime-700">
            <PackageOpen size={22} />
          </span>
          <p className="mt-3 text-sm font-bold text-ink-900">Nothing purchased yet</p>
          <p className="mt-1 max-w-xs text-sm text-ink-600">
            Pick any billing model on the pricing shelf — it lands here the moment payment is
            confirmed.
          </p>
          <Button href="/pricing" variant="secondary" className="mt-4">
            Browse pricing
          </Button>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {owned.map((p) => {
            const art = findTier(p.productId, p.tierId)?.tier.art;
            return (
              <li key={p.id} className="overflow-hidden rounded-xl border border-ink-100">
                {art && <ProductArt art={art} alt={p.productName} className="h-24" />}
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-ink-900">{p.productName}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-ink-400">
                      {p.billingModel.replace("_", " ")} · {p.checkoutMode}
                    </span>
                    <Badge tone={STATUS_TONE[p.status] ?? "ink"}>
                      {p.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {locked.length > 0 && (
        <div className="mt-6 border-t border-ink-100 pt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <Lock size={12} /> Still locked
          </p>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {locked.map(({ product, tier }) => (
              <li key={tier.id}>
                <Link
                  href="/pricing"
                  className="group block overflow-hidden rounded-lg border border-ink-100"
                  title={`${product.name} — ${tier.label}`}
                >
                  <ProductArt
                    art={tier.art}
                    blurred
                    className="h-14 transition-opacity group-hover:opacity-80"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
