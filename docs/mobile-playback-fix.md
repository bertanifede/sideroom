# Mobile Playback Fix — Changes & Testing Guide

**Branch:** `mobile-playback-fix` · **Date:** 2026-05-20

This document synthesizes what changed, what to expect, and how to verify it before
the next party. Full detail lives in
[`docs/superpowers/specs/2026-05-20-mobile-playback-fix-design.md`](superpowers/specs/2026-05-20-mobile-playback-fix-design.md)
and the implementation plan alongside it.

---

## The problem

The first paying client's party played perfectly on desktop but, on mobile,
audio skipped / froze / resumed roughly every ~10 seconds.

## Root cause

It was a **synchronization** problem, not a streaming-bandwidth problem.

The guest playback code hard-seeked the audio element whenever it measured more
than **300 ms** of drift from the host. But the drift it measured was really just
**network latency** — and 300 ms is *below* normal mobile-cellular latency. So a
mobile guest crossed the threshold on nearly every heartbeat (every 5 s) and
hard-seeked every time. Each hard seek flushes the audio decoder → an audible
skip. Desktop wifi latency stays under 300 ms, so desktop never triggered it.

A second, separate weakness: the streaming proxy and its error handling were
fragile under the connection patterns mobile browsers use.

## What changed

### 1. The sync fix (the core change)

The "hard-seek on any drift" rule is replaced with a **two-band tolerance**:

| How far off the guest is | What happens |
|---|---|
| within **10 s** of the host | nothing — the guest plays at natural speed, a few seconds off the host (imperceptible for a remote party) |
| more than 10 s off | one hard seek to resync — rare (track change, long stall, backgrounded tab) |

The guest's `playbackRate` is never altered. An earlier revision nudged
playback speed (0.97–1.03×) for moderate drift, but on mobile the drift sits
in that band almost permanently — continuous time-stretching is audible as a
"wobble"/chorus artifact — so nudging was removed entirely. The same two-band
rule applies on **reconnection**, so a brief wifi blip no longer forces a skip.

### 2. Streaming proxy hardening

- **`maxDuration`** is set on the stream route so the hosting platform can't
  terminate a long mobile stream mid-playback.
- The proxy **caches the signed URL** (~50 s) instead of running 3–4 database
  queries on every range request.
- The audio **error handler no longer reload-loops** on a transient network
  blip — it retries a few times, then shows a "tap to resume" instead of
  thrashing.

### 3. Diagnostics (so the fix can be verified)

- Append **`?debug=1`** to a party URL to turn on structured console logging
  plus a one-line summary every 30 s. It is a complete no-op without the flag —
  nothing extra ships to normal guests.
- A **"Buffering…" indicator** now appears on screen when audio is genuinely
  buffering, instead of silent confusion.

### 4. Cleanup

- Deleted a **dead WebGL background subsystem** (~830 lines) that was imported
  but never actually rendered.
- The decorative aura animation and the Web Audio analyser now run on
  **desktop only**. The analyser's iOS audio-routing behaviour was a latent
  playback hazard on mobile.

### 5. Safety — unchanged

Authentication, Row-Level Security, and the streaming proxy's
content-protection model are **untouched**. Signed URLs are still generated
server-side and never reach the client. All diagnostics are gated behind
`?debug=1`.

## What to expect

- **Mobile guests:** smooth playback, no periodic skipping. They may sit 1–2 s
  behind the host — imperceptible for remote listening.
- A brief **"Buffering…"** indicator (instead of silence) if the network hiccups.
- **Desktop:** unchanged.
- The decorative aura no longer animates on phones — a battery/performance win.
  The artwork itself is unchanged.

---

## How to test

### Step 1 — Get it onto a real URL

A proper mobile test needs the app reachable from a phone **and** the real
serverless proxy. Best option: **push this branch and use the Vercel preview
deployment**. (A local `npm run dev` with the phone on the same wifi works for
the sync behaviour, but cannot exercise the serverless `maxDuration` / proxy
timeout behaviour.)

### Step 2 — Deploy check

- **Confirm the Vercel plan.** `maxDuration = 300` requires the **Pro** plan.
  On **Hobby** the cap is 60 — if so, change `maxDuration` to `60` in
  `app/api/party/[id]/stream/route.ts`.
- Optional: set the env var **`DEBUG_STREAM=1`** to get per-request proxy
  timing in the Vercel function logs.

### Step 3 — Run a debug party

1. Host a party on one device.
2. Join as a guest on your phone, appending `?debug=1` to the URL:
   `…/party/<invite-code>?debug=1`
3. Tether the phone and open its browser console:
   - **iPhone:** Safari → Develop menu → your phone → the party tab.
   - **Android:** `chrome://inspect` on a desktop Chrome.

### Step 4 — What to watch

Every 30 s a summary line prints, e.g.:

```
[diag:summary] 30s — 6 heartbeats · 0 seeks · 1 nudges · drift avg 0.42s max 1.1s · 0 stalls totaling 0.0s · 8 janky frames
```

- **seeks** should be `0` (or very rare). *Before* the fix you would see a seek
  on most heartbeats — that was the bug.
- **stalls** = audible freezes. Should be `0` or near it.
- **nudges** are expected and fine — they are the smooth, inaudible correction.
- And of course: **no audible skipping** during the session.

### Step 5 — A/B the analyser (optional)

If any dropouts remain, compare `?debug=1` against `?debug=1&noanalyser=1`.
If the second run is clean, the Web Audio analyser is implicated and can be
disabled outright.

### Step 6 — Desktop smoke test

Confirm desktop playback, chat, the seat list, and track changes still behave
normally.

---

## What was deliberately NOT done

- **No transcoding** — the client's file is already a compressed MP3, so
  re-encoding gains nothing.
- **No full latency-compensated sync** — that would require synchronizing the
  clocks of every device. The current fix accepts guests being 1–2 s behind
  (which you confirmed is acceptable) and is glitch-free without clock sync.
  The `sentAt` timestamp is now attached to every sync message as groundwork,
  should tighter sync ever be wanted.

## Verification status

`tsc` clean · 55 unit tests passing · production build succeeds · independent
multi-agent code review passed (one bug found and fixed — a sync nudge that
could stay applied after a pause).
