import { DodoPayments } from "dodopayments-checkout";
import type { CheckoutEvent } from "dodopayments-checkout";

// ---------------------------------------------------------------------------
// Thin wrapper around the Dodo Payments Checkout SDK
// (https://docs.dodopayments.com/developer-resources/overlay-checkout).
//
// The SDK is a singleton: Initialize() sets the global mode/display type and
// event handler, then Checkout.open() renders the overlay or inline frame.
// We re-initialize before each open so the user can switch the checkout mode
// toggle freely — displayType is fixed per initialization.
// ---------------------------------------------------------------------------

const DODO_MODE: "test" | "live" = (import.meta.env.VITE_DODO_MODE as "test" | "live") ?? "test";

function onCheckoutEvent(event: CheckoutEvent) {
  if (event.event_type === "checkout.error") {
    console.error("[dodo-checkout] error:", event.data?.message);
  } else {
    console.log("[dodo-checkout]", event.event_type, event.data ?? "");
  }
}

export function openOverlayCheckout(checkoutUrl: string) {
  DodoPayments.Initialize({
    mode: DODO_MODE,
    displayType: "overlay",
    onEvent: onCheckoutEvent,
  });
  DodoPayments.Checkout.open({ checkoutUrl });
}

export function openInlineCheckout(checkoutUrl: string, elementId: string) {
  DodoPayments.Initialize({
    mode: DODO_MODE,
    displayType: "inline",
    onEvent: onCheckoutEvent,
  });
  DodoPayments.Checkout.open({ checkoutUrl, elementId });
}

export function closeCheckout() {
  DodoPayments.Checkout.close();
}

export function isCheckoutOpen() {
  return DodoPayments.Checkout.isOpen();
}