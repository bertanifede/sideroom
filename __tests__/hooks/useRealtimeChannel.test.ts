import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Capture the subscribe callback
let subscribeCallback: ((status: string) => void) | null = null;

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn((cb: (status: string) => void) => {
    subscribeCallback = cb;
  }),
  track: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn(),
  presenceState: vi.fn().mockReturnValue({}),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => mockChannel,
  }),
}));

import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";

describe("useRealtimeChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeCallback = null;
  });

  it("isConnected becomes true on SUBSCRIBED", async () => {
    const { result } = renderHook(() =>
      useRealtimeChannel("party1", "Alice", "🎧")
    );

    expect(result.current.isConnected).toBe(false);

    await act(async () => {
      subscribeCallback?.("SUBSCRIBED");
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("isConnected becomes false on CHANNEL_ERROR", async () => {
    const { result } = renderHook(() =>
      useRealtimeChannel("party1", "Alice", "🎧")
    );

    // First connect
    await act(async () => {
      subscribeCallback?.("SUBSCRIBED");
    });
    expect(result.current.isConnected).toBe(true);

    // Then error
    await act(async () => {
      subscribeCallback?.("CHANNEL_ERROR");
    });
    expect(result.current.isConnected).toBe(false);
  });

  it("isConnected becomes false on TIMED_OUT", async () => {
    const { result } = renderHook(() =>
      useRealtimeChannel("party1", "Alice", "🎧")
    );

    await act(async () => {
      subscribeCallback?.("SUBSCRIBED");
    });
    expect(result.current.isConnected).toBe(true);

    await act(async () => {
      subscribeCallback?.("TIMED_OUT");
    });
    expect(result.current.isConnected).toBe(false);
  });
});
