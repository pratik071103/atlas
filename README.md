# Foundry.Studio

A small AI-image-studio storefront built as a **Dodo Payments reference app**. It exercises
every major billing surface Dodo offers — one-time packs, tiered subscriptions with
upgrade/downgrade, usage-based metering, seat add-ons, on-demand top-ups and license keys —
against a real MongoDB-backed account model with guest checkout.

**Next.js 15 (App Router) · TypeScript · Tailwind · MongoDB · Better Auth**

> Known problems in the credit and access logic are tracked in [`ISSUES.md`](ISSUES.md).
> Read it before taking this anywhere near production.

It runs with **only `MONGODB_URI` set**. Without a Dodo API key it falls back to simulate
mode: purchases complete instantly, license keys are minted locally, and usage events are
logged as `simulated` — so the whole app is explorable offline before you touch the dashboard.

---

## Quick start

```bash
cp .env.example .env      # fill in MONGODB_URI (and BETTER_AUTH_SECRET)
npm install
npm run dev               # http://localhost:3000
```

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### MongoDB

Point `MONGODB_URI` at an **Atlas cluster or any replica set**. The wallet and the
guest→account link write several documents at once and use real transactions; a standalone
`mongod` cannot open one. The app degrades rather than crashing — it warns once and runs the
writes non-atomically — but use a replica set to see the intended behaviour.

No migration step is needed. Better Auth's Mongo adapter is schemaless, and the app's own
indexes are created on first use.

---

## What to try

| Flow | Where |
|---|---|
| Buy a plan, pack, usage plan, team seats or the Studio Pass, in redirect / overlay / inline checkout | `/pricing` |
| Guest checkout, then sign up and watch everything follow you | any auth prompt |
| Spend credits, ingest metered events, watch the log | `/dashboard` |
| Upgrade / downgrade / cancel a subscription | `/dashboard`, `/profile` |
| Both credit buckets and the ledger behind them | `/profile` |
| Invite teammates to seats, accept an invite | `/team`, `/invite/[token]` |
| License key → the noise dissolves to reveal the hidden picture | `/studio` |

---

## Going live (Dodo test mode)

1. **Create the products** in the Dodo dashboard (test mode) — one per catalog tier — and
   paste their ids into `dodoProductId` in [`shared/catalog.ts`](shared/catalog.ts). The
   Studio Pass needs a **license key** entitlement attached so Dodo issues a key on payment.
2. **Set the credentials** in `.env`:
   ```
   DODO_API_KEY=...
   DODO_WEBHOOK_SECRET=whsec_...
   ```
   For team seats, also create the team base product and seat add-on and set
   `DODO_TEAM_BASE_PRODUCT_ID` and `DODO_SEAT_ADDON_ID`. `NEXT_PUBLIC_DODO_STORE_URL`
   shows the storefront preview button on `/pricing`; `NEXT_PUBLIC_DODO_MODE` tells the
   checkout SDK which environment to load. All of them are listed in `.env.example`.
3. **Expose the webhook endpoint.** Run `ngrok http 3000` and register
   `https://<tunnel>.ngrok.app/api/auth/dodopayments/webhooks` in the Dodo dashboard. That
   path is mounted by the adapter, not by hand — signature verification and event dispatch
   both happen inside it.
4. **Pay with a test card:** `4000 0000 0000 0002` succeeds, `4000 0000 0000 0008` declines.

Payments advance the purchase; credits land exactly once even if Dodo re-delivers the event.
Every verified event is also recorded in the `webhookEvents` collection if you need to inspect one.

---

## How it fits together

```
shared/
  catalog.ts            products, tiers, credit buckets, generated-art specs
  playground.ts         playground actions + their authoritative credit costs

src/
  app/
    (marketing)/        landing
    pricing/            the shelf + checkout-mode switch (monthly plans)
    dashboard/          KPIs, usage playground, event log, subscription, library
    profile/            identity, credit meter, licenses, portal
    studio/             hidden picture + license activate / lock again
    team/               seats, invites, members
    invite/[token]/     accept a team invite
    api/
      auth/[...all]/    Better Auth — also mounts the Dodo webhook endpoint
      checkout/         on-demand (mandate_only) sessions + simulate path
      billing/          me · credits/spend · subscription change-plan & cancel
      license/          activate · validate · deactivate
      teams/            team, members, invite accept
      usage/            event log + ingest results
  lib/
    db.ts               Mongo client, typed documents, index bootstrap
    auth.ts             betterAuth() — mongodbAdapter + anonymous + dodopayments
    auth-client.ts      browser client (anonymous + dodopayments plugins)
    dodo.ts             lazy Dodo SDK client + SIMULATE_PAYMENTS
    http.ts             withIdentity() and service-error → status mapping
    api.ts              typed browser client for this app's own API
    services/           wallet · purchases · subscriptions · licenses · usage
                        · teams · webhook-handlers · linking
  components/           ui kit + feature components
```

**The rules the code sticks to:**

- Route handlers parse, call a service, and respond. They never touch a collection.
- All Mongo access lives in `lib/services/*`; all Dodo API calls go through `lib/dodo.ts`.
- Components never `fetch` — `lib/api.ts` does.
- **Payment state is only ever advanced by webhooks.** Checkout creates a pending purchase;
  `payment.succeeded` activates it. The simulate path runs the same activation transaction,
  so the two cannot drift.

### Two credit buckets

| | refreshed | spent |
|---|---|---|
| **plan** — subscriptions, seats | replaced every billing cycle | first |
| **top-up** — packs, on-demand | never expires | after plan credits run out |

The plan bucket is *set*, not incremented: it is recomputed as the sum of every active
plan-granting purchase. That is why upgrades, downgrades, extra seats and cancellations all
land on the right number instead of drifting apart. *(Not yet true: a sync currently refills credits already spent this cycle — see [ISSUES.md](ISSUES.md#2-plan-changes-refill-credits-the-user-already-spent--high).)*

### Guests

"Continue as guest" creates an anonymous Better Auth user — a real, flagged account. Every
flow works for them. On sign-up, `onLinkAccount` moves their purchases, ledger, usage events
and licenses onto the new account in one transaction, and *merges* their wallet (the hook also
fires when a guest signs in to an account that already holds credits).

---

## Dodo surface used

| SDK | Used for |
|---|---|
| `@dodopayments/better-auth` | `checkout()`, `portal()`, `usage()` (ingest + meters), `webhooks()` with typed handlers |
| `dodopayments` | `checkoutSessions.create` (on-demand `mandate_only`), `subscriptions.changePlan` / `.update`, `licenses.activate` / `.validate` / `.deactivate` |
| `dodopayments-checkout` | overlay + inline checkout |
| `better-auth` | email/password, `anonymous` plugin, `mongodbAdapter`, `nextCookies` |

---

## Demo-only shortcuts

Two things are deliberately unsuitable for production, both because there is no mail
transport configured:

- `requireEmailVerification` is off.
- New users are marked `emailVerified: true` by a database hook. This is not cosmetic — the
  adapter's usage plugin refuses `/usage/ingest` and `/usage/meters/list` for unverified
  users, so the metering half of the demo would 401 for everyone.

Remove both the moment you wire a real email provider.

---

## Scripts

```bash
npm run dev         # next dev
npm run build       # next build
npm run start       # next start
npm run typecheck   # tsc --noEmit
```
