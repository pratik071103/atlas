# Atlas Studio v2 — Dodo Payments Demo App (Next.js + MongoDB revamp)

## Context

The repo currently holds a working Dodo Payments reference app on **React + Vite + Express + SQLite**, already using `better-auth` + `@dodopayments/better-auth` (portal, usage, webhooks, anonymous guests), the `dodopayments` server SDK, and `dodopayments-checkout` for overlay/inline checkout. This revamp turns it into a polished, smooth demo app that shows off every major Dodo Payments capability:

- **Migrate to Next.js (App Router)** — full rewrite.
- **MongoDB (Atlas / replica set)** replaces SQLite — transactions available.
- Keep **Better Auth + Dodo adapter** as the auth/billing backbone; guests are anonymous users whose data survives sign-up.
- New headline features: two-bucket credits (plan + top-up), usage-billing playground with live event log, subscription upgrade/downgrade, profile page, product art, and a **license-key → unblur** flow.
- Real Dodo API when `DODO_API_KEY` is set; simulated fallback otherwise so the demo always runs.

Existing business logic worth porting (not rewriting from scratch): the webhook state machine (`server/lib/webhookHandlers.ts`), credit-ledger semantics (`server/lib/credits.ts`), checkout session construction incl. on-demand `mandate_only` (`server/routes/checkout.ts`), and the product catalog (`shared/catalog.ts`).

## Confirmed decisions

| Decision | Choice |
|---|---|
| Stack | Next.js 15 App Router, TypeScript, Tailwind; old Vite/Express tree removed |
| DB | MongoDB via `mongodb` driver + Better Auth `mongodbAdapter`; `MONGODB_URI` in `.env` |
| Credits | Two buckets: **plan** (refresh each billing cycle, spent first) and **top-up** (never expire) |
| Licenses | Real Dodo `/licenses/activate` + `/licenses/validate` (public endpoints), simulated fallback offline |
| Payments | Real Dodo test mode when key present; `SIMULATE_PAYMENTS` fallback preserved |

## Dodo surface being demoed (SDKs used)

- `@dodopayments/better-auth` — `checkout()` (session per product slug), `portal()`, `usage()` (ingest + meters list), `webhooks()` (typed handlers, signature verification)
- `dodopayments` (server SDK) — `checkoutSessions.create` (on-demand mandate products), `subscriptions.changePlan` (upgrade/downgrade with `proration_billing_mode`), `subscriptions.update` (cancel), `licenses.activate/validate/deactivate`
- `dodopayments-checkout` (browser SDK) — overlay + inline checkout modes
- `better-auth` — email/password + `anonymous` plugin (guests), `mongodbAdapter`, `nextCookies`

## Target architecture (separation of concerns)

```
improvement.md                 ← this plan
.env.example / .env            ← all env vars (below)
shared/catalog.ts              ← product catalog + art metadata (single source of truth)

src/
  app/
    (marketing)/page.tsx           Landing
    pricing/page.tsx               5 billing models, cycle toggle, checkout-mode switch
    dashboard/page.tsx             KPIs, usage playground, live event log, purchase library
    profile/page.tsx               identity, options, subscription card, credit status, licenses
    studio/page.tsx                blurred premium art + license activate/validate → unblur
    dev/webhooks/page.tsx          webhook inspector
    api/auth/[...all]/route.ts     Better Auth handler (owns /api/auth/* incl. Dodo webhook)
    api/checkout/route.ts          on-demand/mandate + simulate-mode checkout
    api/billing/...                me / credits/spend / subscription change-plan & cancel
    api/license/...                issue (simulate) / activate / validate
  lib/
    db.ts                          Mongo client, typed collections, index bootstrap
    auth.ts                        betterAuth() config (mongodbAdapter + anonymous + dodopayments)
    auth-client.ts                 createAuthClient + anonymousClient + dodopaymentsClient
    dodo.ts                        lazy DodoPayments SDK client + SIMULATE_PAYMENTS flag
    services/
      wallet.ts                    two-bucket credit wallet + append-only ledger (Mongo txns)
      purchases.ts                 purchase lifecycle (pending→active…), owner reassignment
      usage.ts                     local usage-event log + Dodo ingest orchestration
      licenses.ts                  issue/activate/validate (real + simulated)
      webhook-handlers.ts          typed Dodo event handlers → services above
  components/                      ui kit (Button/Card/Badge/…), Navbar, AuthModal,
                                   PricingCard, PlaygroundButtons, EventLogPanel,
                                   SubscriptionCard, CreditMeter, LicenseUnlockCard, ProductArt
```

**Rules:** route handlers stay thin (parse → service → respond); all Mongo access lives in `lib/services/*`; all Dodo API calls live in services via `lib/dodo.ts`; components never fetch directly — a typed `lib/api.ts` client does.

### MongoDB collections

- Better Auth owns `user`, `session`, `account`, `verification` (schemaless — no migration CLI needed, unlike SQLite).
- App collections: `purchases`, `wallets` (`{ userId, plan, topup }`), `creditLedger` (append-only, `bucket` field), `usageEvents` (local log of playground events + ingest status), `licenses` (key, instanceId, status), `webhookEvents` (audit + unique index on `eventId` for replay dedupe).
- Guest→user linking: `onLinkAccount` reassigns `userId` on all five app collections inside one transaction (port of `reassignOwner`).

### Feature → requirement mapping

1. **Better Auth adapter + SDKs** — adapter runs auth, customer creation, portal, usage, webhooks; browser + server Dodo SDKs for checkout modes, plan changes, licenses.
2. **MongoDB** — `mongodbAdapter(client.db())`; app services use the same client with transactions for wallet/linking.
3. **Guest flows** — "Continue as guest" → `anonymous` plugin; every flow (buy, spend, generate, license) works as guest; sign-up links and migrates everything.
4. **Credit + usage billing demo** — Dashboard **playground**: buttons like "Generate image (1 credit)", "HD render (5 credits)", "API call (metered)". Each click: spends from wallet (plan first), writes ledger + local event row, and fires `authClient.dodopayments.usage.ingest()`; an **EventLogPanel** streams the log (event name, credits, bucket, Dodo ingest OK/simulated).
5. **Profile options** — edit display name, avatar (generated from id), email, theme, customer-portal button, sign-out, guest-upgrade CTA, cancel-subscription controls.
6. **Subscription state** — SubscriptionCard shows current tier; **Upgrade/Downgrade** buttons call `subscriptions.changePlan` (`prorated_immediately`); `subscription.plan_changed` / `subscription.renewed` webhooks update the purchase row and refresh plan credits; UI reflects new tier after webhook (with optimistic banner meanwhile).
7. **Both credit types** — CreditMeter shows plan vs top-up balances separately + combined, with per-bucket ledger history.
8. **Product art** — each catalog tier gets a local gradient/SVG art asset; dashboard "Library" renders owned products as art cards; unpurchased premium art renders blurred.
9. **License → unblur** — `/studio`: premium artwork blurred with a lock overlay. Buy the license product → Dodo issues key (webhook `entitlement_grant.delivered` / simulate issues local key) → user pastes key → activate → validate (public endpoints) → CSS blur animates away; invalid/expired keys show the failure path. Deactivate button re-blurs.
10. **Smooth** — skeletons on every async surface, optimistic wallet updates, view transitions/`motion` micro-animations, no layout shift, toasts for webhook-driven changes.
11. **Env** — everything in `.env` (see below), `.env.example` documented.

### Env vars (`.env.example`)

```
MONGODB_URI=                    # Atlas connection string (replica set)
DODO_API_KEY=                   # test-mode key; unset → simulate mode
DODO_MODE=test_mode
DODO_WEBHOOK_SECRET=whsec_xxx   # webhook endpoint: /api/auth/dodopayments/webhooks
SIMULATE_PAYMENTS=              # =1 forces simulate even with a key
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DODO_MODE=test      # dodopayments-checkout overlay/inline mode
NEXT_PUBLIC_DODO_STORE_URL=     # optional storefront preview link
```

## Commit plan (13 commits, separation-of-concern order)

Each commit leaves the app bootable. Branch: `dev`.

1. **`docs: add revamp plan (improvement.md)`** — save this plan file.
2. **`chore: scaffold next.js app, retire vite/express tree`** — Next 15 + TS + Tailwind; base layout, fonts, theme tokens, ui-kit primitives ported from `src/components/ui/*`; delete `server/`, Vite config; new scripts (`dev`, `build`, `start`, `typecheck`).
3. **`feat(db): mongodb client, typed collections, indexes`** — `lib/db.ts`, index bootstrap (unique `webhookEvents.eventId`, `wallets.userId`, owner indexes).
4. **`feat(auth): better auth on mongodb with dodo adapter + guest logins`** — `lib/auth.ts` (email/password, `anonymous` w/ `onLinkAccount`, `dodopayments` plugin: `createCustomerOnSignUp`, `portal()`, `usage()`, `webhooks()` stub handlers), `api/auth/[...all]/route.ts`, `auth-client.ts`, AuthModal + Navbar session UI, guest sign-in.
5. **`feat(catalog): product catalog with art assets`** — port/extend `shared/catalog.ts` (+ license product, art metadata), ProductArt component, landing + pricing pages rendering all 5 billing models.
6. **`feat(wallet): two-bucket credit wallet and ledger service`** — `services/wallet.ts` (grant/spend plan-first, Mongo transactions, idempotency keys), `services/purchases.ts` (port of activate-exactly-once), `/api/billing/me`.
7. **`feat(checkout): real dodo checkout in redirect/overlay/inline + simulate mode`** — adapter `checkout()` for standard products, `/api/checkout` for on-demand `mandate_only`, `dodopayments-checkout` overlay/inline wiring, return-URL verify overlay with status polling.
8. **`feat(webhooks): typed event handlers + audit log + inspector`** — port state machine to `services/webhook-handlers.ts` (payments, subscriptions incl. `plan_changed`, refunds, disputes, `entitlement_grant.delivered`), `webhookEvents` audit, `/dev/webhooks` page.
9. **`feat(usage): playground buttons, event ingestion, live event log`** — playground buttons spend credits + `usage.ingest()`, `usageEvents` log + EventLogPanel, meters list via adapter.
10. **`feat(subscriptions): current plan card + upgrade/downgrade`** — SubscriptionCard, `/api/billing/subscription/change-plan` (`subscriptions.changePlan`, prorated) + cancel (schedule/immediate), plan-credit refresh on change/renewal, simulate path.
11. **`feat(licenses): key issue, activate, validate, and art unblur flow`** — `services/licenses.ts`, `/studio` page with blurred art → activate/validate → animated unblur; simulate-mode local keys; licenses list on profile.
12. **`feat(profile): profile page with options, credits, subscription, portal`** — identity editing (`authClient.updateUser`), avatar, CreditMeter (both buckets + history), portal button, guest-upgrade CTA, sign-out.
13. **`polish: motion, skeletons, empty states, docs`** — micro-animations, toasts on webhook-driven updates, loading/empty states everywhere, rewrite `README.md` (setup: Atlas URI, Dodo dashboard product/entitlement setup, ngrok webhook URL, test cards), final `.env.example`, delete `UI_IMPROVEMENT_PLAN.md`.

## Verification

- **Offline (simulate)**: `npm run dev` with only `MONGODB_URI` set → guest login, buy every billing model instantly, credits granted (correct bucket), playground spends + logs events (ingest marked "simulated"), fake license key unblurs art, guest→sign-up carries everything over.
- **Live test mode**: set `DODO_API_KEY` + `DODO_WEBHOOK_SECRET`, create catalog products + license entitlement in Dodo test dashboard, paste product ids into the `DODO_PRODUCT_*` env vars (`.env`, one per catalog tier — resolved server-side by `src/lib/dodo-catalog.ts`); `ngrok http 3000` → webhook to `/api/auth/dodopayments/webhooks`. Then: card `4000 0000 0000 0002` succeeds / `...0008` declines across redirect, overlay, inline; webhook advances purchase pending→active and grants credits exactly once (re-delivery deduped); subscription upgrade shows new tier after `subscription.plan_changed`; usage events visible in Dodo dashboard meter; real license key activates/validates and unblurs; portal opens from profile.
- `npm run typecheck` and `npm run build` clean at every commit.
