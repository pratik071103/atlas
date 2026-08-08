import { DodoPayments } from "dodopayments";

// ---------------------------------------------------------------------------
// Shared, lazily-created Dodo Payments client (checkout sessions + webhook
// verification). The webhook secret is passed to the SDK as `webhookKey` so
// signature verification uses Dodo's own reference implementation
// (client.webhooks.unwrap) — see server/routes/webhooks.ts.
// ---------------------------------------------------------------------------

const DODO_MODE = (process.env.DODO_MODE as "test_mode" | "live_mode") ?? "test_mode";

export const SIMULATE_PAYMENTS =
  process.env.SIMULATE_PAYMENTS === "1" || !process.env.DODO_API_KEY;

let dodo: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
  if (!dodo) {
    dodo = new DodoPayments({
      bearerToken: process.env.DODO_API_KEY!,
      environment: DODO_MODE,
      webhookKey: process.env.DODO_WEBHOOK_SECRET || null,
    });
  }
  return dodo;
}

/** True when no Dodo API key is configured and the app runs in simulate mode. */
export function isPaymentSimulation(): boolean {
  return SIMULATE_PAYMENTS;
}