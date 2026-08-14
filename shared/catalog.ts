// ---------------------------------------------------------------------------
// Product catalog — the single source of truth for both halves of the app.
//
// Server routes read it to build Dodo checkout sessions and to know how many
// credits a purchase grants; the pricing shelf, dashboard library and studio
// render from the same objects. Nothing here is server-only, so it is safe to
// import from client components.
//
// `dodoProductId` is the id of the product you create in the Dodo Payments
// dashboard (test mode) for each tier. Create products with matching prices
// and billing intervals, then paste the ids here. In simulate mode they are
// never sent anywhere.
// ---------------------------------------------------------------------------

export type BillingModel =
  | "one_time"
  | "subscription"
  | "usage_based"
  | "seat_based"
  | "on_demand";

/**
 * Which wallet the credits a purchase grants land in.
 *   plan  — refreshed every billing cycle, spent first
 *   topup — prepaid, never expires
 */
export type CreditBucket = "plan" | "topup";

/** Motif the generative <ProductArt> lays down over the gradient. */
export type ArtMotif = "orbit" | "waves" | "prism" | "grid" | "bloom";

export interface ArtSpec {
  /** Gradient stops, top-left → bottom-right. */
  from: string;
  to: string;
  /** Stroke/fill colour for the motif drawn on top. */
  accent: string;
  motif: ArtMotif;
  /** Drives the deterministic shape placement; also the SVG's gradient ids. */
  seed: string;
}

export interface PriceTier {
  id: string;
  label: string;
  monthly: number;
  yearly: number;
  /** Credits granted on activation (and again on each renewal). */
  credits?: number;
  seats?: number;
  description: string;
  features: string[];
  highlighted?: boolean;
  /** Dodo Payments product id for this tier (from the Dodo dashboard). */
  dodoProductId: string;
  art: ArtSpec;
}

export interface Product {
  id: string;
  group: BillingModel;
  name: string;
  tagline: string;
  badge?: string;
  ctaLabel: string;
  /**
   * Buying this issues a license key, which unlocks the blurred artwork on
   * /studio. Exactly one product in the catalog carries it.
   */
  grantsLicense?: boolean;
  tiers: PriceTier[];
}

export const GROUP_META: Record<BillingModel, { label: string; description: string }> = {
  one_time: { label: "One-Time", description: "Pay once, keep it forever" },
  subscription: {
    label: "Subscription",
    description: "Recurring plans, billed monthly or yearly",
  },
  usage_based: { label: "Usage-Based", description: "Pay only for what you generate" },
  seat_based: { label: "Seat-Based", description: "Priced per teammate on the workspace" },
  on_demand: { label: "On-Demand", description: "No commitment — top up whenever" },
};

/**
 * Subscriptions and seats grant *plan* credits, which the next renewal
 * replaces; everything bought outright grants *top-up* credits, which stack
 * and never expire.
 */
export function creditBucketFor(group: BillingModel): CreditBucket {
  return group === "subscription" || group === "seat_based" ? "plan" : "topup";
}

/** Metered products authorize a payment method up front and bill on usage. */
export function isMetered(group: BillingModel): boolean {
  return group === "usage_based" || group === "on_demand";
}

export const CATALOG: Product[] = [
  {
    id: "prompt-pack",
    group: "one_time",
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
        dodoProductId: "pdt_0NkxCWAFZAlYbC8lkjp1q",
        description: "One-time purchase, credits never expire.",
        features: [
          "5 image-generation credits",
          "Lands in your top-up balance",
          "Use anytime from your dashboard",
        ],
        art: { from: "#ede9fb", to: "#c1b2f0", accent: "#7550c4", motif: "prism", seed: "pack5" },
      },
    ],
  },
  {
    id: "atlas-plans",
    group: "subscription",
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
        dodoProductId: "pdt_atlas_starter",
        description: "Good for trying Atlas out.",
        features: ["25 plan credits / month", "Standard queue", "Email support"],
        art: { from: "#fafef0", to: "#d3f16f", accent: "#6d8e15", motif: "orbit", seed: "starter" },
      },
      {
        id: "standard",
        label: "Standard",
        monthly: 24,
        yearly: 230,
        credits: 80,
        dodoProductId: "pdt_atlas_standard",
        description: "For creators who ship weekly.",
        features: ["80 plan credits / month", "Priority queue", "Email + chat support"],
        highlighted: true,
        art: { from: "#e4f7a6", to: "#8fb818", accent: "#0c0f0c", motif: "bloom", seed: "standard" },
      },
      {
        id: "pro",
        label: "Pro",
        monthly: 49,
        yearly: 470,
        credits: 200,
        dodoProductId: "pdt_atlas_pro",
        description: "For studios and power users.",
        features: ["200 plan credits / month", "Fastest queue", "Priority support"],
        art: { from: "#d3f16f", to: "#485c17", accent: "#fafef0", motif: "waves", seed: "pro" },
      },
    ],
  },
  {
    id: "ai-image-gen",
    group: "usage_based",
    name: "AI Image Generation",
    tagline: "Metered billing — every generation is reported to Dodo as it happens.",
    badge: "Usage-Based",
    ctaLabel: "Start generating",
    tiers: [
      {
        id: "usage-metered",
        label: "Pay-per-image",
        monthly: 0.4,
        yearly: 0.4,
        dodoProductId: "pdt_ai_image_gen",
        description: "$0.40 per image, billed at the end of the cycle.",
        features: [
          "No minimum spend",
          "Usage ingested to Dodo automatically",
          "Live event log on the dashboard",
        ],
        art: { from: "#f7f8f7", to: "#1c211c", accent: "#c3ee3f", motif: "grid", seed: "metered" },
      },
    ],
  },
  {
    id: "team-seats",
    group: "seat_based",
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
        credits: 20,
        dodoProductId: "pdt_team_seat",
        description: "Billed per active teammate, per month.",
        features: ["20 plan credits / seat / month", "Per-seat usage history", "Remove anytime"],
        art: { from: "#f7f6fe", to: "#a488e6", accent: "#0c0f0c", motif: "grid", seed: "seat" },
      },
    ],
  },
  {
    id: "credit-topup",
    group: "on_demand",
    name: "Credit Top-Up",
    tagline: "No subscription — authorize once, buy credits whenever you need them.",
    ctaLabel: "Buy credits",
    tiers: [
      {
        id: "topup-100",
        label: "100 Credits",
        monthly: 10,
        yearly: 10,
        credits: 100,
        dodoProductId: "pdt_topup_100",
        description: "Prepaid credits, never expire.",
        features: ["100 top-up credits", "No recurring charge", "Stack with any plan"],
        art: { from: "#f2fbd4", to: "#aede1f", accent: "#0c0f0c", motif: "waves", seed: "topup100" },
      },
      {
        id: "topup-500",
        label: "500 Credits",
        monthly: 40,
        yearly: 40,
        credits: 500,
        dodoProductId: "pdt_topup_500",
        description: "Best value top-up.",
        features: ["500 top-up credits", "20% cheaper per credit", "No recurring charge"],
        highlighted: true,
        art: { from: "#c3ee3f", to: "#576f16", accent: "#fafef0", motif: "bloom", seed: "topup500" },
      },
    ],
  },
  {
    id: "studio-pass",
    group: "one_time",
    name: "Atlas Studio Pass",
    tagline: "A license key that unlocks the premium gallery in the Studio.",
    badge: "License key",
    ctaLabel: "Buy pass",
    grantsLicense: true,
    tiers: [
      {
        id: "studio-pass-lifetime",
        label: "Lifetime Pass",
        monthly: 29,
        yearly: 29,
        dodoProductId: "pdt_studio_pass",
        description: "Issues a license key you activate to reveal the gallery.",
        features: [
          "Dodo-issued license key",
          "Activate on this device, validate anytime",
          "Deactivate to free the seat",
        ],
        art: { from: "#1c211c", to: "#0c0f0c", accent: "#c3ee3f", motif: "orbit", seed: "pass" },
      },
    ],
  },
];

/** Every product/tier pair, in catalog order — what the pricing shelf renders. */
export const SHELF: { product: Product; tier: PriceTier }[] = CATALOG.flatMap((product) =>
  product.tiers.map((tier) => ({ product, tier }))
);

export function findProduct(productId: string): Product | undefined {
  return CATALOG.find((p) => p.id === productId);
}

export function findTier(
  productId: string,
  tierId: string
): { product: Product; tier: PriceTier } | null {
  const product = findProduct(productId);
  const tier = product?.tiers.find((t) => t.id === tierId);
  return product && tier ? { product, tier } : null;
}

/** The one product that issues license keys, used by the studio unlock flow. */
export const LICENSE_PRODUCT = CATALOG.find((p) => p.grantsLicense)!;

export function tierPrice(tier: PriceTier, cycle: "monthly" | "yearly"): number {
  return cycle === "yearly" ? tier.yearly : tier.monthly;
}

export function formatPrice(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** Converts a catalog price (whole dollars) to minor units, which Dodo expects. */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
