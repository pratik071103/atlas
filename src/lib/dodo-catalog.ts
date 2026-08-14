import "server-only";

import { CATALOG, type PriceTier, type Product } from "@shared/catalog";

// ---------------------------------------------------------------------------
// Dodo product ids, keyed by catalog tier.
//
// The shared catalog (shared/catalog.ts) deliberately carries no Dodo ids: it
// is imported by client components, so anything secret must not live there.
// Each tier's product id — created in the Dodo dashboard, test or live mode —
// is read from a `DODO_PRODUCT_*` environment variable instead, so the same
// build can run against a test catalog and a live one by swapping .env.
//
// In simulate mode these are never sent anywhere, so unset variables are fine.
// ---------------------------------------------------------------------------

/** Env var that holds the Dodo product id for a catalog tier. */
const ENV_FOR_TIER: Record<string, string> = {
  "prompt-pack-5": "DODO_PRODUCT_PROMPT_PACK_5",
  starter: "DODO_PRODUCT_STARTER",
  standard: "DODO_PRODUCT_STANDARD",
  pro: "DODO_PRODUCT_PRO",
  "usage-metered": "DODO_PRODUCT_USAGE_METERED",
  "seat-monthly": "DODO_PRODUCT_SEAT_MONTHLY",
  "topup-100": "DODO_PRODUCT_TOPUP_100",
  "topup-500": "DODO_PRODUCT_TOPUP_500",
  "studio-pass-lifetime": "DODO_PRODUCT_STUDIO_PASS_LIFETIME",
};

/** The Dodo product id for a catalog tier, or null when it is not configured. */
export function dodoProductIdFor(tierId: string): string | null {
  const envName = ENV_FOR_TIER[tierId];
  if (!envName) return null;
  return process.env[envName] ?? null;
}

/**
 * Finds the catalog tier a Dodo product id belongs to (the reverse of
 * `dodoProductIdFor`). Used by webhooks that carry only Dodo's product id,
 * like `subscription.plan_changed`.
 */
export function tierByDodoProductId(
  productId: unknown
): { product: Product; tier: PriceTier } | null {
  if (typeof productId !== "string" || !productId) return null;
  for (const product of CATALOG) {
    const tier = product.tiers.find((t) => dodoProductIdFor(t.id) === productId);
    if (tier) return { product, tier };
  }
  return null;
}
