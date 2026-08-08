import { Router } from "express";
import { db } from "../db.js";
import { requireIdentity, newId } from "../lib/auth.js";
import { getDodoClient, SIMULATE_PAYMENTS } from "../lib/dodo.js";
import { CATALOG, toMinorUnits } from "../data/products.js";

export const checkoutRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/checkout/session
//
// Creates a real Dodo Payments checkout session and returns the checkout URL
// (or simulated response when SIMULATE_PAYMENTS=1). The `mode` field only
// changes what the *frontend* does with `checkoutUrl`:
//   redirect  → window.location = checkoutUrl   (Dodo-hosted page)
//   overlay   → dodopayments-checkout SDK modal
//   inline    → dodopayments-checkout SDK embedded frame
//
// Payment state lives in the purchases table and is advanced by webhooks
// (routes/webhooks.ts) — never by this route alone.
// ---------------------------------------------------------------------------

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

checkoutRouter.post("/session", async (req, res) => {
  const identity = requireIdentity(req, res);
  if (!identity) return;

  const { productId, tierId, billingCycle, mode } = req.body ?? {};
  const product = CATALOG.find((p) => p.id === productId);
  const tier = product?.tiers.find((t) => t.id === tierId);
  if (!product || !tier) {
    return res.status(400).json({ error: "Unknown product or tier." });
  }

  const amount = billingCycle === "yearly" ? tier.yearly : tier.monthly;
  const purchaseId = newId("pur");

  // ---- Simulated mode -------------------------------------------------------
  // Used for local development without a Dodo account: instant success so the
  // rest of the app (dashboard, credits) still works offline.
  if (SIMULATE_PAYMENTS) {
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
      grantCredits(identity.ownerId, identity.ownerKind, tier.credits, `Purchase: ${product.name} (${tier.label})`);
    }

    return res.status(201).json({
      purchaseId,
      simulated: true,
      checkoutUrl: null,
      sessionId: null,
    });
  }

  // ---- Real mode -------------------------------------------------------------
  // Usage-based and on-demand products are metered: authorize the payment
  // method up front (mandate_only) with no initial charge; actual usage is
  // reported to Dodo and bills later.
  const onDemandGroups = ["usage_based", "on_demand"];

  let session;
  try {
    session = await getDodoClient().checkoutSessions.create({
      product_cart: [
        { product_id: tier.dodoProductId, quantity: onDemandGroups.includes(product.group) ? 0 : 1 },
      ],
      // Guest identities may have no email yet — let Dodo collect it in
      // checkout rather than inventing one.
      ...(identity.email ? { customer: { email: identity.email, name: identity.name || undefined } } : {}),
      billing_currency: "USD",
      return_url: `${CLIENT_ORIGIN}/dashboard?checkout=${purchaseId}`,
      cancel_url: `${CLIENT_ORIGIN}/pricing`,
      metadata: { purchaseId },
      customization: {
        theme: "light",
        theme_config: {
          light: {
            bg_primary: "#FFFFFF",
            text_primary: "#101828",
            button_primary: "#A6E500",
            button_primary_hover: "#8CC500",
            button_text_primary: "#0D0D0D",
          },
          radius: "8px",
        },
      },
      ...(onDemandGroups.includes(product.group)
        ? {
            subscription_data: {
              on_demand: {
                mandate_only: true,
                product_price: toMinorUnits(amount),
                adaptive_currency_fees_inclusive: true,
                product_description: `${product.name} — ${tier.label}`,
              },
            },
          }
        : {}),
    });
  } catch (err) {
    console.error("[checkout] Dodo session creation failed:", err);
    return res.status(502).json({ error: "Could not create checkout session with Dodo Payments." });
  }

  if (!session?.session_id || !session?.checkout_url) {
    return res.status(502).json({ error: "Dodo Payments did not return a checkout session." });
  }

  db.prepare(
    `INSERT INTO purchases
      (id, owner_id, owner_kind, product_id, tier_id, product_name, billing_model, billing_cycle, checkout_mode, amount, status, credits_granted, dodo_session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
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
    tier.credits ?? 0,
    session.session_id
  );

  res.status(201).json({
    purchaseId,
    simulated: false,
    sessionId: session.session_id,
    checkoutUrl: session.checkout_url,
  });
});

// ---------------------------------------------------------------------------
// GET /api/checkout/:purchaseId/status
//
// Polling endpoint for the frontend. Returns the purchase's payment lifecycle
// status, which is advanced exclusively by Dodo webhooks (payment.succeeded
// → 'active', payment.failed → 'failed', payment.cancelled → 'cancelled').
// ---------------------------------------------------------------------------
checkoutRouter.get("/:purchaseId/status", (req, res) => {
  const identity = requireIdentity(req, res);
  if (!identity) return;

  const purchase = db
    .prepare(`SELECT * FROM purchases WHERE id = ? AND owner_id = ? AND owner_kind = ?`)
    .get(req.params.purchaseId, identity.ownerId, identity.ownerKind) as any;
  if (!purchase) return res.status(404).json({ error: "Purchase not found." });

  res.json({
    purchaseId: purchase.id,
    status: purchase.status,
    productName: purchase.product_name,
    amount: purchase.amount,
    credits: purchase.credits_granted,
  });
});

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