import { NextResponse } from "next/server";
import { fail, readJson, withIdentity } from "@/lib/http";
import { getPurchase } from "@/lib/services/purchases";
import { changePlan, SubscriptionError } from "@/lib/services/subscriptions";

interface ChangePlanBody {
  tierId: string;
  proration_billing_mode?: "prorated_immediately" | "full_immediately" | "difference_immediately" | "do_not_bill";
  effective_at?: "immediately" | "next_billing_date";
  on_payment_failure?: "prevent_change" | "apply_change";
  discount_codes?: string[];
  adaptive_currency_fees_inclusive?: boolean;
  quantity?: number;
}

// POST /api/billing/subscription/:purchaseId/change-plan
//
// Requests an upgrade or downgrade with configurable proration and timing.
// The tier only actually moves when subscription.plan_changed arrives — see
// services/webhook-handlers.ts — except in simulate mode, where no webhook is
// coming and the service applies it directly.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const { purchaseId } = await params;

  return withIdentity(async (identity) => {
    const body = await readJson<ChangePlanBody>(request);
    if (!body.tierId) return fail("A target tierId is required.", 400);

    const purchase = await getPurchase(identity.userId, purchaseId);

    try {
      return NextResponse.json(
        await changePlan(purchase, body.tierId, {
          proration_billing_mode: body.proration_billing_mode,
          effective_at: body.effective_at,
          on_payment_failure: body.on_payment_failure,
          discount_codes: body.discount_codes,
          adaptive_currency_fees_inclusive: body.adaptive_currency_fees_inclusive,
          quantity: body.quantity,
        })
      );
    } catch (err) {
      if (err instanceof SubscriptionError) return fail(err.message, err.status);
      throw err;
    }
  });
}
