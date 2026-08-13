import "server-only";

import type { ClientSession } from "mongodb";
import {
  getCollections,
  newId,
  withTransaction,
  type CreditBucket,
  type PurchaseDoc,
  type PurchaseStatus,
} from "@/lib/db";
import { grantCreditsWithin, setPlanBalanceWithin } from "./wallet";

// ---------------------------------------------------------------------------
// Purchase lifecycle.
//
// A purchase row is the app's mirror of something a customer bought. Only two
// things ever create one — the checkout route and the simulate path — and only
// webhooks advance it, so the UI never has to guess whether a payment landed.
//
// `activatePurchase` is the port of the SQLite transaction of the same name:
// flip to 'active' and grant the credits, atomically and exactly once, because
// Dodo re-delivers webhooks.
// ---------------------------------------------------------------------------

/** How long a checkout may sit unconfirmed before it is written off. */
const STALE_CHECKOUT_MS = 24 * 60 * 60 * 1000;

export interface CreatePurchaseInput {
  /** Pre-allocated so it can be embedded in the Dodo return_url and metadata. */
  id?: string;
  userId: string;
  productId: string;
  tierId: string;
  productName: string;
  billingModel: string;
  billingCycle: "monthly" | "yearly";
  checkoutMode: "redirect" | "overlay" | "inline";
  amount: number;
  creditsGranted: number;
  creditBucket: CreditBucket;
  dodoProductId: string | null;
  dodoSessionId?: string | null;
  simulated: boolean;
}

export async function createPurchase(input: CreatePurchaseInput): Promise<PurchaseDoc> {
  const c = await getCollections();
  const now = new Date();
  const { id, ...rest } = input;
  const doc: PurchaseDoc = {
    _id: id ?? newId("pur"),
    ...rest,
    status: "pending",
    dodoSessionId: input.dodoSessionId ?? null,
    dodoPaymentId: null,
    dodoSubscriptionId: null,
    createdAt: now,
    updatedAt: now,
  };
  await c.purchases.insertOne(doc);
  return doc;
}

/**
 * The plan allowance is the sum of every currently-active plan-bucket
 * purchase, so a customer on a plan *and* a couple of seats gets both.
 * Recomputing it (rather than adding one purchase's credits) is what keeps
 * upgrades, downgrades and cancellations from drifting the balance.
 */
async function syncPlanAllowanceWithin(
  session: ClientSession | undefined,
  userId: string,
  reason: string,
  idempotencyKey?: string
): Promise<void> {
  const c = await getCollections();
  const active = await c.purchases
    .find(
      {
        userId,
        creditBucket: "plan",
        status: { $in: ["active", "scheduled_cancel"] },
      },
      session ? { session } : {}
    )
    .toArray();

  const allowance = active.reduce((sum, p) => sum + (p.creditsGranted || 0), 0);
  await setPlanBalanceWithin(session, userId, allowance, reason, idempotencyKey);
}

/**
 * Marks a purchase active and grants its credits, atomically and exactly once.
 * Safe to call repeatedly — a purchase that already reached 'active' is left
 * untouched, which is what makes webhook re-delivery harmless.
 *
 * Returns true only when this call was the one that activated it.
 */
export async function activatePurchase(purchaseId: string, reason: string): Promise<boolean> {
  const c = await getCollections();

  return withTransaction(async (session) => {
    const opts = session ? { session } : {};
    const purchase = await c.purchases.findOne({ _id: purchaseId }, opts);
    if (!purchase || purchase.status === "active") return false;

    await c.purchases.updateOne(
      { _id: purchaseId },
      { $set: { status: "active", updatedAt: new Date() } },
      opts
    );

    if (purchase.creditsGranted > 0) {
      if (purchase.creditBucket === "plan") {
        // Recomputed from every active plan purchase, this one included.
        await syncPlanAllowanceWithin(session, purchase.userId, reason, `activate:${purchaseId}`);
      } else {
        await grantCreditsWithin(
          session,
          purchase.userId,
          "topup",
          purchase.creditsGranted,
          reason,
          `activate:${purchaseId}`
        );
      }
    }

    return true;
  });
}

/** Re-issues the plan allowance for a new billing period. */
export async function refreshPlanAllowance(
  userId: string,
  reason: string,
  idempotencyKey?: string
): Promise<void> {
  await withTransaction((session) =>
    syncPlanAllowanceWithin(session, userId, reason, idempotencyKey)
  );
}

/**
 * Moves a purchase to a new status, optionally refusing to overwrite terminal
 * ones. Mirrors the SQLite `setStatus(..., notIn)` guard: a late
 * `payment.processing` must not drag an already-active purchase backwards.
 */
export async function setPurchaseStatus(
  purchaseId: string,
  status: PurchaseStatus,
  notIn: PurchaseStatus[] = []
): Promise<void> {
  const c = await getCollections();
  await c.purchases.updateOne(
    { _id: purchaseId, ...(notIn.length ? { status: { $nin: notIn } } : {}) },
    { $set: { status, updatedAt: new Date() } }
  );
}

/** Records Dodo's own ids on the purchase so later events can correlate. */
export async function linkDodoIds(
  purchaseId: string,
  ids: { paymentId?: string | null; subscriptionId?: string | null }
): Promise<void> {
  const set: Partial<PurchaseDoc> = {};
  if (ids.paymentId) set.dodoPaymentId = ids.paymentId;
  if (ids.subscriptionId) set.dodoSubscriptionId = ids.subscriptionId;
  if (Object.keys(set).length === 0) return;

  const c = await getCollections();
  await c.purchases.updateOne(
    { _id: purchaseId },
    { $set: { ...set, updatedAt: new Date() } }
  );
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Shape sent to the browser — camelCase, dates as ISO strings. */
export interface PurchaseView {
  id: string;
  productId: string;
  tierId: string;
  productName: string;
  billingModel: string;
  billingCycle: string;
  checkoutMode: string;
  amount: number;
  status: PurchaseStatus;
  creditsGranted: number;
  creditBucket: CreditBucket;
  dodoSubscriptionId: string | null;
  simulated: boolean;
  createdAt: string;
}

export function toPurchaseView(p: PurchaseDoc): PurchaseView {
  return {
    id: p._id,
    productId: p.productId,
    tierId: p.tierId,
    productName: p.productName,
    billingModel: p.billingModel,
    billingCycle: p.billingCycle,
    checkoutMode: p.checkoutMode,
    amount: p.amount,
    status: p.status,
    creditsGranted: p.creditsGranted,
    creditBucket: p.creditBucket,
    dodoSubscriptionId: p.dodoSubscriptionId,
    simulated: p.simulated,
    createdAt: p.createdAt.toISOString(),
  };
}

/**
 * Writes off this customer's own abandoned checkouts.
 *
 * The SQLite version deleted *every* user's pending rows on any dashboard
 * load, and hard-deleted them rather than recording that they lapsed. This
 * only touches the caller's, and marks them expired so the history survives.
 */
export async function expireStaleCheckouts(userId: string): Promise<void> {
  const c = await getCollections();
  await c.purchases.updateMany(
    {
      userId,
      status: { $in: ["pending", "processing"] },
      createdAt: { $lt: new Date(Date.now() - STALE_CHECKOUT_MS) },
    },
    { $set: { status: "expired", updatedAt: new Date() } }
  );
}

export async function listPurchases(userId: string): Promise<PurchaseView[]> {
  const c = await getCollections();
  const rows = await c.purchases.find({ userId }).sort({ createdAt: -1 }).toArray();
  return rows.map(toPurchaseView);
}

export async function getPurchase(
  userId: string,
  purchaseId: string
): Promise<PurchaseDoc | null> {
  const c = await getCollections();
  return c.purchases.findOne({ _id: purchaseId, userId });
}

/**
 * Locates the purchase a Dodo event refers to, trying the most reliable
 * correlation first.
 *
 * Sessions are the strongest link because we minted the id ourselves and Dodo
 * echoes it onto payment objects. Subscription ids only work once an earlier
 * event has taught us which purchase a subscription belongs to, and our own
 * metadata is the fallback for events that carry neither.
 */
export async function findPurchaseForEvent(
  data: Record<string, unknown> | undefined
): Promise<PurchaseDoc | null> {
  if (!data || typeof data !== "object") return null;
  const c = await getCollections();

  const sessionId = data.checkout_session_id;
  if (typeof sessionId === "string") {
    const bySession = await c.purchases.findOne({ dodoSessionId: sessionId });
    if (bySession) return bySession;
  }

  const subscriptionId = data.subscription_id;
  if (typeof subscriptionId === "string") {
    const bySubscription = await c.purchases.findOne({ dodoSubscriptionId: subscriptionId });
    if (bySubscription) return bySubscription;
  }

  const paymentId = data.payment_id;
  if (typeof paymentId === "string") {
    const byPayment = await c.purchases.findOne({ dodoPaymentId: paymentId });
    if (byPayment) return byPayment;
  }

  const metadata = data.metadata as { purchaseId?: unknown } | undefined;
  if (metadata && typeof metadata.purchaseId === "string") {
    const byMetadata = await c.purchases.findOne({ _id: metadata.purchaseId });
    if (byMetadata) return byMetadata;
  }

  return null;
}

/**
 * Repoints a purchase at a different catalog tier after a Dodo plan change.
 * The caller refreshes the plan allowance afterwards; recomputing it from the
 * updated rows is what makes an upgrade and a downgrade the same code path.
 */
export async function repointPurchaseTier(
  purchaseId: string,
  tier: {
    productId: string;
    tierId: string;
    productName: string;
    amount: number;
    creditsGranted: number;
    creditBucket: CreditBucket;
    dodoProductId: string;
  }
): Promise<void> {
  const c = await getCollections();
  await c.purchases.updateOne(
    { _id: purchaseId },
    { $set: { ...tier, updatedAt: new Date() } }
  );
}
