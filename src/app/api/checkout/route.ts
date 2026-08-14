import { NextResponse } from "next/server";
import {
  creditBucketFor,
  findTier,
  isMetered,
  tierPrice,
  toMinorUnits,
} from "@shared/catalog";
import { newId } from "@/lib/db";
import { appUrl, getDodoClient, SIMULATE_PAYMENTS } from "@/lib/dodo";
import { dodoProductIdFor } from "@/lib/dodo-catalog";
import { fail, readJson, withIdentity } from "@/lib/http";
import { issueSimulatedLicense } from "@/lib/services/licenses";
import { activatePurchase, createPurchase } from "@/lib/services/purchases";

// ---------------------------------------------------------------------------
// POST /api/checkout
//
// Creates a Dodo Payments checkout session and returns its URL. `mode` only
// changes what the *browser* does with that URL:
//   redirect  → window.location = checkoutUrl   (Dodo-hosted page)
//   overlay   → dodopayments-checkout SDK modal
//   inline    → dodopayments-checkout SDK embedded frame
//
// The adapter's own checkout() endpoint covers plain products; this route
// exists for the on-demand/metered ones, which need `mandate_only` subscription
// data the adapter does not expose — and for the simulate path.
//
// Payment state is never advanced here. It lives on the purchase row and only
// webhooks move it (services/webhook-handlers.ts).
// ---------------------------------------------------------------------------

interface Body {
  productId?: string;
  tierId?: string;
  billingCycle?: "monthly" | "yearly";
  mode?: "redirect" | "overlay" | "inline";
}

const MODES = ["redirect", "overlay", "inline"] as const;

export async function POST(request: Request) {
  return withIdentity(async (identity) => {
    const body = await readJson<Body>(request);

    const match = findTier(String(body.productId), String(body.tierId));
    if (!match) return fail("Unknown product or tier.", 400);

    const { product, tier } = match;
    const billingCycle: "monthly" | "yearly" =
      body.billingCycle === "yearly" ? "yearly" : "monthly";
    const mode = MODES.includes(body.mode as (typeof MODES)[number])
      ? (body.mode as (typeof MODES)[number])
      : "redirect";

    const amount = tierPrice(tier, billingCycle);
    const purchaseId = newId("pur");
    const productName = `${product.name} — ${tier.label}`;

    const base = {
      id: purchaseId,
      userId: identity.userId,
      productId: product.id,
      tierId: tier.id,
      productName,
      billingModel: product.group,
      billingCycle,
      checkoutMode: mode,
      amount,
      creditsGranted: tier.credits ?? 0,
      creditBucket: creditBucketFor(product.group),
      dodoProductId: dodoProductIdFor(tier.id),
    };

    // ---- Simulated mode ----------------------------------------------------
    // Local development without a Dodo account: instant success, so the rest of
    // the app (dashboard, wallet, studio) still works offline. The purchase is
    // inserted pending and then activated through the same transactional path
    // the webhook uses, so simulated and real purchases cannot drift apart.
    if (SIMULATE_PAYMENTS) {
      await createPurchase({ ...base, simulated: true });
      await activatePurchase(purchaseId, `Purchase: ${productName}`);

      // Live, Dodo mints the key and delivers it on license_key.created.
      // Offline there is nothing to do that, so the pass issues its own.
      if (product.grantsLicense) await issueSimulatedLicense(identity.userId);

      return NextResponse.json(
        { purchaseId, simulated: true, checkoutUrl: null, sessionId: null },
        { status: 201 }
      );
    }

    // ---- Real mode ---------------------------------------------------------
    // Metered products (usage-based, on-demand) authorize a payment method up
    // front with no initial charge — quantity 0 plus `mandate_only` — and bill
    // later from the usage events the playground ingests.
    const metered = isMetered(product.group);

    const dodoProductId = dodoProductIdFor(tier.id);
    if (!dodoProductId) {
      return fail(
        `No Dodo product id configured for tier "${tier.id}" — set DODO_PRODUCT_${tier.id
          .toUpperCase()
          .replace(/-/g, "_")} in .env.`,
        500
      );
    }

    let session;
    try {
      session = await getDodoClient().checkoutSessions.create({
        product_cart: [{ product_id: dodoProductId, quantity: metered ? 0 : 1 }],
        // Prefer the Dodo customer Better Auth linked at sign-up so repeat
        // purchases attach to one customer record and show up in that
        // customer's portal. Anonymous guests have none yet — let Dodo collect
        // their details during checkout.
        ...(identity.dodoCustomerId
          ? { customer: { customer_id: identity.dodoCustomerId } }
          : identity.email && !identity.isAnonymous
            ? { customer: { email: identity.email, name: identity.name || undefined } }
            : {}),
        billing_currency: "USD",
        return_url: `${appUrl()}/dashboard?checkout=${purchaseId}`,
        cancel_url: `${appUrl()}/pricing`,
        metadata: { purchaseId },
        // Brand colours in both palettes, so the customer's profile preference
        // (light / dark / follow the device) still looks like Atlas.
        customization: {
          theme: identity.checkoutTheme,
          theme_config: {
            light: {
              bg_primary: "#FFFFFF",
              text_primary: "#101828",
              button_primary: "#A6E500",
              button_primary_hover: "#8CC500",
              button_text_primary: "#0D0D0D",
            },
            dark: {
              bg_primary: "#0C0F0C",
              text_primary: "#F7F8F7",
              button_primary: "#C3EE3F",
              button_primary_hover: "#AEDE1F",
              button_text_primary: "#0C0F0C",
            },
            radius: "8px",
          },
        },
        ...(metered
          ? {
              subscription_data: {
                on_demand: {
                  mandate_only: true,
                  product_price: toMinorUnits(amount),
                  adaptive_currency_fees_inclusive: true,
                  product_description: productName,
                },
              },
            }
          : {}),
      });
    } catch (err) {
      console.error("[checkout] Dodo session creation failed:", err);
      return fail("Could not create checkout session with Dodo Payments.", 502);
    }

    if (!session?.session_id || !session?.checkout_url) {
      return fail("Dodo Payments did not return a checkout session.", 502);
    }

    await createPurchase({ ...base, simulated: false, dodoSessionId: session.session_id });

    return NextResponse.json(
      {
        purchaseId,
        simulated: false,
        sessionId: session.session_id,
        checkoutUrl: session.checkout_url,
      },
      { status: 201 }
    );
  });
}
