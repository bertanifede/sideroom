import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockServiceFrom = vi.fn();
const mockCreateServiceClient = vi.fn(() => ({
  from: mockServiceFrom,
}));

const mockAuthGetUser = vi.fn();
const mockCreateClient = vi.fn(() => ({
  auth: { getUser: mockAuthGetUser },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => mockCreateServiceClient(),
  createClient: () => mockCreateClient(),
}));

const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
}));

import { GET } from "@/app/api/party/[id]/playback-state/route";

/**
 * Build a chainable Supabase query mock that resolves to `result`.
 * Handles arbitrary .select().eq().eq().is().single() chains.
 */
function fakeQuery(result: { data: unknown }) {
  // Every method returns the same proxy so any chain order works
  const proxy: Record<string, unknown> = {};
  const handler = () => proxy;
  proxy.select = handler;
  proxy.eq = handler;
  proxy.is = handler;
  proxy.single = () => Promise.resolve(result);
  return () => proxy;
}

function makeRequest() {
  return new Request("http://localhost/api/party/abc/playback-state");
}
function makeParams() {
  return { params: Promise.resolve({ id: "abc" }) };
}

describe("GET /api/party/[id]/playback-state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when no guest token and no auth user", async () => {
    mockCookieGet.mockReturnValue(undefined);
    mockServiceFrom.mockImplementation(fakeQuery({ data: null }));
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns playback_state when guest token is valid (seated guest)", async () => {
    mockCookieGet.mockReturnValue({ value: "tok123" });

    const responses = [
      { data: { id: "seat1" } },             // seats query → found
      { data: { playback_state: { track_position: 2, position: 10, is_playing: true, updated_at: "2024-01-01T00:00:00Z" } } },
    ];
    let call = 0;
    mockServiceFrom.mockImplementation(() => fakeQuery(responses[call++])());

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      playback_state: { track_position: 2, position: 10, is_playing: true, updated_at: "2024-01-01T00:00:00Z" },
    });
  });

  it("returns playback_state when authenticated artist", async () => {
    mockCookieGet.mockReturnValue(undefined); // no guest cookie → skip seats query

    const responses = [
      { data: { artist_id: "user1" } },      // parties → artist_id
      { data: { playback_state: { track_position: 1, position: 0, is_playing: false, updated_at: "2024-01-01T00:00:00Z" } } },
    ];
    let call = 0;
    mockServiceFrom.mockImplementation(() => fakeQuery(responses[call++])());

    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user1" } } });

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      playback_state: { track_position: 1, position: 0, is_playing: false, updated_at: "2024-01-01T00:00:00Z" },
    });
  });

  it("returns null when party has no playback state", async () => {
    mockCookieGet.mockReturnValue({ value: "tok123" });

    const responses = [
      { data: { id: "seat1" } },
      { data: { playback_state: null } },
    ];
    let call = 0;
    mockServiceFrom.mockImplementation(() => fakeQuery(responses[call++])());

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ playback_state: null });
  });
});
