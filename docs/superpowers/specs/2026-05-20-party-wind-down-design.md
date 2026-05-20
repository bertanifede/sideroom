# Party Wind-Down — Design Spec

**Date:** 2026-05-20
**Status:** Approved (pending spec review)
**Author:** Fede Bertani

---

## Background

When the last track of a party finishes, the party **ends instantly**: the host's
`onEnded` handler calls `endParty()`, which broadcasts `party_ended` to every
guest. That broadcast immediately pauses each guest's audio and slams up the
full-screen "Party Ended" overlay.

Two problems:

1. **Guests get cut off.** Guests run a few seconds behind the host (normal,
   accepted sync drift). The `party_ended` broadcast pauses their audio *before*
   their copy of the last song has finished — so they never hear the end of it.
2. **It's abrupt.** The room vanishes into a modal the instant the music stops,
   with no room to say goodbye.

## Goals

1. Guests always hear the last song to its natural end.
2. After the music ends, the room stays open for chat and notes — a "wind-down".
3. The party ends only when the **host** taps "End Party" — not automatically.
4. A 1-hour cap keeps the room from being stuck open forever; the existing
   48-hour audio auto-deletion is unaffected.
5. The end is no longer a jarring surprise.

## Non-goals

- Changing the **mid-party** manual "End Party" flow — if the host ends a party
  while music is still playing, that stays immediate (it is a deliberate act).
- Redesigning the post-party review experience.
- Any change to the 48-hour deletion *window* itself (only *when the clock
  starts* is clarified — see below).

---

## Design

### Lifecycle

A party's state is derived from three timestamps on the `parties` row —
`scheduled_at`, `playback_ended_at` (new), `ended_at`:

| State | Condition |
|---|---|
| **live** | playing; `playback_ended_at` null, not `ended` |
| **wind-down** | `playback_ended_at` set, not `ended` |
| **ended** | `ended_at` set **or** `now > playback_ended_at + 1h` **or** `now > scheduled_at + 6h` |

This is captured in a pure function `partyLifecycle(party, now)` → `"live" |
"winddown" | "ended"`, used by both the party page and the playback hook. (The
pre-start "countdown" state is unchanged and out of scope here.)

### The core fix — last-song handling

When the **last track ends**, the host no longer calls `endParty()`. Instead:

- The host records **`playback_ended_at = now`** (persisted to the DB) and
  enters wind-down locally. **No `party_ended` broadcast is sent.**
- Each **guest's** last track ends naturally on its own `onEnded` — a few
  seconds later if the guest is behind — and that guest enters wind-down too.
- Because nothing broadcasts a pause, **every client plays its last song to its
  true end.** This is the fix.
- A guest who loads the party after the music is already over (`playback_ended_at`
  set) is shown the wind-down state directly.

### Wind-down state

The room stays fully usable — chat and notes are not playback-gated. The state
change is **inline, not an overlay**, which removes the abruptness.

- **Host:** the artwork play control becomes a non-interactive "Set finished —
  all tracks played" state (tapping does nothing). The **End Party** button
  remains and is now the clear next action.
- **Guest:** a calm inline line near the player — e.g. "The set has finished —
  say goodbye in chat." No overlay.

Playback is locked in wind-down: the host cannot restart or replay the set.

### Ending the party

- **Host taps End Party** → `ended_at = now`, broadcast `party_ended`, the
  existing Party Ended screen appears. Mechanism unchanged.
- **1-hour cap** — if the host never taps End Party, the party is treated as
  ended once `now > playback_ended_at + 1h`. This is **purely computed** by
  `partyLifecycle`: the party page renders the ended/review state, and a client
  sitting in the room flips to the Party Ended screen via a timer. No database
  write and no cron change are involved.
- **File deletion** is unchanged (see "File deletion" below). An un-ended party
  is still cleaned up by the existing cron via its `scheduled_at` fallback, so
  the "audio deleted 48h after the party" privacy guarantee holds with no
  change to the cron.

### Optional polish

The final `PartyEndedOverlay` fades in (short transition) rather than appearing
instantly. Low-cost; further softens the end. Can be dropped if it complicates
the change.

---

## Schema

**Migration 016** — add one nullable column:

```sql
ALTER TABLE parties ADD COLUMN playback_ended_at TIMESTAMPTZ;
```

Covered by the existing `parties` RLS policies (artists update their own
parties). The host writes it through an authenticated, artist-checked route,
the same pattern as `playback_state`.

## API

A small server route records `playback_ended_at` when the host's last track
ends — either a new `POST /api/party/[id]/playback-ended` or an extension of
the existing `PUT /api/party/[id]/playback-state`. It verifies the caller is
the party's artist before writing. (Exact choice deferred to the plan.)

## File deletion (unchanged)

The `cleanup-files` cron is **not modified**. Its existing query
(`lib/cleanup-party-files.ts`) already deletes audio 48h after `ended_at`, or —
when `ended_at` is null — 48h after `scheduled_at`. This feature leaves
`ended_at` null for any party the host never explicitly ends; those parties are
cleaned via the `scheduled_at` branch, exactly as abandoned parties are today.
No cron change is needed.

## Party-page logic

`app/party/[inviteCode]/page.tsx` currently treats a party as ended when
`ended_at` is set or `scheduled_at + 6h` has passed. It additionally treats
`playback_ended_at + 1h` elapsed as ended. When the party is in **wind-down**
(`playback_ended_at` set, not ended) it still renders `PartyRoom`, which shows
the wind-down state.

## Documentation updates

- **`docs/technical-overview.md`** — add `playback_ended_at` to the `parties`
  data model, and update the deletion-lifecycle section to describe the
  live → wind-down → ended states. No new doc is needed, and `cron-jobs.md` is
  unchanged because the cron itself does not change.

This update is part of this feature's implementation, not a separate task.

## Testing

- **`partyLifecycle(party, now)`** — pure function, unit-tested for every
  branch (live / wind-down / ended via each of the three conditions, boundary
  values).
- **Integration** — the host's last-track `onEnded` enters wind-down and does
  **not** broadcast `party_ended`; a guest finishing its last track enters
  wind-down independently.

## Risks and open items

- **`ended_at` stays null for un-ended parties** — when the host never taps
  End Party, `ended_at` is never written. Every consumer of "is this over?"
  (party page, dashboard, stream route, file cleanup) already also checks
  `scheduled_at`-based expiry, so this is harmless — and it is exactly how
  abandoned parties already behave today.
- **Stuck guest** — a guest whose last track never fires `onEnded` (e.g. paused
  on a stall) will not auto-enter wind-down from its own playback. It is a
  cosmetic edge case (no audio is playing for them anyway); a reload resolves
  it via the party-page lifecycle check. Not worth extra machinery.
