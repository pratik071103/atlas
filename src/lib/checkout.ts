import type { CheckoutSession } from "./api";
import {
  openInlineCheckout,
  openOverlayCheckout,
  closeCheckout as closeSdkCheckout,
} from "./checkoutSdk";

export type CheckoutMode = "redirect" | "overlay" | "inline";

// The checkout container id used by inline mode — must exist in the DOM when
// launchCheckout is called. Pricing.tsx keeps this element mounted at all
// times so the injected frame survives React re-renders.
export const INLINE_CHECKOUT_ELEMENT_ID = "dodo-inline-checkout";

// ---------------------------------------------------------------------------
// Dispatches a created checkout session based on the pricing-page toggle:
//   redirect → send the browser to the Dodo-hosted page (return_url brings
//              the customer back to /dashboard?checkout=<purchaseId>)
//   overlay  → open the Dodo modal on top of the current page
//   inline   → embed the checkout frame into the current page
//
// In every mode the terminal success/failure state is confirmed by Dodo
// webhooks on the server; the dashboard polls the purchase status while the
// "Verifying payment…" overlay is shown.
// ---------------------------------------------------------------------------
export function launchCheckout(session: CheckoutSession, mode: CheckoutMode, fallback: () => void) {
  if (session.simulated || !session.checkoutUrl) {
    // No live Dodo session (SIMULATE_PAYMENTS=1): keep the old instant flow.
    fallback();
    return;
  }

  switch (mode) {
    case "redirect":
      window.location.href = session.checkoutUrl;
      break;
    case "overlay":
      openOverlayCheckout(session.checkoutUrl);
      break;
    case "inline":
      openInlineCheckout(session.checkoutUrl, INLINE_CHECKOUT_ELEMENT_ID);
      break;
  }
}

/** Closes any open SDK checkout frame (overlay or inline). */
export function closeCheckout() {
  closeSdkCheckout();
}