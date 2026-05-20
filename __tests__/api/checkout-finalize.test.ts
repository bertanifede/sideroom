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

  it("returns 200 with invite_code when the party already exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRetrieve.mockResolvedValue({ id: "cs_1", metadata: { artist_id: "u1" } });
    mockCreateParty.mockResolvedValue({ status: "exists", inviteCode: "iron-glow-abc" });
    const res = await POST(makeRequest({ session_id: "cs_1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ invite_code: "iron-glow-abc" });
  });

  it("returns 500 when party creation throws", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRetrieve.mockResolvedValue({ id: "cs_1", metadata: { artist_id: "u1" } });
    mockCreateParty.mockRejectedValue(new Error("db down"));
    const res = await POST(makeRequest({ session_id: "cs_1" }));
    expect(res.status).toBe(500);
  });

  it("returns 400 when session_id is not a string", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await POST(makeRequest({ session_id: 12345 }));
    expect(res.status).toBe(400);
  });
});
