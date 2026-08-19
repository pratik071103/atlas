import "server-only";

import DodoPayments from "dodopayments";

// ---------------------------------------------------------------------------
// Shared, lazily-created Dodo Payments server client.
//
// Used for everything the Better Auth adapter does not cover itself: on-demand
// (mandate_only) checkout sessions, subscription plan changes and
// cancellations, and license activate/validate/deactivate.
//
// The webhook secret is handed to the SDK as `webhookKey` so signature
// verification uses Dodo's own reference implementation.
// ---------------------------------------------------------------------------

const DODO_MODE = (process.env.DODO_MODE as "test_mode" | "live_mode") ?? "test_mode";

/**
 * True when no API key is configured (or SIMULATE_PAYMENTS=1 forces it).
 * In simulate mode nothing reaches the network: every real call site checks
 * this first and takes a local path instead, so the whole demo runs offline.
 */
export const SIMULATE_PAYMENTS =
  process.env.SIMULATE_PAYMENTS === "1" || !process.env.DODO_API_KEY;

/** Resolves the credit entitlement attached to the current Dodo customer. */
export async function getCustomerCreditEntitlement(customerId: string) {
  const configured = process.env.DODO_CREDIT_ENTITLEMENT_ID;
  if (configured) return configured;

  const result = await getDodoClient().customers.listCreditEntitlements(customerId);
  const entitlement = result.items?.[0];
  if (!entitlement) throw new Error("No Dodo credit entitlement is attached to this customer.");
  return entitlement.credit_entitlement_id;
}

export async function debitDodoCredits(
  customerId: string,
  amount: number,
  reason: string,
  idempotencyKey: string
) {
  const creditEntitlementId = await getCustomerCreditEntitlement(customerId);
  return getDodoClient().creditEntitlements.balances.createLedgerEntry(customerId, {
    credit_entitlement_id: creditEntitlementId,
    amount: String(amount),
    entry_type: "debit",
    reason,
    idempotency_key: idempotencyKey,
  });
}

let client: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
  if (!client) {
    client = new DodoPayments({
      // The SDK throws on construction without a token, and Better Auth builds
      // the Dodo plugin at module load — so an unconfigured clone would crash
      // on boot. The placeholder keeps simulate mode importable.
      bearerToken: process.env.DODO_API_KEY || "simulate-mode-no-api-key",
      environment: DODO_MODE,
      webhookKey: process.env.DODO_WEBHOOK_SECRET || null,
    });
  }
  return client;
}

/** Absolute origin used for checkout return/cancel URLs. */
export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}
