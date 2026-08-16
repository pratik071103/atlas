import "server-only";

import { creditBucketFor, findProduct, type Product } from "@shared/catalog";
import { getCollections, type PurchaseDoc } from "@/lib/db";
import { getDodoClient, SIMULATE_PAYMENTS } from "@/lib/dodo";
import { dodoProductIdFor } from "@/lib/dodo-catalog";
import {
  refreshPlanAllowance,
  repointPurchaseTier,
  setPurchaseStatus,
} from "./purchases";

// ---------------------------------------------------------------------------
// Subscription changes.
//
// The previous implementation was a local UPDATE with a TODO, and no
// subscription id was ever stored to cancel against. Both operations now go
// through the Dodo SDK, and — as everywhere else in the app — the local row is
// only the optimistic half: `subscription.plan_changed` and
// `subscription.cancelled` are what make it true.
// ---------------------------------------------------------------------------

export class SubscriptionError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "SubscriptionError";
  }
}

function assertChangeable(purchase: PurchaseDoc | null): asserts purchase is PurchaseDoc {
  if (!purchase) throw new SubscriptionError("Subscription not found.", 404);
  if (purchase.billingModel !== "subscription" && purchase.billingModel !== "seat_based") {
    throw new SubscriptionError("That purchase is not a subscription.", 400);
  }
  if (purchase.status !== "active" && purchase.status !== "scheduled_cancel") {
    throw new SubscriptionError("Only an active subscription can be changed.", 409);
  }
}

export interface ChangePlanOptions {
  proration_billing_mode?: "prorated_immediately" | "full_immediately" | "difference_immediately" | "do_not_bill";
  effective_at?: "immediately" | "next_billing_date";
  on_payment_failure?: "prevent_change" | "apply_change";
  discount_codes?: string[];
  adaptive_currency_fees_inclusive?: boolean;
  quantity?: number;
}

export interface ChangePlanResult {
  /** True when the new tier is already live (simulate mode only). */
  applied: boolean;
  pendingTierId: string;
  productName: string;
}

/**
 * Upgrades or downgrades a subscription.
 *
 * `prorated_immediately` is what makes an upgrade feel instant and a downgrade
 * fair: Dodo bills (or credits) the difference for the remainder of the current
 * period straight away rather than waiting for the next invoice.
 *
 * On success the purchase is only *marked* as changing. The webhook repoints
 * the tier and recomputes the plan allowance, so the credit maths happens in
 * exactly one place regardless of whether the change was requested here or
 * from the Dodo customer portal.
 */
export async function changePlan(
  purchase: PurchaseDoc | null,
  targetTierId: string,
  options: ChangePlanOptions = {}
): Promise<ChangePlanResult> {
  assertChangeable(purchase);

  const product = findProduct(purchase.productId) as Product | undefined;
  const target = product?.tiers.find((t) => t.id === targetTierId);
  if (!product || !target) throw new SubscriptionError("Unknown target plan.", 400);
  if (target.id === purchase.tierId) {
    throw new SubscriptionError("That is already the current plan.", 400);
  }

  // Dodo constraint: effective_at=next_billing_date only allows full_immediately proration
  if (options.effective_at === "next_billing_date" && options.proration_billing_mode !== "full_immediately") {
    throw new SubscriptionError(
      "Scheduled plan changes (next_billing_date) require proration mode 'full_immediately'.",
      400
    );
  }

  const c = await getCollections();
  const productName = `${product.name} — ${target.label}`;

  // ---- Simulated mode ------------------------------------------------------
  // No Dodo subscription exists to change, and no plan_changed webhook will
  // ever arrive — so apply locally through the same helpers the webhook uses.
  if (SIMULATE_PAYMENTS || !purchase.dodoSubscriptionId) {
    await repointPurchaseTier(purchase._id, {
      productId: product.id,
      tierId: target.id,
      productName,
      amount: purchase.billingCycle === "yearly" ? target.yearly : target.monthly,
      creditsGranted: target.credits ?? 0,
      creditBucket: creditBucketFor(product.group),
      dodoProductId: dodoProductIdFor(target.id),
    });
    await refreshPlanAllowance(purchase.userId, `Plan changed: ${productName}`);
    return { applied: true, pendingTierId: target.id, productName };
  }

  const dodoProductId = dodoProductIdFor(target.id);
  if (!dodoProductId) {
    throw new SubscriptionError(
      `No Dodo product id configured for tier "${target.id}" — set the DODO_PRODUCT_* env var.`,
      500
    );
  }

  try {
    // Build options object, omitting undefined values to avoid SDK issues
    const dodoOptions = {
      product_id: dodoProductId,
      proration_billing_mode: options.proration_billing_mode ?? "prorated_immediately",
      quantity: options.quantity ?? 1,
      ...(options.effective_at && { effective_at: options.effective_at }),
      ...(options.on_payment_failure && { on_payment_failure: options.on_payment_failure }),
      ...(options.discount_codes && options.discount_codes.length > 0 && { discount_codes: options.discount_codes }),
      ...(typeof options.adaptive_currency_fees_inclusive === "boolean" && { adaptive_currency_fees_inclusive: options.adaptive_currency_fees_inclusive }),
    };

    await getDodoClient().subscriptions.changePlan(purchase.dodoSubscriptionId, dodoOptions);
  } catch (err) {
    console.error("[subscriptions] Dodo change-plan failed:", err);
    // Log the actual error for debugging
    if (err instanceof Error) {
      console.error("[subscriptions] Error details:", err.message, err.stack);
    }
    throw new SubscriptionError("Could not change the plan with Dodo Payments.", 502);
  }

  await c.purchases.updateOne(
    { _id: purchase._id },
    { $set: { pendingTierId: target.id, updatedAt: new Date() } }
  );

  return { applied: false, pendingTierId: target.id, productName };
}

/**
 * Cancels a subscription.
 *   schedule  → keeps access until the period ends, then does not renew
 *   immediate → ends access now
 *
 * The authoritative status change still arrives on subscription.cancelled;
 * this reflects the request locally so the UI responds instantly.
 */
export async function cancelSubscription(
  purchase: PurchaseDoc | null,
  mode: "immediate" | "schedule"
): Promise<{ status: "cancelled" | "scheduled_cancel" }> {
  assertChangeable(purchase);

  if (!SIMULATE_PAYMENTS && purchase.dodoSubscriptionId) {
    try {
      await getDodoClient().subscriptions.update(
        purchase.dodoSubscriptionId,
        mode === "immediate"
          ? { status: "cancelled" }
          : { cancel_at_next_billing_date: true }
      );
    } catch (err) {
      console.error("[subscriptions] Dodo cancel failed:", err);
      throw new SubscriptionError(
        "Could not cancel the subscription with Dodo Payments.",
        502
      );
    }
  }

  const status = mode === "immediate" ? "cancelled" : "scheduled_cancel";
  await setPurchaseStatus(purchase._id, status);

  // An immediate cancellation drops this purchase out of the active set, so
  // the plan allowance has to come back down with it. A scheduled one does
  // not — the customer keeps their credits until the period actually ends.
  if (mode === "immediate") {
    await refreshPlanAllowance(purchase.userId, `Cancelled: ${purchase.productName}`);
  }

  return { status };
}
