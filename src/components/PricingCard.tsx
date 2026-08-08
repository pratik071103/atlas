import { Check } from "lucide-react";
import { BillingModel, PriceTier, formatPrice } from "../lib/catalog";

const GROUP_TINT: Record<BillingModel, { badge: string; header: string }> = {
  one_time: { badge: "bg-lavender-100 text-lavender-600", header: "bg-lavender-50" },
  subscription: { badge: "bg-lime-100 text-lime-800", header: "bg-lime-50" },
  usage_based: { badge: "bg-ink-100 text-ink-600", header: "bg-ink-50" },
  seat_based: { badge: "bg-lavender-100 text-lavender-600", header: "bg-lavender-50" },
  on_demand: { badge: "bg-lime-100 text-lime-800", header: "bg-lime-50" },
};

const GROUP_LABEL: Record<BillingModel, string> = {
  one_time: "One-Time",
  subscription: "Subscription",
  usage_based: "Usage-Based",
  seat_based: "Seat-Based",
  on_demand: "On-Demand",
};

function isCycleSensitive(group: BillingModel) {
  return group === "subscription" || group === "seat_based";
}

function unitSuffix(group: BillingModel, cycle: "monthly" | "yearly") {
  switch (group) {
    case "one_time":
    case "on_demand":
      return "one-time";
    case "usage_based":
      return "per image";
    case "seat_based":
      return cycle === "yearly" ? "/seat/mo, billed yearly" : "/seat/mo";
    case "subscription":
      return cycle === "yearly" ? "/mo, billed yearly" : "/mo";
  }
}

interface Props {
  productName: string;
  group: BillingModel;
  tier: PriceTier;
  cycle: "monthly" | "yearly";
  ctaLabel: string;
  onBuy: () => void;
  loading?: boolean;
}

export function PricingCard({ productName, group, tier, cycle, ctaLabel, onBuy, loading }: Props) {
  const tint = GROUP_TINT[group];
  const cycleSensitive = isCycleSensitive(group);
  const yearlyMonthlyEquivalent = tier.yearly / 12;
  const showStrikethrough = cycleSensitive && cycle === "yearly" && tier.yearly < tier.monthly * 12;
  const displayAmount = cycleSensitive
    ? cycle === "yearly"
      ? yearlyMonthlyEquivalent
      : tier.monthly
    : cycle === "yearly"
    ? tier.yearly
    : tier.monthly;

  return (
    <div
      className={`card flex w-[280px] shrink-0 snap-start flex-col overflow-hidden ${
        tier.highlighted ? "border-ink-900 ring-1 ring-ink-900" : ""
      }`}
    >
      <div className={`px-5 pt-5 pb-4 ${tint.header}`}>
        <div className="flex items-center justify-between">
          <span className={`pill ${tint.badge}`}>{GROUP_LABEL[group]}</span>
          {tier.highlighted && <span className="pill bg-ink-900 text-white">Popular</span>}
        </div>
        <h4 className="mt-3 text-base font-bold text-ink-900">{productName}</h4>
        <p className="text-xs text-ink-600">{tier.label}</p>
      </div>

      <div className="flex flex-1 flex-col px-5 py-5">
        <div className="flex items-baseline gap-2 flex-wrap">
          {showStrikethrough && (
            <span className="text-base text-ink-400 line-through decoration-2">
              {formatPrice(tier.monthly)}
            </span>
          )}
          <span className="text-3xl font-bold font-display text-ink-900">
            {formatPrice(displayAmount)}
          </span>
        </div>
        <span className="text-xs text-ink-400">{unitSuffix(group, cycle)}</span>

        <p className="mt-3 text-sm text-ink-600">{tier.description}</p>

        <ul className="mt-4 space-y-2 flex-1">
          {tier.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-ink-800">
              <Check size={15} className="mt-0.5 shrink-0 text-lime-600" strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={onBuy}
          disabled={loading}
          className={tier.highlighted ? "btn-primary mt-5 w-full" : "btn-dark mt-5 w-full"}
        >
          {loading ? "Working…" : ctaLabel}
        </button>

        <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-500" />
          {tier.credits ? `${tier.credits} credits` : tier.seats ? "1 seat" : "Metered usage"}
        </div>
      </div>
    </div>
  );
}
