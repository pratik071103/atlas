"use client";

import type { CheckoutSession } from "./api";
import {
  closeCheckout as closeSdkCheckout,
  openInlineCheckout,
  openOverlayCheckout,
  INLINE_CHECKOUT_ELEMENT_ID,
} from "./checkout-sdk";

export type CheckoutMode = "redirect" | "overlay" | "inline";

export { INLINE_CHECKOUT_ELEMENT_ID };

/**
 * What the customer was trying to buy when they hit the sign-in gate.
 * Stashed on the session context so the auth modal can resume the purchase
 * instead of dumping them back on the pricing shelf to start over.
 */
export interface CheckoutIntent {
  productId: string;
  productName: string;
  tierId: string;
  tierLabel: string;
  amount: number;
  billingCycle: "monthly" | "yearly";
  mode: CheckoutMode;
}

// ---------------------------------------------------------------------------
// Dispatches a created checkout session according to the pricing-page toggle:
//   redirect → send the browser to the Dodo-hosted page (return_url brings the
//              customer back to /dashboard?checkout=<purchaseId>)
//   overlay  → open the Dodo modal on top of the current page
//   inline   → embed the checkout frame into the current page
//
// In every mode the terminal success/failure state is confirmed server-side by
// webhooks; the dashboard polls the purchase while the "Verifying payment…"
// overlay is up.
// ---------------------------------------------------------------------------
export async function launchCheckout(
  session: CheckoutSession,
  mode: CheckoutMode,
  onSimulated: () => void,
  inlineElementId = INLINE_CHECKOUT_ELEMENT_ID
): Promise<void> {
  if (session.simulated || !session.checkoutUrl) {
    // No live Dodo session (simulate mode): the purchase is already active.
    onSimulated();
    return;
  }

  switch (mode) {
    case "redirect":
      window.location.href = session.checkoutUrl;
      break;
    case "overlay":
      await openOverlayCheckout(session.checkoutUrl);
      break;
    case "inline":
      await openInlineCheckout(session.checkoutUrl, inlineElementId);
      break;
  }
}

export function closeCheckout(): Promise<void> {
  return closeSdkCheckout();
}
