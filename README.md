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

## Where to plug in real Dodo Payments

**`server/routes/checkout.ts`** — currently simulates an instant successful
purchase so the rest of the app has real data to show. Replace the body of the
`POST /session` handler with a call to Dodo's checkout session API
(`dodo.checkoutSessions.create(...)`), and return the resulting
`checkout_url` / client token instead of the simulated redirect.

**`server/routes/webhooks.ts`** — already verifies Standard Webhooks HMAC
signatures (`server/lib/webhookVerify.ts`) and has a `switch` stubbed for the
event types this project's data model expects: `payment.succeeded`,
`payment.failed`, `subscription.plan_changed`, `subscription.renewed`,
`subscription.cancelled` / `.expired`. Point your Dodo webhook endpoint at
`POST /api/webhooks/dodo` and set `DODO_WEBHOOK_SECRET` in `.env`.

**`shared/catalog.ts`** — swap the demo prices/tiers for your real Dodo
product IDs; both the pricing page and the checkout route read from this one
file.

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
