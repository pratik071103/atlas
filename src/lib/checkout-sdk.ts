"use client";

import type { CheckoutEvent } from "dodopayments-checkout";

// ---------------------------------------------------------------------------
// Thin wrapper around the Dodo Payments Checkout SDK
// (https://docs.dodopayments.com/developer-resources/overlay-checkout).
//
// The SDK is a singleton: Initialize() sets the global mode/display type and
// event handler, then Checkout.open() renders the overlay or the inline frame.
// It is re-initialized before each open because displayType is fixed per
// initialization and the pricing page lets you switch modes freely.
//
// It is imported dynamically rather than at module scope: the module touches
// browser globals on load, and this file is reachable from a page Next
// prerenders on the server.
// ---------------------------------------------------------------------------

const DODO_MODE: "test" | "live" =
  (process.env.NEXT_PUBLIC_DODO_MODE as "test" | "live") ?? "test";

/** The container id inline mode injects into; must exist in the DOM when opened. */
export const INLINE_CHECKOUT_ELEMENT_ID = "dodo-inline-checkout";

type SdkEventHandler = (event: CheckoutEvent) => void;

async function sdk() {
  const { DodoPayments } = await import("dodopayments-checkout");
  return DodoPayments;
}

function defaultHandler(event: CheckoutEvent) {
  if (event.event_type === "checkout.error") {
    console.error("[dodo-checkout] error:", event.data?.message);
  } else {
    console.log("[dodo-checkout]", event.event_type, event.data ?? "");
  }
}

export async function openOverlayCheckout(checkoutUrl: string, onEvent?: SdkEventHandler) {
  const DodoPayments = await sdk();
  DodoPayments.Initialize({
    mode: DODO_MODE,
    displayType: "overlay",
    onEvent: (event) => {
      defaultHandler(event);
      onEvent?.(event);
    },
  });
  DodoPayments.Checkout.open({ checkoutUrl });
}

export async function openInlineCheckout(
  checkoutUrl: string,
  elementId: string,
  onEvent?: SdkEventHandler
) {
  const DodoPayments = await sdk();
  DodoPayments.Initialize({
    mode: DODO_MODE,
    displayType: "inline",
    onEvent: (event) => {
      defaultHandler(event);
      onEvent?.(event);
    },
  });
  DodoPayments.Checkout.open({ checkoutUrl, elementId });
}

/** Closes any open SDK checkout frame (overlay or inline). */
export async function closeCheckout() {
  const DodoPayments = await sdk();
  DodoPayments.Checkout.close();
}
