import { Router } from "express";
import { db } from "../db.js";
import { requireIdentity, newId } from "../lib/auth.js";

export const billingRouter = Router();

function getBalance(ownerId: string, ownerKind: string) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(delta), 0) as balance FROM credit_ledger WHERE owner_id = ? AND owner_kind = ?`
    )
    .get(ownerId, ownerKind) as any;
  return row?.balance ?? 0;
}

billingRouter.get("/me", (req, res) => {
  const identity = requireIdentity(req, res);
  if (!identity) return;

  const purchases = db
    .prepare(
      `SELECT * FROM purchases WHERE owner_id = ? AND owner_kind = ? ORDER BY created_at DESC`
    )
    .all(identity.ownerId, identity.ownerKind);

  const ledger = db
    .prepare(
      `SELECT * FROM credit_ledger WHERE owner_id = ? AND owner_kind = ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(identity.ownerId, identity.ownerKind);

  res.json({
    identity: {
      name: identity.name,
      email: identity.email,
      kind: identity.ownerKind,
    },
    creditBalance: getBalance(identity.ownerId, identity.ownerKind),
    purchases,
    ledger,
  });
});

// Demo-only endpoint powering the "credit chatbot" widget on the dashboard.
// Lets the user debit/credit their own balance to see the KPI + ledger
// update live. A real usage-based integration would call this internally
// after each metered action (e.g. one image generation = -1 credit) and
// report usage to Dodo Payments for billing.
billingRouter.post("/credits/adjust", (req, res) => {
  const identity = requireIdentity(req, res);
  if (!identity) return;

  const { delta, reason } = req.body ?? {};
  const amount = Number(delta);
  if (!Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ error: "Provide a non-zero numeric delta." });
  }

  const balance = getBalance(identity.ownerId, identity.ownerKind);
  if (balance + amount < 0) {
    return res.status(400).json({ error: "Not enough credits for that." });
  }

  const newBalance = balance + amount;
  db.prepare(
    `INSERT INTO credit_ledger (id, owner_id, owner_kind, delta, reason, balance_after)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(newId("ldg"), identity.ownerId, identity.ownerKind, amount, reason || "Manual adjustment", newBalance);

  res.json({ creditBalance: newBalance });
});

// ---------------------------------------------------------------------------
// Subscription management actions below. In a real integration these would
// call the Dodo Payments API (e.g. `dodo.subscriptions.cancel(...)`,
// `dodo.customerPortal.create(...)`) — here they update local state only, so
// the dashboard has something real to reflect back.
// ---------------------------------------------------------------------------

billingRouter.patch("/subscription/:purchaseId/cancel", (req, res) => {
  const identity = requireIdentity(req, res);
  if (!identity) return;

  const { mode } = req.body ?? {}; // "immediate" | "schedule"
  if (mode !== "immediate" && mode !== "schedule") {
    return res.status(400).json({ error: "mode must be 'immediate' or 'schedule'." });
  }

  const purchase = db
    .prepare(`SELECT * FROM purchases WHERE id = ? AND owner_id = ? AND owner_kind = ?`)
    .get(req.params.purchaseId, identity.ownerId, identity.ownerKind) as any;
  if (!purchase) return res.status(404).json({ error: "Subscription not found." });

  // TODO: real integration — call dodo.subscriptions.cancel({ id, at_period_end: mode === "schedule" })
  const status = mode === "immediate" ? "canceled" : "scheduled_cancel";
  db.prepare(`UPDATE purchases SET status = ? WHERE id = ?`).run(status, purchase.id);

  res.json({ status });
});

billingRouter.post("/portal", (req, res) => {
  const identity = requireIdentity(req, res);
  if (!identity) return;
  // TODO: real integration — return the URL from dodo.customerPortal.create({ customer_id })
  res.json({
    url: "https://app.dodopayments.com/portal/demo-session",
    simulated: true,
  });
});

billingRouter.post("/payment-method", (req, res) => {
  const identity = requireIdentity(req, res);
  if (!identity) return;
  // TODO: real integration — return a Dodo-hosted payment method update link
  res.json({
    url: "https://app.dodopayments.com/portal/demo-session/payment-method",
    simulated: true,
  });
});
