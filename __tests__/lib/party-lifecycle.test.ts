import { describe, it, expect } from "vitest";
import { partyLifecycle } from "@/lib/party-lifecycle";

const HOUR = 60 * 60 * 1000;

function party(over: Partial<{
  scheduled_at: string;
  playback_ended_at: string | null;
  ended_at: string | null;
}>) {
  return {
    scheduled_at: new Date(0).toISOString(),
    playback_ended_at: null,
    ended_at: null,
    ...over,
  };
}

describe("partyLifecycle", () => {
  it("is 'live' before playback finishes and within the scheduled window", () => {
    const now = 2 * HOUR;
    const p = party({ scheduled_at: new Date(now - HOUR).toISOString() });
    expect(partyLifecycle(p, now)).toBe("live");
  });

  it("is 'winddown' once playback_ended_at is set and within the 1h cap", () => {
    const now = 10 * HOUR;
    const p = party({
      scheduled_at: new Date(now - HOUR).toISOString(),
      playback_ended_at: new Date(now - 30 * 60 * 1000).toISOString(),
    });
    expect(partyLifecycle(p, now)).toBe("winddown");
  });

  it("is 'ended' once playback finished more than 1h ago", () => {
    const now = 10 * HOUR;
    const p = party({
      scheduled_at: new Date(now - 2 * HOUR).toISOString(),
      playback_ended_at: new Date(now - HOUR - 60_000).toISOString(),
    });
    expect(partyLifecycle(p, now)).toBe("ended");
  });

  it("is 'ended' when ended_at is set", () => {
    const now = 5 * HOUR;
    const p = party({ ended_at: new Date(now - 60_000).toISOString() });
    expect(partyLifecycle(p, now)).toBe("ended");
  });

  it("is 'ended' more than 6h after the scheduled start even without an end", () => {
    const now = 10 * HOUR;
    const p = party({ scheduled_at: new Date(now - 7 * HOUR).toISOString() });
    expect(partyLifecycle(p, now)).toBe("ended");
  });
});
