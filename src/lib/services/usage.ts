import "server-only";

import type { PlaygroundAction } from "@shared/playground";
import {
  getCollections,
  newId,
  withTransaction,
  type CreditBucket,
  type IngestStatus,
  type UsageEventDoc,
} from "@/lib/db";
import { spendCreditsWithin, type WalletBalance } from "./wallet";

// ---------------------------------------------------------------------------
// Playground usage events.
//
// Each click does two independent things: it spends credits from the local
// wallet, and it reports a metered event to Dodo. They are deliberately not
// coupled — the wallet is this app's own accounting, while Dodo's meter is
// what actually bills a usage-based subscription — so a metering outage must
// not block the demo, and a failed ingest must not silently un-spend credits.
//
// The row written here is the join between the two: it records what was spent
// and, once the browser has called authClient.dodopayments.usage.ingest(),
// how that went. It starts life 'pending' for exactly that window.
// ---------------------------------------------------------------------------

const EVENT_LIMIT = 30;

export interface UsageEventView {
  id: string;
  eventName: string;
  label: string;
  credits: number;
  bucket: CreditBucket | null;
  ingestStatus: IngestStatus;
  ingestMessage: string | null;
  createdAt: string;
}

function toView(doc: UsageEventDoc): UsageEventView {
  return {
    id: doc._id,
    eventName: doc.eventName,
    label: doc.label,
    credits: doc.credits,
    bucket: doc.bucket,
    ingestStatus: doc.ingestStatus,
    ingestMessage: doc.ingestMessage,
    createdAt: doc.createdAt.toISOString(),
  };
}

export interface PlaygroundResult {
  wallet: WalletBalance;
  event: UsageEventView;
}

/**
 * Runs one playground action: spend, then log.
 *
 * Both happen in a single transaction so the event log can never claim credits
 * were spent that the wallet does not reflect. A zero-credit action (the
 * metered-only API call) skips the spend and just logs.
 *
 * Throws InsufficientCreditsError when the wallet cannot cover it, before
 * anything is written.
 */
export async function runPlaygroundAction(
  userId: string,
  action: PlaygroundAction,
  currentWallet: WalletBalance
): Promise<PlaygroundResult> {
  const c = await getCollections();

  return withTransaction(async (session) => {
    let wallet = currentWallet;
    let bucket: CreditBucket | null = null;

    if (action.credits > 0) {
      const spend = await spendCreditsWithin(session, userId, action.credits, action.label);
      wallet = { plan: spend.plan, topup: spend.topup, total: spend.total };
      // Report the bucket the credits actually came out of. A spend that
      // straddles both buckets is attributed to the plan, since that is the
      // one that drained first.
      bucket = spend.spentFromPlan > 0 ? "plan" : "topup";
    }

    const doc: UsageEventDoc = {
      _id: newId("use"),
      userId,
      eventName: action.eventName,
      label: action.label,
      credits: action.credits,
      bucket,
      ingestStatus: "pending",
      ingestMessage: null,
      createdAt: new Date(),
    };
    await c.usageEvents.insertOne(doc, session ? { session } : {});

    return { wallet, event: toView(doc) };
  });
}

/** Records how the browser's Dodo ingest call went. */
export async function markIngestResult(
  userId: string,
  eventId: string,
  status: IngestStatus,
  message: string | null
): Promise<UsageEventView | null> {
  const c = await getCollections();
  const updated = await c.usageEvents.findOneAndUpdate(
    { _id: eventId, userId },
    { $set: { ingestStatus: status, ingestMessage: message } },
    { returnDocument: "after" }
  );
  return updated ? toView(updated) : null;
}

export async function listUsageEvents(
  userId: string,
  limit = EVENT_LIMIT
): Promise<UsageEventView[]> {
  const c = await getCollections();
  const rows = await c.usageEvents
    .find({ userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .toArray();
  return rows.map(toView);
}
