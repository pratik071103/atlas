import { Router } from "express";
import { db } from "../db.js";
import { newId } from "../lib/auth.js";
import { verifyWebhookSignature } from "../lib/webhookVerify.js";

export const webhooksRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/webhooks/dodo
//
// This route is intentionally decoupled from checkout logic: Dodo Payments
// calls this endpoint directly, independent of any browser session. Because
// this reference project simulates purchases synchronously in
// routes/checkout.ts, this handler is not wired into a live Dodo account —
// but the shape here is the real one to build against. Point your Dodo
// webhook endpoint at POST /api/webhooks/dodo and set DODO_WEBHOOK_SECRET.
// ---------------------------------------------------------------------------

const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET ?? "";

webhooksRouter.post("/dodo", (req, res) => {
  const rawBody = (req as any).rawBody ?? JSON.stringify(req.body ?? {});

  const isValid = DODO_WEBHOOK_SECRET
    ? verifyWebhookSignature(rawBody, req.headers as any, DODO_WEBHOOK_SECRET)
    : true; // no secret configured yet in this demo — accept for local testing

  if (!isValid) {
    logEvent("signature_invalid", "rejected", rawBody);
    return res.status(401).json({ error: "Invalid webhook signature." });
  }

  const event = req.body ?? {};
  logEvent(event.type ?? "unknown", "received", rawBody);

  switch (event.type) {
    case "payment.succeeded":
      // TODO: mark the matching purchase as paid, grant entitlements/credits
      break;
    case "payment.failed":
      // TODO: mark the purchase failed, notify the customer
      break;
    case "subscription.plan_changed":
      // TODO: update the local subscription tier + proration state
      break;
    case "subscription.renewed":
      // TODO: extend the current billing period, top up recurring credits
      break;
    case "subscription.cancelled":
    case "subscription.expired":
      // TODO: move the subscription to a terminal state
      break;
    default:
      // Unrecognized event types are logged but not acted on.
      break;
  }

  res.json({ received: true });
});

function logEvent(eventType: string, status: string, payload: string) {
  db.prepare(
    `INSERT INTO webhook_events (id, event_type, status, payload) VALUES (?, ?, ?, ?)`
  ).run(newId("evt"), eventType, status, payload);
}
