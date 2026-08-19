import "server-only";

import { CATALOG, creditBucketFor, type PriceTier, type Product } from "@shared/catalog";
import { getCollections, newId, type PurchaseDoc } from "@/lib/db";
import { recordIssuedLicense } from "./licenses";
import {
  activatePurchase,
  findPurchaseForEvent,
  linkDodoIds,
  refreshPlanAllowance,
  repointPurchaseTier,
  setPurchaseStatus,
} from "./purchases";
import { grantCredits } from "./wallet";

// ---------------------------------------------------------------------------
// Dodo webhook event handling.
//
// The endpoint itself is mounted by the adapter's webhooks() plugin at
// POST /api/auth/dodopayments/webhooks — signature verification, header
// parsing and timestamp tolerance all happen there. This module only supplies
// the business logic for each typed event.
//
// The pre-adapter version was a hand-rolled switch over four `payment.*`
// strings; the adapter exposes ~45 typed handlers, so renewals, plan changes,
// cancellations, refunds and disputes now reach the app instead of being
// silently ignored.
// ---------------------------------------------------------------------------

/**
 * A supertype of every payload the adapter hands out.
 *
 * The adapter's handlers are typed per event (~45 discriminated shapes). This
 * module only ever reaches for the correlation ids, so widening once here
 * keeps each handler from having to name its own payload type — `timestamp`
 * is a Date on the typed payloads, hence the union.
 */
export interface WebhookPayload {
  type?: string;
  timestamp?: string | Date;
  data?: Record<string, unknown>;
}

/**
 * A key that is stable across re-deliveries of the same event but different
 * between distinct events.
 *
 * The SQLite version keyed the audit log on `data.payment_id` alone, which
 * (with a unique index on it) meant only the *first* event for a payment was
 * ever recorded — payment.succeeded would be dropped if payment.processing had
 * already logged. Folding in the type and Dodo's own timestamp fixes that
 * while keeping true replays deduped.
 */
function deliveryKey(payload: WebhookPayload): string | null {
  const data = payload.data ?? {};
  const subject =
    (typeof data.payment_id === "string" && data.payment_id) ||
    (typeof data.subscription_id === "string" && data.subscription_id) ||
    (typeof data.refund_id === "string" && data.refund_id) ||
    (typeof data.dispute_id === "string" && data.dispute_id) ||
    (typeof data.license_key_id === "string" && data.license_key_id) ||
    null;

  if (!subject || !payload.type) return null;
  const at =
    payload.timestamp instanceof Date
      ? payload.timestamp.toISOString()
      : (payload.timestamp ?? "");
  return `${payload.type}:${subject}:${at}`;
}

async function logEvent(payload: WebhookPayload, status: string): Promise<void> {
  try {
    const c = await getCollections();
    await c.webhookEvents.insertOne({
      _id: newId("evt"),
      eventId: deliveryKey(payload),
      eventType: String(payload.type ?? "unknown"),
      status,
      payload,
      createdAt: new Date(),
    });
  } catch {
    // A duplicate eventId means Dodo re-delivered. The unique index rejects
    // the second audit row, which is exactly the dedupe behaviour we want.
  }
}

/** Resolves the purchase for an event, warning when nothing matches. */
async function resolve(type: string, payload: WebhookPayload): Promise<PurchaseDoc | null> {
  const data = payload.data ?? {};
  const purchase = await findPurchaseForEvent(data);

  if (!purchase) {
    console.warn(
      `[webhook] ${type} — no matching purchase for:`,
      JSON.stringify(data).slice(0, 300)
    );
    return null;
  }

  await linkDodoIds(purchase._id, {
    paymentId: typeof data.payment_id === "string" ? data.payment_id : null,
    subscriptionId: typeof data.subscription_id === "string" ? data.subscription_id : null,
  });
  return purchase;
}

/** Finds the catalog tier a Dodo product id belongs to. */
function tierByDodoProductId(
  productId: unknown
): { product: Product; tier: PriceTier } | null {
  if (typeof productId !== "string") return null;
  for (const product of CATALOG) {
    const tier = product.tiers.find((t) => t.dodoProductId === productId);
    if (tier) return { product, tier };
  }
  return null;
}

/**
 * Puts a purchase's credits back where they belong after its status moved.
 *
 * Plan credits are an allowance recomputed from every still-active plan
 * purchase, so a cancellation or refund simply drops out of the sum. Top-up
 * credits were handed over outright, so they have to be clawed back explicitly
 * — clamped at zero by the wallet, since the customer may already have spent
 * them.
 */
async function reverseCredits(purchase: PurchaseDoc, reason: string): Promise<void> {
  if (purchase.creditsGranted <= 0) return;

  if (purchase.creditBucket === "plan") {
    await refreshPlanAllowance(purchase.userId, reason);
  } else {
    await grantCredits(
      purchase.userId,
      "topup",
      -purchase.creditsGranted,
      reason,
      `reverse:${purchase._id}`
    );
  }
}

export const webhookHandlers = {
  // Audit every verified event; newest is visible on /dev/webhooks.
  onPayload: async (payload: WebhookPayload) => {
    await logEvent(payload, "received");
    console.log(`[webhook] ${payload?.type ?? "unknown"}`);
  },

  // ---- Payment lifecycle --------------------------------------------------
  onPaymentProcessing: async (payload: WebhookPayload) => {
    const p = await resolve("payment.processing", payload);
    if (p) await setPurchaseStatus(p._id, "processing", ["active", "failed", "cancelled"]);
  },

  onPaymentSucceeded: async (payload: WebhookPayload) => {
    const p = await resolve("payment.succeeded", payload);
    if (p) await activatePurchase(p._id, `Purchase: ${p.productName}`);
  },

  onPaymentFailed: async (payload: WebhookPayload) => {
    const p = await resolve("payment.failed", payload);
    if (p) await setPurchaseStatus(p._id, "failed", ["active"]);
  },

  onPaymentCancelled: async (payload: WebhookPayload) => {
    const p = await resolve("payment.cancelled", payload);
    if (p) await setPurchaseStatus(p._id, "cancelled", ["active", "failed"]);
  },

  // ---- Subscription lifecycle ---------------------------------------------
  onSubscriptionActive: async (payload: WebhookPayload) => {
    const p = await resolve("subscription.active", payload);
    if (!p) return;
    await activatePurchase(p._id, `Subscription active: ${p.productName}`);

    // Seat-based: create the team workspace and generate N invite link slots.
    if (p.billingModel === "seat_based") {
      const { createTeam, generateInviteLinks, getTeamByOwner } = await import("./teams");
      const existing = await getTeamByOwner(p.userId);
      if (!existing) {
        const seatCount = Number(
          (payload.data?.metadata as Record<string, unknown> | undefined)?.seatCount ?? 1
        );
        const subId =
          typeof payload.data?.subscription_id === "string" ? payload.data.subscription_id : null;
        const team = await createTeam({
          ownerId: p.userId,
          purchaseId: p._id,
          dodoSubscriptionId: subId,
          seatCount,
          name: "My Workspace",
        });
        await generateInviteLinks(team._id, p.userId, seatCount);
      }
    }
  },

  onSubscriptionRenewed: async (payload: WebhookPayload) => {
    const p = await resolve("subscription.renewed", payload);
    if (!p) return;

    await setPurchaseStatus(p._id, "active");
    if (p.creditsGranted <= 0) return;

    const periodEnd = String(payload.data?.next_billing_date ?? payload.timestamp ?? "");
    const key = `renew:${p.dodoSubscriptionId ?? p._id}:${periodEnd}`;

    if (p.billingModel === "seat_based") {
      // Owner renewal: grant their total credits directly (excluded from plan-sum).
      await grantCredits(p.userId, "plan", p.creditsGranted, `Renewal: ${p.productName}`, key);

      // Also refresh every active member's wallet to 20 credits (one seat each).
      const { getTeamByOwner, refreshMemberCredits } = await import("./teams");
      const team = await getTeamByOwner(p.userId);
      if (team) {
        // creditsGranted = seatCount × 20, so per-seat = creditsGranted / seatCount.
        const creditsPerSeat = team.seatCount > 0
          ? Math.round(p.creditsGranted / team.seatCount)
          : 20;
        await refreshMemberCredits(team._id, creditsPerSeat, `${key}:members`);
      }
    } else if (p.creditBucket === "plan") {
      await refreshPlanAllowance(p.userId, `Renewal: ${p.productName}`, key);
    } else {
      await grantCredits(p.userId, "topup", p.creditsGranted, `Renewal: ${p.productName}`, key);
    }
  },

  /**
   * The authoritative half of an upgrade or downgrade. The API call that
   * requested it only reports the intent; this is where the purchase actually
   * becomes the new tier and the plan allowance is recomputed.
   */
  onSubscriptionPlanChanged: async (payload: WebhookPayload) => {
    const p = await resolve("subscription.plan_changed", payload);
    if (!p) return;

    const match = tierByDodoProductId(payload.data?.product_id);
    if (!match) {
      console.warn(
        `[webhook] plan_changed for purchase ${p._id} — product ${String(
          payload.data?.product_id
        )} is not in the catalog; leaving the tier as-is.`
      );
      return;
    }

    const { product, tier } = match;
    await repointPurchaseTier(p._id, {
      productId: product.id,
      tierId: tier.id,
      productName: `${product.name} — ${tier.label}`,
      amount: p.billingCycle === "yearly" ? tier.yearly : tier.monthly,
      creditsGranted: tier.credits ?? 0,
      creditBucket: creditBucketFor(product.group),
      dodoProductId: tier.dodoProductId,
    });
    await setPurchaseStatus(p._id, "active");
    await refreshPlanAllowance(p.userId, `Plan changed: ${product.name} — ${tier.label}`);

    // Seat-based: sync seat count, append extra invite links if seats increased.
    if (p.billingModel === "seat_based") {
      const addonItems = payload.data?.addons as Array<{ addon_id: string; quantity: number }> | undefined;
      const newQty = addonItems?.reduce((sum, a) => sum + (a.quantity ?? 0), 0) ?? 1;
      const { getTeamByOwner, updateSeatCount, generateInviteLinks } = await import("./teams");
      const team = await getTeamByOwner(p.userId);
      if (team) {
        const delta = newQty - team.seatCount;
        await updateSeatCount(team._id, newQty);
        if (delta > 0) await generateInviteLinks(team._id, p.userId, delta);
      }
    }
  },

  onSubscriptionCancelled: async (payload: WebhookPayload) => {
    const p = await resolve("subscription.cancelled", payload);
    if (!p) return;
    await setPurchaseStatus(p._id, "cancelled");
    await reverseCredits(p, `Cancelled: ${p.productName}`);

    // Seat-based: cancel the team and zero every member's wallet.
    if (p.billingModel === "seat_based") {
      const { getTeamByOwner, cancelTeam } = await import("./teams");
      const team = await getTeamByOwner(p.userId);
      if (team) await cancelTeam(team._id);
    }
  },

  onSubscriptionExpired: async (payload: WebhookPayload) => {
    const p = await resolve("subscription.expired", payload);
    if (!p) return;
    await setPurchaseStatus(p._id, "expired");
    await reverseCredits(p, `Expired: ${p.productName}`);
  },

  onSubscriptionOnHold: async (payload: WebhookPayload) => {
    const p = await resolve("subscription.on_hold", payload);
    if (p) await setPurchaseStatus(p._id, "on_hold");
  },

  onSubscriptionFailed: async (payload: WebhookPayload) => {
    const p = await resolve("subscription.failed", payload);
    if (p) await setPurchaseStatus(p._id, "failed", ["active"]);
  },

  // ---- Money moving back out ----------------------------------------------
  onRefundSucceeded: async (payload: WebhookPayload) => {
    const p = await resolve("refund.succeeded", payload);
    if (!p) return;
    await setPurchaseStatus(p._id, "refunded");
    await reverseCredits(p, `Refund: ${p.productName}`);
  },

  onDisputeOpened: async (payload: WebhookPayload) => {
    const p = await resolve("dispute.opened", payload);
    if (p) await setPurchaseStatus(p._id, "disputed");
  },

  onDisputeWon: async (payload: WebhookPayload) => {
    const p = await resolve("dispute.won", payload);
    if (p) await activatePurchase(p._id, `Dispute won: ${p.productName}`);
  },

  onDisputeLost: async (payload: WebhookPayload) => {
    const p = await resolve("dispute.lost", payload);
    if (!p) return;
    await setPurchaseStatus(p._id, "refunded");
    await reverseCredits(p, `Dispute lost: ${p.productName}`);
  },

  // ---- Entitlements --------------------------------------------------------
  /**
   * Dodo mints the Studio Pass key when the payment settles and delivers it
   * here. Storing it against the buyer is what lets /studio show them the key
   * to activate — they never have to go and find it in an email.
   *
   * The key is correlated to a customer through the purchase the payment or
   * subscription id belongs to, since Dodo's customer id is not this app's
   * user id.
   */
  onLicenseKeyCreated: async (payload: WebhookPayload) => {
    const data = payload.data ?? {};
    const key = typeof data.key === "string" ? data.key : null;
    if (!key) {
      console.warn("[webhook] license_key.created carried no key");
      return;
    }

    const purchase = await resolve("license_key.created", payload);
    if (!purchase) return;

    await recordIssuedLicense(purchase.userId, key, purchase.productName);
    console.log(`[webhook] license key stored for ${purchase.userId}`);
  },

  onEntitlementGrantDelivered: async (payload: WebhookPayload) => {
    console.log(`[webhook] entitlement delivered: ${String(payload.data?.id ?? "unknown")}`);
  },
};
