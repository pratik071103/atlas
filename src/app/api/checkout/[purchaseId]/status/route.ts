import { NextResponse } from "next/server";
import { fail, withIdentity } from "@/lib/http";
import { getPurchase } from "@/lib/services/purchases";

// GET /api/checkout/:purchaseId/status
//
// Polled by the "Verifying payment…" overlay after a checkout returns. The
// status it reports is advanced exclusively by Dodo webhooks — payment.succeeded
// → active, payment.failed → failed, payment.cancelled → cancelled — so the
// browser never has to take the checkout page's word for it.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  const { purchaseId } = await params;

  return withIdentity(async (identity) => {
    const purchase = await getPurchase(identity.userId, purchaseId);
    if (!purchase) return fail("Purchase not found.", 404);

    return NextResponse.json({
      purchaseId: purchase._id,
      status: purchase.status,
      productName: purchase.productName,
      amount: purchase.amount,
      credits: purchase.creditsGranted,
      creditBucket: purchase.creditBucket,
      simulated: purchase.simulated,
    });
  });
}
