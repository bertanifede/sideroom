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
