import { Router } from "express";
import { db } from "../db.js";
import { requireIdentity, newId } from "../lib/auth.js";
import { CATALOG } from "../data/products.js";

export const checkoutRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/checkout/session
//
// This is the single place a real integration would call the Dodo Payments
// API (e.g. `dodo.checkoutSessions.create(...)`) and return a redirect /
// overlay / inline client secret. For this frontend-only reference, we skip
// the network call and simulate an instant successful purchase so the rest
// of the product (dashboard, credits, plan state) has something real to
// show. Swap the body of this handler for your Dodo client call — the
// request/response shape below is deliberately close to what that call
// would need and return.
// ---------------------------------------------------------------------------
checkoutRouter.post("/session", (req, res) => {
  const identity = requireIdentity(req, res);
  if (!identity) return;

  const { productId, tierId, billingCycle, mode } = req.body ?? {};
  const product = CATALOG.find((p) => p.id === productId);
  const tier = product?.tiers.find((t) => t.id === tierId);
  if (!product || !tier) {
    return res.status(400).json({ error: "Unknown product or tier." });
  }

  const amount = billingCycle === "yearly" ? tier.yearly : tier.monthly;

  // TODO: real integration — create the Dodo checkout session here instead:
  //   const session = await dodo.checkoutSessions.create({
  //     product_id, quantity: 1, customer: { email, name }, return_url,
  //   });
  //   return res.json({ checkoutUrl: session.checkout_url });

  const purchaseId = newId("pur");
  db.prepare(
    `INSERT INTO purchases
      (id, owner_id, owner_kind, product_id, tier_id, product_name, billing_model, billing_cycle, checkout_mode, amount, status, credits_granted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
  ).run(
    purchaseId,
    identity.ownerId,
    identity.ownerKind,
    product.id,
    tier.id,
    `${product.name} — ${tier.label}`,
    product.group,
    billingCycle ?? "monthly",
    mode ?? "redirect",
    amount,
    tier.credits ?? 0
  );

  if (tier.credits) {
    const prev = db
      .prepare(
        `SELECT COALESCE(SUM(delta), 0) as balance FROM credit_ledger WHERE owner_id = ? AND owner_kind = ?`
      )
      .get(identity.ownerId, identity.ownerKind) as any;
    const newBalance = (prev?.balance ?? 0) + tier.credits;
    db.prepare(
      `INSERT INTO credit_ledger (id, owner_id, owner_kind, delta, reason, balance_after)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      newId("ldg"),
      identity.ownerId,
      identity.ownerKind,
      tier.credits,
      `Purchase: ${product.name} (${tier.label})`,
      newBalance
    );
  }

  // Simulated "redirect" target — in a real integration this would be the
  // Dodo-hosted checkout URL (or the overlay/inline session token).
  res.status(201).json({
    purchaseId,
    simulated: true,
    checkoutMode: mode ?? "redirect",
    redirectUrl: `/dashboard?purchase=${purchaseId}`,
  });
});
