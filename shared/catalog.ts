// Demo product catalog for the Atlas Studio / Dodo Payments reference frontend.
// Prices and copy are placeholders — wire real values from your Dodo Payments
// dashboard when connecting the checkout folder to the live API.

export type BillingModel =
  | "one_time"
  | "subscription"
  | "usage_based"
  | "seat_based"
  | "on_demand";

export interface PriceTier {
  id: string;
  label: string;
  monthly: number;
  yearly: number;
  credits?: number;
  seats?: number;
  description: string;
  features: string[];
  highlighted?: boolean;
}

export interface Product {
  id: string;
  group: BillingModel;
  groupLabel: string;
  name: string;
  tagline: string;
  badge?: string;
  ctaLabel: string;
  tiers: PriceTier[];
}

export const GROUP_ORDER: BillingModel[] = [
  "one_time",
  "subscription",
  "usage_based",
  "seat_based",
  "on_demand",
];

export const GROUP_META: Record<
  BillingModel,
  { label: string; description: string }
> = {
  one_time: {
    label: "One-Time",
    description: "Pay once, keep it forever",
  },
  subscription: {
    label: "Subscription",
    description: "Recurring plans, billed monthly or yearly",
  },
  usage_based: {
    label: "Usage-Based",
    description: "Pay only for what you generate",
  },
  seat_based: {
    label: "Seat-Based",
    description: "Priced per teammate on the workspace",
  },
  on_demand: {
    label: "On-Demand",
    description: "No commitment — top up whenever",
  },
};

export const CATALOG: Product[] = [
  {
    id: "prompt-pack",
    group: "one_time",
    groupLabel: "One-Time",
    name: "5-Credit Image Pack",
    tagline: "A single bundle of 5 image-generation credits. Never expires.",
    ctaLabel: "Buy pack",
    tiers: [
      {
        id: "prompt-pack-5",
        label: "5 Credits",
        monthly: 9,
        yearly: 9,
        credits: 5,
        description: "One-time purchase, credits never expire.",
        features: ["5 image-generation credits", "No expiry", "Use anytime from your dashboard"],
      },
    ],
  },
  {
    id: "atlas-plans",
    group: "subscription",
    groupLabel: "Subscription",
    name: "Atlas Plans",
    tagline: "Monthly credits and generation limits for regular creators.",
    ctaLabel: "Choose plan",
    tiers: [
      {
        id: "starter",
        label: "Starter",
        monthly: 10,
        yearly: 96,
        credits: 25,
        description: "Good for trying Atlas out.",
        features: ["25 credits / month", "Standard queue", "Email support"],
      },
      {
        id: "standard",
        label: "Standard",
        monthly: 24,
        yearly: 230,
        credits: 80,
        description: "For creators who ship weekly.",
        features: ["80 credits / month", "Priority queue", "Email + chat support"],
        highlighted: true,
      },
      {
        id: "pro",
        label: "Pro",
        monthly: 49,
        yearly: 470,
        credits: 200,
        description: "For studios and power users.",
        features: ["200 credits / month", "Fastest queue", "Priority support"],
      },
    ],
  },
  {
    id: "ai-image-gen",
    group: "usage_based",
    groupLabel: "Usage-Based",
    name: "AI Image Generation",
    tagline: "Metered billing — every generation deducts credits automatically.",
    badge: "Usage-Based",
    ctaLabel: "Start generating",
    tiers: [
      {
        id: "usage-metered",
        label: "Pay-per-image",
        monthly: 0.4,
        yearly: 0.4,
        description: "$0.40 per image, billed at end of cycle.",
        features: ["No minimum spend", "Usage reported to Dodo automatically", "Real-time credit deduction"],
      },
    ],
  },
  {
    id: "team-seats",
    group: "seat_based",
    groupLabel: "Seat-Based",
    name: "Extra Seats",
    tagline: "Add teammates to your Atlas workspace.",
    ctaLabel: "Add seats",
    tiers: [
      {
        id: "seat-monthly",
        label: "Per Seat",
        monthly: 8,
        yearly: 80,
        seats: 1,
        description: "Billed per active teammate, per month.",
        features: ["Shared workspace credits", "Per-seat usage history", "Remove anytime"],
      },
    ],
  },
  {
    id: "credit-topup",
    group: "on_demand",
    groupLabel: "On-Demand",
    name: "Credit Top-Up",
    tagline: "No subscription — buy credits whenever you need them.",
    ctaLabel: "Buy credits",
    tiers: [
      {
        id: "topup-100",
        label: "100 Credits",
        monthly: 10,
        yearly: 10,
        credits: 100,
        description: "Prepaid credits, never expire.",
        features: ["100 credits", "No recurring charge", "Stack with any plan"],
      },
      {
        id: "topup-500",
        label: "500 Credits",
        monthly: 40,
        yearly: 40,
        credits: 500,
        description: "Best value top-up.",
        features: ["500 credits", "20% cheaper per credit", "No recurring charge"],
        highlighted: true,
      },
    ],
  },
];

export function formatPrice(amount: number) {
  return amount % 1 === 0
    ? `$${amount}`
    : `$${amount.toFixed(2)}`;
}
