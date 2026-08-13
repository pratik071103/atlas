import "server-only";

import type { ClientSession } from "mongodb";
import {
  getCollections,
  newId,
  withTransaction,
  type CreditBucket,
  type LedgerDoc,
  type WalletDoc,
} from "@/lib/db";

// ---------------------------------------------------------------------------
// Two-bucket credit wallet + append-only ledger.
//
// The SQLite build had one balance, derived as SUM(delta) over the ledger on
// every read. That cannot express the thing this demo is about: a plan
// allowance that resets each billing cycle sitting alongside prepaid top-ups
// that never expire. So the wallet is now a materialised document with two
// counters, and the ledger is the audit trail behind it rather than the
// source of truth.
//
// Spending always drains `plan` first — plan credits are the ones with an
// expiry date, so using them before top-ups is what a customer would want.
//
// Every mutation is transactional so the counters and the ledger rows
// explaining them commit together, exactly as db.transaction() gave the
// SQLite version. Each operation comes in two flavours:
//
//   grantCredits(...)             opens its own transaction
//   grantCreditsWithin(session,…) joins a caller's transaction
//
// The second exists because activating a purchase has to move the purchase
// row and the wallet as one unit; nesting withTransaction would silently open
// a second, independent session and lose that.
// ---------------------------------------------------------------------------

export class InsufficientCreditsError extends Error {
  constructor(
    readonly required: number,
    readonly available: number
  ) {
    super(`Not enough credits: ${required} needed, ${available} available.`);
    this.name = "InsufficientCreditsError";
  }
}

export interface WalletBalance {
  plan: number;
  topup: number;
  total: number;
}

export interface SpendResult extends WalletBalance {
  spentFromPlan: number;
  spentFromTopup: number;
}

const EMPTY: WalletBalance = { plan: 0, topup: 0, total: 0 };

function toBalance(wallet: Pick<WalletDoc, "plan" | "topup">): WalletBalance {
  return { plan: wallet.plan, topup: wallet.topup, total: wallet.plan + wallet.topup };
}

function sessionOpts(session: ClientSession | undefined) {
  return session ? { session } : {};
}

/**
 * Loads the wallet, creating it on first touch. Upserting rather than
 * inserting keeps concurrent first-writes from racing against the unique
 * index on wallets.userId.
 */
async function loadForUpdate(
  userId: string,
  session: ClientSession | undefined
): Promise<WalletDoc> {
  const c = await getCollections();
  const opts = sessionOpts(session);

  const existing = await c.wallets.findOne({ userId }, opts);
  if (existing) return existing;

  const fresh: WalletDoc = {
    _id: newId("wal"),
    userId,
    plan: 0,
    topup: 0,
    updatedAt: new Date(),
  };
  await c.wallets.updateOne({ userId }, { $setOnInsert: fresh }, { ...opts, upsert: true });
  return (await c.wallets.findOne({ userId }, opts)) ?? fresh;
}

async function appendLedger(
  entry: Omit<LedgerDoc, "_id" | "createdAt">,
  session: ClientSession | undefined
): Promise<void> {
  const c = await getCollections();
  await c.creditLedger.insertOne(
    { _id: newId("ldg"), createdAt: new Date(), ...entry },
    sessionOpts(session)
  );
}

/**
 * True when this movement has already been applied.
 *
 * Dodo re-delivers webhooks, so `payment.succeeded` for one purchase can
 * arrive several times. Callers pass a key derived from the event
 * (`activate:<purchaseId>`, `renew:<subscriptionId>:<periodEnd>`) and the
 * second delivery becomes a no-op instead of a second grant. The unique sparse
 * index on creditLedger.idempotencyKey is the backstop; this check exists so
 * the duplicate does not abort the surrounding transaction.
 */
async function alreadyApplied(
  idempotencyKey: string | undefined,
  session: ClientSession | undefined
): Promise<boolean> {
  if (!idempotencyKey) return false;
  const c = await getCollections();
  const hit = await c.creditLedger.findOne({ idempotencyKey }, sessionOpts(session));
  return hit !== null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Reads a wallet without creating one — an untouched user simply has zero. */
export async function getWallet(userId: string): Promise<WalletBalance> {
  const c = await getCollections();
  const wallet = await c.wallets.findOne({ userId });
  return wallet ? toBalance(wallet) : EMPTY;
}

export interface LedgerEntry {
  id: string;
  bucket: CreditBucket;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
}

export async function getLedger(userId: string, limit = 25): Promise<LedgerEntry[]> {
  const c = await getCollections();
  const rows = await c.creditLedger
    .find({ userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .toArray();

  return rows.map((r) => ({
    id: r._id,
    bucket: r.bucket,
    delta: r.delta,
    reason: r.reason,
    balanceAfter: r.balanceAfter,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Adds (or, with a negative delta, claws back) credits in one bucket.
 * Balances are clamped at zero: a refund for more credits than the customer
 * still holds takes what is left rather than pushing them negative.
 */
export async function grantCreditsWithin(
  session: ClientSession | undefined,
  userId: string,
  bucket: CreditBucket,
  delta: number,
  reason: string,
  idempotencyKey?: string
): Promise<WalletBalance> {
  const c = await getCollections();
  const opts = sessionOpts(session);

  if (!Number.isFinite(delta) || delta === 0) {
    const current = await c.wallets.findOne({ userId }, opts);
    return current ? toBalance(current) : EMPTY;
  }

  if (await alreadyApplied(idempotencyKey, session)) {
    const current = await c.wallets.findOne({ userId }, opts);
    return current ? toBalance(current) : EMPTY;
  }

  const wallet = await loadForUpdate(userId, session);
  const before = wallet[bucket];
  const after = Math.max(0, before + Math.round(delta));
  const effective = after - before;

  await c.wallets.updateOne({ userId }, { $set: { [bucket]: after, updatedAt: new Date() } }, opts);

  if (effective !== 0) {
    await appendLedger(
      { userId, bucket, delta: effective, reason, balanceAfter: after, idempotencyKey },
      session
    );
  }

  return toBalance({ ...wallet, [bucket]: after });
}

export function grantCredits(
  userId: string,
  bucket: CreditBucket,
  delta: number,
  reason: string,
  idempotencyKey?: string
): Promise<WalletBalance> {
  return withTransaction((session) =>
    grantCreditsWithin(session, userId, bucket, delta, reason, idempotencyKey)
  );
}

/**
 * Sets the plan bucket to an absolute figure.
 *
 * Plan credits are an allowance, not a running total: at renewal the new
 * cycle's allowance replaces whatever was left of the last one. The ledger
 * still records the movement as a delta, so the history reads correctly
 * whichever way the reset went (+55 topped up, −12 clawed back).
 */
export async function setPlanBalanceWithin(
  session: ClientSession | undefined,
  userId: string,
  target: number,
  reason: string,
  idempotencyKey?: string
): Promise<WalletBalance> {
  const c = await getCollections();
  const opts = sessionOpts(session);
  const next = Math.max(0, Math.round(target));

  if (await alreadyApplied(idempotencyKey, session)) {
    const current = await c.wallets.findOne({ userId }, opts);
    return current ? toBalance(current) : EMPTY;
  }

  const wallet = await loadForUpdate(userId, session);
  const delta = next - wallet.plan;

  await c.wallets.updateOne({ userId }, { $set: { plan: next, updatedAt: new Date() } }, opts);

  if (delta !== 0) {
    await appendLedger(
      { userId, bucket: "plan", delta, reason, balanceAfter: next, idempotencyKey },
      session
    );
  }

  return toBalance({ ...wallet, plan: next });
}

/**
 * Spends credits, draining the plan bucket before touching top-ups.
 * Throws InsufficientCreditsError rather than partially spending.
 */
export async function spendCreditsWithin(
  session: ClientSession | undefined,
  userId: string,
  amount: number,
  reason: string
): Promise<SpendResult> {
  const cost = Math.round(amount);
  if (!Number.isFinite(cost) || cost <= 0) {
    throw new Error("Spend amount must be a positive number of credits.");
  }

  const c = await getCollections();
  const opts = sessionOpts(session);

  const wallet = await loadForUpdate(userId, session);
  const available = wallet.plan + wallet.topup;
  if (available < cost) throw new InsufficientCreditsError(cost, available);

  const spentFromPlan = Math.min(wallet.plan, cost);
  const spentFromTopup = cost - spentFromPlan;
  const plan = wallet.plan - spentFromPlan;
  const topup = wallet.topup - spentFromTopup;

  await c.wallets.updateOne({ userId }, { $set: { plan, topup, updatedAt: new Date() } }, opts);

  if (spentFromPlan > 0) {
    await appendLedger(
      { userId, bucket: "plan", delta: -spentFromPlan, reason, balanceAfter: plan },
      session
    );
  }
  if (spentFromTopup > 0) {
    await appendLedger(
      { userId, bucket: "topup", delta: -spentFromTopup, reason, balanceAfter: topup },
      session
    );
  }

  return { plan, topup, total: plan + topup, spentFromPlan, spentFromTopup };
}
