import "server-only";

import { getCollections, newId, withTransaction } from "@/lib/db";

// ---------------------------------------------------------------------------
// Guest → account linking.
//
// Guests are anonymous Better Auth users, so "signing up" is a link, not a
// migration: the anonymous user's rows are moved onto the real account inside
// one transaction. This is the Mongo port of the SQLite `reassignOwner`, which
// only knew about two tables — it now covers all five app collections, and
// merges wallets rather than reassigning them.
//
// Wallets need merging because `onLinkAccount` also fires when a guest signs
// *in* to an account that already exists, and that account may already hold
// credits. Reassigning would hit the unique index on wallets.userId; summing
// the buckets is both correct and what a customer would expect.
// ---------------------------------------------------------------------------

export interface LinkResult {
  purchases: number;
  ledger: number;
  usageEvents: number;
  licenses: number;
  planCredits: number;
  topupCredits: number;
}

export async function reassignOwner(fromUserId: string, toUserId: string): Promise<LinkResult> {
  const c = await getCollections();

  return withTransaction(async (session) => {
    const opts = session ? { session } : {};

    const [purchases, ledger, usageEvents, licenses] = await Promise.all([
      c.purchases.updateMany({ userId: fromUserId }, { $set: { userId: toUserId } }, opts),
      c.creditLedger.updateMany({ userId: fromUserId }, { $set: { userId: toUserId } }, opts),
      c.usageEvents.updateMany({ userId: fromUserId }, { $set: { userId: toUserId } }, opts),
      c.licenses.updateMany({ userId: fromUserId }, { $set: { userId: toUserId } }, opts),
    ]);

    const guestWallet = await c.wallets.findOne({ userId: fromUserId }, opts);
    let planCredits = 0;
    let topupCredits = 0;

    if (guestWallet && (guestWallet.plan > 0 || guestWallet.topup > 0)) {
      planCredits = guestWallet.plan;
      topupCredits = guestWallet.topup;

      await c.wallets.updateOne(
        { userId: toUserId },
        {
          $inc: { plan: planCredits, topup: topupCredits },
          $set: { updatedAt: new Date() },
          $setOnInsert: { _id: newId("wal"), userId: toUserId },
        },
        { ...opts, upsert: true }
      );
    }

    if (guestWallet) {
      await c.wallets.deleteOne({ userId: fromUserId }, opts);
    }

    return {
      purchases: purchases.modifiedCount,
      ledger: ledger.modifiedCount,
      usageEvents: usageEvents.modifiedCount,
      licenses: licenses.modifiedCount,
      planCredits,
      topupCredits,
    };
  });
}
