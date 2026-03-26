# Audio Sync Tests

Unit tests for sideroom's audio synchronization system. Run with:

```bash
npm test          # watch mode
npx vitest run    # single run
```

## Test Structure

```
__tests__/
  api/
    playback-state.test.ts    # API route auth + response
  components/
    AudioPlayer.test.tsx       # Component rendering
  hooks/
    usePlaybackSync.test.ts    # Core sync logic
    useRealtimeChannel.test.ts # Realtime connection status
```

## Setup

- **Vitest** with jsdom environment for DOM/React testing
- **@testing-library/react** for component rendering and hook testing
- **@testing-library/jest-dom** for DOM matchers (`toBeInTheDocument`, etc.)
- Config in `vitest.config.ts`, matcher setup in `vitest.setup.ts`

---

## API Route: `playback-state.test.ts`

Tests the `GET /api/party/[id]/playback-state` endpoint's authorization logic.

Supabase is mocked at the module level (`@/lib/supabase/server`). A reusable `fakeQuery()` helper creates self-referencing proxy objects so any `.select().eq().is().single()` chain works without mirroring exact query structure.

| Test | What it verifies |
|------|-----------------|
| No guest token + no auth user | Returns 403 Unauthorized |
| Valid guest token (seated guest) | Returns the party's `playback_state` |
| Authenticated artist | Falls through guest check, matches `artist_id`, returns state |
| Party has no playback state | Returns `{ playback_state: null }` |

---

## Component: `AudioPlayer.test.tsx`

Renders the `AudioPlayer` component with `@testing-library/react` and asserts on DOM output.

| Test | What it verifies |
|------|-----------------|
| `needsInteraction=true` + guest | "Tap to start listening" button is visible |
| `needsInteraction=false` | Button is not rendered |
| Click tap-to-listen button | `onResume` callback fires |
| Playing + not needsInteraction | "listening" indicator is visible |
| Playing + needsInteraction | Indicator is hidden (button takes priority) |
| Artist view | Play/pause button is rendered |

---

## Hook: `usePlaybackSync.test.ts`

The largest test file. Split into two sections:

### Pure function: `computeSeekPosition`

Extracted from the hook so the elapsed-time math can be tested directly — no React, no mocks, no timing issues.

| Test | What it verifies |
|------|-----------------|
| 60s ago | Elapsed capped at 30s (position 10 + 30 = 40) |
| 5s ago | Uses real elapsed (~15s) |
| Near end of track | Clamped to track duration (190 + 30 = 220, capped to 200) |
| Duration is null | No clamping applied |

### Hook integration tests

Uses `renderHook` with a mock `HTMLAudioElement` and mock Realtime channel. The mock audio tracks `src`, `currentTime`, `paused` state and spies on `play()`/`pause()`.

**Broadcast handling (guest):**

| Test | What it verifies |
|------|-----------------|
| HEARTBEAT track change | Fetches new stream URL for the new track, sets `audio.src` |
| HEARTBEAT drift > 2s | Corrects `audio.currentTime` to match artist position |
| HEARTBEAT resume | Calls `play()` when artist says `is_playing` but guest audio is paused |
| Artist flag | `isArtist=true` skips registering any broadcast listener |

**Recovery guard:**

| Test | What it verifies |
|------|-----------------|
| Broadcasts before recovery | Ignored entirely (PAUSE doesn't call `audio.pause`) |

**Late joiner (mount recovery):**

These test the scenario where a guest opens the party page after playback has already started.

| Test | What it verifies |
|------|-----------------|
| Joins on track 3, 10s elapsed | Fetches track 3's URL, seeks to ~70s, sets `currentTrackPosition` to 3 |
| Joins when artist is paused | Does NOT auto-play, but updates track position |
| Stream URL fetch fails | No crash, no play attempt, `src` stays empty |
| Browser blocks autoplay | `play()` rejects → `needsInteraction` set to `true` |
| Guard lifts after recovery | Subsequent PAUSE broadcast is processed (audio pauses, time updates) |
| Guard lifts even on fetch failure | `finally{}` ensures `recoveryCompleteRef` is set even when stream URL fetch fails |
| Resume re-fetches URL on refresh | `resumeFromInteraction` fetches a new stream URL when `audio.src` is empty (covers page refresh where initial recovery failed) |
| Basic mount recovery | Seeks to computed position (~15s), calls `play()`, sets `src` |

---

## Hook: `useRealtimeChannel.test.ts`

Tests the Supabase Realtime channel's connection status tracking.

The mock captures the `.subscribe()` callback and fires it with different status strings.

| Test | What it verifies |
|------|-----------------|
| `SUBSCRIBED` | `isConnected` becomes `true` |
| `CHANNEL_ERROR` | `isConnected` becomes `false` |
| `TIMED_OUT` | `isConnected` becomes `false` |

---

## Mocking Strategy

- **Supabase**: Mocked at module level via `vi.mock()`. API route tests use a proxy-based chain mock. Hook tests don't touch Supabase directly (the hook receives a channel prop).
- **fetch**: Stubbed globally with `vi.stubGlobal("fetch", mockFn)` for stream URL fetches.
- **HTMLAudioElement**: A plain object with getters/setters for `src`, `currentTime`, `paused` and vi.fn() spies on `play()`/`pause()`. Injected via the hook's `audioRef`.
- **RealtimeChannel**: A minimal object with `send`, `on`, `off` spies and a `_trigger()` helper to simulate broadcast events.
