# Self-Healing Party Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make party creation self-heal so a Stripe webhook failure can never again leave a paying customer without a party.

**Architecture:** Extract party creation into one idempotent function, `createPartyFromCheckout`, gated on Stripe-confirmed `payment_status === "paid"`. Two paths call it: the existing webhook (fast path) and a new `/api/checkout/finalize` endpoint that the success page calls (guaranteed path). A `UNIQUE` index on `parties.stripe_session_id` makes duplicates impossible.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (`@supabase/supabase-js`), Stripe Node SDK, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-19-self-healing-party-creation-design.md`

**Deployment constraint:** All work is on branch `payment-self-heal`. Nothing ships to production — and the migration is NOT applied — until Scott's "Tommy Listening Event" party has ended and the user gives an explicit go-ahead.

---

## File Structure

- **Create** `supabase/migrations/015_stripe_session_dedup.sql` — backfills schema drift + adds the dedup unique index.
- **Create** `lib/create-party-from-checkout.ts` — the single idempotent, payment-gated party-creation function.
- **Create** `__tests__/lib/create-party-from-checkout.test.ts` — unit tests for it.
- **Modify** `app/api/webhooks/stripe/route.ts` — refactor to call the shared function.
- **Create** `__tests__/api/webhooks-stripe.test.ts` — webhook tests.
- **Create** `app/api/checkout/finalize/route.ts` — the guaranteed-path endpoint.
- **Create** `__tests__/api/checkout-finalize.test.ts` — finalize endpoint tests.
- **Modify** `app/payment/success/page.tsx` — replace DB polling with a finalize call.
- **Create** `__tests__/app/payment-success.test.tsx` — success page tests.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/015_stripe_session_dedup.sql`

The live database already has `pending_checkouts` and `parties.stripe_session_id` (added out-of-band; never captured in a migration). This migration backfills those so the repo matches production, then adds the new dedup index. Every statement is idempotent: a no-op against production, correct for a fresh database. **This file is not applied now** — it is applied as part of the gated production deploy.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/015_stripe_session_dedup.sql`:

```sql
-- Self-healing party creation: schema-drift backfill + dedup guarantee.
--
-- pending_checkouts and parties.stripe_session_id already exist in the
-- production database but were never captured in a migration file. Every
-- statement here is written to be a no-op against the existing production
-- schema while still making a fresh database correct. The ONLY change to
-- production is the new unique index at the bottom.

-- Backfill: pending_checkouts.
-- No-op on production (the table already exists); creates it on a fresh DB.
CREATE TABLE IF NOT EXISTS pending_checkouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT NOT NULL,
  artist_id         UUID NOT NULL REFERENCES profiles(id),
  party_data        JSONB NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on pending_checkouts only if it is not already enabled, so
-- this migration provably does not alter the existing production table.
-- (Only the service-role client, which bypasses RLS, ever touches this
-- table; with RLS on and no policies, anon/authenticated access is denied.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'pending_checkouts'
      AND rowsecurity = true
  ) THEN
    EXECUTE 'ALTER TABLE pending_checkouts ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Backfill: parties.stripe_session_id.
-- No-op on production (the column already exists); adds it on a fresh DB.
ALTER TABLE parties ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- New: the dedup guarantee. This is the only statement that changes the
-- production schema, and it only ADDS an index -- no table, column, or
-- data is altered. Verified beforehand that parties has no duplicate
-- non-null stripe_session_id values, so the index builds cleanly.
-- Postgres permits multiple NULLs, so legacy rows with a null
-- stripe_session_id are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS parties_stripe_session_id_key
  ON parties (stripe_session_id);
```

- [ ] **Step 2: Verify the SQL**

Run: `cat supabase/migrations/015_stripe_session_dedup.sql`
Expected: file matches the block above. (No DB apply — the migration runs at deploy time.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/015_stripe_session_dedup.sql
git commit -m "Add migration 015: stripe_session_id dedup index + schema backfill"
```

---

## Task 2: Shared `createPartyFromCheckout` function

**Files:**
- Create: `lib/create-party-from-checkout.ts`
- Test: `__tests__/lib/create-party-from-checkout.test.ts`

This is the only place a party is created from a checkout. It is payment-gated, idempotent, and race-safe.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/create-party-from-checkout.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { createPartyFromCheckout } from "@/lib/create-party-from-checkout";

// --- Fake Supabase service client -------------------------------------
// Each entry in `plan[table]` is consumed in call order. Every query
// method returns the same thenable builder, so any chain shape works:
//   .select().eq().maybeSingle()      → resolves via .maybeSingle()
//   .insert().select().single()       → resolves via .single()
//   .insert(rows) / .delete().eq()    → resolved by awaiting the builder
type QueryResult = { data: unknown; error: unknown };

function makeFakeClient(plan: Record<string, QueryResult[]>) {
  const cursors: Record<string, number> = {};
  return {
    from(table: string) {
      const idx = cursors[table] ?? 0;
      cursors[table] = idx + 1;
      const result = (plan[table] ?? [])[idx] ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = chain;
      builder.eq = chain;
      builder.insert = chain;
      builder.delete = chain;
      builder.update = chain;
      builder.single = () => Promise.resolve(result);
      builder.maybeSingle = () => Promise.resolve(result);
      builder.then = (resolve: (v: QueryResult) => unknown) => resolve(result);
      return builder;
    },
  } as unknown as Parameters<typeof createPartyFromCheckout>[0];
}

function session(overrides: Partial<Stripe.Checkout.Session> = {}) {
  return {
    id: "cs_test_123",
    payment_status: "paid",
    ...overrides,
  } as Stripe.Checkout.Session;
}

const PARTY_DATA = {
  title: "My Party",
  description: "desc",
  seat_limit: 10,
  scheduled_at: "2026-06-01T00:00:00Z",
  cover_image_path: "art/cover.png",
  theme: { bg: "#000" },
  pin: null as string | null,
  tracks: [
    { file_path: "art/a.mp3", file_name: "a.mp3", position: 1, duration: 100 },
  ],
};

describe("createPartyFromCheckout", () => {
  it("creates nothing when the session is not paid", async () => {
    const client = makeFakeClient({});
    const result = await createPartyFromCheckout(
      client,
      session({ payment_status: "unpaid" })
    );
    expect(result.status).toBe("not_paid");
  });

  it("returns the existing party when one already exists (idempotent)", async () => {
    const client = makeFakeClient({
      parties: [{ data: { id: "p1", invite_code: "iron-glow-abc" }, error: null }],
    });
    const result = await createPartyFromCheckout(client, session());
    expect(result.status).toBe("exists");
    expect(result).toMatchObject({ inviteCode: "iron-glow-abc" });
  });

  it("returns no_pending when there is no pending checkout row", async () => {
    const client = makeFakeClient({
      parties: [{ data: null, error: null }],
      pending_checkouts: [{ data: null, error: null }],
    });
    const result = await createPartyFromCheckout(client, session());
    expect(result.status).toBe("no_pending");
  });

  it("creates the party, tracks, and returns created on the happy path", async () => {
    const client = makeFakeClient({
      parties: [
        { data: null, error: null }, // idempotency check
        { data: null, error: null }, // invite-code collision check
        { data: { id: "p1", invite_code: "iron-glow-abc" }, error: null }, // insert
      ],
      pending_checkouts: [
        { data: { id: "pc1", artist_id: "artist1", party_data: PARTY_DATA }, error: null },
        { data: null, error: null }, // delete
      ],
      tracks: [{ data: null, error: null }],
    });
    const result = await createPartyFromCheckout(client, session());
    expect(result.status).toBe("created");
    expect(result).toMatchObject({ inviteCode: "iron-glow-abc" });
  });

  it("returns exists when the party insert loses a race (23505)", async () => {
    const client = makeFakeClient({
      parties: [
        { data: null, error: null }, // idempotency check
        { data: null, error: null }, // invite-code collision check
        { data: null, error: { code: "23505", message: "duplicate" } }, // insert loses
        { data: { id: "p1", invite_code: "iron-glow-abc" }, error: null }, // re-select
      ],
      pending_checkouts: [
        { data: { id: "pc1", artist_id: "artist1", party_data: PARTY_DATA }, error: null },
      ],
    });
    const result = await createPartyFromCheckout(client, session());
    expect(result.status).toBe("exists");
    expect(result).toMatchObject({ inviteCode: "iron-glow-abc" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/lib/create-party-from-checkout.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/create-party-from-checkout"`.

- [ ] **Step 3: Write the implementation**

Create `lib/create-party-from-checkout.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { generateInviteCode } from "@/lib/invite-code";
import { hashPin } from "@/lib/pin";

interface PartyData {
  title: string;
  description?: string | null;
  seat_limit: number;
  scheduled_at: string;
  cover_image_path?: string | null;
  theme?: unknown;
  pin?: string | null;
  tracks?: {
    file_path: string;
    file_name: string;
    position: number;
    duration?: number | null;
  }[];
}

type PartyRef = { id: string; invite_code: string };

export type CreatePartyResult =
  | { status: "created"; party: PartyRef; inviteCode: string }
  | { status: "exists"; party: PartyRef; inviteCode: string }
  | { status: "not_paid" }
  | { status: "no_pending" };

/**
 * Creates a party from a completed Stripe Checkout session.
 *
 * The single source of truth for checkout-driven party creation, called by
 * both the Stripe webhook and the /api/checkout/finalize endpoint.
 *
 * - Payment-gated: creates nothing unless `session.payment_status === "paid"`.
 * - Idempotent: a party already created for the session is returned as-is.
 * - Race-safe: relies on the UNIQUE index on parties.stripe_session_id;
 *   the loser of a webhook-vs-finalize race returns the winner's party.
 */
export async function createPartyFromCheckout(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<CreatePartyResult> {
  // 1. Payment gate — Stripe is the source of truth.
  if (session.payment_status !== "paid") {
    return { status: "not_paid" };
  }

  const sessionId = session.id;

  // 2. Idempotency — has a party already been created for this session?
  const { data: existing } = await supabase
    .from("parties")
    .select("id, invite_code")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (existing) {
    return { status: "exists", party: existing, inviteCode: existing.invite_code };
  }

  // 3. Load the pending checkout captured at checkout time.
  const { data: pending } = await supabase
    .from("pending_checkouts")
    .select("*")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (!pending) {
    console.error(
      "createPartyFromCheckout: no pending checkout for session",
      sessionId
    );
    return { status: "no_pending" };
  }

  const partyData = pending.party_data as PartyData;

  // 4. Generate a unique invite code (invite_code is also UNIQUE in the DB).
  let invite_code = generateInviteCode();
  for (let attempts = 0; attempts < 5; attempts++) {
    const { data: clash } = await supabase
      .from("parties")
      .select("id")
      .eq("invite_code", invite_code)
      .maybeSingle();
    if (!clash) break;
    invite_code = generateInviteCode();
  }

  // 5. Hash the PIN if one was set.
  let pin_hash: string | null = null;
  if (partyData.pin) {
    pin_hash = await hashPin(partyData.pin);
  }

  // 6. Insert the party.
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .insert({
      invite_code,
      artist_id: pending.artist_id,
      title: partyData.title,
      description: partyData.description ?? null,
      seat_limit: partyData.seat_limit,
      scheduled_at: partyData.scheduled_at,
      payment_status: "paid",
      cover_image_path: partyData.cover_image_path ?? null,
      theme: partyData.theme ?? null,
      stripe_session_id: sessionId,
      // Legacy fields — populated from the first track.
      file_path: partyData.tracks?.[0]?.file_path,
      file_name: partyData.tracks?.[0]?.file_name,
    })
    .select("id, invite_code")
    .single();

  if (partyError) {
    // 23505 = unique violation. The other path (webhook vs finalize) won
    // the race and already created the party — return that one.
    if (partyError.code === "23505") {
      const { data: raced } = await supabase
        .from("parties")
        .select("id, invite_code")
        .eq("stripe_session_id", sessionId)
        .single();
      if (raced) {
        return { status: "exists", party: raced, inviteCode: raced.invite_code };
      }
    }
    throw new Error(`Party creation failed: ${partyError.message}`);
  }

  // 7. Store the PIN hash in the secrets table.
  if (pin_hash) {
    await supabase
      .from("party_secrets")
      .insert({ party_id: party.id, pin_hash });
  }

  // 8. Insert tracks.
  if (partyData.tracks?.length) {
    const trackRows = partyData.tracks.map((t) => ({
      party_id: party.id,
      position: t.position,
      file_path: t.file_path,
      file_name: t.file_name,
      duration: t.duration ?? null,
    }));
    const { error: tracksError } = await supabase
      .from("tracks")
      .insert(trackRows);
    if (tracksError) {
      // Roll back the party so it is not left track-less.
      await supabase.from("parties").delete().eq("id", party.id);
      throw new Error(`Track creation failed: ${tracksError.message}`);
    }
  }

  // 9. Delete the consumed pending checkout.
  await supabase.from("pending_checkouts").delete().eq("id", pending.id);

  return { status: "created", party, inviteCode: party.invite_code };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/lib/create-party-from-checkout.test.ts`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/create-party-from-checkout.ts __tests__/lib/create-party-from-checkout.test.ts
git commit -m "Add payment-gated, idempotent createPartyFromCheckout"
```

---

## Task 3: Refactor the Stripe webhook

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts` (full rewrite — replaces inline creation with the shared function)
- Test: `__tests__/api/webhooks-stripe.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/webhooks-stripe.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockConstructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: (...a: unknown[]) => mockConstructEvent(...a) } },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(() => Promise.resolve({})),
}));

const mockCreateParty = vi.fn();
vi.mock("@/lib/create-party-from-checkout", () => ({
  createPartyFromCheckout: (...a: unknown[]) => mockCreateParty(...a),
}));

import { POST } from "@/app/api/webhooks/stripe/route";

function makeRequest(signature: string | null) {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body: "{}",
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when the signature header is missing", async () => {
    const res = await POST(makeRequest(null));
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await POST(makeRequest("sig"));
    expect(res.status).toBe(400);
  });

  it("returns 200 when a party is created", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", payment_status: "paid" } },
    });
    mockCreateParty.mockResolvedValue({ status: "created" });
    const res = await POST(makeRequest("sig"));
    expect(res.status).toBe(200);
  });

  it("returns 200 (no retry) when the pending checkout is gone", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", payment_status: "paid" } },
    });
    mockCreateParty.mockResolvedValue({ status: "no_pending" });
    const res = await POST(makeRequest("sig"));
    expect(res.status).toBe(200);
  });

  it("returns 500 so Stripe retries when creation throws", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", payment_status: "paid" } },
    });
    mockCreateParty.mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest("sig"));
    expect(res.status).toBe(500);
  });

  it("returns 200 for unrelated event types", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: {} },
    });
    const res = await POST(makeRequest("sig"));
    expect(res.status).toBe(200);
    expect(mockCreateParty).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/api/webhooks-stripe.test.ts`
Expected: FAIL — current webhook returns 400 for `no_pending` (the 4th test fails) and has no shared-function wiring.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `app/api/webhooks/stripe/route.ts` with:

```ts
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { createPartyFromCheckout } from "@/lib/create-party-from-checkout";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    try {
      const supabase = await createServiceClient();
      const result = await createPartyFromCheckout(supabase, event.data.object);
      // created | exists | not_paid | no_pending are all terminal — return
      // 200 so Stripe stops retrying. (no_pending is logged inside the
      // shared function; retrying cannot recover deleted data.)
      return NextResponse.json({ received: true, status: result.status });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Stripe webhook: party creation error:", message);
      // 500 → Stripe retries (genuine transient DB/Stripe failure).
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/api/webhooks-stripe.test.ts`
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/stripe/route.ts __tests__/api/webhooks-stripe.test.ts
git commit -m "Refactor Stripe webhook to use createPartyFromCheckout"
```

---

## Task 4: The `/api/checkout/finalize` endpoint

**Files:**
- Create: `app/api/checkout/finalize/route.ts`
- Test: `__tests__/api/checkout-finalize.test.ts`

The guaranteed path: the success page calls this; it verifies payment directly with Stripe and creates the party if missing.

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/checkout-finalize.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve({ auth: { getUser: mockGetUser } })),
  createServiceClient: vi.fn(() => Promise.resolve({})),
}));

const mockRetrieve = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: { checkout: { sessions: { retrieve: (...a: unknown[]) => mockRetrieve(...a) } } },
}));

const mockCreateParty = vi.fn();
vi.mock("@/lib/create-party-from-checkout", () => ({
  createPartyFromCheckout: (...a: unknown[]) => mockCreateParty(...a),
}));

import { POST } from "@/app/api/checkout/finalize/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/checkout/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkout/finalize", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when the user is not logged in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest({ session_id: "cs_1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when session_id is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 503 when Stripe is unreachable", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRetrieve.mockRejectedValue(new Error("network"));
    const res = await POST(makeRequest({ session_id: "cs_1" }));
    expect(res.status).toBe(503);
  });

  it("returns 403 when the session belongs to another user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRetrieve.mockResolvedValue({ id: "cs_1", metadata: { artist_id: "someone_else" } });
    const res = await POST(makeRequest({ session_id: "cs_1" }));
    expect(res.status).toBe(403);
  });

  it("returns 200 with invite_code when the party is created", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRetrieve.mockResolvedValue({ id: "cs_1", metadata: { artist_id: "u1" } });
    mockCreateParty.mockResolvedValue({ status: "created", inviteCode: "iron-glow-abc" });
    const res = await POST(makeRequest({ session_id: "cs_1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ invite_code: "iron-glow-abc" });
  });

  it("returns 200 with not_paid status when the session is unpaid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRetrieve.mockResolvedValue({ id: "cs_1", metadata: { artist_id: "u1" } });
    mockCreateParty.mockResolvedValue({ status: "not_paid" });
    const res = await POST(makeRequest({ session_id: "cs_1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "not_paid" });
  });

  it("returns 409 when the checkout data is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRetrieve.mockResolvedValue({ id: "cs_1", metadata: { artist_id: "u1" } });
    mockCreateParty.mockResolvedValue({ status: "no_pending" });
    const res = await POST(makeRequest({ session_id: "cs_1" }));
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/api/checkout-finalize.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/api/checkout/finalize/route"`.

- [ ] **Step 3: Write the implementation**

Create `app/api/checkout/finalize/route.ts`:

```ts
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { createPartyFromCheckout } from "@/lib/create-party-from-checkout";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = body?.session_id;
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  // Verify payment directly with Stripe — the source of truth.
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("checkout/finalize: Stripe retrieve failed:", message);
    return NextResponse.json({ error: "stripe_unavailable" }, { status: 503 });
  }

  // Ownership — the session must belong to the logged-in user.
  if (session.metadata?.artist_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const serviceClient = await createServiceClient();
    const result = await createPartyFromCheckout(serviceClient, session);

    if (result.status === "created" || result.status === "exists") {
      return NextResponse.json({ invite_code: result.inviteCode });
    }
    if (result.status === "not_paid") {
      return NextResponse.json({ status: "not_paid" });
    }
    // no_pending — the checkout data is gone; cannot self-heal.
    return NextResponse.json({ error: "checkout_data_missing" }, { status: 409 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("checkout/finalize: party creation error:", message);
    return NextResponse.json({ error: "creation_failed" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/api/checkout-finalize.test.ts`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/checkout/finalize/route.ts __tests__/api/checkout-finalize.test.ts
git commit -m "Add /api/checkout/finalize self-heal endpoint"
```

---

## Task 5: Rework the payment success page

**Files:**
- Modify: `app/payment/success/page.tsx` (full rewrite)
- Test: `__tests__/app/payment-success.test.tsx`

Replace the 20-second `parties` poll with a single call to `/api/checkout/finalize`. The party is guaranteed created (if paid) the moment the buyer reaches this page.

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/payment-success.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

let searchString = "session_id=cs_1";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchString),
}));

import PaymentSuccessPage from "@/app/payment/success/page";

describe("PaymentSuccessPage", () => {
  beforeEach(() => {
    searchString = "session_id=cs_1";
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the no-session error when session_id is absent", async () => {
    searchString = "";
    vi.stubGlobal("fetch", vi.fn());
    render(<PaymentSuccessPage />);
    await vi.runAllTimersAsync();
    expect(screen.getByText(/no payment session found/i)).toBeInTheDocument();
  });

  it("shows the payment-failed message when finalize reports not_paid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "not_paid" }),
      })
    );
    render(<PaymentSuccessPage />);
    await vi.runAllTimersAsync();
    expect(screen.getByText(/payment didn.?t go through/i)).toBeInTheDocument();
  });

  it("shows the calm pending message after finalize keeps failing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) })
    );
    render(<PaymentSuccessPage />);
    await vi.runAllTimersAsync();
    expect(screen.getByText(/being set up/i)).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/app/payment-success.test.tsx`
Expected: FAIL — current page polls Supabase and renders "Something Went Wrong", not the new messages.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `app/payment/success/page.tsx` with:

```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "loading" | "no_session" | "not_paid" | "pending";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

function Spinner() {
  return (
    <svg
      className="size-6 text-text-primary animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function DashboardLink({ label }: { label: string }) {
  return (
    <a
      href="/dashboard"
      className="inline-flex items-center justify-center rounded-md bg-surface border border-surface-border text-text-primary px-4 py-2 text-sm font-medium hover:bg-surface-hover transition-colors"
    >
      {label}
    </a>
  );
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!sessionId) {
      setStatus("no_session");
      return;
    }

    let cancelled = false;

    const finalize = async (attempt: number): Promise<void> => {
      try {
        const res = await fetch("/api/checkout/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          if (data.invite_code) {
            window.location.href = "/dashboard";
            return;
          }
          if (data.status === "not_paid") {
            setStatus("not_paid");
            return;
          }
        }

        // 5xx / 409 / unexpected — retry a few times, then the webhook
        // is the backstop: show the calm "being set up" message.
        if (attempt + 1 < MAX_ATTEMPTS) {
          setTimeout(() => finalize(attempt + 1), RETRY_DELAY_MS);
          return;
        }
        setStatus("pending");
      } catch {
        if (cancelled) return;
        if (attempt + 1 < MAX_ATTEMPTS) {
          setTimeout(() => finalize(attempt + 1), RETRY_DELAY_MS);
          return;
        }
        setStatus("pending");
      }
    };

    finalize(0);
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (status === "no_session") {
    return (
      <div className="max-w-md w-full px-6 text-center">
        <h1 className="text-xl font-bold mb-2">Something Went Wrong</h1>
        <p className="text-text-secondary mb-6">No payment session found.</p>
        <DashboardLink label="Go to Dashboard" />
      </div>
    );
  }

  if (status === "not_paid") {
    return (
      <div className="max-w-md w-full px-6 text-center">
        <h1 className="text-xl font-bold mb-2">Payment Didn&apos;t Go Through</h1>
        <p className="text-text-secondary mb-6">
          Your payment wasn&apos;t completed, so no party was created. You can
          try again from your dashboard.
        </p>
        <DashboardLink label="Go to Dashboard" />
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="max-w-md w-full px-6 text-center">
        <h1 className="text-xl font-bold mb-2">Payment Received</h1>
        <p className="text-text-secondary mb-6">
          Your party is being set up — it will appear on your dashboard
          shortly.
        </p>
        <DashboardLink label="Go to Dashboard" />
      </div>
    );
  }

  // loading
  return (
    <div className="max-w-md w-full px-6 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-surface">
        <Spinner />
      </div>
      <h1 className="text-xl font-bold mb-2">Confirming Payment...</h1>
      <p className="text-text-secondary">
        Setting up your party. You&apos;ll be redirected automatically.
      </p>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-blue text-text-primary">
      <Suspense
        fallback={
          <div className="max-w-md w-full px-6 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-surface">
              <Spinner />
            </div>
            <h1 className="text-xl font-bold mb-2">Confirming Payment...</h1>
          </div>
        }
      >
        <PaymentSuccessContent />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/app/payment-success.test.tsx`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/payment/success/page.tsx __tests__/app/payment-success.test.tsx
git commit -m "Rework payment success page to self-heal via /api/checkout/finalize"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all suites green, including the 4 pre-existing test files.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Confirm the deployment gate**

Verify nothing has been pushed or deployed: `git status` shows the branch `payment-self-heal` with all work committed locally. The migration `015_stripe_session_dedup.sql` has NOT been applied to production. Deployment and migration happen only after Scott's party ends and the user gives the go-ahead.

- [ ] **Step 5: Final commit (if anything outstanding)**

```bash
git status
# If verification produced fixes, commit them:
git add -A
git commit -m "Verification fixes for self-healing party creation"
```

---

## Self-Review

**Spec coverage:**
- Shared `createPartyFromCheckout` (paid gate, idempotency, race) → Task 2 ✓
- `/api/checkout/finalize` endpoint → Task 4 ✓
- Webhook refactor + return-code change → Task 3 ✓
- Success page rework (no_session / not_paid / pending) → Task 5 ✓
- Migration: `pending_checkouts` backfill, `stripe_session_id` column, UNIQUE index → Task 1 ✓
- Testing (5 named cases for the shared function) → Task 2 Step 1 ✓
- Deployment gate → Task 6 Step 4 ✓

**Type consistency:** `CreatePartyResult` statuses (`created`, `exists`, `not_paid`, `no_pending`) are produced in Task 2 and consumed identically in Tasks 3 and 4. `inviteCode` (camelCase) is the result field; `invite_code` (snake_case) is the JSON/DB field — used consistently.

**Out of scope (per spec):** email/SMS alerts, reconciliation cron, async-payment webhooks. Not in any task — intentional.
