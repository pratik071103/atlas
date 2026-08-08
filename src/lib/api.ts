export interface SessionIdentity {
  kind: "user" | "guest";
  name: string | null;
  email: string | null;
  billingAddress?: string | null;
}

export interface Purchase {
  id: string;
  product_id: string;
  tier_id: string;
  product_name: string;
  billing_model: string;
  billing_cycle: string;
  checkout_mode: string;
  amount: number;
  status: string;
  credits_granted: number;
  created_at: string;
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
}

export interface LedgerEntry {
  id: string;
  delta: number;
  reason: string;
  balance_after: number;
  created_at: string;
}

export interface WebhookEventRow {
  id: string;
  eventType: string;
  status: string;
  eventId: string | null;
  createdAt: string;
  payloadPreview: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data as T;
}

export const api = {
  getSession: () => request<{ identity: SessionIdentity | null }>("/auth/session"),

  signUp: (name: string, email: string, password: string) =>
    request("/auth/sign-up", { method: "POST", body: JSON.stringify({ name, email, password }) }),

  signIn: (email: string, password: string) =>
    request("/auth/sign-in", { method: "POST", body: JSON.stringify({ email, password }) }),

  continueAsGuest: () => request("/auth/guest", { method: "POST", body: JSON.stringify({}) }),

  signOut: () => request("/auth/sign-out", { method: "POST" }),

  createCheckoutSession: (payload: {
    productId: string;
    tierId: string;
    billingCycle: "monthly" | "yearly";
    mode: "redirect" | "overlay" | "inline";
  }) =>
    request<CheckoutSession>("/checkout/session", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getCheckoutStatus: (purchaseId: string) =>
    request<CheckoutStatus>(`/checkout/${purchaseId}/status`),

  getDashboard: () =>
    request<{
      identity: SessionIdentity;
      creditBalance: number;
      purchases: Purchase[];
      ledger: LedgerEntry[];
    }>("/billing/me"),

  adjustCredits: (delta: number, reason: string) =>
    request<{ creditBalance: number }>("/billing/credits/adjust", {
      method: "POST",
      body: JSON.stringify({ delta, reason }),
    }),

  cancelSubscription: (purchaseId: string, mode: "immediate" | "schedule") =>
    request<{ status: string }>(`/billing/subscription/${purchaseId}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    }),

  openCustomerPortal: () =>
    request<{ url: string; simulated: boolean }>("/billing/portal", { method: "POST" }),

  updatePaymentMethod: () =>
    request<{ url: string; simulated: boolean }>("/billing/payment-method", { method: "POST" }),

  getWebhookEvents: () => request<{ events: WebhookEventRow[] }>("/webhooks/events"),
};
