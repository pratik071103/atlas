"use client";

import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import {
  creditBucketFor,
  formatPrice,
  GROUP_META,
  type BillingModel,
  type PriceTier,
} from "@shared/catalog";
import { CtaButton } from "./ui/Button";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { ProductArt } from "./ProductArt";

/** Orb border colour for the ::before hover animation on each card header. */
const ORB_COLOR: Record<BillingModel, string> = {
  one_time: "rgba(138, 103, 218, 0.35)", // lavender-500
  subscription: "rgba(174, 222, 31,  0.45)", // lime-500
  usage_based: "rgba(12,  15,  12,  0.18)", // ink-900
  seat_based: "rgba(138, 103, 218, 0.35)", // lavender-500
  on_demand: "rgba(174, 222, 31,  0.45)", // lime-500
};

/**
 * Per-group orb shape:
 *   --orb-radius       border-radius in the default state
 *   --orb-rotate       base rotation angle
 *   --orb-rotate-extra extra degrees added on hover (so it spins as it travels)
 */
const ORB_SHAPE: Record<BillingModel, { radius: string; rotate: string; rotateExtra: string }> = {
  // Softly rounded square (squircle)
  one_time: { radius: "22%", rotate: "0deg", rotateExtra: "15deg" },
  // Rotated square → diamond; spins further on hover
  subscription: { radius: "10px", rotate: "45deg", rotateExtra: "20deg" },
  // Organic asymmetric blob
  usage_based: {
    radius: "60% 40% 30% 70% / 60% 30% 70% 40%",
    rotate: "0deg",
    rotateExtra: "-10deg",
  },
  // Alternating-corner pill — opposite corners rounded
  seat_based: {
    radius: "40px 4px 40px 4px / 4px 40px 4px 40px",
    rotate: "0deg",
    rotateExtra: "10deg",
  },
  // Teardrop — three rounded corners + one sharp
  on_demand: { radius: "0% 60% 60% 60%", rotate: "-30deg", rotateExtra: "25deg" },
};

function isCycleSensitive(group: BillingModel) {
  return group === "subscription";
}

function unitSuffix(group: BillingModel, cycle: "monthly" | "yearly") {
  switch (group) {
    case "one_time":
    case "on_demand":
      return "one-time";
    case "usage_based":
      return "per API call";
    case "seat_based":
      return cycle === "yearly" ? "/seat/mo, billed yearly" : "/seat/mo";
    case "subscription":
      return cycle === "yearly" ? "/mo, billed yearly" : "/mo";
  }
}

/** The one-line footnote under the CTA: what you actually walk away with. */
function entitlementHint(
  group: BillingModel,
  tier: PriceTier,
  grantsLicense: boolean
): string {
  if (grantsLicense) return "Issues a license key";
  if (tier.credits) {
    return `${tier.credits} ${creditBucketFor(group) === "plan" ? "plan" : "top-up"} credits`;
  }
  if (tier.seats) return "1 seat";
  return "Metered usage";
}

interface Props {
  productName: string;
  group: BillingModel;
  tier: PriceTier;
  cycle: "monthly" | "yearly";
  ctaLabel: string;
  grantsLicense?: boolean;
  onBuy: () => void;
  loading?: boolean;
}

export function PricingCard({
  productName,
  group,
  tier,
  cycle,
  ctaLabel,
  grantsLicense = false,
  onBuy,
  loading,
}: Props) {
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
    <Card
      className={`flex w-[280px] shrink-0 snap-start flex-col overflow-hidden ${
        tier.highlighted ? "border-ink-900 ring-1 ring-ink-900" : ""
      }`}
    >
      <div
        className="pricing-card-header h-[104px]"
        style={
          {
            "--orb-color": ORB_COLOR[group],
            "--orb-radius": ORB_SHAPE[group].radius,
            "--orb-rotate": ORB_SHAPE[group].rotate,
            "--orb-rotate-extra": ORB_SHAPE[group].rotateExtra,
          } as CSSProperties
        }
      >
        <ProductArt art={tier.art} className="absolute inset-0 z-0" />
        <div className="relative z-10 flex items-center justify-between px-5 pt-4">
          <Badge tone="dark">{GROUP_META[group].label}</Badge>
          {tier.highlighted && <Badge tone="lime-solid">Popular</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 py-5">
        <h4 className="text-base font-bold text-ink-900">{productName}</h4>
        <p className="text-xs text-ink-600">{tier.label}</p>

        <div className="mt-3 flex items-baseline gap-2 flex-wrap">
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

        <CtaButton
          fullWidth
          dark={tier.highlighted}
          loading={loading}
          onClick={onBuy}
          className="mt-5"
        >
          {ctaLabel}
        </CtaButton>

        <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-500" />
          {entitlementHint(group, tier, grantsLicense)}
        </div>
      </div>
    </Card>
  );
}
