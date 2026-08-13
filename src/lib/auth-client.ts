"use client";

import { createAuthClient } from "better-auth/react";
import { anonymousClient, inferAdditionalFields } from "better-auth/client/plugins";
import { dodopaymentsClient } from "@dodopayments/better-auth/client";

// ---------------------------------------------------------------------------
// Better Auth browser client.
//
// Talks to /api/auth/* on the same origin, which the App Router serves from
// the same process — so no baseURL configuration is needed.
//
// The dodopayments client plugin adds the typed calls the app uses directly
// from the browser:
//   authClient.dodopayments.customer.portal()
//   authClient.dodopayments.customer.subscriptions.list()
//   authClient.dodopayments.usage.ingest()
//   authClient.dodopayments.usage.meters.list()
//
// The anonymous plugin backs "continue as guest": the guest is a real (flagged)
// user, so signing up later links the account and carries their purchases over.
// ---------------------------------------------------------------------------

export const authClient = createAuthClient({
  plugins: [
    anonymousClient(),
    dodopaymentsClient(),
    // Declared by shape rather than `inferAdditionalFields<typeof auth>()`,
    // which would pull the server auth module — and everything it imports,
    // including the Mongo client — into the browser bundle.
    inferAdditionalFields({
      user: { checkoutTheme: { type: "string", required: false } },
    }),
  ],
});

export type AuthSession = typeof authClient.$Infer.Session;

/** The app's view of whoever is currently signed in. */
export interface SessionIdentity {
  id: string;
  kind: "user" | "guest";
  name: string | null;
  email: string | null;
  image: string | null;
  /** Palette Dodo renders checkout in; edited from the profile page. */
  checkoutTheme: "light" | "dark" | "system";
}
