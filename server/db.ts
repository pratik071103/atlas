import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Uses Node's built-in SQLite module (stable since Node 22.5+, no native
// compilation / build tools required) instead of a native npm package like
// better-sqlite3 — this avoids node-gyp/Visual Studio build failures on
// machines without C++ build tools installed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Deliberately outside server/data (which holds source files like
// products.ts) so the generated .db file never collides with source code.
const dataDir = path.join(__dirname, "..", ".dbdata");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "atlas.db"));
db.exec("PRAGMA journal_mode = WAL;");

// ---------------------------------------------------------------------------
// Schema
//
// This mirrors the shape you'd want for a real Dodo Payments integration:
// an identity table (users, extendable to a real auth provider like
// Better Auth), a session table for both signed-up users and guest
// checkouts, a purchases table that owns your local billing state, a credit
// ledger for usage-based consumption, and a webhook_events table so incoming
// Dodo events are auditable. See server/routes/webhooks.ts for where real
// signature verification and event handling would plug in.
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    is_guest INTEGER NOT NULL DEFAULT 0,
    guest_name TEXT,
    guest_email TEXT,
    guest_billing_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    owner_kind TEXT NOT NULL CHECK (owner_kind IN ('user', 'guest')),
    product_id TEXT NOT NULL,
    tier_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    billing_model TEXT NOT NULL,
    billing_cycle TEXT NOT NULL,
    checkout_mode TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    credits_granted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS credit_ledger (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    owner_kind TEXT NOT NULL CHECK (owner_kind IN ('user', 'guest')),
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
