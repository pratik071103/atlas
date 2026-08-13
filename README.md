# Atlas Studio — Dodo Payments Frontend Reference

A reference build for a Dodo Payments SaaS integration (React + Express +
SQLite). Checkout, webhooks, the customer portal, and usage metering all call
the real Dodo Payments API — via the `dodopayments` SDK and the official
**Better Auth adapter** (`@dodopayments/better-auth`). With no API key
configured the app falls back to simulated purchases so it still runs offline.

## What's included

- **Landing page** — small Atlas Studio hero + feature highlights
- **Pricing page** — all 5 billing models, monthly/yearly toggle, redirect /
  overlay / inline checkout mode switch with a storefront preview card
- **Auth** — guest checkout (name, email, billing address) or sign up / log in,
  backed by a local SQLite database
- **Dashboard** — KPI cards (credit balance, active subscriptions, lifetime
  spend), purchased products list, and a demo "credit assistant" chatbot that
  debits/credits your balance live

## Run it

```bash
npm install
cp .env.example .env      # optional — only needed for real webhook verification
npm run dev                # starts the Express API (8787) + Vite dev server (5173)
```

Open **http://localhost:5173**. The SQLite file is created automatically at
`server/data/atlas.db` on first run.

For a production-style single-process run:

```bash
npm run build
npm start                  # serves the built frontend + API from one Express process
```

## Structure

```
shared/catalog.ts          Product catalog — the single source of truth for pricing,
                            imported by both the frontend and the server.

src/
  pages/                   Landing, Pricing, Dashboard, DevWebhooks
  components/              Navbar, PricingCard, PricingToggle, CheckoutModeSwitch,
                            AuthModal, KpiCard, CreditPromptBar, PaymentStatus
  lib/
    authClient.ts           Better Auth browser client + Dodo client plugin
                            (session, sign-in/up, customer portal, usage ingest)
    api.ts                  Typed fetch client for the app's own billing routes
    AppContext.tsx          Session identity + pending-checkout-intent state
    catalog.ts              Re-exports shared/catalog.ts

server/
  index.ts                 Express app; mounts Better Auth at /api/auth/* BEFORE
                            express.json() so webhook signatures verify
  db.ts                    App schema (purchases, credit_ledger, webhook_events).
                            Identity tables are owned by Better Auth.
  lib/
    auth.ts                 Better Auth instance: email/password, anonymous
                            guests, and the Dodo adapter (portal, usage, webhooks)
    webhookHandlers.ts      Typed handlers for payment / subscription / refund /
                            dispute events
    credits.ts              Transactional credit ledger helpers
    dodo.ts                 Shared Dodo SDK client
  routes/
    checkout.ts             Creates real Dodo checkout sessions
    billing.ts              Dashboard data, demo credits, real subscription cancel
    webhooks.ts             Dev-only webhook inspector (read-only)
  data/products.ts          Re-exports shared/catalog.ts
```

## Dodo Payments integration

The checkout toggle (`redirect | overlay | inline`) and the webhook pipeline are
wired to the real Dodo Payments API:

- **`server/routes/checkout.ts`** — `POST /api/checkout/session` creates a real
  checkout session via the `dodopayments` SDK (server) and returns the
  `checkout_url`. The toggle mode only changes what the frontend does with it:
  redirect (`window.location`), overlay, or inline (`dodopayments-checkout`
  SDK frame injected into `#dodo-inline-checkout` on the pricing page).
  If `DODO_API_KEY` is unset (or `SIMULATE_PAYMENTS=1`), it falls back to the
  old instant simulated purchase so the app still runs offline.
- **Payment lifecycle** — purchases start `pending`; Dodo webhooks advance
  them: `payment.processing` → `processing`, `payment.succeeded` → `active`
  (credits granted exactly once), `payment.failed` → `failed`,
  `payment.cancelled` → `cancelled`.
- **`server/routes/webhooks.ts`** — `POST /api/webhooks/dodo` verifies the
  Standard Webhooks HMAC signature (with timestamp freshness + replay
  dedupe via the `webhook-id`), then applies the payment state machine.
- **Dashboard verification** — every mode returns the customer to
  `/dashboard?checkout=<purchaseId>` (via `return_url`). While the webhook
  hasn't landed, the dashboard shows a "Verifying payment…" overlay that
  polls the purchase status; the result appears as a success/failure banner.

### Going live / testing the webhook loop

1. Create the catalog products in the Dodo **test** dashboard and paste their
   ids into `dodoProductId` in `shared/catalog.ts`.
2. Copy `.env.example` → `.env`; set `DODO_API_KEY` and `DODO_WEBHOOK_SECRET`
   (keep existing values if already filled).
3. Expose the API to the internet so Dodo can deliver webhooks:
   `ngrok http 8787` (or `cloudflared tunnel --url http://localhost:8787`),
   then set the webhook URL in the Dodo dashboard to
   `https://<tunnel>/api/auth/dodopayments/webhooks` with the signing secret.
   (The endpoint moved when the Better Auth adapter took over verification —
   update it if you configured the old `/api/webhooks/dodo` path.)
4. `npm run dev` and buy any tier in all three checkout modes. Test cards:
   `4000 0000 0000 0002` = success, `4000 0000 0000 0008` = decline.

## Auth

**Better Auth** with the official Dodo Payments adapter
(`@dodopayments/better-auth`), configured in `server/lib/auth.ts`. It owns
every `/api/auth/*` route, and the adapter contributes four things:

- `createCustomerOnSignUp` — a real Dodo customer, linked on `user.dodoCustomerId`
- `portal()` — a real customer-portal session (`authClient.dodopayments.customer.portal()`)
- `usage()` — usage-event ingestion + meters, for the usage-based product
- `webhooks()` — the verified webhook endpoint, with ~45 typed event handlers

**Guests are anonymous Better Auth users** (the `anonymous` plugin) rather than
a parallel session type, so there's one identity model. `onLinkAccount` moves a
guest's purchases and credit ledger onto their new account when they sign up —
previously those rows were orphaned.

One trade-off worth knowing: with live credentials, `createCustomerOnSignUp`
fires for anonymous guests too, so every "continue as guest" creates a Dodo
customer. Set it to `false` in `server/lib/auth.ts` and create the customer at
first checkout if that clutters your dashboard.

## Database note

**better-sqlite3**, because Better Auth's built-in adapter takes the instance
directly (`betterAuth({ database })`) with no Kysely/Drizzle wiring. It ships
prebuilt binaries, so no `node-gyp`/Visual Studio is needed.

Newer npm versions gate package install scripts. If a fresh clone fails to load
the binding, run:

```bash
npm approve-scripts better-sqlite3 && npm rebuild better-sqlite3
```

Identity tables (`user`, `session`, `account`, `verification`) are created by
Better Auth's CLI, not by `db.ts`:

```bash
npx @better-auth/cli migrate --config server/lib/auth.ts
```

The database file lives at `.dbdata/atlas.db` (gitignored). A pre-existing
database from the hand-rolled-auth version is detected on boot and its demo
tables are rebuilt.

## What's simulated

- With no `DODO_API_KEY` (or `SIMULATE_PAYMENTS=1`), checkout completes
  instantly and grants credits locally — no Dodo call is made.
- The dashboard "credit prompt bar" is a demo device for moving the local
  ledger. Real metered usage is additionally reported to Dodo via
  `authClient.dodopayments.usage.ingest()`.
- Product ids in `shared/catalog.ts` are placeholders except the one-time
  pack — create the rest in your Dodo dashboard before demoing live.
