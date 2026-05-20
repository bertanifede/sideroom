# Self-healing, payment-gated party creation

- **Date:** 2026-05-19
- **Status:** Approved — pending implementation
- **Branch:** `payment-self-heal`

## Background

A live Stripe webhook misconfiguration (the endpoint pointed at the apex
domain `sideroom.link`, which 307-redirects to `www.sideroom.link`; Stripe
does not follow redirects) meant the `checkout.session.completed` webhook
never executed in production. Customers were charged but no party was
created — they saw a "Something Went Wrong" page. Two paid parties had to
be recovered manually.

The webhook URL is now fixed and verified. This spec hardens the system so
a webhook failure can never again leave a paying customer without a party.

## Problem

Party creation depends 100% on the Stripe webhook. It is a single point of
failure: a domain change, secret rotation, Stripe outage, or bad deploy
breaks party creation silently, and the customer is charged with nothing to
show for it.

## Goal

Party creation **self-heals**: even if the webhook never fires, the party
is still created automatically, with no customer-visible error.

## Core principle

> A party is created **if and only if** Stripe confirms the checkout
> session as `paid`. The system must verify payment with Stripe — never
> assume it from context (e.g. landing on the success page).

## Non-goals (YAGNI)

- Email/SMS alerting on webhook failure.
- A reconciliation cron job.
- Handling async/delayed payment methods (`checkout.session.async_payment_succeeded`).
  The paid-gate handles them safely anyway — it simply will not create a
  party until `payment_status === "paid"`.

**Residual gap (accepted):** if the webhook fails *and* the buyer closes
the tab before `/payment/success` loads, neither path runs. Rare now that
the webhook is fixed. A cron could close this later; out of scope here.

## Architecture

Two independent triggers, one idempotent creation function, one DB-level
uniqueness guarantee.

```
Buyer completes Stripe Checkout
  ├─ Stripe webhook  ───────────┐  (fast path)
  │  checkout.session.completed │
  │                             ├──> createPartyFromCheckout(session)
  └─ /payment/success page  ────┘  (guaranteed path)
     → POST /api/checkout/finalize
```

## Components

### 1. `lib/create-party-from-checkout.ts` (new)

The **only** place a party is created from a checkout. Extracted from the
current webhook handler.

```
createPartyFromCheckout(serviceClient, session) -> { party, inviteCode, status }
```

Logic:
1. **Paid gate** — if `session.payment_status !== "paid"`, return
   `{ status: "not_paid" }`. Nothing is created.
2. **Idempotency** — `SELECT` party by `stripe_session_id`. If found,
   return `{ status: "exists", party, inviteCode }`.
3. Look up the `pending_checkouts` row by `stripe_session_id`. If absent
   (and no party exists), return `{ status: "no_pending" }` and log an
   error — the data is gone; should not happen in normal flow.
4. Generate a unique invite code, hash the PIN (if any), insert the
   `parties` row, the `party_secrets` row (if PIN), and the `tracks` rows.
5. **Race handling** — if the `parties` insert fails with a unique
   violation (Postgres `23505`) on `stripe_session_id`, the other path won
   the race: re-`SELECT` the party and return `{ status: "exists", ... }`.
6. Delete the `pending_checkouts` row.
7. Return `{ status: "created", party, inviteCode }`.

If track insertion fails, the partially-created party is deleted (current
webhook behavior is preserved).

### 2. `app/api/checkout/finalize/route.ts` (new) — `POST`

Called by the success page. The guaranteed path.

- Requires a logged-in user.
- Body: `{ session_id }`.
- `stripe.checkout.sessions.retrieve(session_id)`.
- **Ownership check:** `session.metadata.artist_id === user.id`, else `403`.
- Calls `createPartyFromCheckout(serviceClient, session)`.

Responses:

| Condition | HTTP | Body |
|---|---|---|
| Created or already exists | 200 | `{ invite_code }` |
| `payment_status !== "paid"` | 200 | `{ status: "not_paid" }` |
| `pending_checkouts` row missing, no party | 409 | `{ error: "checkout_data_missing" }` |
| Session not owned by user | 403 | `{ error: "forbidden" }` |
| Stripe API unreachable / 5xx | 503 | `{ error: "stripe_unavailable" }` |

### 3. `app/api/webhooks/stripe/route.ts` (refactor)

- On `checkout.session.completed`, call `createPartyFromCheckout` with
  `event.data.object`. The paid-gate now applies to the webhook too — it
  currently has **no** `payment_status` check.
- Return `200` for `created`, `exists`, `not_paid`, and `no_pending` so
  Stripe stops retrying already-handled or unrecoverable events (today it
  returns `400` for a missing pending checkout, triggering 3 days of
  pointless retries). `no_pending` is logged as an error but not retried —
  the data is gone, retrying cannot recover it.
- Return `500` only for genuine transient DB/Stripe errors, so Stripe
  retries those.
- Signature-verification failure still returns `400`.

### 4. `app/payment/success/page.tsx` (rework)

Replace the 20-second `parties` table poll with a single call to
`POST /api/checkout/finalize`:

- `{ invite_code }` → redirect to `/dashboard`.
- `{ status: "not_paid" }` → "Your payment didn't go through." + retry link.
- `503` (Stripe unavailable) → retry 2–3 times with backoff, then a calm
  message: *"Payment received — your party is being set up, check your
  dashboard shortly."* The webhook is the backstop in this case. No more
  "Something Went Wrong".
- `409` → same calm message; log for investigation.

### 5. `supabase/migrations/015_stripe_session_dedup.sql` (new)

Backfills schema drift (the live DB has `pending_checkouts` and
`parties.stripe_session_id` but no migration files define them) and adds
the dedup guarantee. All statements idempotent — no-ops against production,
correct for fresh setups.

```sql
-- Backfill: pending_checkouts (already exists in production)
CREATE TABLE IF NOT EXISTS pending_checkouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT NOT NULL,
  artist_id         UUID NOT NULL REFERENCES profiles(id),
  party_data        JSONB NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pending_checkouts ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role client (RLS-bypassing) touches it.

-- Backfill: parties.stripe_session_id (already exists in production)
ALTER TABLE parties ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- New: dedup guarantee. Unique index supports IF NOT EXISTS;
-- Postgres permits multiple NULLs, so legacy null rows are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS parties_stripe_session_id_key
  ON parties (stripe_session_id);
```

Exact column types/RLS to be re-verified against production before applying.

## Idempotency & race handling

- `parties.stripe_session_id` is unique → two parties for one payment is
  impossible at the database level.
- The shared function does a `SELECT`-before-`INSERT`, and on a `23505`
  unique violation falls back to `SELECT` — so the webhook and finalize
  racing each other always resolves to one party.
- Deleting the `pending_checkouts` row is the second guard: once consumed,
  the losing path sees no pending data but does see the party, and returns
  it.

## Testing

Unit tests on `createPartyFromCheckout` (the critical unit):
1. `payment_status !== "paid"` → nothing created, returns `not_paid`.
2. Idempotent — called twice for one session → exactly one party.
3. Race — simulated `23505` on insert → returns the existing party.
4. Happy path — party, tracks, and PIN secret all created correctly.
5. Missing `pending_checkouts` row → returns `no_pending`, no throw.

Test setup to be confirmed against the existing repo conventions during
implementation; follow TDD.

## Deployment constraint

All work happens on the `payment-self-heal` branch. **Nothing ships to
production until Scott's "Tommy Listening Event" party (2026-05-20 00:00
UTC / 9 PM ART, 2026-05-19) has ended and the user gives an explicit
go-ahead.** The migration is applied to production as part of that same
gated deploy.
