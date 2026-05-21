# Mobile Playback Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the periodic skip/freeze/resume of audio on mobile during a listening party, and ship a diagnostic harness to verify it.

**Architecture:** Four independent tiers. P0 replaces the guest's hard-seek drift correction with a three-band (`none`/`nudge`/`seek`) algorithm and removes the serverless timeout risk. P1 hardens the streaming proxy (signed-URL cache, bounded `onError` retries). P2 adds query-param-gated diagnostic logging. P3 deletes a dead WebGL subsystem and makes two animation loops desktop-only. Every behavioural change preserves the existing auth / signed-URL content-protection model.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Realtime + Storage), Vitest + Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-05-20-mobile-playback-fix-design.md`

---

## File Structure

**New files:**
- `lib/signed-url-cache.ts` — server-side signed-URL TTL cache (pure-ish module).
- `lib/diagnostics.ts` — diagnostic flag parsing, `log()`, counters, 30s summary.
- `hooks/useCoarsePointer.ts` — coarse-pointer (mobile) detection hook.
- `hooks/useFrameHealth.ts` — debug-only dropped-frame counter.
- `hooks/useAudioDiagnostics.ts` — debug-only audio buffering-event logger.
- `__tests__/lib/signed-url-cache.test.ts`, `__tests__/lib/diagnostics.test.ts` — unit tests.

**Modified files:**
- `app/api/party/[id]/stream/route.ts` — `maxDuration`, signed-URL cache, timing log.
- `hooks/usePlaybackSync.ts` — `decideCorrection`, `shouldRetryAfterError`, three-band wiring, `sentAt`, softened `onError`, diag logging.
- `hooks/useRealtimeChannel.ts` — channel-state diag logging.
- `hooks/useAudioAnalyser.ts` — `enabled` option, diag logging.
- `components/party/AudioPlayer.tsx` — `preservesPitch`, buffering indicator.
- `components/party/PartyRoom.tsx` — mount diagnostic hooks, coarse-pointer gating, remove dead import.
- `types/index.ts` — `sentAt` on `PlaybackEvent`.
- `__tests__/hooks/usePlaybackSync.test.ts` — new tests, updated HEARTBEAT tests, mock `playbackRate`.

**Deleted files (dead code):**
- `components/party/PartyWebGLBackground.tsx`, `components/party/ShaderDevControls.tsx`, `components/party/PartyGlowBackground.tsx`
- `hooks/useWebGLBackground.ts`
- `lib/shaders/types.ts`, `lib/shaders/fullscreenQuad.ts`, `lib/shaders/presets/index.ts`, `lib/shaders/presets/cosmicFlow.ts`

---

# Tier P0 — Sync fix + timeout

## Task 1: Add `maxDuration` to the stream route

**Files:**
- Modify: `app/api/party/[id]/stream/route.ts:1-4`

- [ ] **Step 1: Add the route segment config**

In `app/api/party/[id]/stream/route.ts`, the file currently starts:

```ts
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(
```

Change it to:

```ts
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

// Allow long-lived streaming responses. Without this the platform default
// timeout can kill an open Range stream mid-playback. 300s is the Vercel Pro
// cap; on Hobby the cap is 60 — lower this to 60 if the project is on Hobby.
export const maxDuration = 300;

export async function GET(
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/party/\[id\]/stream/route.ts
git commit -m "Add maxDuration to stream route to prevent timeout-killed streams"
```

---

## Task 2: Add `sentAt` to the `PlaybackEvent` type

**Files:**
- Modify: `types/index.ts:72-76`

- [ ] **Step 1: Add the optional field to every variant**

In `types/index.ts`, replace:

```ts
export type PlaybackEvent =
  | { type: "PLAY"; position: number; track_position: number }
  | { type: "PAUSE"; position: number }
  | { type: "SEEK"; position: number }
  | { type: "HEARTBEAT"; position: number; track_position: number; is_playing: boolean };
```

with:

```ts
export type PlaybackEvent =
  | { type: "PLAY"; position: number; track_position: number; sentAt?: number }
  | { type: "PAUSE"; position: number; sentAt?: number }
  | { type: "SEEK"; position: number; sentAt?: number }
  | { type: "HEARTBEAT"; position: number; track_position: number; is_playing: boolean; sentAt?: number };
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "Add optional sentAt timestamp to PlaybackEvent"
```

---

## Task 3: `decideCorrection` pure function

**Files:**
- Modify: `hooks/usePlaybackSync.ts:1-18` (add after `computeSeekPosition`)
- Test: `__tests__/hooks/usePlaybackSync.test.ts:3` (import) and after the `computeSeekPosition` describe block

- [ ] **Step 1: Write the failing tests**

In `__tests__/hooks/usePlaybackSync.test.ts`, change the import on line 3 from:

```ts
import { usePlaybackSync, computeSeekPosition } from "@/hooks/usePlaybackSync";
```

to:

```ts
import { usePlaybackSync, computeSeekPosition, decideCorrection } from "@/hooks/usePlaybackSync";
```

Then add this new describe block immediately after the closing `});` of the `describe("computeSeekPosition", ...)` block (around line 44):

```ts
describe("decideCorrection", () => {
  it("returns 'none' with rate 1 when |delta| is within the dead zone", () => {
    expect(decideCorrection(0)).toEqual({ action: "none", playbackRate: 1 });
    expect(decideCorrection(1.5)).toEqual({ action: "none", playbackRate: 1 });
    expect(decideCorrection(-1.5)).toEqual({ action: "none", playbackRate: 1 });
    expect(decideCorrection(2)).toEqual({ action: "none", playbackRate: 1 });
  });

  it("nudges faster (1.03) when the guest is behind (positive delta)", () => {
    expect(decideCorrection(3)).toEqual({ action: "nudge", playbackRate: 1.03 });
    expect(decideCorrection(5)).toEqual({ action: "nudge", playbackRate: 1.03 });
  });

  it("nudges slower (0.97) when the guest is ahead (negative delta)", () => {
    expect(decideCorrection(-3)).toEqual({ action: "nudge", playbackRate: 0.97 });
    expect(decideCorrection(-5)).toEqual({ action: "nudge", playbackRate: 0.97 });
  });

  it("seeks when |delta| exceeds the seek threshold", () => {
    expect(decideCorrection(6)).toEqual({ action: "seek", playbackRate: 1 });
    expect(decideCorrection(-10)).toEqual({ action: "seek", playbackRate: 1 });
  });
});
```

- [ ] **Step 2: Run the tests — verify they fail**

Run: `npx vitest run __tests__/hooks/usePlaybackSync.test.ts -t "decideCorrection"`
Expected: FAIL — `decideCorrection is not a function` (not yet exported).

- [ ] **Step 3: Implement `decideCorrection`**

In `hooks/usePlaybackSync.ts`, the file currently has `computeSeekPosition` ending at line 18 with `}`. Immediately after that closing brace (before the `interface UsePlaybackSyncProps` block), insert:

```ts

/** Sync correction tuning — see spec P0b. */
const SYNC_DEAD_ZONE_SEC = 2;
const SYNC_SEEK_THRESHOLD_SEC = 5;
const NUDGE_RATE_FASTER = 1.03;
const NUDGE_RATE_SLOWER = 0.97;

/**
 * Pure decision for guest drift correction.
 * `delta` = artist position − guest position (positive ⇒ guest is behind).
 */
export function decideCorrection(delta: number): {
  action: "none" | "nudge" | "seek";
  playbackRate: number;
} {
  const magnitude = Math.abs(delta);
  if (magnitude <= SYNC_DEAD_ZONE_SEC) {
    return { action: "none", playbackRate: 1 };
  }
  if (magnitude <= SYNC_SEEK_THRESHOLD_SEC) {
    return {
      action: "nudge",
      playbackRate: delta > 0 ? NUDGE_RATE_FASTER : NUDGE_RATE_SLOWER,
    };
  }
  return { action: "seek", playbackRate: 1 };
}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npx vitest run __tests__/hooks/usePlaybackSync.test.ts -t "decideCorrection"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add hooks/usePlaybackSync.ts __tests__/hooks/usePlaybackSync.test.ts
git commit -m "Add decideCorrection three-band sync decision function"
```

---

## Task 4: Wire `decideCorrection` into the HEARTBEAT handler

**Files:**
- Modify: `hooks/usePlaybackSync.ts:57-67` (broadcast) and `:383-389` (HEARTBEAT drift block)
- Test: `__tests__/hooks/usePlaybackSync.test.ts:51-79` (mock) and `:245-269` (replace one test)

- [ ] **Step 1: Add `playbackRate` to the test mock**

In `__tests__/hooks/usePlaybackSync.test.ts`, in `createMockAudio()`, the returned object currently ends:

```ts
    load: vi.fn(),
    preload: "",
    crossOrigin: null,
  } as unknown as HTMLAudioElement;
```

Change it to:

```ts
    load: vi.fn(),
    preload: "",
    crossOrigin: null,
    playbackRate: 1,
  } as unknown as HTMLAudioElement;
```

- [ ] **Step 2: Replace the old drift test with three band tests**

In the same file, find and delete this entire test (lines ~245-269):

```ts
  it("guest HEARTBEAT: corrects currentTime on drift > 2s", async () => {
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
        payload: { type: "HEARTBEAT", position: 55, track_position: 1, is_playing: true },
      });
    });

    expect(audio.currentTime).toBe(55);
  });
```

Replace it with these three tests:

```ts
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

  it("guest HEARTBEAT: nudges playbackRate (no seek) for moderate drift", async () => {
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
        payload: { type: "HEARTBEAT", position: 53.5, track_position: 1, is_playing: true },
      });
    });

    // delta = 53.5 - 50 = 3.5 → nudge, currentTime untouched
    expect(audio.currentTime).toBe(50);
    expect(audio.playbackRate).toBe(1.03);
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
```

- [ ] **Step 3: Run the tests — verify they fail**

Run: `npx vitest run __tests__/hooks/usePlaybackSync.test.ts -t "guest HEARTBEAT"`
Expected: FAIL — the "nudges" and "dead zone" tests fail because the current code hard-seeks on any drift > 0.3s.

- [ ] **Step 4: Add `sentAt` to broadcasts**

In `hooks/usePlaybackSync.ts`, replace the `broadcast` callback (lines ~57-67):

```ts
  const broadcast = useCallback(
    (event: PlaybackEvent) => {
      if (!channel) return;
      channel.send({
        type: "broadcast",
        event: "playback",
        payload: event,
      });
    },
    [channel]
  );
```

with:

```ts
  const broadcast = useCallback(
    (event: PlaybackEvent) => {
      if (!channel) return;
      channel.send({
        type: "broadcast",
        event: "playback",
        payload: { ...event, sentAt: Date.now() },
      });
    },
    [channel]
  );
```

- [ ] **Step 5: Replace the HEARTBEAT drift block**

In the same file, in the `case "HEARTBEAT":` block, replace these lines (~383-389):

```ts
          const drift = Math.abs(audio.currentTime - event.position);
          if (drift > 2) {
            audio.currentTime = event.position;
          } else if (drift > 0.3) {
            audio.currentTime = event.position;
          }
          break;
```

with:

```ts
          const delta = event.position - audio.currentTime;
          const correction = decideCorrection(delta);
          if (correction.action === "seek") {
            audio.currentTime = event.position;
            audio.playbackRate = 1;
          } else if (correction.action === "nudge") {
            audio.playbackRate = correction.playbackRate;
          } else if (audio.playbackRate !== 1) {
            audio.playbackRate = 1;
          }
          break;
```

- [ ] **Step 6: Run the full test file — verify everything passes**

Run: `npx vitest run __tests__/hooks/usePlaybackSync.test.ts`
Expected: PASS (all tests, now 25 in this file).

- [ ] **Step 7: Commit**

```bash
git add hooks/usePlaybackSync.ts __tests__/hooks/usePlaybackSync.test.ts
git commit -m "Replace HEARTBEAT hard-seek with three-band drift correction"
```

---

## Task 5: Wire `decideCorrection` into the reconnection re-sync

**Files:**
- Modify: `hooks/usePlaybackSync.ts:489-505` (inside the reconnection effect)
- Test: `__tests__/hooks/usePlaybackSync.test.ts` (add one integration test)

- [ ] **Step 1: Write the failing integration test**

In `__tests__/hooks/usePlaybackSync.test.ts`, inside the `describe("usePlaybackSync hook", ...)` block, add this test after the `describe("late joiner", ...)` block's closing `});`:

```ts
  it("reconnection re-sync: nudges instead of seeking after a brief flap", async () => {
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

    // delta = 33 - 30 = 3 → nudge; currentTime unchanged
    expect(audio.currentTime).toBe(30);
    expect(audio.playbackRate).toBe(1.03);
  });
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `npx vitest run __tests__/hooks/usePlaybackSync.test.ts -t "reconnection re-sync"`
Expected: FAIL — current code does `audio.currentTime = seekTo` unconditionally, so `currentTime` becomes 33, not 30.

- [ ] **Step 3: Apply the three-band logic to the reconnection effect**

In `hooks/usePlaybackSync.ts`, inside the reconnection effect, replace these lines (~489-505):

```ts
        const trackDur = tracks.find((t) => t.position === state.track_position)?.duration;
        const seekTo = computeSeekPosition(state.position, state.updated_at, trackDur);

        // Switch track if needed
        if (state.track_position !== currentTrackPositionRef.current || !audio.src) {
          const url = getStreamProxyUrl(state.track_position);
          audio.src = url;
          setAudioUrl(url);
        }

        audio.currentTime = seekTo;
        try {
          await audio.play();
          setIsPlaying(true);
        } catch {
          setNeedsInteraction(true);
        }
```

with:

```ts
        const trackDur = tracks.find((t) => t.position === state.track_position)?.duration;
        const seekTo = computeSeekPosition(state.position, state.updated_at, trackDur);

        // Switch track if needed
        const trackChanged =
          state.track_position !== currentTrackPositionRef.current || !audio.src;
        if (trackChanged) {
          const url = getStreamProxyUrl(state.track_position);
          audio.src = url;
          setAudioUrl(url);
        }

        if (trackChanged) {
          // New src starts at 0 — seek directly to the recovered position.
          audio.currentTime = seekTo;
          audio.playbackRate = 1;
        } else {
          // Same track — three-band correction so a brief flap doesn't seek.
          const correction = decideCorrection(seekTo - audio.currentTime);
          if (correction.action === "seek") {
            audio.currentTime = seekTo;
            audio.playbackRate = 1;
          } else if (correction.action === "nudge") {
            audio.playbackRate = correction.playbackRate;
          } else {
            audio.playbackRate = 1;
          }
        }
        try {
          await audio.play();
          setIsPlaying(true);
        } catch {
          setNeedsInteraction(true);
        }
```

- [ ] **Step 4: Run the full test file — verify everything passes**

Run: `npx vitest run __tests__/hooks/usePlaybackSync.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add hooks/usePlaybackSync.ts __tests__/hooks/usePlaybackSync.test.ts
git commit -m "Apply three-band correction to reconnection re-sync"
```

---

## Task 6: Set `preservesPitch` on the audio elements

**Files:**
- Modify: `components/party/AudioPlayer.tsx:3` (import) and the component body

- [ ] **Step 1: Import `useEffect`**

In `components/party/AudioPlayer.tsx`, change line 3 from:

```ts
import { RefObject } from "react";
```

to:

```ts
import { RefObject, useEffect } from "react";
```

- [ ] **Step 2: Add the `preservesPitch` effect**

In the same file, the component body starts (after the props destructuring `}: AudioPlayerProps) {`):

```ts
  const hasMultipleTracks = (totalTracks ?? 0) > 1;
```

Insert this `useEffect` immediately before that line:

```ts
  // Keep pitch stable when playbackRate is nudged for sync correction.
  useEffect(() => {
    for (const ref of [audioRef, preloadAudioRef]) {
      const el = ref?.current;
      if (!el) continue;
      el.preservesPitch = true;
      (el as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
    }
  }, [audioRef, preloadAudioRef]);

```

- [ ] **Step 3: Verify typecheck and existing tests**

Run: `npx tsc --noEmit && npx vitest run __tests__/components/AudioPlayer.test.tsx`
Expected: no type errors; 6 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add components/party/AudioPlayer.tsx
git commit -m "Set preservesPitch so sync nudges change tempo, not pitch"
```

---

# Tier P1 — Proxy hardening

## Task 7: Signed-URL cache module

**Files:**
- Create: `lib/signed-url-cache.ts`
- Test: `__tests__/lib/signed-url-cache.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/signed-url-cache.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  getCachedSignedUrl,
  setCachedSignedUrl,
  __clearSignedUrlCache,
} from "@/lib/signed-url-cache";

describe("signed-url-cache", () => {
  beforeEach(() => __clearSignedUrlCache());

  it("returns null for a key that was never set", () => {
    expect(getCachedSignedUrl("p1:1")).toBeNull();
  });

  it("returns the stored URL within the TTL window", () => {
    setCachedSignedUrl("p1:1", "https://signed.example/a", 1_000);
    expect(getCachedSignedUrl("p1:1", 10_000)).toBe("https://signed.example/a");
  });

  it("returns null once the TTL has expired", () => {
    setCachedSignedUrl("p1:1", "https://signed.example/a", 1_000);
    // expiry = 1_000 + 50_000 = 51_000; a query at 51_000 is expired
    expect(getCachedSignedUrl("p1:1", 51_000)).toBeNull();
  });

  it("isolates entries by key", () => {
    setCachedSignedUrl("p1:1", "https://signed.example/one", 0);
    setCachedSignedUrl("p1:2", "https://signed.example/two", 0);
    expect(getCachedSignedUrl("p1:1", 100)).toBe("https://signed.example/one");
    expect(getCachedSignedUrl("p1:2", 100)).toBe("https://signed.example/two");
  });
});
```

- [ ] **Step 2: Run the tests — verify they fail**

Run: `npx vitest run __tests__/lib/signed-url-cache.test.ts`
Expected: FAIL — module `@/lib/signed-url-cache` does not exist.

- [ ] **Step 3: Implement the module**

Create `lib/signed-url-cache.ts`:

```ts
/**
 * In-memory cache of Supabase signed URLs, keyed by `partyId:trackPosition`.
 * Lives only in server memory; never reaches the client. Shared across warm
 * serverless invocations of the same instance.
 */

interface SignedUrlEntry {
  url: string;
  expiresAt: number;
}

// Signed URLs are minted with 60s validity; cache for 50s to leave margin.
const TTL_MS = 50_000;

const cache = new Map<string, SignedUrlEntry>();

/** Returns a cached signed URL if present and unexpired, else null. */
export function getCachedSignedUrl(key: string, now: number = Date.now()): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  return entry.url;
}

/** Stores a signed URL with a TTL shorter than its real validity window. */
export function setCachedSignedUrl(key: string, url: string, now: number = Date.now()): void {
  cache.set(key, { url, expiresAt: now + TTL_MS });
}

/** Test-only: clears all cached entries. */
export function __clearSignedUrlCache(): void {
  cache.clear();
}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npx vitest run __tests__/lib/signed-url-cache.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/signed-url-cache.ts __tests__/lib/signed-url-cache.test.ts
git commit -m "Add server-side signed-URL TTL cache"
```

---

## Task 8: Wire the signed-URL cache into the stream route

**Files:**
- Modify: `app/api/party/[id]/stream/route.ts` (imports + the file-path/signed-URL section, lines ~69-113)

- [ ] **Step 1: Add the import**

In `app/api/party/[id]/stream/route.ts`, add to the imports at the top of the file:

```ts
import { getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
```

- [ ] **Step 2: Replace the file-path + signed-URL section**

In the same file, replace this entire block (the `--- Resolve file path ---` and `--- Generate signed URL ---` sections, lines ~69-104):

```ts
    // --- Resolve file path ---
    const { searchParams } = new URL(request.url);
    const trackPosition = parseInt(searchParams.get("track") || "1", 10);

    const { data: track } = await supabase
      .from("tracks")
      .select("file_path")
      .eq("party_id", id)
      .eq("position", trackPosition)
      .single();

    let filePath = track?.file_path;

    if (!filePath) {
      const { data: party } = await supabase
        .from("parties")
        .select("file_path")
        .eq("id", id)
        .single();

      filePath = party?.file_path;
    }

    if (!filePath) {
      return new Response("Track not found", { status: 404 });
    }

    // --- Generate signed URL server-side (never sent to client) ---
    const { data: signedUrl, error: storageError } = await supabase.storage
      .from("party-audio")
      .createSignedUrl(filePath, 60); // short-lived: 60 seconds

    if (storageError || !signedUrl) {
      console.error("[stream] storage error:", storageError?.message, "for path:", filePath);
      return new Response("Could not generate stream", { status: 500 });
    }
```

with:

```ts
    // --- Resolve a signed URL, reusing a cached one if still fresh ---
    const { searchParams } = new URL(request.url);
    const trackPosition = parseInt(searchParams.get("track") || "1", 10);
    const cacheKey = `${id}:${trackPosition}`;

    let signedUrlString: string;
    const cachedUrl = getCachedSignedUrl(cacheKey);

    if (cachedUrl) {
      signedUrlString = cachedUrl;
    } else {
      // Cache miss — resolve the file path and mint a fresh signed URL.
      const { data: track } = await supabase
        .from("tracks")
        .select("file_path")
        .eq("party_id", id)
        .eq("position", trackPosition)
        .single();

      let filePath = track?.file_path;

      if (!filePath) {
        const { data: partyFile } = await supabase
          .from("parties")
          .select("file_path")
          .eq("id", id)
          .single();
        filePath = partyFile?.file_path;
      }

      if (!filePath) {
        return new Response("Track not found", { status: 404 });
      }

      const { data: signedUrl, error: storageError } = await supabase.storage
        .from("party-audio")
        .createSignedUrl(filePath, 60); // short-lived: 60 seconds

      if (storageError || !signedUrl) {
        console.error("[stream] storage error:", storageError?.message, "for path:", filePath);
        return new Response("Could not generate stream", { status: 500 });
      }

      signedUrlString = signedUrl.signedUrl;
      setCachedSignedUrl(cacheKey, signedUrlString);
    }
```

- [ ] **Step 3: Point the upstream fetch at the resolved variable**

In the same file, find:

```ts
    const upstream = await fetch(signedUrl.signedUrl, { headers });
```

and change it to:

```ts
    const upstream = await fetch(signedUrlString, { headers });
```

- [ ] **Step 4: Verify typecheck and the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/party/\[id\]/stream/route.ts
git commit -m "Cache signed URLs in the stream proxy to cut per-request overhead"
```

---

## Task 9: `shouldRetryAfterError` helper

**Files:**
- Modify: `hooks/usePlaybackSync.ts` (add exported function near `decideCorrection`)
- Test: `__tests__/hooks/usePlaybackSync.test.ts:3` (import) and a new describe block

- [ ] **Step 1: Write the failing tests**

In `__tests__/hooks/usePlaybackSync.test.ts`, update the import on line 3 to add `shouldRetryAfterError`:

```ts
import {
  usePlaybackSync,
  computeSeekPosition,
  decideCorrection,
  shouldRetryAfterError,
} from "@/hooks/usePlaybackSync";
```

Then add this describe block right after the `describe("decideCorrection", ...)` block:

```ts
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
```

- [ ] **Step 2: Run the tests — verify they fail**

Run: `npx vitest run __tests__/hooks/usePlaybackSync.test.ts -t "shouldRetryAfterError"`
Expected: FAIL — `shouldRetryAfterError is not a function`.

- [ ] **Step 3: Implement `shouldRetryAfterError`**

In `hooks/usePlaybackSync.ts`, immediately after the `decideCorrection` function (after its closing `}`), insert:

```ts

/** onError retry budget — see spec P1b. */
const ERROR_RETRY_WINDOW_MS = 15_000;
const ERROR_RETRY_BUDGET = 4;

/**
 * Pure: given timestamps of recent audio errors, decide whether another
 * automatic recovery attempt is still within budget.
 */
export function shouldRetryAfterError(
  errorTimestamps: number[],
  now: number,
  windowMs: number = ERROR_RETRY_WINDOW_MS,
  budget: number = ERROR_RETRY_BUDGET
): boolean {
  const recent = errorTimestamps.filter((t) => now - t <= windowMs);
  return recent.length <= budget;
}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npx vitest run __tests__/hooks/usePlaybackSync.test.ts -t "shouldRetryAfterError"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add hooks/usePlaybackSync.ts __tests__/hooks/usePlaybackSync.test.ts
git commit -m "Add shouldRetryAfterError onError retry-budget helper"
```

---

## Task 10: Soften the `onError` handler

**Files:**
- Modify: `hooks/usePlaybackSync.ts` (add a ref near line ~49; rewrite `onError`; add an `onPlaying` listener in the same effect, ~lines 513-582)

- [ ] **Step 1: Add the error-timestamps ref**

In `hooks/usePlaybackSync.ts`, find the ref declarations near the top of the hook (around line 49, near `recoveryAttemptedRef`). Add this line alongside them:

```ts
  const errorTimestampsRef = useRef<number[]>([]);
```

- [ ] **Step 2: Rewrite the `onError` handler**

In the same file, in the time-updates effect, replace the `onError` handler (lines ~550-569):

```ts
    // Re-set proxy URL on error (proxy generates fresh signed URL each request)
    const onError = async () => {
      if (!audio.src) return;
      const savedTime = audio.currentTime;
      const wasPlaying = !audio.paused;

      const url = getStreamProxyUrl(currentTrackPositionRef.current);
      audio.src = url;
      setAudioUrl(url);
      audio.currentTime = savedTime;

      if (wasPlaying) {
        try {
          await audio.play();
          setIsPlaying(true);
        } catch {
          setNeedsInteraction(true);
        }
      }
    };
```

with:

```ts
    // On error: retry the proxy URL within budget, then give up instead of
    // looping. The proxy mints a fresh signed URL on each request.
    const onError = async () => {
      if (!audio.src) return;

      const now = Date.now();
      errorTimestampsRef.current.push(now);

      if (!shouldRetryAfterError(errorTimestampsRef.current, now)) {
        // Retry budget exhausted — stop the reload loop, surface to the user.
        setNeedsInteraction(true);
        return;
      }

      const savedTime = audio.currentTime;
      const wasPlaying = !audio.paused;

      const url = getStreamProxyUrl(currentTrackPositionRef.current);
      audio.src = url;
      setAudioUrl(url);
      audio.currentTime = savedTime;

      if (wasPlaying) {
        try {
          await audio.play();
          setIsPlaying(true);
        } catch {
          setNeedsInteraction(true);
        }
      }
    };

    // A clean resume clears the error budget.
    const onPlaying = () => {
      errorTimestampsRef.current = [];
    };
```

- [ ] **Step 3: Register and unregister the `onPlaying` listener**

In the same effect, find the listener registration block:

```ts
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
```

and change it to:

```ts
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("playing", onPlaying);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("playing", onPlaying);
    };
```

- [ ] **Step 4: Verify typecheck and the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS (the wiring is covered by `shouldRetryAfterError` unit tests in Task 9; the full suite confirms nothing regressed).

- [ ] **Step 5: Commit**

```bash
git add hooks/usePlaybackSync.ts
git commit -m "Bound onError retries so transient blips don't reload-loop"
```

---

# Tier P2 — Instrumentation

## Task 11: Diagnostics module

**Files:**
- Create: `lib/diagnostics.ts`
- Test: `__tests__/lib/diagnostics.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/diagnostics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseDiagFlags } from "@/lib/diagnostics";

describe("parseDiagFlags", () => {
  it("defaults every flag to false for an empty query string", () => {
    expect(parseDiagFlags("")).toEqual({ debug: false, noAnalyser: false });
  });

  it("enables debug when ?debug=1 is present", () => {
    expect(parseDiagFlags("?debug=1")).toEqual({ debug: true, noAnalyser: false });
  });

  it("enables noAnalyser when ?noanalyser=1 is present", () => {
    expect(parseDiagFlags("?debug=1&noanalyser=1")).toEqual({
      debug: true,
      noAnalyser: true,
    });
  });

  it("treats any value other than '1' as false", () => {
    expect(parseDiagFlags("?debug=true")).toEqual({ debug: false, noAnalyser: false });
  });
});
```

- [ ] **Step 2: Run the tests — verify they fail**

Run: `npx vitest run __tests__/lib/diagnostics.test.ts`
Expected: FAIL — module `@/lib/diagnostics` does not exist.

- [ ] **Step 3: Implement the module**

Create `lib/diagnostics.ts`:

```ts
/**
 * Diagnostic instrumentation — gated entirely behind the `?debug=1` query flag.
 * A complete no-op (zero console output, zero overhead) when the flag is absent.
 */

export interface DiagFlags {
  debug: boolean;
  noAnalyser: boolean;
}

/** Pure: parse diagnostic toggle flags from a URL query string. */
export function parseDiagFlags(search: string): DiagFlags {
  const params = new URLSearchParams(search);
  return {
    debug: params.get("debug") === "1",
    noAnalyser: params.get("noanalyser") === "1",
  };
}

const flags: DiagFlags = parseDiagFlags(
  typeof window !== "undefined" ? window.location.search : ""
);

interface DiagCounters {
  heartbeats: number;
  seeks: number;
  nudges: number;
  driftSum: number;
  driftMax: number;
  stalls: number;
  stallMsTotal: number;
  jankFrames: number;
}

function emptyCounters(): DiagCounters {
  return {
    heartbeats: 0,
    seeks: 0,
    nudges: 0,
    driftSum: 0,
    driftMax: 0,
    stalls: 0,
    stallMsTotal: 0,
    jankFrames: 0,
  };
}

let counters = emptyCounters();
let summaryTimer: ReturnType<typeof setInterval> | null = null;

export const diag = {
  enabled: flags.debug,
  flags,

  log(category: string, event: string, data?: Record<string, unknown>): void {
    if (!flags.debug) return;
    const t = (performance.now() / 1000).toFixed(2);
    console.log(`[diag:${category}] +${t}s ${event}`, data ?? "");
  },

  recordHeartbeat(driftAbs: number, action: "none" | "nudge" | "seek"): void {
    if (!flags.debug) return;
    counters.heartbeats += 1;
    counters.driftSum += driftAbs;
    counters.driftMax = Math.max(counters.driftMax, driftAbs);
    if (action === "seek") counters.seeks += 1;
    if (action === "nudge") counters.nudges += 1;
  },

  recordStall(durationMs: number): void {
    if (!flags.debug) return;
    counters.stalls += 1;
    counters.stallMsTotal += durationMs;
  },

  recordJankFrame(): void {
    if (!flags.debug) return;
    counters.jankFrames += 1;
  },
};

/** Starts the 30s rolling summary. Safe to call repeatedly. */
export function initDiagnostics(): void {
  if (!flags.debug || summaryTimer !== null || typeof window === "undefined") {
    return;
  }
  summaryTimer = setInterval(() => {
    const c = counters;
    const avgDrift = c.heartbeats > 0 ? c.driftSum / c.heartbeats : 0;
    console.log(
      `[diag:summary] 30s — ${c.heartbeats} heartbeats · ${c.seeks} seeks · ` +
        `${c.nudges} nudges · drift avg ${avgDrift.toFixed(2)}s max ${c.driftMax.toFixed(2)}s · ` +
        `${c.stalls} stalls totaling ${(c.stallMsTotal / 1000).toFixed(1)}s · ` +
        `${c.jankFrames} janky frames`
    );
    counters = emptyCounters();
  }, 30_000);
}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npx vitest run __tests__/lib/diagnostics.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/diagnostics.ts __tests__/lib/diagnostics.test.ts
git commit -m "Add diagnostics module: flag parsing, logging, 30s summary"
```

---

## Task 12: `useFrameHealth` hook

**Files:**
- Create: `hooks/useFrameHealth.ts`

- [ ] **Step 1: Create the hook**

Create `hooks/useFrameHealth.ts`:

```ts
"use client";

import { useEffect } from "react";
import { diag } from "@/lib/diagnostics";

/** Debug-only: counts dropped animation frames while the party room is open. */
export function useFrameHealth(): void {
  useEffect(() => {
    if (!diag.enabled) return;

    let raf = 0;
    let last = performance.now();

    function tick(now: number): void {
      const delta = now - last;
      last = now;
      if (delta > 32) diag.recordJankFrame();
      if (delta > 100) diag.log("frame", "severe-jank", { ms: Math.round(delta) });
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}
```

- [ ] **Step 2: Verify typecheck and the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/useFrameHealth.ts
git commit -m "Add useFrameHealth debug-only dropped-frame counter"
```

---

## Task 13: `useAudioDiagnostics` hook

**Files:**
- Create: `hooks/useAudioDiagnostics.ts`

- [ ] **Step 1: Create the hook**

Create `hooks/useAudioDiagnostics.ts`:

```ts
"use client";

import { useEffect, RefObject } from "react";
import { diag } from "@/lib/diagnostics";

/** Debug-only: logs audio-element buffering events and measures stall durations. */
export function useAudioDiagnostics(
  audioRef: RefObject<HTMLAudioElement | null>,
  swapCount: number
): void {
  useEffect(() => {
    if (!diag.enabled) return;
    const audio = audioRef.current;
    if (!audio) return;

    let waitingAt = 0;
    const at = () => Number(audio.currentTime.toFixed(2));

    const onWaiting = () => {
      waitingAt = performance.now();
      diag.log("audio", "waiting", { t: at(), readyState: audio.readyState });
    };
    const onPlaying = () => {
      if (waitingAt > 0) {
        const stallMs = performance.now() - waitingAt;
        diag.recordStall(stallMs);
        diag.log("audio", "recovered", { stallMs: Math.round(stallMs) });
        waitingAt = 0;
      }
    };
    const onStalled = () => diag.log("audio", "stalled", { t: at() });
    const onSeeking = () => diag.log("audio", "seeking", { t: at() });
    const onSeeked = () => diag.log("audio", "seeked", { t: at() });
    const onRateChange = () => diag.log("audio", "ratechange", { rate: audio.playbackRate });
    const onError = () => diag.log("audio", "error", { code: audio.error?.code });

    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("stalled", onStalled);
    audio.addEventListener("seeking", onSeeking);
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("ratechange", onRateChange);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("stalled", onStalled);
      audio.removeEventListener("seeking", onSeeking);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("ratechange", onRateChange);
      audio.removeEventListener("error", onError);
    };
  }, [audioRef, swapCount]);
}
```

- [ ] **Step 2: Verify typecheck and the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/useAudioDiagnostics.ts
git commit -m "Add useAudioDiagnostics debug-only buffering-event logger"
```

---

## Task 14: Wire diagnostic logging into the sync hooks

**Files:**
- Modify: `hooks/usePlaybackSync.ts` (import + HEARTBEAT block)
- Modify: `hooks/useRealtimeChannel.ts` (import + subscribe callback)
- Modify: `hooks/useAudioAnalyser.ts` (import + AudioContext lifecycle)

- [ ] **Step 1: Log heartbeats in `usePlaybackSync`**

In `hooks/usePlaybackSync.ts`, add to the imports at the top:

```ts
import { diag } from "@/lib/diagnostics";
```

Then in the `case "HEARTBEAT":` block, find the code added in Task 4:

```ts
          const delta = event.position - audio.currentTime;
          const correction = decideCorrection(delta);
          if (correction.action === "seek") {
```

and insert two lines so it becomes:

```ts
          const delta = event.position - audio.currentTime;
          const correction = decideCorrection(delta);
          diag.recordHeartbeat(Math.abs(delta), correction.action);
          diag.log("sync", "heartbeat", {
            delta: Number(delta.toFixed(2)),
            action: correction.action,
            sentAt: event.sentAt,
          });
          if (correction.action === "seek") {
```

- [ ] **Step 2: Log channel state in `useRealtimeChannel`**

In `hooks/useRealtimeChannel.ts`, add to the imports:

```ts
import { diag } from "@/lib/diagnostics";
```

Then find the `.subscribe` callback:

```ts
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
```

and change it to:

```ts
      .subscribe(async (status) => {
        diag.log("channel", "status", { status });
        if (status === "SUBSCRIBED") {
```

- [ ] **Step 3: Log AudioContext lifecycle in `useAudioAnalyser`**

In `hooks/useAudioAnalyser.ts`, add to the imports:

```ts
import { diag } from "@/lib/diagnostics";
```

Find:

```ts
    if (!contextRef.current) {
      contextRef.current = new AudioContext();
    }
```

and change it to:

```ts
    if (!contextRef.current) {
      contextRef.current = new AudioContext();
      diag.log("analyser", "context-created", { state: contextRef.current.state });
      contextRef.current.addEventListener("statechange", () => {
        diag.log("analyser", "statechange", { state: contextRef.current?.state });
      });
    }
```

Then find:

```ts
    if (ctx.state === "suspended") {
      ctx.resume();
    }
```

and change it to:

```ts
    if (ctx.state === "suspended") {
      ctx.resume().then(
        () => diag.log("analyser", "resumed", { state: ctx.state }),
        () => diag.log("analyser", "resume-failed", {})
      );
    }
```

- [ ] **Step 4: Verify typecheck and the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS (diag calls are no-ops when `?debug=1` is absent).

- [ ] **Step 5: Commit**

```bash
git add hooks/usePlaybackSync.ts hooks/useRealtimeChannel.ts hooks/useAudioAnalyser.ts
git commit -m "Wire diagnostic logging into sync, channel, and analyser hooks"
```

---

## Task 15: Stream route timing log

**Files:**
- Modify: `app/api/party/[id]/stream/route.ts` (inside the `GET` handler `try` block)

- [ ] **Step 1: Capture a start timestamp**

In `app/api/party/[id]/stream/route.ts`, the handler currently starts:

```ts
  try {
    const { id } = await params;
    const supabase = await createServiceClient();
```

Change it to:

```ts
  try {
    const tStart = Date.now();
    const debugStream = process.env.DEBUG_STREAM === "1";
    const { id } = await params;
    const supabase = await createServiceClient();
```

- [ ] **Step 2: Log timing before the streaming response**

In the same file, find the final response block:

```ts
    responseHeaders.set("Accept-Ranges", "bytes");

    return new Response(upstream.body, {
      status: upstream.status, // 200 for full, 206 for range
      headers: responseHeaders,
    });
```

and change it to:

```ts
    responseHeaders.set("Accept-Ranges", "bytes");

    if (debugStream) {
      console.log(
        "[stream]",
        JSON.stringify({
          party: id,
          track: trackPosition,
          range: rangeHeader ?? "none",
          status: upstream.status,
          totalMs: Date.now() - tStart,
        })
      );
    }

    return new Response(upstream.body, {
      status: upstream.status, // 200 for full, 206 for range
      headers: responseHeaders,
    });
```

- [ ] **Step 3: Verify typecheck and the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/party/\[id\]/stream/route.ts
git commit -m "Add DEBUG_STREAM-gated timing log to the stream route"
```

---

## Task 16: AudioPlayer buffering indicator

**Files:**
- Modify: `components/party/AudioPlayer.tsx` (import, props, state, effect, JSX)

- [ ] **Step 1: Import `useState`**

In `components/party/AudioPlayer.tsx`, change line 3 (already updated in Task 6) from:

```ts
import { RefObject, useEffect } from "react";
```

to:

```ts
import { RefObject, useEffect, useState } from "react";
```

- [ ] **Step 2: Add the `swapCount` prop**

In the `AudioPlayerProps` interface, add a field after `audioRef`/`preloadAudioRef`:

```ts
  swapCount?: number;
```

In the component's destructured parameters, add `swapCount` to the list:

```ts
  audioRef,
  preloadAudioRef,
  swapCount,
  isPlaying,
```

- [ ] **Step 3: Add buffering state and a listener effect**

Immediately after the `preservesPitch` effect added in Task 6, insert:

```ts
  const [isBuffering, setIsBuffering] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onWaiting = () => setIsBuffering(true);
    const onResumed = () => setIsBuffering(false);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onResumed);
    audio.addEventListener("canplay", onResumed);
    return () => {
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onResumed);
      audio.removeEventListener("canplay", onResumed);
    };
  }, [audioRef, swapCount]);
```

- [ ] **Step 4: Render the buffering indicator**

In the JSX, find the "listening indicator" block:

```tsx
      {/* Guest: listening indicator */}
      {!isArtist && isPlaying && !needsInteraction && (
```

Change that condition to also require not-buffering:

```tsx
      {/* Guest: listening indicator */}
      {!isArtist && isPlaying && !needsInteraction && !isBuffering && (
```

Then immediately after that entire listening-indicator block's closing `)}`, insert:

```tsx

      {/* Buffering indicator */}
      {isPlaying && isBuffering && (
        <div className="flex items-center justify-center mt-4 gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-[var(--party-fg)]/30 border-t-[var(--party-fg)] animate-spin" />
          <span className="text-xs text-[var(--party-fg)]/60">Buffering…</span>
        </div>
      )}
```

- [ ] **Step 5: Verify typecheck and the AudioPlayer tests**

Run: `npx tsc --noEmit && npx vitest run __tests__/components/AudioPlayer.test.tsx`
Expected: no type errors; 6 tests PASS (default render unchanged when not buffering).

- [ ] **Step 6: Commit**

```bash
git add components/party/AudioPlayer.tsx
git commit -m "Add buffering indicator to AudioPlayer"
```

---

# Tier P3 — Dead-code removal + render guards

## Task 17: `useCoarsePointer` hook

**Files:**
- Create: `hooks/useCoarsePointer.ts`

- [ ] **Step 1: Create the hook**

Create `hooks/useCoarsePointer.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

/** True on touch / coarse-pointer devices (phones, most tablets). */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const handler = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return coarse;
}
```

- [ ] **Step 2: Verify typecheck and the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/useCoarsePointer.ts
git commit -m "Add useCoarsePointer mobile-detection hook"
```

---

## Task 18: Add an `enabled` option to `useAudioAnalyser`

**Files:**
- Modify: `hooks/useAudioAnalyser.ts:5-11` (options + signature), the effect guard, and the effect deps array

- [ ] **Step 1: Add `enabled` to the options interface**

In `hooks/useAudioAnalyser.ts`, change:

```ts
interface UseAudioAnalyserOptions {
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  swapCount?: number;
}
```

to:

```ts
interface UseAudioAnalyserOptions {
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  swapCount?: number;
  enabled?: boolean;
}
```

- [ ] **Step 2: Destructure `enabled` with a default**

Change the function signature:

```ts
export function useAudioAnalyser({ audioRef, isPlaying, swapCount }: UseAudioAnalyserOptions) {
```

to:

```ts
export function useAudioAnalyser({ audioRef, isPlaying, swapCount, enabled = true }: UseAudioAnalyserOptions) {
```

- [ ] **Step 3: Guard the effect**

Find the effect's early-return guard:

```ts
    const audio = audioRef.current;
    if (!audio || !isPlaying) return;
```

and change it to:

```ts
    const audio = audioRef.current;
    if (!enabled || !audio || !isPlaying) return;
```

Then find the effect's dependency array (the line `}, [audioRef, isPlaying, swapCount]);`) and change it to:

```ts
  }, [audioRef, isPlaying, swapCount, enabled]);
```

- [ ] **Step 4: Verify typecheck and the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useAudioAnalyser.ts
git commit -m "Add enabled option to useAudioAnalyser"
```

---

## Task 19: Delete the dead WebGL subsystem

**Files:**
- Modify: `components/party/PartyRoom.tsx:13` (remove import)
- Delete: `components/party/PartyWebGLBackground.tsx`, `components/party/ShaderDevControls.tsx`, `components/party/PartyGlowBackground.tsx`, `hooks/useWebGLBackground.ts`, `lib/shaders/` (4 files)

- [ ] **Step 1: Remove the dead import from PartyRoom**

In `components/party/PartyRoom.tsx`, delete this line (line 13):

```ts
import PartyWebGLBackground from "./PartyWebGLBackground";
```

- [ ] **Step 2: Delete the dead files**

Run:

```bash
git rm components/party/PartyWebGLBackground.tsx \
       components/party/ShaderDevControls.tsx \
       components/party/PartyGlowBackground.tsx \
       hooks/useWebGLBackground.ts
git rm -r lib/shaders
```

- [ ] **Step 3: Verify nothing references the deleted code**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: no type errors, no lint errors, all tests PASS. (If any error mentions a deleted path, a live reference was missed — stop and investigate.)

- [ ] **Step 4: Commit**

```bash
git add components/party/PartyRoom.tsx
git commit -m "Delete dead WebGL background subsystem (never rendered)"
```

---

## Task 20: Wire diagnostics and render guards into PartyRoom

**Files:**
- Modify: `components/party/PartyRoom.tsx` (imports, hook calls, analyser `enabled`, ArtworkAura gate, AudioPlayer `swapCount`)

- [ ] **Step 1: Add the imports**

In `components/party/PartyRoom.tsx`, change the React import (line 17):

```ts
import { useCallback, useState } from "react";
```

to:

```ts
import { useCallback, useEffect, useState } from "react";
```

Then add these import lines alongside the other hook imports near the top of the file:

```ts
import { useCoarsePointer } from "@/hooks/useCoarsePointer";
import { useFrameHealth } from "@/hooks/useFrameHealth";
import { useAudioDiagnostics } from "@/hooks/useAudioDiagnostics";
import { diag, initDiagnostics } from "@/lib/diagnostics";
```

- [ ] **Step 2: Call the new hooks**

In the component body, find the analyser call (line ~88):

```ts
  const { amplitudeRef } = useAudioAnalyser({ audioRef, isPlaying, swapCount });
```

and replace it with:

```ts
  const isCoarsePointer = useCoarsePointer();
  const { amplitudeRef } = useAudioAnalyser({
    audioRef,
    isPlaying,
    swapCount,
    enabled: !isCoarsePointer && !diag.flags.noAnalyser,
  });

  useFrameHealth();
  useAudioDiagnostics(audioRef, swapCount);
  useEffect(() => {
    initDiagnostics();
  }, []);
```

- [ ] **Step 3: Gate ArtworkAura to desktop only**

In the JSX, find the `<ArtworkAura ... />` element:

```tsx
        <ArtworkAura
          colors={colors.palette}
          scale={2.2}
          blur={50}
          grain={0.35}
          pulseSpeed={4}
          amplitudeRef={amplitudeRef}
        />
```

and wrap it so it only renders on desktop:

```tsx
        {!isCoarsePointer && (
          <ArtworkAura
            colors={colors.palette}
            scale={2.2}
            blur={50}
            grain={0.35}
            pulseSpeed={4}
            amplitudeRef={amplitudeRef}
          />
        )}
```

- [ ] **Step 4: Pass `swapCount` to AudioPlayer**

In the JSX, find the `<AudioPlayer` element and its props:

```tsx
        <AudioPlayer
          audioRef={audioRef}
          preloadAudioRef={preloadAudioRef}
          isPlaying={isPlaying}
```

and add the `swapCount` prop:

```tsx
        <AudioPlayer
          audioRef={audioRef}
          preloadAudioRef={preloadAudioRef}
          swapCount={swapCount}
          isPlaying={isPlaying}
```

- [ ] **Step 5: Verify typecheck, lint, and the full suite**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: no type errors, no lint errors, all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add components/party/PartyRoom.tsx
git commit -m "Mount diagnostic hooks and gate render extras to desktop"
```

---

## Final verification

- [ ] **Run the full suite and a production build**

Run: `npx vitest run && npm run build`
Expected: all tests PASS; the build completes with no errors.

- [ ] **Manual verification (tethered mobile session)**

Open a party on a phone tethered for remote console inspection. Append `?debug=1` to the URL. Confirm:
- `[diag:summary]` lines print every 30s.
- During steady playback, `seeks` stays at 0 and audio does not skip.
- Compare a desktop session and a mobile session to confirm the glitch is gone.

This manual step is the integration verification called for in the spec; it is not a blocker for merging the code tasks.
