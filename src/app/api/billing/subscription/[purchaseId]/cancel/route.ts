import { NextResponse } from "next/server";
import { fail, readJson, withIdentity } from "@/lib/http";
import { getPurchase } from "@/lib/services/purchases";
import { cancelSubscription, SubscriptionError } from "@/lib/services/subscriptions";

// PATCH /api/billing/subscription/:purchaseId/cancel
//
// `schedule` sets cancel_at_next_billing_date so the customer keeps access
// until the period ends; `immediate` cancels outright. The authoritative status
// change still arrives via subscription.cancelled.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const { purchaseId } = await params;

  return withIdentity(async (identity) => {
    const { mode } = await readJson<{ mode?: string }>(request);
    if (mode !== "immediate" && mode !== "schedule") {
      return fail("mode must be 'immediate' or 'schedule'.", 400);
    }

    const purchase = await getPurchase(identity.userId, purchaseId);

    try {
      return NextResponse.json(await cancelSubscription(purchase, mode));
    } catch (err) {
      if (err instanceof SubscriptionError) return fail(err.message, err.status);
      throw err;
    }
  });
}
