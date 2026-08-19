"use client";

import { PackageOpen } from "lucide-react";
import type { Purchase } from "@/lib/api";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

// ---------------------------------------------------------------------------
// The customer's library: everything they own, rendered as its artwork.
//
// Below it sits the rest of the catalog, blurred — the same <ProductArt> with
// `blurred` set, so "locked" and "owned" are the same component in two states
// rather than two different cards.
// ---------------------------------------------------------------------------

interface Props {
  purchases: Purchase[];
  className?: string;
}

export function PurchaseLibrary({ purchases, className }: Props) {
  const owned = purchases.filter((p) => p.status === "active" || p.status === "scheduled_cancel");
  return (
    <Card className={`flex flex-col p-5${className ? ` ${className}` : ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink-900">Your library</h2>
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
        <ul className="mt-4 divide-y divide-ink-100">
          {owned.map((p) => {
            return (
              <li key={p.id} className="py-3">
                <p className="truncate text-sm font-semibold text-ink-900">{p.productName}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
