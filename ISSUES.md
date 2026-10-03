# Known issues

Problems found in a code review of the credit and access logic (October 2026).
None of them break the demo, but each one is a real bug and must be fixed before
this handles real money. Severity is for a production deployment.

Line numbers are as of the review and may drift.

---

## 1. Credit spends can double-charge Dodo or drift from the local wallet — High

**Where:** `src/lib/services/usage.ts:78-87`, `src/lib/db.ts:369`

`runPlaygroundAction` calls Dodo to debit credits **inside** the Mongo transaction and
**before** the local balance check (`spendCreditsWithin`). Three things go wrong:

- **Short wallet:** Dodo is debited first, then the local spend throws
  `InsufficientCreditsError` and the transaction aborts. Dodo has taken the credits, the
  app has not. The two ledgers drift apart.
- **Retries:** a write conflict (two fast clicks) makes the driver re-run the transaction
  callback. Each run builds a fresh idempotency key with `newId("spend")`, so Dodo is
  debited again.
- **No replica set:** on a standalone `mongod`, `withTransaction` fails on the first
  session op and re-runs the callback with `fn(undefined)` (`db.ts:369`). Every spend
  debits Dodo twice.

**Fix:** check and reserve the local balance first, commit, then call Dodo with a
deterministic idempotency key derived from the usage event id. Never make a network
call inside a transaction callback that can be retried.

---

## 2. Plan changes refill credits the user already spent — High

**Where:** `src/lib/services/purchases.ts:71-96` (`syncPlanAllowanceWithin`),
`src/lib/services/wallet.ts:231` (`setPlanBalanceWithin`)

The plan bucket is *set* to the sum of every active plan's full allowance whenever it
is synced, and a sync runs on plan change, cancel, and any plan purchase activating.
It ignores what has already been spent this cycle.

**Example:** a Pro user spends 200 credits, downgrades, then upgrades again. The bucket
goes back to the full allowance — the 200 are restored — and with prorated billing the
round trip costs almost nothing. Buying and immediately cancelling a second plan does
the same.

**Fix:** keep "allowance for this cycle" and "spent this cycle" separately and set the
balance to `allowance − spent`, or apply plan changes as a delta instead of a reset.
Only renewals should restore the full allowance.

---

## 3. Payment and auth settings fail open — High

### 3a. Missing Dodo key silently makes everything free

**Where:** `src/lib/dodo.ts:23-24`

`SIMULATE_PAYMENTS` turns on whenever `DODO_API_KEY` is unset. A production deploy that
forgets the key runs in simulate mode: every checkout activates instantly, grants
credits, mints a license and creates a team, with no payment.

Related:

- `src/lib/services/licenses.ts` still honours license rows marked `simulated` when
  running live, so a key minted in simulate mode keeps working after real payments are
  switched on.
- `src/lib/services/subscriptions.ts:80` applies a plan change locally, with no charge,
  whenever the purchase has no `dodoSubscriptionId` — even in live mode.

**Fix:** in production, refuse to start without `DODO_API_KEY` unless
`SIMULATE_PAYMENTS=1` is set explicitly. Reject simulated rows and
subscription-less plan changes when not simulating.

### 3b. Hardcoded auth secret fallback

**Where:** `src/lib/auth.ts:38`

If `BETTER_AUTH_SECRET` is missing, sessions are signed with
`"foundry-studio-dev-secret-change-me"`, which is public in this repo. That also
bypasses Better Auth's own check for a default secret. Anyone could forge session
cookies.

**Fix:** throw at startup in production when `BETTER_AUTH_SECRET` is unset.

---

## 4. Other access and credit problems — Medium

- **Refunds and disputes.**
  - `refund.succeeded` ignores `is_partial`, so a partial refund marks the whole purchase
    refunded and claws back all its credits (`webhook-handlers.ts:324-326`).
  - Neither a refund nor a lost dispute revokes the Studio Pass license, and
    `hasActiveLicense` (`licenses.ts:82`) only checks the local license status, so the
    studio stays unlocked after the money is returned.
- **Refunded purchases can come back.** `activatePurchase` only skips when the status is
  already `active` (`purchases.ts:111`). A redelivered `payment.succeeded` or
  `subscription.active` arriving after a refund or cancel flips the purchase back to
  `active` and its credits count again.
- **Usage billing trusts the browser.** The server never ingests metered usage itself:
  the browser calls the ingest endpoint, then reports the result through
  `PATCH /api/usage/[eventId]`, which accepts `status: "ok"` from the client. A modified
  client can make API calls that are never billed.
- **Credit top-up checkout is probably broken.** The top-up group is `on_demand`, so
  checkout sends `mandate_only` subscription data (`checkout/route.ts:181-182`), but the
  Dodo products are one-time. Dodo will likely reject it, or grant credits without
  charging; nothing ever calls `subscriptions.charge`. The product is hidden on
  `/pricing` but the API still accepts it.
- **Yearly price recorded, monthly charged.** The checkout API still accepts
  `billingCycle: "yearly"` (`checkout/route.ts:51-52`), but every tier maps to one
  monthly Dodo product, so the purchase records the yearly price while Dodo charges
  monthly.
- **Guest → account merge leaves the Dodo customer behind.** `reassignOwner`
  (`src/lib/services/linking.ts`) moves the guest's rows to the new account but not their
  Dodo customer, so later credit debits and usage ingest go to a customer that has none
  of the guest's subscriptions or credit entitlement. It also runs `Promise.all` over one
  transaction session, which the Mongo driver does not support.
- **Webhook audit log drops events.** Events with no subject id are stored with
  `eventId: null`; the unique sparse index still indexes explicit nulls, so every later
  event of that kind fails to insert and `logEvent` swallows the error
  (`webhook-handlers.ts:84-89`). Auditing only — handlers still run.
- **Internal errors reach the client.** `src/lib/http.ts:37` returns `err.message` for any
  unrecognised error, so raw Dodo SDK and Mongo errors are shown to users.

