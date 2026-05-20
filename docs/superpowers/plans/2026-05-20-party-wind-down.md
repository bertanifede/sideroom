# Party Wind-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the abrupt auto-end-when-the-last-song-finishes with a wind-down state — the room stays open for chat and notes until the host taps "End Party" (or a 1-hour cap), and no guest gets cut off mid-song.

**Architecture:** When the last track ends, the host records a new `playback_ended_at` timestamp and enters a wind-down state — crucially with **no `party_ended` broadcast**, so every client plays its own last track to its true end. The party only formally ends on the host's End Party tap or 1 hour after wind-down. A pure `partyLifecycle(party, now)` function derives `live | winddown | ended` from three timestamps and is used by the party page and the playback hook.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-20-party-wind-down-design.md`

---

## File Structure

**New files:**
- `supabase/migrations/016_playback_ended_at.sql` — the schema migration.
- `lib/party-lifecycle.ts` — pure `partyLifecycle` function + the wind-down constant.
- `app/api/party/[id]/playback-ended/route.ts` — records `playback_ended_at` (artist-only, idempotent).
- `__tests__/lib/party-lifecycle.test.ts` — unit tests.

**Modified files:**
- `types/index.ts` — add `playback_ended_at` to the `Party` interface.
- `hooks/usePlaybackSync.ts` — wind-down state, last-track handling, 1-hour cap.
- `components/party/ArtworkOverlay.tsx` — "Set finished" locked state.
- `components/party/PartyRoom.tsx` — pass new props; render the wind-down line.
- `app/party/[inviteCode]/page.tsx` — use `partyLifecycle` for the ended check.
- `docs/technical-overview.md` — document the column and the wind-down lifecycle.
- `__tests__/hooks/usePlaybackSync.test.ts` — integration test for the last-track transition.

---

## Task 1: Schema migration + `Party` type

**Files:**
- Create: `supabase/migrations/016_playback_ended_at.sql`
- Modify: `types/index.ts` (the `Party` interface)

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/016_playback_ended_at.sql`:

```sql
-- Wind-down: records when the last track finished. The party then stays open
-- for chat/notes until the host taps "End Party" (or the 1-hour cap is hit).
ALTER TABLE parties ADD COLUMN playback_ended_at TIMESTAMPTZ;
```

- [ ] **Step 2: Add the field to the `Party` type**

In `types/index.ts`, in the `Party` interface, add `playback_ended_at` immediately after the `ended_at` line:

```ts
  ended_at: string | null;
  playback_ended_at: string | null;
  files_deleted: boolean;
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/016_playback_ended_at.sql types/index.ts
git commit -m "Add playback_ended_at column for party wind-down"
```

> **Deploy note:** this migration must be applied to the Supabase database (SQL editor or CLI) before the feature works at runtime. The Supabase clients are untyped, so the build/tests do not depend on the column existing.

---

## Task 2: `partyLifecycle` pure function

**Files:**
- Create: `lib/party-lifecycle.ts`
- Test: `__tests__/lib/party-lifecycle.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/party-lifecycle.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests — verify they fail**

Run: `npx vitest run __tests__/lib/party-lifecycle.test.ts`
Expected: FAIL — module `@/lib/party-lifecycle` does not exist.

- [ ] **Step 3: Implement the module**

Create `lib/party-lifecycle.ts`:

```ts
/**
 * Party lifecycle — derived purely from timestamps on the `parties` row.
 */

/** How long after the last track finishes the room stays open before it is
 *  treated as ended (the wind-down cap). */
export const WIND_DOWN_CAP_MS = 60 * 60 * 1000; // 1 hour

/** A party with no explicit end is treated as over this long after its
 *  scheduled start — the existing app-wide expiry rule. */
const SCHEDULED_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface PartyTiming {
  scheduled_at: string;
  playback_ended_at: string | null;
  ended_at: string | null;
}

export type PartyLifecycle = "live" | "winddown" | "ended";

/**
 * Derive a party's lifecycle state. `now` is epoch milliseconds.
 *
 * - `ended`    — the host ended it, or 1h past wind-down, or 6h past start.
 * - `winddown` — the last track finished; the room stays open for chat/notes.
 * - `live`     — playing normally.
 */
export function partyLifecycle(party: PartyTiming, now: number): PartyLifecycle {
  if (party.ended_at) return "ended";
  if (now - new Date(party.scheduled_at).getTime() > SCHEDULED_EXPIRY_MS) {
    return "ended";
  }
  if (party.playback_ended_at) {
    const sinceFinish = now - new Date(party.playback_ended_at).getTime();
    return sinceFinish > WIND_DOWN_CAP_MS ? "ended" : "winddown";
  }
  return "live";
}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npx vitest run __tests__/lib/party-lifecycle.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/party-lifecycle.ts __tests__/lib/party-lifecycle.test.ts
git commit -m "Add partyLifecycle: derive live/winddown/ended from timestamps"
```

---

## Task 3: `playback-ended` API route

**Files:**
- Create: `app/api/party/[id]/playback-ended/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/party/[id]/playback-ended/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Records when the host's last track finished — start of the wind-down. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: party } = await supabase
      .from("parties")
      .select("artist_id, playback_ended_at")
      .eq("id", id)
      .single();

    if (!party || party.artist_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Idempotent — the first call wins.
    if (party.playback_ended_at) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from("parties")
      .update({ playback_ended_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

(No unit test — this route is a verbatim copy of the existing, untested `app/api/party/[id]/end/route.ts` pattern. Its effect is exercised by the integration test in Task 4 and the tethered preview test.)

- [ ] **Step 3: Commit**

```bash
git add app/api/party/\[id\]/playback-ended/route.ts
git commit -m "Add playback-ended route to record wind-down start"
```

---

## Task 4: Hook — wind-down state, last-track handling, 1-hour cap

**Files:**
- Modify: `hooks/usePlaybackSync.ts`
- Modify: `components/party/PartyRoom.tsx` (pass the new prop)
- Test: `__tests__/hooks/usePlaybackSync.test.ts`

- [ ] **Step 1: Write the failing integration test**

In `__tests__/hooks/usePlaybackSync.test.ts`, inside the `describe("usePlaybackSync hook", ...)` block, add this test after the `describe("dual-element preloading", ...)` block's closing `});`:

```ts
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
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `npx vitest run __tests__/hooks/usePlaybackSync.test.ts -t "enters wind-down"`
Expected: FAIL — `result.current.playbackFinished` is `undefined` (not yet exposed).

- [ ] **Step 3: Add the `playbackEndedAt` prop**

In `hooks/usePlaybackSync.ts`, change the props interface:

```ts
interface UsePlaybackSyncProps {
  channel: RealtimeChannel | null;
  isArtist: boolean;
  tracks: Track[];
  partyId: string;
  initialPlaybackState?: PlaybackState | null;
  isConnected?: boolean;
  playbackEndedAt?: string | null;
}
```

and the destructured signature:

```ts
export function usePlaybackSync({
  channel,
  isArtist,
  tracks,
  partyId,
  initialPlaybackState,
  isConnected = false,
  playbackEndedAt,
}: UsePlaybackSyncProps) {
```

- [ ] **Step 4: Add the `playbackFinished` state**

In the same file, find:

```ts
  const [needsInteraction, setNeedsInteraction] = useState(false);
```

and add directly after it:

```ts
  const [playbackFinished, setPlaybackFinished] = useState(!!playbackEndedAt);
```

- [ ] **Step 5: Import the wind-down constant**

Add to the imports at the top of `hooks/usePlaybackSync.ts`:

```ts
import { WIND_DOWN_CAP_MS } from "@/lib/party-lifecycle";
```

- [ ] **Step 6: Rewrite the `onEnded` handler**

Replace the `onEnded` handler:

```ts
    const onEnded = () => {
      setIsPlaying(false);
      persistState(currentTrackPosition, 0, false);
      if (isArtist) {
        if (currentTrackPosition < totalTracks) {
          // Auto-advance to next track
          playTrack(currentTrackPosition + 1);
        } else {
          // Last track finished — end the party
          endPartyRef.current();
        }
      }
    };
```

with:

```ts
    const onEnded = () => {
      setIsPlaying(false);
      persistState(currentTrackPosition, 0, false);
      if (currentTrackPosition < totalTracks) {
        // Not the last track — the artist auto-advances; guests follow the
        // artist's next-track broadcast.
        if (isArtist) playTrack(currentTrackPosition + 1);
      } else {
        // Last track finished — enter wind-down. No party_ended broadcast, so
        // every client plays its own last track to its true end.
        setPlaybackFinished(true);
        if (isArtist) {
          fetch(`/api/party/${partyId}/playback-ended`, { method: "POST" }).catch(
            () => {}
          );
        }
      }
    };
```

- [ ] **Step 7: Remove the now-unused `endPartyRef`**

In the same file, delete this block (it was only used by the old `onEnded`):

```ts
  const endPartyRef = useRef(endParty);
  useEffect(() => {
    endPartyRef.current = endParty;
  });

```

- [ ] **Step 8: Add the 1-hour cap effect**

In the place where `endPartyRef` was just removed (immediately after the `endParty` `useCallback` ends with `}, [isArtist, partyEnded, channel, partyId]);`), insert:

```ts
  // Wind-down 1-hour cap: once playback has finished, if the host never taps
  // End Party, treat the party as ended after WIND_DOWN_CAP_MS.
  useEffect(() => {
    if (!playbackFinished || partyEnded) return;
    const startedAt = playbackEndedAt
      ? new Date(playbackEndedAt).getTime()
      : Date.now();
    const remaining = startedAt + WIND_DOWN_CAP_MS - Date.now();
    const timer = setTimeout(() => setPartyEnded(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [playbackFinished, partyEnded, playbackEndedAt]);
```

- [ ] **Step 9: Expose `playbackFinished` from the hook**

In the `return { ... }` object, add `playbackFinished` after `partyEnded`:

```ts
    partyEnded,
    playbackFinished,
    endParty,
  };
```

- [ ] **Step 10: Pass `playbackEndedAt` from PartyRoom**

In `components/party/PartyRoom.tsx`, find the `usePlaybackSync` call:

```ts
  } = usePlaybackSync({ channel, isArtist, tracks, partyId: party.id, initialPlaybackState, isConnected });
```

and change it to:

```ts
  } = usePlaybackSync({ channel, isArtist, tracks, partyId: party.id, initialPlaybackState, isConnected, playbackEndedAt: party.playback_ended_at });
```

- [ ] **Step 11: Run the test and the full suite**

Run: `npx vitest run __tests__/hooks/usePlaybackSync.test.ts && npx tsc --noEmit`
Expected: all tests PASS; no type errors.

- [ ] **Step 12: Commit**

```bash
git add hooks/usePlaybackSync.ts components/party/PartyRoom.tsx __tests__/hooks/usePlaybackSync.test.ts
git commit -m "Last track enters wind-down instead of ending the party"
```

---

## Task 5: Wind-down UI

**Files:**
- Modify: `components/party/ArtworkOverlay.tsx`
- Modify: `components/party/PartyRoom.tsx`

- [ ] **Step 1: Add the `playbackFinished` prop to ArtworkOverlay**

In `components/party/ArtworkOverlay.tsx`, add `playbackFinished` to the props interface:

```ts
interface ArtworkOverlayProps {
  coverImageUrl?: string | null;
  fallbackGradient?: { primary: string; secondary: string };
  title: string;
  crossOrigin?: "" | "anonymous" | "use-credentials";
  showPlayOverlay?: boolean;
  isPlaying?: boolean;
  isLoading?: boolean;
  onTogglePlay?: () => void;
  playbackFinished?: boolean;
}
```

and to the destructured parameters:

```ts
export default function ArtworkOverlay({
  coverImageUrl,
  fallbackGradient,
  title,
  crossOrigin,
  showPlayOverlay,
  isPlaying,
  isLoading,
  onTogglePlay,
  playbackFinished,
}: ArtworkOverlayProps) {
```

- [ ] **Step 2: Render the "Set finished" state instead of the play button**

In the same file, find the play-overlay block and change its opening condition from `{showPlayOverlay && (` to `{showPlayOverlay && !playbackFinished && (`, and add the wind-down block directly before it. The result:

```tsx
      {showPlayOverlay && playbackFinished && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl text-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <span className="text-white/90 text-sm font-medium">
            Set finished — all tracks played
          </span>
        </div>
      )}
      {showPlayOverlay && !playbackFinished && (
        <button
          onClick={onTogglePlay}
          disabled={isLoading}
          className={`absolute inset-0 flex items-center justify-center rounded-2xl cursor-pointer transition-opacity duration-500 ${
            isPlaying && !isLoading ? "opacity-0 hover:opacity-60" : "opacity-100"
          }`}
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
        >
          <span className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            {isLoading ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="animate-spin">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" strokeDasharray="50 20" strokeLinecap="round" />
              </svg>
            ) : isPlaying ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="2" />
                <rect x="14" y="4" width="4" height="16" rx="2" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" />
              </svg>
            )}
          </span>
        </button>
      )}
```

- [ ] **Step 3: Destructure `playbackFinished` in PartyRoom**

In `components/party/PartyRoom.tsx`, add `playbackFinished` to the `usePlaybackSync` destructure, after `partyEnded`:

```ts
    partyEnded,
    playbackFinished,
    endParty,
  } = usePlaybackSync({ channel, isArtist, tracks, partyId: party.id, initialPlaybackState, isConnected, playbackEndedAt: party.playback_ended_at });
```

- [ ] **Step 4: Pass `playbackFinished` to ArtworkOverlay**

In the same file, find the `<ArtworkOverlay` element and add the prop:

```tsx
        <ArtworkOverlay
          coverImageUrl={coverImageUrl}
          fallbackGradient={themeGradientColors}
          title={party.title}
          crossOrigin="anonymous"
          showPlayOverlay={isArtist}
          isPlaying={isPlaying}
          isLoading={isLoadingPlay}
          onTogglePlay={isPlaying ? pause : handlePlay}
          playbackFinished={playbackFinished}
        />
```

- [ ] **Step 5: Add the wind-down line below the player**

In the same file, find the AudioPlayer block:

```tsx
      <div className="w-full max-w-sm mt-3">
        <AudioPlayer
          audioRef={audioRef}
          preloadAudioRef={preloadAudioRef}
          swapCount={swapCount}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          isArtist={isArtist}
          onPlay={handlePlay}
          onPause={pause}
          needsInteraction={needsInteraction}
          onResume={resumeFromInteraction}
        />
      </div>
```

and insert directly after that closing `</div>`:

```tsx
      {playbackFinished && !partyEnded && (
        <p className="text-sm text-[var(--party-fg)]/60 text-center mt-3 max-w-sm">
          {isArtist
            ? "All tracks played — guests can still chat. Tap End Party when you're ready."
            : "The set has finished — say goodbye in chat."}
        </p>
      )}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add components/party/ArtworkOverlay.tsx components/party/PartyRoom.tsx
git commit -m "Add wind-down UI: 'Set finished' state and inline message"
```

---

## Task 6: Party page uses `partyLifecycle`

**Files:**
- Modify: `app/party/[inviteCode]/page.tsx`

- [ ] **Step 1: Import `partyLifecycle`**

In `app/party/[inviteCode]/page.tsx`, add to the imports:

```ts
import { partyLifecycle } from "@/lib/party-lifecycle";
```

- [ ] **Step 2: Replace the ended check**

In the same file, find:

```ts
  // If the party has ended (explicitly or 6h past scheduled time), show ended state
  const isExpired =
    party.scheduled_at &&
    Date.now() - new Date(party.scheduled_at).getTime() > 6 * 60 * 60 * 1000;

  if (party.ended_at || isExpired) {
```

and replace those lines with:

```ts
  // Ended = host ended it, 1h past wind-down, or 6h past the scheduled start.
  const lifecycle = partyLifecycle(party, Date.now());

  if (lifecycle === "ended") {
```

(The rest of the ended/review block is unchanged. When `lifecycle` is `live` or `winddown`, the page renders `PartyRoom` as before — `PartyRoom` shows the wind-down state from Task 5 because `party.playback_ended_at` flows into the hook.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: no type errors; all tests PASS; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/party/\[inviteCode\]/page.tsx
git commit -m "Party page: derive ended state from partyLifecycle"
```

---

## Task 7: Documentation

**Files:**
- Modify: `docs/technical-overview.md`

- [ ] **Step 1: Add the column to the data model**

In `docs/technical-overview.md`, in the `parties` block of the Data Model section, add a line directly after `ended_at`:

```
  ended_at (TIMESTAMPTZ, nullable)
  playback_ended_at (TIMESTAMPTZ, nullable) — when the last track finished; the party then stays open for chat/notes until the host ends it
  files_deleted (BOOLEAN)
```

- [ ] **Step 2: Update the Deletion Lifecycle section**

In the same file, in the "Deletion Lifecycle" section, replace the lifecycle block with:

```
Party created → files uploaded
Last track finishes → wind-down: room stays open for chat/notes, playback_ended_at set, no audio cut off
Host taps End Party → ended_at set
  (if untouched: treated as ended 1h after wind-down, or 6h after scheduled_at)
+48 hours after the end (ended_at, or scheduled_at when never ended) →
  Vercel cron deletes files from storage, sets files_deleted = true
→ Artist receives deletion confirmation email
```

- [ ] **Step 3: Commit**

```bash
git add docs/technical-overview.md
git commit -m "Document the party wind-down lifecycle"
```

---

## Final verification

- [ ] **Run the full suite and a production build**

Run: `npx vitest run && npm run build`
Expected: all tests PASS; the build completes with no errors.

- [ ] **Manual verification**

On the preview deployment, with a multi-track test party: play to the end and confirm — the last song plays to its natural finish on a guest device (no cut-off), the room stays open with chat/notes working, the host sees "Set finished" and the End Party button, and tapping End Party shows the Party Ended screen. Apply migration 016 to the database first.
