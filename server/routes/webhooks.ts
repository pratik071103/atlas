import { Router } from "express";
import { db } from "../db.js";
import { newId } from "../lib/auth.js";
import { getDodoClient } from "../lib/dodo.js";

export const webhooksRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/webhooks/dodo
//
// Dodo Payments calls this endpoint directly, independent of any browser
// session. The handler:
//   1. Verifies the signature with Dodo's own SDK verifier
//      (client.webhooks.unwrap — the reference implementation for the
//      Standard Webhooks spec, handles the exact secret format + header
//      parsing + 5-minute timestamp tolerance).
//   2. Dedupes replays via the unique `webhook-id` header.
//   3. Advances the matching purchase row through its payment lifecycle:
//        payment.processing → 'processing'
//        payment.succeeded  → 'active'  (+ credits granted, exactly once)
//        payment.failed     → 'failed'
//        payment.cancelled  → 'cancelled'
//
// The frontend learns about these transitions by polling
// GET /api/checkout/:purchaseId/status — the return_url redirect lands on
// /dashboard?checkout=<purchaseId>, where the polling + result banner lives.
// ---------------------------------------------------------------------------

const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET ?? "";
const PAYMENT_EVENT_TYPES = [
  "payment.processing",
  "payment.succeeded",
  "payment.failed",
  "payment.cancelled",
] as const;

type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];

webhooksRouter.post("/dodo", (req, res) => {
  const headers = req.headers as any;
  const rawBody = (req as any).rawBody ?? JSON.stringify(req.body ?? {});
  const eventId = headers["webhook-id"] ?? "";

  // Reply 200 to replays we've already processed without re-applying side effects.
  if (eventId && isReplay(eventId)) {
    return res.json({ received: true, replay: true });
  }

  if (DODO_WEBHOOK_SECRET) {
    try {
      getDodoClient().webhooks.unwrap(rawBody, {
        headers: {
          "webhook-id": headers["webhook-id"],
          "webhook-timestamp": headers["webhook-timestamp"],
          "webhook-signature": headers["webhook-signature"],
        },
      });
    } catch (err) {
      console.warn("[webhook] signature verification failed:", (err as Error).message);
      logEvent("signature_invalid", "rejected", rawBody, eventId);
      return res.status(401).json({ error: "Invalid webhook signature." });
    }
  }
  // Without a configured secret (fresh clone, demo only) accept for local testing.

  const event = JSON.parse(rawBody);
  const eventType = String(event.type ?? "unknown");
  logEvent(eventType, "received", rawBody, eventId);
  console.log(
    `[webhook] ${eventType} · id ${eventId || "n/a"} · payment ${event.data?.payment_id || "n/a"}`
  );

  if (PAYMENT_EVENT_TYPES.includes(eventType as PaymentEventType)) {
    handlePaymentEvent(eventType as PaymentEventType, event.data ?? {});
  }

  res.json({ received: true });
});

// ---------------------------------------------------------------------------
// Dev/diagnostic — GET /api/webhooks/events
//
// Returns the most recent webhooks this server received (verified or not),
// newest first. Handy while developing: point ngrok/tunnel at the server,
// reload this page, and watch events arrive as you buy. There is no auth on
// this endpoint on purpose — it exists for local debugging only.
// ---------------------------------------------------------------------------

webhooksRouter.get("/events", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, event_type, status, event_id, payload, created_at
       FROM webhook_events ORDER BY created_at DESC, rowid DESC LIMIT 50`
    )
    .all() as any[];

  res.json({
    events: rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      status: r.status,
      eventId: r.event_id,
      createdAt: r.created_at,
      payloadPreview: r.payload.slice(0, 400),
    })),
  });
});

// ---------------------------------------------------------------------------
// Payment event handling
// ---------------------------------------------------------------------------

function handlePaymentEvent(type: PaymentEventType, data: any) {
  const purchase = findPurchase(data);
  if (!purchase) {
    // The checkout session may have been created before this server had the
    // product mapping — log and move on; the status endpoint stays 'pending'
    // and the frontend overlay times out gracefully.
    console.warn(`[webhook] ${type} — no matching purchase for payload:`, JSON.stringify(data).slice(0, 300));
    return;
  }

  if (data.payment_id) {
    db.prepare(`UPDATE purchases SET dodo_payment_id = ? WHERE id = ?`).run(data.payment_id, purchase.id);
  }

  switch (type) {
    case "payment.processing":
      db.prepare(`UPDATE purchases SET status = 'processing' WHERE id = ? AND status NOT IN ('active','failed','cancelled')`).run(purchase.id);
      break;

    case "payment.succeeded": {
      // Idempotency guard: only transition + grant credits for a purchase that
      // hasn't already reached a terminal success state. Dodo may re-deliver.
      const row = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(purchase.id) as any;
      if (!row || row.status === "active") break;
      db.prepare(`UPDATE purchases SET status = 'active' WHERE id = ?`).run(purchase.id);
      if (row.credits_granted > 0) {
        grantCredits(row.owner_id, row.owner_kind, row.credits_granted, `Purchase: ${row.product_name} (webhook)`);
      }
      break;
    }

    case "payment.failed":
      db.prepare(`UPDATE purchases SET status = 'failed' WHERE id = ? AND status != 'active'`).run(purchase.id);
      break;

    case "payment.cancelled":
      db.prepare(`UPDATE purchases SET status = 'cancelled' WHERE id = ? AND status NOT IN ('active','failed')`).run(purchase.id);
      break;
  }
}

// ---------------------------------------------------------------------------
// Correlation helpers
// ---------------------------------------------------------------------------

/** Locates the local purchase row a Dodo payment event refers to. */
function findPurchase(data: any): any {
  if (!data || typeof data !== "object") return null;

  // Preferred: Dodo attaches checkout_session_id to payment objects.
  const sessionId = data.checkout_session_id ?? data.session_id ?? data.checkoutSessionId;
  if (sessionId) {
    const bySession = db
      .prepare(`SELECT * FROM purchases WHERE dodo_session_id = ?`)
      .get(sessionId) as any;
    if (bySession) return bySession;
  }

  // Fallback: our own metadata echoed back on the payment object.
  const purchaseId = data.metadata?.purchaseId;
  if (purchaseId) {
    const byMeta = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(purchaseId) as any;
    if (byMeta) return byMeta;
  }

  return null;
}

function isReplay(eventId: string): boolean {
  const seen = db
    .prepare(`SELECT id FROM webhook_events WHERE event_id = ?`)
    .get(eventId) as any;
  return Boolean(seen);
}

function logEvent(eventType: string, status: string, payload: string, eventId?: string) {
  db.prepare(
    `INSERT INTO webhook_events (id, event_type, status, payload, event_id) VALUES (?, ?, ?, ?, ?)`
  ).run(newId("evt"), eventType, status, payload, eventId || null);
}

function grantCredits(ownerId: string, ownerKind: string, credits: number, reason: string) {
  const prev = db
    .prepare(
      `SELECT COALESCE(SUM(delta), 0) as balance FROM credit_ledger WHERE owner_id = ? AND owner_kind = ?`
    )
    .get(ownerId, ownerKind) as any;
  const newBalance = (prev?.balance ?? 0) + credits;
  db.prepare(
    `INSERT INTO credit_ledger (id, owner_id, owner_kind, delta, reason, balance_after)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(newId("ldg"), ownerId, ownerKind, credits, reason, newBalance);
}