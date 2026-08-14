"use client";

import { useState } from "react";
import { Coins, Wallet } from "lucide-react";
import type { CreditBucket } from "@shared/catalog";
import type { LedgerEntry, WalletBalance } from "@/lib/api";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";

// ---------------------------------------------------------------------------
// Both credit buckets, side by side, with the ledger that explains them.
//
// Showing a single combined number would hide the only thing that matters
// about the split: plan credits expire at the end of the cycle and top-ups do
// not, which is also why spending drains plan first. The bar makes the ratio
// visible, and the history can be filtered per bucket.
// ---------------------------------------------------------------------------

type Filter = "all" | CreditBucket;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "plan", label: "Plan" },
  { id: "topup", label: "Top-up" },
];

interface Props {
  wallet: WalletBalance;
  ledger: LedgerEntry[];
}

export function CreditMeter({ wallet, ledger }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  // Guard the divide: an empty wallet would otherwise render NaN% widths.
  const total = wallet.total || 1;
  const planPct = (wallet.plan / total) * 100;
  const topupPct = (wallet.topup / total) * 100;

  const rows = filter === "all" ? ledger : ledger.filter((l) => l.bucket === filter);

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-ink-900">Credits</h2>
        <p className="font-display text-2xl font-bold text-ink-900">
          {wallet.total}
          <span className="ml-1 text-xs font-medium text-ink-400">total</span>
        </p>
      </div>

      <div
        className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-ink-100"
        role="img"
        aria-label={`${wallet.plan} plan credits, ${wallet.topup} top-up credits`}
      >
        <span
          className="bg-lime-400 transition-[width] duration-500"
          style={{ width: `${planPct}%` }}
        />
        <span
          className="bg-lavender-400 transition-[width] duration-500"
          style={{ width: `${topupPct}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-ink-100 p-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-600">
            <Wallet size={13} className="text-lime-700" /> Plan
          </span>
          <p className="mt-1 font-display text-xl font-bold text-ink-900">{wallet.plan}</p>
          <p className="text-[11px] leading-snug text-ink-400">
            Refreshed each cycle · spent first
          </p>
        </div>
        <div className="rounded-xl border border-ink-100 p-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-600">
            <Coins size={13} className="text-lavender-500" /> Top-up
          </span>
          <p className="mt-1 font-display text-xl font-bold text-ink-900">{wallet.topup}</p>
          <p className="text-[11px] leading-snug text-ink-400">Prepaid · never expires</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">History</p>
        <div className="inline-flex rounded-full border border-ink-100 p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                filter === f.id ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">
          Nothing yet. Buying credits or running the playground writes here.
        </p>
      ) : (
        <ul className="mt-2 max-h-64 divide-y divide-ink-100 overflow-y-auto pr-1">
          {rows.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-800">{entry.reason}</p>
                <p className="text-[11px] text-ink-400">
                  {new Date(entry.createdAt).toLocaleString()} · balance {entry.balanceAfter}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={entry.bucket === "plan" ? "lime" : "lavender"}>{entry.bucket}</Badge>
                <span
                  className={`w-12 text-right text-sm font-semibold ${
                    entry.delta > 0 ? "text-lime-700" : "text-ink-800"
                  }`}
                >
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
