import { NextResponse } from "next/server";
import { withIdentity } from "@/lib/http";
import { expireStaleCheckouts, listPurchases } from "@/lib/services/purchases";
import { getLedger, getWallet } from "@/lib/services/wallet";

// GET /api/billing/me — everything the dashboard and profile render from.
export async function GET() {
  return withIdentity(async (identity) => {
    await expireStaleCheckouts(identity.userId);

    const [wallet, purchases, ledger] = await Promise.all([
      getWallet(identity.userId),
      listPurchases(identity.userId),
      getLedger(identity.userId),
    ]);

    return NextResponse.json({
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
    });
  });
}
