import { NextResponse } from "next/server";
import { fail, readJson, withIdentity } from "@/lib/http";
import { getPurchase } from "@/lib/services/purchases";
import { changePlan, SubscriptionError } from "@/lib/services/subscriptions";

// POST /api/billing/subscription/:purchaseId/change-plan
//
// Requests an upgrade or downgrade with prorated_immediately billing. The tier
// only actually moves when subscription.plan_changed arrives — see
// services/webhook-handlers.ts — except in simulate mode, where no webhook is
// coming and the service applies it directly.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const { purchaseId } = await params;

  return withIdentity(async (identity) => {
    const { tierId } = await readJson<{ tierId?: string }>(request);
    if (!tierId) return fail("A target tierId is required.", 400);

    const purchase = await getPurchase(identity.userId, purchaseId);

    try {
      return NextResponse.json(await changePlan(purchase, tierId));
    } catch (err) {
      if (err instanceof SubscriptionError) return fail(err.message, err.status);
      throw err;
    }
  });
}
