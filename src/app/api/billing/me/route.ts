import { NextResponse } from "next/server";
import { SIMULATE_PAYMENTS } from "@/lib/dodo";
import { withIdentity } from "@/lib/http";
import { expireStaleCheckouts, listPurchases } from "@/lib/services/purchases";
import { listUsageEvents } from "@/lib/services/usage";
import { getLedger, getWallet } from "@/lib/services/wallet";

// GET /api/billing/me — everything the dashboard and profile render from.
export async function GET() {
  return withIdentity(async (identity) => {
    await expireStaleCheckouts(identity.userId);

    const [wallet, purchases, ledger, usageEvents] = await Promise.all([
      getWallet(identity.userId),
      listPurchases(identity.userId),
      getLedger(identity.userId),
      listUsageEvents(identity.userId),
    ]);

    return NextResponse.json({
      // Lets the browser skip the Dodo ingest call it knows cannot land, and
      // label the event log honestly instead of showing a failure.
      simulated: SIMULATE_PAYMENTS,
      identity: {
        id: identity.userId,
        kind: identity.isAnonymous ? "guest" : "user",
        // Anonymous users hold a generated placeholder name/email
        // (temp-…@guest.atlas.local) — not something to show or return.
        name: identity.isAnonymous ? null : identity.name || null,
        email: identity.isAnonymous ? null : identity.email || null,
      },
      wallet,
      purchases,
      ledger,
      usageEvents,
    });
  });
}
