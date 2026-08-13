import type { CreditBucket } from "@shared/catalog";

// ---------------------------------------------------------------------------
// Typed browser client for the app's own API.
//
// Components never call fetch directly; they call this. Auth is not part of it
// — sign-up/sign-in/guest/session/portal/usage all belong to Better Auth and
// live on authClient (src/lib/auth-client.ts).
// ---------------------------------------------------------------------------

export interface SessionIdentitySummary {
  id: string;
  kind: "user" | "guest";
  name: string | null;
  email: string | null;
}

export interface WalletBalance {
  plan: number;
  topup: number;
  total: number;
}

export interface Purchase {
  id: string;
  productId: string;
  tierId: string;
  productName: string;
  billingModel: string;
  billingCycle: string;
  checkoutMode: string;
  amount: number;
  status: string;
  creditsGranted: number;
  creditBucket: CreditBucket;
  dodoSubscriptionId: string | null;
  simulated: boolean;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  bucket: CreditBucket;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
}

export interface CheckoutSession {
  purchaseId: string;
  sessionId: string | null;
  checkoutUrl: string | null;
  simulated: boolean;
}

export interface CheckoutStatus {
  purchaseId: string;
  status: string;
  productName: string;
  amount: number;
  credits: number;
  creditBucket: CreditBucket;
  simulated: boolean;
}

export interface WebhookEventRow {
  id: string;
  eventType: string;
  status: string;
  eventId: string | null;
  createdAt: string;
  payloadPreview: string;
}

export interface BillingSnapshot {
  identity: SessionIdentitySummary;
  wallet: WalletBalance;
  purchases: Purchase[];
  ledger: LedgerEntry[];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || "Something went wrong. Please try again."
    );
  }
  return data as T;
}

export const api = {
  getBilling: () => request<BillingSnapshot>("/billing/me"),

  createCheckoutSession: (payload: {
    productId: string;
    tierId: string;
    billingCycle: "monthly" | "yearly";
    mode: "redirect" | "overlay" | "inline";
  }) =>
    request<CheckoutSession>("/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getCheckoutStatus: (purchaseId: string) =>
    request<CheckoutStatus>(`/checkout/${purchaseId}/status`),

  getWebhookEvents: () => request<{ events: WebhookEventRow[] }>("/webhooks/events"),
};
