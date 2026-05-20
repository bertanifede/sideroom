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

  it("throws when a unique invite code cannot be generated", async () => {
    const client = makeFakeClient({
      parties: [
        { data: null, error: null }, // idempotency check
        { data: { id: "x" }, error: null }, // collision 1
        { data: { id: "x" }, error: null }, // collision 2
        { data: { id: "x" }, error: null }, // collision 3
        { data: { id: "x" }, error: null }, // collision 4
        { data: { id: "x" }, error: null }, // collision 5
      ],
      pending_checkouts: [
        { data: { id: "pc1", artist_id: "artist1", party_data: PARTY_DATA }, error: null },
      ],
    });
    await expect(createPartyFromCheckout(client, session())).rejects.toThrow(
      /unique invite code/
    );
  });

  it("hashes and stores the PIN, then creates the party", async () => {
    const client = makeFakeClient({
      parties: [
        { data: null, error: null }, // idempotency check
        { data: null, error: null }, // invite-code collision check
        { data: { id: "p1", invite_code: "iron-glow-abc" }, error: null }, // insert
      ],
      pending_checkouts: [
        {
          data: {
            id: "pc1",
            artist_id: "artist1",
            party_data: { ...PARTY_DATA, pin: "secret" },
          },
          error: null,
        },
        { data: null, error: null }, // delete
      ],
      party_secrets: [{ data: null, error: null }],
      tracks: [{ data: null, error: null }],
    });
    const result = await createPartyFromCheckout(client, session());
    expect(result.status).toBe("created");
  });

  it("rolls back the party and throws when track insertion fails", async () => {
    const client = makeFakeClient({
      parties: [
        { data: null, error: null }, // idempotency check
        { data: null, error: null }, // invite-code collision check
        { data: { id: "p1", invite_code: "iron-glow-abc" }, error: null }, // insert
        { data: null, error: null }, // rollback delete
      ],
      pending_checkouts: [
        { data: { id: "pc1", artist_id: "artist1", party_data: PARTY_DATA }, error: null },
      ],
      tracks: [{ data: null, error: { message: "tracks boom" } }],
    });
    await expect(createPartyFromCheckout(client, session())).rejects.toThrow(
      /Track creation failed/
    );
  });

  it("throws when the party insert fails with a non-race error", async () => {
    const client = makeFakeClient({
      parties: [
        { data: null, error: null }, // idempotency check
        { data: null, error: null }, // invite-code collision check
        { data: null, error: { code: "42501", message: "permission denied" } }, // insert
      ],
      pending_checkouts: [
        { data: { id: "pc1", artist_id: "artist1", party_data: PARTY_DATA }, error: null },
      ],
    });
    await expect(createPartyFromCheckout(client, session())).rejects.toThrow(
      /Party creation failed/
    );
  });
});
