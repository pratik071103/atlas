import "server-only";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { dodopayments, portal, usage, webhooks } from "@dodopayments/better-auth";
import { headers } from "next/headers";
import { mongoDb } from "@/lib/db";
import { getDodoClient, SIMULATE_PAYMENTS } from "@/lib/dodo";
import { reassignOwner } from "@/lib/services/linking";
import { webhookHandlers } from "@/lib/services/webhook-handlers";

// ---------------------------------------------------------------------------
// Better Auth + the official Dodo Payments adapter.
//
// Beyond auth itself the `dodopayments()` plugin brings four things the app
// would otherwise have to fake:
//
//   createCustomerOnSignUp  a real Dodo customer, linked on user.dodoCustomerId
//   portal()                a real customer-portal session
//   usage()                 usage-event ingestion + meters listing
//   webhooks()              a verified endpoint with ~45 typed event handlers
//
// Guests are anonymous Better Auth users rather than a parallel session type,
// so there is one identity model — and `onLinkAccount` carries everything a
// guest bought onto their new account instead of orphaning it.
//
// Mounted at /api/auth/[...all], which is also what gives the adapter its
// webhook route: POST /api/auth/dodopayments/webhooks.
// ---------------------------------------------------------------------------

export const auth = betterAuth({
  // The adapter is schemaless on Mongo, so — unlike the SQLite build — there
  // is no `@better-auth/cli migrate` step before the app can boot.
  database: mongodbAdapter(mongoDb),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "atlas-studio-dev-secret-change-me",

  emailAndPassword: {
    enabled: true,
    // Demo app: no mail transport is configured, so verification would lock
    // every new account out. Turn this on once you wire an email provider.
    requireEmailVerification: false,
  },

  plugins: [
    anonymous({
      emailDomainName: "guest.atlas.local",
      // Fires when an anonymous (guest) user signs up or logs in for real.
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        const moved = await reassignOwner(anonymousUser.user.id, newUser.user.id);
        console.log(
          `[auth] linked guest ${anonymousUser.user.id} → ${newUser.user.id} ` +
            `(${moved.purchases} purchases, ${moved.ledger} ledger rows, ` +
            `${moved.licenses} licenses, +${moved.planCredits}/+${moved.topupCredits} credits)`
        );
      },
    }),

    dodopayments({
      client: getDodoClient(),
      // Gated on real credentials: the adapter's user-create hook calls the
      // Dodo API for every new user, and with no key that 401s — a fresh clone
      // could not sign in at all.
      //
      // Note this also fires for anonymous guests when credentials ARE set, so
      // every "continue as guest" click creates a Dodo customer. Set it to
      // false and create the customer at first checkout if that clutters your
      // dashboard.
      createCustomerOnSignUp: !SIMULATE_PAYMENTS,
      use: [
        portal(),
        usage(),
        webhooks({
          webhookKey: process.env.DODO_WEBHOOK_SECRET ?? "",
          ...webhookHandlers,
        }),
      ],
    }),

    // Must stay last: it copies Set-Cookie off Better Auth's response onto the
    // Next response, so sign-in actually persists a session.
    nextCookies(),
  ],
});

// ---------------------------------------------------------------------------
// Identity
//
// Route handlers call these instead of reaching for the session themselves, so
// the "guests are anonymous users" detail stays in one place.
// ---------------------------------------------------------------------------

export interface Identity {
  userId: string;
  name: string;
  email: string;
  isAnonymous: boolean;
  dodoCustomerId: string | null;
}

export async function getIdentity(): Promise<Identity | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = session.user as typeof session.user & {
    isAnonymous?: boolean | null;
    dodoCustomerId?: string | null;
  };

  return {
    userId: user.id,
    name: user.name ?? "",
    email: user.email ?? "",
    isAnonymous: Boolean(user.isAnonymous),
    dodoCustomerId: user.dodoCustomerId ?? null,
  };
}

/** 401 body returned by every route that needs a signed-in (or guest) user. */
export const UNAUTHENTICATED = {
  error: "Not signed in. Continue as guest or sign in first.",
} as const;
