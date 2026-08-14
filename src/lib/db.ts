import "server-only";

import crypto from "node:crypto";
import { MongoClient, type ClientSession, type Collection, type Db } from "mongodb";

// ---------------------------------------------------------------------------
// MongoDB access layer.
//
// Replaces the previous better-sqlite3 database. Two things drove the change:
//
//   * Better Auth's `mongodbAdapter` is schemaless, so the identity tables no
//     longer need a migration CLI run before the app can boot.
//   * The wallet grants/spends credits and the guest→account link moves five
//     collections at once. On SQLite those were `db.transaction(...)` wrappers;
//     here they are real multi-document transactions, which is why the plan
//     calls for an Atlas cluster (or any replica set) rather than a standalone
//     mongod.
//
// This module owns *only* connection, document types and indexes. Every query
// lives in src/lib/services/* — route handlers never touch a collection.
// ---------------------------------------------------------------------------

const FALLBACK_URI = "mongodb://127.0.0.1:27017/atlas_studio";
const DEFAULT_DB_NAME = "atlas_studio";

function resolveUri(): string {
  const uri = process.env.MONGODB_URI?.trim();
  if (uri) return uri;
  // Thrown lazily instead: `next build` prerenders pages without a database,
  // and betterAuth() needs a Db handle at module load. Failing here would make
  // an unconfigured clone unbuildable rather than merely unable to serve data.
  console.warn(
    "[db] MONGODB_URI is not set — falling back to " +
      `${FALLBACK_URI}. Set it in .env before using the app.`
  );
  return FALLBACK_URI;
}

/** Database name from the connection string's path, if it carries one. */
function resolveDbName(uri: string): string {
  try {
    const path = new URL(uri).pathname.replace(/^\//, "");
    return path || DEFAULT_DB_NAME;
  } catch {
    return DEFAULT_DB_NAME;
  }
}

// Next's dev server re-evaluates modules on every hot reload. Caching the
// client on globalThis keeps one connection pool instead of leaking a new one
// per edit.
const globalForMongo = globalThis as typeof globalThis & {
  __atlasMongoClient?: MongoClient;
  __atlasIndexBootstrap?: Promise<void>;
};

const uri = resolveUri();

export const mongoClient: MongoClient =
  globalForMongo.__atlasMongoClient ?? new MongoClient(uri);

if (process.env.NODE_ENV !== "production") {
  globalForMongo.__atlasMongoClient = mongoClient;
}

/** Handle used by Better Auth's mongodbAdapter — available synchronously. */
export const mongoDb: Db = mongoClient.db(resolveDbName(uri));

// ---------------------------------------------------------------------------
// Documents
//
// Better Auth owns `user`, `session`, `account` and `verification`; they are
// deliberately not typed here. What follows is the application's own state.
// `userId` is always a Better Auth user id — guests are anonymous users, so
// there is one identity model and no owner_kind split.
// ---------------------------------------------------------------------------

export type CreditBucket = "plan" | "topup";

export type PurchaseStatus =
  | "pending"
  | "processing"
  | "active"
  | "failed"
  | "cancelled"
  | "scheduled_cancel"
  | "expired"
  | "on_hold"
  | "refunded"
  | "disputed";

export interface PurchaseDoc {
  _id: string;
  userId: string;
  productId: string;
  tierId: string;
  productName: string;
  billingModel: string;
  billingCycle: "monthly" | "yearly";
  checkoutMode: "redirect" | "overlay" | "inline";
  amount: number;
  status: PurchaseStatus;
  /** Credits this purchase grants each time it activates or renews. */
  creditsGranted: number;
  /** Which wallet bucket those credits land in. */
  creditBucket: CreditBucket;
  /** Dodo product id the purchase was created against, for plan changes. */
  dodoProductId: string | null;
  /**
   * Tier an upgrade/downgrade was requested for but Dodo has not confirmed
   * yet. Set when the change-plan call succeeds, cleared by the
   * subscription.plan_changed webhook — which is what lets the UI say "moving
   * to Pro" instead of pretending it already happened.
   */
  pendingTierId?: string | null;
  dodoSessionId: string | null;
  dodoPaymentId: string | null;
  dodoSubscriptionId: string | null;
  simulated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Two-bucket credit wallet. `plan` credits are refreshed each billing cycle
 * and are spent first; `topup` credits are prepaid and never expire.
 */
export interface WalletDoc {
  _id: string;
  userId: string;
  plan: number;
  topup: number;
  updatedAt: Date;
}

/** Append-only credit movement. A wallet balance is the sum of its deltas. */
export interface LedgerDoc {
  _id: string;
  userId: string;
  bucket: CreditBucket;
  delta: number;
  reason: string;
  balanceAfter: number;
  /** Set by callers that must not double-apply (webhook re-delivery). */
  idempotencyKey?: string;
  createdAt: Date;
}

/**
 * How the Dodo usage ingest for an event went.
 *   pending    — spent locally, ingest not reported back yet
 *   ok         — accepted by Dodo
 *   simulated  — no API key configured, so nothing was sent
 *   failed     — Dodo rejected it (the credit spend still stands)
 */
export type IngestStatus = "pending" | "ok" | "simulated" | "failed";

/** Local mirror of a playground event, plus how its Dodo ingest went. */
export interface UsageEventDoc {
  _id: string;
  userId: string;
  eventName: string;
  label: string;
  credits: number;
  bucket: CreditBucket | null;
  ingestStatus: IngestStatus;
  ingestMessage: string | null;
  createdAt: Date;
}

export type LicenseStatus = "issued" | "active" | "expired" | "deactivated";

export interface LicenseDoc {
  _id: string;
  userId: string;
  key: string;
  productId: string;
  productName: string;
  status: LicenseStatus;
  /** Returned by Dodo's activate endpoint; needed to validate/deactivate. */
  instanceId: string | null;
  instanceName: string | null;
  /** True when the key was minted locally because no Dodo key was configured. */
  simulated: boolean;
  activatedAt: Date | null;
  lastValidatedAt: Date | null;
  createdAt: Date;
}

export interface WebhookEventDoc {
  _id: string;
  /** Dodo's delivery id — uniquely indexed, which is what dedupes replays. */
  eventId: string | null;
  eventType: string;
  status: string;
  payload: unknown;
  createdAt: Date;
}

export interface Collections {
  purchases: Collection<PurchaseDoc>;
  wallets: Collection<WalletDoc>;
  creditLedger: Collection<LedgerDoc>;
  usageEvents: Collection<UsageEventDoc>;
  licenses: Collection<LicenseDoc>;
  webhookEvents: Collection<WebhookEventDoc>;
}

const collections: Collections = {
  purchases: mongoDb.collection<PurchaseDoc>("purchases"),
  wallets: mongoDb.collection<WalletDoc>("wallets"),
  creditLedger: mongoDb.collection<LedgerDoc>("creditLedger"),
  usageEvents: mongoDb.collection<UsageEventDoc>("usageEvents"),
  licenses: mongoDb.collection<LicenseDoc>("licenses"),
  webhookEvents: mongoDb.collection<WebhookEventDoc>("webhookEvents"),
};

// ---------------------------------------------------------------------------
// Indexes
//
// createIndex is idempotent, so this runs once per process and is safe to
// re-run. It is awaited by getCollections() rather than fired at import time,
// so a build with no reachable database still succeeds.
// ---------------------------------------------------------------------------

async function bootstrapIndexes(): Promise<void> {
  await Promise.all([
    collections.purchases.createIndex({ userId: 1, createdAt: -1 }),
    collections.purchases.createIndex({ dodoSessionId: 1 }, { sparse: true }),
    collections.purchases.createIndex({ dodoSubscriptionId: 1 }, { sparse: true }),
    collections.purchases.createIndex({ dodoPaymentId: 1 }, { sparse: true }),

    collections.wallets.createIndex({ userId: 1 }, { unique: true }),

    collections.creditLedger.createIndex({ userId: 1, createdAt: -1 }),
    // Lets a webhook re-delivery insert be rejected instead of double-granting.
    collections.creditLedger.createIndex(
      { idempotencyKey: 1 },
      { unique: true, sparse: true }
    ),

    collections.usageEvents.createIndex({ userId: 1, createdAt: -1 }),

    collections.licenses.createIndex({ userId: 1, createdAt: -1 }),
    collections.licenses.createIndex({ key: 1 }, { unique: true }),

    // Replay dedupe: Dodo re-delivers, the second audit insert is rejected.
    collections.webhookEvents.createIndex({ eventId: 1 }, { unique: true, sparse: true }),
    collections.webhookEvents.createIndex({ createdAt: -1 }),
  ]);
}

function indexBootstrap(): Promise<void> {
  if (!globalForMongo.__atlasIndexBootstrap) {
    globalForMongo.__atlasIndexBootstrap = bootstrapIndexes().catch((err) => {
      // Let the next call retry rather than caching a rejected promise —
      // otherwise a database that was briefly unreachable at boot would stay
      // index-less for the life of the process.
      globalForMongo.__atlasIndexBootstrap = undefined;
      throw err;
    });
  }
  return globalForMongo.__atlasIndexBootstrap;
}

/** The app's collections, with indexes guaranteed to exist. */
export async function getCollections(): Promise<Collections> {
  await indexBootstrap();
  return collections;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/** Mongo's error label for "this deployment has no transaction support". */
function isUnsupportedTransaction(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("Transaction numbers are only allowed on a replica set") ||
    message.includes("Transactions are not supported") ||
    message.includes("replica set member or mongos")
  );
}

let warnedNoTransactions = false;

/**
 * Runs `fn` inside a transaction, retrying on transient commit errors.
 *
 * A standalone mongod cannot start one. Rather than failing the whole demo,
 * the callback is re-run without a session and a warning is logged once —
 * the write still lands, it just is not atomic. Point MONGODB_URI at a replica
 * set (Atlas does this by default) to get the real guarantee.
 */
export async function withTransaction<T>(
  fn: (session: ClientSession | undefined) => Promise<T>
): Promise<T> {
  const session = mongoClient.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } catch (err) {
    if (!isUnsupportedTransaction(err)) throw err;
    if (!warnedNoTransactions) {
      warnedNoTransactions = true;
      console.warn(
        "[db] this MongoDB deployment does not support transactions — " +
          "multi-document writes will not be atomic. Use a replica set (Atlas) for the real behaviour."
      );
    }
    return fn(undefined);
  } finally {
    await session.endSession();
  }
}

// ---------------------------------------------------------------------------
// Ids
//
// Prefixed, readable ids (pur_…, ldg_…) rather than ObjectIds, so a document
// says what it is when it shows up in a webhook payload or the event log.
// ---------------------------------------------------------------------------

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}
