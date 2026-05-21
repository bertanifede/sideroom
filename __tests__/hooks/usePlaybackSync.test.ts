import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  usePlaybackSync,
  computeSeekPosition,
  decideCorrection,
  shouldRetryAfterError,
} from "@/hooks/usePlaybackSync";
import type { Track, PlaybackState } from "@/types";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Pure function tests — no hooks, no timing, no mocks needed
// ---------------------------------------------------------------------------

describe("computeSeekPosition", () => {
  it("caps elapsed at 30s when updated_at is 60s ago", () => {
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    const result = computeSeekPosition(10, sixtySecondsAgo, 200);
    // 10 + min(60, 30) = 40, capped by duration 200 → 40
    expect(result).toBe(40);
  });

  it("uses actual elapsed when updated_at is 5s ago", () => {
    const fiveSecondsAgo = new Date(Date.now() - 5_000).toISOString();
    const result = computeSeekPosition(10, fiveSecondsAgo, 200);
    // 10 + ~5 ≈ 15
    expect(result).toBeGreaterThanOrEqual(14);
    expect(result).toBeLessThanOrEqual(16);
  });

  it("clamps seekTo to track duration", () => {
    const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
    const result = computeSeekPosition(190, thirtySecondsAgo, 200);
    // 190 + 30 = 220, capped at 200
    expect(result).toBe(200);
  });

  it("does not clamp when duration is null", () => {
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    const result = computeSeekPosition(100, tenSecondsAgo, null);
    // 100 + ~10 ≈ 110, no cap
    expect(result).toBeGreaterThanOrEqual(109);
    expect(result).toBeLessThanOrEqual(111);
  });
});

describe("decideCorrection", () => {
  it("returns 'none' within the tolerance band, in either direction", () => {
    expect(decideCorrection(0)).toEqual({ action: "none" });
    expect(decideCorrection(5)).toEqual({ action: "none" });
    expect(decideCorrection(-8)).toEqual({ action: "none" });
    expect(decideCorrection(10)).toEqual({ action: "none" });
    expect(decideCorrection(-10)).toEqual({ action: "none" });
  });

  it("returns 'seek' only when drift exceeds the tolerance", () => {
    expect(decideCorrection(10.5)).toEqual({ action: "seek" });
    expect(decideCorrection(30)).toEqual({ action: "seek" });
    expect(decideCorrection(-12)).toEqual({ action: "seek" });
  });
});

describe("shouldRetryAfterError", () => {
  it("allows a retry when there are no prior errors", () => {
    expect(shouldRetryAfterError([], 1000)).toBe(true);
  });

  it("allows retries while within the budget", () => {
    expect(shouldRetryAfterError([1000, 1100, 1200], 1300)).toBe(true);
  });

  it("stops retrying once the budget is exceeded within the window", () => {
    expect(shouldRetryAfterError([1000, 1100, 1200, 1300, 1400], 1500)).toBe(false);
  });

  it("ignores errors older than the window", () => {
    // four old errors + one recent → only one counts
    expect(shouldRetryAfterError([1000, 1100, 1200, 1300, 50000], 50100)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Hook integration tests — only for behavior that requires React lifecycle
// ---------------------------------------------------------------------------

// Minimal mock audio that tracks mutations
function createMockAudio() {
  let _src = "";
  let _currentTime = 0;
  let _paused = true;
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  return {
    get src() { return _src; },
    set src(v: string) { _src = v; },
    get currentTime() { return _currentTime; },
    set currentTime(v: number) { _currentTime = v; },
    get paused() { return _paused; },
    get duration() { return 200; },
    play: vi.fn(() => { _paused = false; return Promise.resolve(); }),
    pause: vi.fn(() => { _paused = true; }),
    addEventListener: vi.fn((e: string, h: (...a: unknown[]) => void) => {
      (listeners[e] ??= []).push(h);
    }),
    removeEventListener: vi.fn((e: string, h: (...a: unknown[]) => void) => {
      if (listeners[e]) listeners[e] = listeners[e].filter((x) => x !== h);
    }),
    removeAttribute: vi.fn((attr: string) => {
      if (attr === "src") _src = "";
    }),
    load: vi.fn(),
    preload: "",
    crossOrigin: null,
    playbackRate: 1,
  } as unknown as HTMLAudioElement;
}

function createMockChannel() {
  const handlers: Record<string, ((payload: unknown) => void)> = {};
  return {
    send: vi.fn(),
    on: vi.fn((_type: string, opts: { event: string }, handler: (payload: unknown) => void) => {
      handlers[opts.event] = handler;
      return { subscribe: vi.fn() };
    }),
    off: vi.fn(),
    _trigger(payload: unknown, event = "playback") { handlers[event]?.(payload); },
  };
}

const baseTracks: Track[] = [
  { id: "t1", party_id: "p1", position: 1, file_path: "a.mp3", file_name: "Track 1", duration: 200, created_at: "" },
  { id: "t2", party_id: "p1", position: 2, file_path: "b.mp3", file_name: "Track 2", duration: 180, created_at: "" },
  { id: "t3", party_id: "p1", position: 3, file_path: "c.mp3", file_name: "Track 3", duration: 240, created_at: "" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyChannel = any;

// Helper: renders the hook with audioRef pre-attached (so it's available during effects)
function renderWithAudio(
  audio: HTMLAudioElement,
  props: Parameters<typeof usePlaybackSync>[0],
  preloadAudio?: HTMLAudioElement
) {
  return renderHook(() => {
    const hookResult = usePlaybackSync(props);
    // Set during render phase, before effects run
    (hookResult.audioRef as { current: HTMLAudioElement }).current = audio;
    if (preloadAudio) {
      (hookResult.preloadAudioRef as { current: HTMLAudioElement }).current = preloadAudio;
    }
    return hookResult;
  });
}

describe("usePlaybackSync hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://cdn.example.com/stream.mp3" }),
    });
  });

  it("guest recovery guard: ignores broadcasts until recovery completes", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();

    // Recovery will hang because play() never resolves
    (audio.play as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

    renderWithAudio(audio, {
      channel: channel as AnyChannel,
      isArtist: false,
      tracks: baseTracks,
      partyId: "p1",
      initialPlaybackState: {
        track_position: 1, position: 10, is_playing: true,
        updated_at: new Date().toISOString(),
      },
      isConnected: true,
    });

    // Fire a PAUSE broadcast — should be ignored because recoveryCompleteRef is still false
    await act(async () => {
      channel._trigger({ payload: { type: "PAUSE", position: 5 } });
    });

    expect(audio.pause).not.toHaveBeenCalled();
  });

  it("mount recovery: uses proxy URL without fetching stream-url endpoint", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();

    const state: PlaybackState = {
      track_position: 1,
      position: 5,
      is_playing: true,
      updated_at: new Date().toISOString(),
    };

    renderWithAudio(audio, {
      channel: channel as AnyChannel,
      isArtist: false,
      tracks: baseTracks,
      partyId: "p1",
      initialPlaybackState: state,
      isConnected: true,
    });

    await waitFor(() => {
      expect(audio.play).toHaveBeenCalled();
    });

    // Proxy URL set directly — no fetch to stream-url
    expect(audio.src).toBe("/api/party/p1/stream?track=1");
    const streamUrlFetches = mockFetch.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("stream-url")
    );
    expect(streamUrlFetches).toHaveLength(0);
  });

  it("guest PLAY broadcast: sets proxy URL for the correct track", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();

    renderWithAudio(audio, {
      channel: channel as AnyChannel,
      isArtist: false,
      tracks: baseTracks,
      partyId: "p1",
      initialPlaybackState: null,
      isConnected: true,
    });

    await act(async () => {});

    // Artist sends PLAY for track 2
    await act(async () => {
      channel._trigger({
        payload: { type: "PLAY", position: 0, track_position: 2 },
      });
    });

    // Should set proxy URL for track 2, not fetch a signed URL
    expect(audio.src).toBe("/api/party/p1/stream?track=2");
    const streamUrlFetches = mockFetch.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("stream-url")
    );
    expect(streamUrlFetches).toHaveLength(0);
  });

  it("guest HEARTBEAT: sets proxy URL on track change", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();

    renderWithAudio(audio, {
      channel: channel as AnyChannel,
      isArtist: false,
      tracks: baseTracks,
      partyId: "p1",
      initialPlaybackState: null, // no recovery → recoveryComplete = true immediately
      isConnected: true,
    });

    // Wait for recovery to mark complete (null state → synchronous)
    await act(async () => {});

    // HEARTBEAT with track 2 (different from default track 1)
    await act(async () => {
      channel._trigger({
        payload: { type: "HEARTBEAT", position: 15, track_position: 2, is_playing: true },
      });
    });

    // Should set proxy URL directly (no fetch)
    expect(audio.src).toBe("/api/party/p1/stream?track=2");
  });

  it("guest HEARTBEAT: hard-seeks when drift exceeds the seek threshold", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();
    audio.src = "https://cdn.example.com/stream.mp3";
    (audio as unknown as { currentTime: number }).currentTime = 50;

    renderWithAudio(audio, {
      channel: channel as AnyChannel,
      isArtist: false,
      tracks: baseTracks,
      partyId: "p1",
      initialPlaybackState: null,
      isConnected: true,
    });

    await act(async () => {});

    await act(async () => {
      channel._trigger({
        payload: { type: "HEARTBEAT", position: 100, track_position: 1, is_playing: true },
      });
    });

    // delta = 100 - 50 = 50 → seek
    expect(audio.currentTime).toBe(100);
    expect(audio.playbackRate).toBe(1);
  });

  it("guest HEARTBEAT: leaves playback untouched for drift within tolerance", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();
    audio.src = "https://cdn.example.com/stream.mp3";
    (audio as unknown as { currentTime: number }).currentTime = 50;

    renderWithAudio(audio, {
      channel: channel as AnyChannel,
      isArtist: false,
      tracks: baseTracks,
      partyId: "p1",
      initialPlaybackState: null,
      isConnected: true,
    });

    await act(async () => {});

    await act(async () => {
      channel._trigger({
        payload: { type: "HEARTBEAT", position: 58, track_position: 1, is_playing: true },
      });
    });

    // delta = 58 - 50 = 8 → within 10s tolerance → no seek, no rate change
    expect(audio.currentTime).toBe(50);
    expect(audio.playbackRate).toBe(1);
  });

  it("guest: resumes immediately when the audio is paused externally (route change)", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();
    audio.src = "https://cdn.example.com/stream.mp3";

    renderWithAudio(audio, {
      channel: channel as AnyChannel,
      isArtist: false,
      tracks: baseTracks,
      partyId: "p1",
      initialPlaybackState: null,
      isConnected: true,
    });
    await act(async () => {});

    // Get the guest playing via a heartbeat.
    await act(async () => {
      channel._trigger({
        payload: { type: "HEARTBEAT", position: 0, track_position: 1, is_playing: true },
      });
    });
    const playsBefore = (audio.play as ReturnType<typeof vi.fn>).mock.calls.length;

    // Simulate iOS pausing the element on a route change, then the pause event.
    audio.pause();
    const pauseCalls = (audio.addEventListener as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === "pause"
    );
    const onPause = pauseCalls[pauseCalls.length - 1][1] as () => void;
    await act(async () => {
      onPause();
    });

    // The external pause was auto-resumed.
    expect((audio.play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      playsBefore + 1
    );
  });

  it("guest: does NOT auto-resume after the host pauses (no resume loop)", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();
    audio.src = "https://cdn.example.com/stream.mp3";

    renderWithAudio(audio, {
      channel: channel as AnyChannel,
      isArtist: false,
      tracks: baseTracks,
      partyId: "p1",
      initialPlaybackState: null,
      isConnected: true,
    });
    await act(async () => {});

    // Get the guest playing.
    await act(async () => {
      channel._trigger({
        payload: { type: "HEARTBEAT", position: 0, track_position: 1, is_playing: true },
      });
    });

    // Host pauses the party.
    await act(async () => {
      channel._trigger({ payload: { type: "PAUSE", position: 12 } });
    });
    const playsBefore = (audio.play as ReturnType<typeof vi.fn>).mock.calls.length;

    // The host's pause() fires the audio "pause" event — the listener must NOT
    // resume it (that would fight the host and create a play/pause loop).
    const pauseCalls = (audio.addEventListener as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === "pause"
    );
    const onPause = pauseCalls[pauseCalls.length - 1][1] as () => void;
    await act(async () => {
      onPause();
    });

    expect((audio.play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      playsBefore
    );
  });

  it("guest HEARTBEAT: leaves playback untouched within the dead zone", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();
    audio.src = "https://cdn.example.com/stream.mp3";
    (audio as unknown as { currentTime: number }).currentTime = 50;

    renderWithAudio(audio, {
      channel: channel as AnyChannel,
      isArtist: false,
      tracks: baseTracks,
      partyId: "p1",
      initialPlaybackState: null,
      isConnected: true,
    });

    await act(async () => {});

    await act(async () => {
      channel._trigger({
        payload: { type: "HEARTBEAT", position: 51, track_position: 1, is_playing: true },
      });
    });

    // delta = 1 → dead zone, no change
    expect(audio.currentTime).toBe(50);
    expect(audio.playbackRate).toBe(1);
  });

  it("guest HEARTBEAT: resumes play when artist is_playing but audio is paused", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();
    audio.src = "https://cdn.example.com/stream.mp3";

    renderWithAudio(audio, {
      channel: channel as AnyChannel,
      isArtist: false,
      tracks: baseTracks,
      partyId: "p1",
      initialPlaybackState: null,
      isConnected: true,
    });

    await act(async () => {});

    await act(async () => {
      channel._trigger({
        payload: { type: "HEARTBEAT", position: 10, track_position: 1, is_playing: true },
      });
    });

    expect(audio.play).toHaveBeenCalled();
  });

  it("artist: does not listen for broadcast events", () => {
    const channel = createMockChannel();

    renderHook(() =>
      usePlaybackSync({
        channel: channel as AnyChannel,
        isArtist: true,
        tracks: baseTracks,
        partyId: "p1",
        initialPlaybackState: null,
        isConnected: true,
      })
    );

    // channel.on should NOT be called for broadcast when isArtist=true
    // The effect returns early: `if (!channel || isArtist) return`
    const broadcastCalls = (channel.on as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: unknown[]) => call[0] === "broadcast"
    );
    expect(broadcastCalls).toHaveLength(0);
  });

  it("mount recovery: seeks to computed position and plays", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();

    const fiveSecondsAgo = new Date(Date.now() - 5_000).toISOString();
    const state: PlaybackState = {
      track_position: 1,
      position: 10,
      is_playing: true,
      updated_at: fiveSecondsAgo,
    };

    renderWithAudio(audio, {
      channel: channel as AnyChannel,
      isArtist: false,
      tracks: baseTracks,
      partyId: "p1",
      initialPlaybackState: state,
      isConnected: true,
    });

    await waitFor(() => {
      expect(audio.play).toHaveBeenCalled();
    });

    // ~15s (10 + 5s elapsed)
    expect(audio.currentTime).toBeGreaterThanOrEqual(14);
    expect(audio.currentTime).toBeLessThanOrEqual(17);
    expect(audio.src).toBe("/api/party/p1/stream?track=1");
  });

  // -------------------------------------------------------------------------
  // Late joiner scenarios — guest arrives mid-stream
  // -------------------------------------------------------------------------
  describe("late joiner", () => {
    it("joins mid-party on track 3 and seeks to correct position", async () => {
      const channel = createMockChannel();
      const audio = createMockAudio();

      const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
      const state: PlaybackState = {
        track_position: 3,
        position: 60,
        is_playing: true,
        updated_at: tenSecondsAgo,
      };

      const { result } = renderWithAudio(audio, {
        channel: channel as AnyChannel,
        isArtist: false,
        tracks: baseTracks,
        partyId: "p1",
        initialPlaybackState: state,
        isConnected: true,
      });

      await waitFor(() => {
        expect(audio.play).toHaveBeenCalled();
      });

      // Should set proxy URL for track 3 (no fetch needed)
      expect(audio.src).toBe("/api/party/p1/stream?track=3");

      // 60 + ~10s elapsed ≈ 70
      expect(audio.currentTime).toBeGreaterThanOrEqual(69);
      expect(audio.currentTime).toBeLessThanOrEqual(72);

      // Hook state should reflect track 3
      expect(result.current.currentTrackPosition).toBe(3);
    });

    it("joins when artist is paused — does NOT auto-play", async () => {
      const channel = createMockChannel();
      const audio = createMockAudio();

      const state: PlaybackState = {
        track_position: 2,
        position: 45,
        is_playing: false,
        updated_at: new Date().toISOString(),
      };

      const { result } = renderWithAudio(audio, {
        channel: channel as AnyChannel,
        isArtist: false,
        tracks: baseTracks,
        partyId: "p1",
        initialPlaybackState: state,
        isConnected: true,
      });

      // Give effects a chance to run
      await act(async () => {});

      // Should NOT have called play — artist is paused
      expect(audio.play).not.toHaveBeenCalled();

      // But track position should still be updated
      expect(result.current.currentTrackPosition).toBe(2);
    });

    it("joins and sets proxy URL even without network — browser handles errors", async () => {
      const channel = createMockChannel();
      const audio = createMockAudio();

      const state: PlaybackState = {
        track_position: 1,
        position: 30,
        is_playing: true,
        updated_at: new Date().toISOString(),
      };

      renderWithAudio(audio, {
        channel: channel as AnyChannel,
        isArtist: false,
        tracks: baseTracks,
        partyId: "p1",
        initialPlaybackState: state,
        isConnected: true,
      });

      await waitFor(() => {
        expect(audio.play).toHaveBeenCalled();
      });

      // Proxy URL is always set synchronously (browser handles fetch errors via audio error event)
      expect(audio.src).toBe("/api/party/p1/stream?track=1");
    });

    it("joins but browser blocks autoplay — sets needsInteraction", async () => {
      const channel = createMockChannel();
      const audio = createMockAudio();

      // Make play() reject (browser autoplay policy)
      (audio.play as ReturnType<typeof vi.fn>).mockRejectedValue(
        new DOMException("NotAllowedError")
      );

      const state: PlaybackState = {
        track_position: 1,
        position: 10,
        is_playing: true,
        updated_at: new Date().toISOString(),
      };

      const { result } = renderWithAudio(audio, {
        channel: channel as AnyChannel,
        isArtist: false,
        tracks: baseTracks,
        partyId: "p1",
        initialPlaybackState: state,
        isConnected: true,
      });

      await waitFor(() => {
        expect(result.current.needsInteraction).toBe(true);
      });
    });

    it("after recovery completes, broadcasts are processed", async () => {
      const channel = createMockChannel();
      const audio = createMockAudio();

      const state: PlaybackState = {
        track_position: 1,
        position: 10,
        is_playing: true,
        updated_at: new Date().toISOString(),
      };

      renderWithAudio(audio, {
        channel: channel as AnyChannel,
        isArtist: false,
        tracks: baseTracks,
        partyId: "p1",
        initialPlaybackState: state,
        isConnected: true,
      });

      // Wait for recovery to complete (play succeeds)
      await waitFor(() => {
        expect(audio.play).toHaveBeenCalled();
      });

      // Now broadcasts should work — send a PAUSE
      await act(async () => {
        channel._trigger({ payload: { type: "PAUSE", position: 20 } });
      });

      // Audio SHOULD be paused now (guard is lifted)
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(20);
    });

    it("recovery guard lifts even when play fails", async () => {
      const channel = createMockChannel();
      const audio = createMockAudio();

      // Make play() reject (simulates autoplay block)
      (audio.play as ReturnType<typeof vi.fn>).mockRejectedValue(
        new DOMException("NotAllowedError")
      );

      const state: PlaybackState = {
        track_position: 1,
        position: 30,
        is_playing: true,
        updated_at: new Date().toISOString(),
      };

      const { result } = renderWithAudio(audio, {
        channel: channel as AnyChannel,
        isArtist: false,
        tracks: baseTracks,
        partyId: "p1",
        initialPlaybackState: state,
        isConnected: true,
      });

      // Wait for recovery to finish (play fails, but finally{} sets recoveryComplete)
      await waitFor(() => {
        expect(result.current.needsInteraction).toBe(true);
      });

      // Re-enable play so broadcasts can work
      (audio.play as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Broadcast should NOT be blocked — guard was lifted by finally{}
      await act(async () => {
        channel._trigger({
          payload: { type: "HEARTBEAT", position: 40, track_position: 1, is_playing: true },
        });
      });

      expect(audio.play).toHaveBeenCalledTimes(2);
    });

  it("reconnection re-sync: leaves playback alone after a brief flap", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();
    audio.src = "/api/party/p1/stream?track=1";
    (audio as unknown as { currentTime: number }).currentTime = 30;

    mockFetch.mockImplementation((url: unknown) => {
      if (typeof url === "string" && url.includes("playback-state")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              playback_state: {
                track_position: 1,
                position: 33,
                is_playing: true,
                updated_at: new Date().toISOString(),
              },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { rerender } = renderHook(
      (props: Parameters<typeof usePlaybackSync>[0]) => {
        const r = usePlaybackSync(props);
        (r.audioRef as { current: HTMLAudioElement }).current = audio;
        return r;
      },
      {
        initialProps: {
          channel: channel as AnyChannel,
          isArtist: false,
          tracks: baseTracks,
          partyId: "p1",
          initialPlaybackState: null,
          isConnected: false,
        },
      }
    );

    await act(async () => {});

    await act(async () => {
      rerender({
        channel: channel as AnyChannel,
        isArtist: false,
        tracks: baseTracks,
        partyId: "p1",
        initialPlaybackState: null,
        isConnected: true,
      });
    });
    await act(async () => {});

    // delta = 33 - 30 = 3 → within tolerance; nothing touched
    expect(audio.currentTime).toBe(30);
    expect(audio.playbackRate).toBe(1);
  });

    it("resumeFromInteraction sets proxy URL when src was never set", async () => {
      const channel = createMockChannel();
      const audio = createMockAudio();

      // Make play() reject on first call (autoplay blocked during recovery)
      (audio.play as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new DOMException("NotAllowedError"));

      const state: PlaybackState = {
        track_position: 2,
        position: 20,
        is_playing: true,
        updated_at: new Date().toISOString(),
      };

      const { result } = renderWithAudio(audio, {
        channel: channel as AnyChannel,
        isArtist: false,
        tracks: baseTracks,
        partyId: "p1",
        initialPlaybackState: state,
        isConnected: true,
      });

      await waitFor(() => {
        expect(result.current.needsInteraction).toBe(true);
      });

      // Src was set during recovery (proxy URL is synchronous)
      expect(audio.src).toBe("/api/party/p1/stream?track=2");

      // Re-enable play (user taps "Tap to start listening")
      (audio.play as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await act(async () => {
        await result.current.resumeFromInteraction();
      });

      expect(audio.play).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // Dual-element preloading tests
  // -------------------------------------------------------------------------
  describe("dual-element preloading", () => {
    it("artist: preloads next track when current track nears end", async () => {
      const channel = createMockChannel();
      const audio = createMockAudio();
      const preloadAudio = createMockAudio();

      const { result } = renderWithAudio(
        audio,
        {
          channel: channel as AnyChannel,
          isArtist: true,
          tracks: baseTracks,
          partyId: "p1",
          initialPlaybackState: null,
          isConnected: true,
        },
        preloadAudio
      );

      // Start playing track 1
      await act(async () => {
        await result.current.play();
      });

      // Simulate timeupdate near end of track (duration=200, currentTime=190)
      (audio as any).currentTime = 190;

      // Find and call the timeupdate listener
      const timeupdateCall = (audio.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === "timeupdate"
      );
      expect(timeupdateCall).toBeDefined();

      await act(async () => {
        timeupdateCall![1]();
      });

      // Preload element should have next track's URL
      expect(preloadAudio.src).toBe("/api/party/p1/stream?track=2");
    });

    it("artist: uses preloaded element for instant track transition", async () => {
      const channel = createMockChannel();
      const audio = createMockAudio();
      const preloadAudio = createMockAudio();

      // Make preloadAudio report as ready
      Object.defineProperty(preloadAudio, "readyState", {
        get: () => 3, // HAVE_FUTURE_DATA
        configurable: true,
      });

      const { result } = renderWithAudio(
        audio,
        {
          channel: channel as AnyChannel,
          isArtist: true,
          tracks: baseTracks,
          partyId: "p1",
          initialPlaybackState: null,
          isConnected: true,
        },
        preloadAudio
      );

      // Start playing track 1 first
      await act(async () => {
        await result.current.play();
      });

      // Simulate preload by triggering timeupdate near track end
      (audio as any).currentTime = 190;
      const timeupdateCall = (audio.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === "timeupdate"
      );
      await act(async () => {
        timeupdateCall![1]();
      });

      // preloadAudio should now have track 2's URL set (from preload trigger)
      expect(preloadAudio.src).toBe("/api/party/p1/stream?track=2");

      // Now advance to track 2 — should use the preloaded element
      await act(async () => {
        await result.current.playTrack(2);
      });

      // The preload audio (which had track 2 buffered) should have been played
      expect(preloadAudio.play).toHaveBeenCalled();

      // The broadcast should indicate track 2
      expect((channel.send as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    });

    it("artist: falls back to cold load when preload not available", async () => {
      const channel = createMockChannel();
      const audio = createMockAudio();

      // No preload element — just use renderWithAudio without preloadAudio
      const { result } = renderWithAudio(audio, {
        channel: channel as AnyChannel,
        isArtist: true,
        tracks: baseTracks,
        partyId: "p1",
        initialPlaybackState: null,
        isConnected: true,
      });

      await act(async () => {
        await result.current.playTrack(2);
      });

      // Should fall back to setting src on main audio element
      expect(audio.src).toBe("/api/party/p1/stream?track=2");
      expect(audio.play).toHaveBeenCalled();
    });

    it("artist: does not preload when on last track", async () => {
      const channel = createMockChannel();
      const audio = createMockAudio();
      const preloadAudio = createMockAudio();

      const { result } = renderWithAudio(
        audio,
        {
          channel: channel as AnyChannel,
          isArtist: true,
          tracks: baseTracks, // 3 tracks
          partyId: "p1",
          initialPlaybackState: null,
          isConnected: true,
        },
        preloadAudio
      );

      // Play track 3 (last track)
      await act(async () => {
        await result.current.playTrack(3);
      });

      // Simulate near end of last track
      (audio as any).currentTime = 190;
      const timeupdateCall = (audio.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === "timeupdate"
      );
      await act(async () => {
        timeupdateCall![1]();
      });

      // Should NOT preload — there's no track 4
      expect(preloadAudio.src).toBe("");
    });
  });

  it("artist: last track ending enters wind-down without a party_ended broadcast", async () => {
    const channel = createMockChannel();
    const audio = createMockAudio();
    const { result } = renderWithAudio(audio, {
      channel: channel as AnyChannel,
      isArtist: true,
      tracks: baseTracks,
      partyId: "p1",
      initialPlaybackState: null,
      isConnected: true,
    });

    // Move to the last of the 3 tracks.
    await act(async () => {
      await result.current.playTrack(3);
    });

    // Fire the most recently registered "ended" listener.
    const endedCalls = (audio.addEventListener as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === "ended"
    );
    const onEnded = endedCalls[endedCalls.length - 1][1] as () => void;
    await act(async () => {
      onEnded();
    });

    // Wind-down entered, and NO party_ended broadcast was sent.
    expect(result.current.playbackFinished).toBe(true);
    const partyEndedSends = (channel.send as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => (c[0] as { event?: string } | undefined)?.event === "party_ended"
    );
    expect(partyEndedSends).toHaveLength(0);
  });
});
