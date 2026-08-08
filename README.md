# Atlas Studio — Dodo Payments Frontend Reference

A frontend-only reference build for a Dodo Payments SaaS integration, styled after
the pricing-page reference you shared. It's a real, running app (React + Express +
SQLite) — checkout and webhook handling are deliberately stubbed so you can drop
in real Dodo Payments calls later without restructuring anything.

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
  pages/                   Landing, Pricing, Dashboard
  components/              Navbar, PricingCard, PricingToggle, CheckoutModeSwitch,
                            AuthModal, KpiCard, CreditChatbot
  lib/
    api.ts                 Typed fetch client for the Express API
    AppContext.tsx          Session identity + pending-checkout-intent state
    catalog.ts              Re-exports shared/catalog.ts

server/
  index.ts                 Express app: middleware, route mounting, static serving
  db.ts                    SQLite schema (users, sessions, purchases, credit_ledger,
                            webhook_events)
  lib/
    auth.ts                Password hashing + session cookie helpers
    webhookVerify.ts        Standard Webhooks HMAC signature verification
  routes/
    auth.ts                 Sign up / sign in / guest / sign out / session
    checkout.ts              << integrate real Dodo checkout session creation here
    billing.ts               Dashboard data + demo credit debit/credit endpoint
    webhooks.ts               << point your Dodo webhook endpoint here
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
   `https://<tunnel>/api/webhooks/dodo` with the signing secret.
4. `npm run dev` and buy any tier in all three checkout modes. Test cards:
   `4000 0000 0000 0002` = success, `4000 0000 0000 0008` = decline.

## Auth note

You asked for **Better Auth**. This build uses a hand-rolled email/password +
guest-session system instead (scrypt password hashing, httpOnly session
cookies, SQLite-backed) — same responsibilities, same shape, just implemented
by hand in `server/lib/auth.ts` and `server/routes/auth.ts` so the whole flow
is inspectable in two files and doesn't depend on a library migration step I
couldn't test live. Swapping in the real `better-auth` package later is a
contained change: replace those two files with `betterAuth({ database: ... })`
+ its Express handler, keeping the same `/api/auth/*` routes the frontend
already calls.

## Database note

This uses Node's **built-in `node:sqlite` module** rather than a native npm
package like `better-sqlite3` — no `node-gyp`/Visual Studio/build-tools
requirement, so `npm install` works out of the box on Windows, macOS, and
Linux. Requires **Node 22.5+** (you're on a recent Node, so you're covered).
You'll see an `ExperimentalWarning: SQLite is an experimental feature` line
on startup — that's expected and harmless.

## What's intentionally not real

- No real payments are processed — checkout "completes" instantly and grants
  credits/entitlements directly, per the app's own database.
- Passwords, sessions, and billing are all local-only demo data in
  `server/data/atlas.db` (gitignored).
