# Mobile Playback Fix — Design Spec

**Date:** 2026-05-20
**Status:** Approved (pending spec review)
**Author:** Fede Bertani

---

## Background

sideroom's first paying client hosted a party. Desktop playback was perfect; on mobile, listeners experienced audio that skipped/froze/resumed roughly every ~10 seconds. The client expects to host another paid party the weekend of 2026-05-24, so this must be fixed and verified before then.

The lag was reported secondhand for an unidentified participant — whether host or guest is **not confirmed**. Guests are the confirmed-prone case; host impact is assumed as a precaution. The client's audio file was an MP3.

## Diagnosis

Two independent root causes, at different confidence levels:

### Root cause #1 — Drift-correction seek loop (HIGH confidence, guests only)

In `hooks/usePlaybackSync.ts`, the guest HEARTBEAT handler hard-seeks the audio element whenever measured drift exceeds 300ms:

```js
const drift = Math.abs(audio.currentTime - event.position);
if (drift > 2) { audio.currentTime = event.position; }
else if (drift > 0.3) { audio.currentTime = event.position; }
```

The heartbeat is not latency-compensated: `event.position` is the artist's position at *send* time, so a perfectly-synced guest still measures drift ≈ network latency. Desktop wifi latency stays under 300ms (no seek); mobile cellular latency exceeds it on nearly every 5s heartbeat → a hard seek every heartbeat → decoder flush + re-buffer → the audible skip. The two `if` branches are identical, so the ">2s pause/seek/resume" behaviour described in `docs/technical-overview.md` does not actually exist.

A secondary trigger: the reconnection re-sync effect also hard-seeks on every WebSocket reconnect, which is frequent on mobile.

### Root cause #2 — Fragile streaming proxy (SUSPECTED, unconfirmed, everyone)

`app/api/party/[id]/stream/route.ts` proxies audio. On **every Range request** it runs 3–4 Supabase queries plus `createSignedUrl`, and it sets no explicit `maxDuration`. Mobile browsers (iOS Safari especially) open/close/reopen Range connections frequently; each reopen pays the full proxy overhead, and a long open-ended Range stream can be killed mid-flight by the platform timeout. The `onError` handler reacts to any audio error with a full `src` reset + seek, turning transient blips into guaranteed audible skips. This path is shared by host and guests.

### Not a cause

- **Bandwidth / file size** — the file is an MP3 (already compressed). Transcoding is not needed.
- **Range support** — the proxy correctly forwards Range headers and returns 206.

## Goals

1. Eliminate the periodic skip/freeze/resume on mobile.
2. Keep guests acceptably in sync — being 1–2 seconds behind the host is explicitly acceptable.
3. Ship a verification harness so the fix can be confirmed on a real mobile session before the weekend.
4. Preserve the existing content-protection model entirely.

## Non-goals

- Transcoding / AAC re-encode (file is already an MP3).
- Full latency-compensated sync requiring artist↔guest clock synchronisation (deferred; `sentAt` groundwork is laid but unused).
- HLS / segmented streaming, audio watermarking, DRM.

---

## The Fix

Delivered in four priority tiers. Each tier is independently shippable and verifiable.

### P0a — Set `maxDuration` on the stream route

Add a route segment config to `app/api/party/[id]/stream/route.ts`:

```ts
export const maxDuration = 300;
```

Verify the actual cap allowed by the current Vercel plan and use the highest permitted value. This removes the timeout-kill risk for long mobile Range streams. The Node.js runtime is kept (Edge cannot do this streaming proxy as cleanly). One line, zero behavioural risk.

### P0b — Three-band drift correction (the glitch fix)

Rewrite the guest drift-correction logic in `hooks/usePlaybackSync.ts` around a pure decision function:

```ts
// delta = targetPosition - audio.currentTime  (positive = guest is behind)
function decideCorrection(delta: number): {
  action: "none" | "nudge" | "seek";
  playbackRate: number;
}
```

Bands (constants tunable; defaults below):

| `|delta|` | action | effect |
|---|---|---|
| ≤ `DEAD_ZONE` (2.0s) | `none` | nothing; ensure `playbackRate` is reset to 1.0 |
| > 2.0s and ≤ `SEEK_THRESHOLD` (5.0s) | `nudge` | `playbackRate` = 1.03 if behind, 0.97 if ahead |
| > 5.0s | `seek` | one hard seek to `targetPosition`, reset `playbackRate` to 1.0 |

Applied in two places:

- **HEARTBEAT handler** — replaces the current `drift > 0.3 → seek` block. Re-evaluated every heartbeat; the nudge is a smooth, pitch-preserved tempo change that quietly absorbs lag accumulated from any occasional stall.
- **Reconnection re-sync effect** — replaces its unconditional `audio.currentTime = seekTo` with the same `decideCorrection` call, so a brief WebSocket flap no longer triggers a seek (a long disconnect still yields a large delta → seek, which is correct).

Additional details:

- Set `audio.preservesPitch = true` (and the `webkitPreservesPitch` alias) so nudging changes tempo, not pitch.
- Add `sentAt: Date.now()` to broadcast event payloads and `sentAt?: number` to the `PlaybackEvent` type. Unused by this fix; it is groundwork for a future latency-compensated sync and is logged by P2 instrumentation.
- Existing track-change and play/pause-mismatch handling in the HEARTBEAT path is unchanged.

**Net effect:** zero glitches in all normal conditions. A hard seek occurs only after a genuine large desync (e.g. the phone was asleep/backgrounded).

### P1a — Lean proxy

In `app/api/party/[id]/stream/route.ts`, add a module-scope cache of the generated signed URL, keyed by `${partyId}:${track}`, with a ~50s TTL (the signed URL is valid 60s; 50s leaves margin). A cache hit skips both the track DB lookup and `createSignedUrl`. Expired entries are dropped on access.

The per-request authorization check (guest seat / artist lookup) **stays live** — it is a single indexed query, and caching it could let a guest who has left the party keep streaming. The signed-URL cache is server-side only and never reaches the client, so the content-protection model is unchanged.

### P1b — Soften `onError`

Replace the immediate full reload in the `onError` handler with bounded, backed-off recovery:

- Track consecutive error count and timestamps in a ref.
- On an isolated error, attempt lightweight recovery (allow the element to retry / wait for `canplay`) rather than an immediate `src` reset + seek.
- Only perform the full `src` reset + seek after repeated failures within a short window, and wait for `canplay` before treating playback as resumed.

This prevents a single transient mobile network blip from becoming a guaranteed audible skip or a reload loop.

### P2 — Instrumentation (verification harness)

Built early so it can verify P0 and P1 on a tethered mobile test session. Capture method: structured `console` logging (developer tests on their own phone, tethered).

**New files:**
- `lib/diagnostics.ts` — parses toggle flags from `window.location.search` once; exposes `enabled`, `flags`, and a `log(category, event, data)` function; maintains aggregation counters and prints a 30s rolling summary line. SSR-safe; a complete no-op when `?debug=1` is absent.
- `hooks/useAudioDiagnostics.ts` — debug-only; attaches `waiting`/`stalled`/`playing`/`seeking`/`seeked`/`ratechange`/`error` listeners to the audio element(s) and measures stall durations (`waiting`→`playing`). Mounted in `PartyRoom`.
- `hooks/useFrameHealth.ts` — debug-only; a `requestAnimationFrame` frame-interval monitor counting janky frames (>32ms) per window. Mounted in `PartyRoom`.

**Edits:**
- `hooks/usePlaybackSync.ts` — `diag.log()` calls at the drift/seek decision, PLAY/PAUSE/SEEK, and reconnection recovery.
- `hooks/useRealtimeChannel.ts` — log channel connect/disconnect transitions.
- `hooks/useAudioAnalyser.ts` — log `AudioContext` creation, state, `statechange`, and `resume()` result.
- `app/api/party/[id]/stream/route.ts` — per-request timing log (auth ms, sign ms, upstream TTFB, total ms, range, status), gated by a `DEBUG_STREAM` env var. Output appears in Vercel function logs.
- `components/party/AudioPlayer.tsx` — a small user-facing "buffering…" indicator driven by `waiting`/`playing`, so guests see a state instead of silent confusion. (This part is not gated — it is a genuine UX improvement.)

**Toggle flags (query params):** `?debug=1` (master logging switch) and `?noanalyser=1` (disable the Web Audio analyser on desktop for A/B testing).

The instrumentation data also feeds tuning of the P0b band constants.

### P3 — Remove dead WebGL code; desktop-only render extras

Verified during planning: `PartyWebGLBackground` is imported into `PartyRoom.tsx` but never rendered. The WebGL shader background and everything it pulls in are dead code and are deleted:

- `components/party/PartyWebGLBackground.tsx`
- `components/party/ShaderDevControls.tsx`
- `components/party/PartyGlowBackground.tsx`
- `hooks/useWebGLBackground.ts`
- `lib/shaders/` (`types.ts`, `fullscreenQuad.ts`, `presets/`)
- the unused `PartyWebGLBackground` import in `components/party/PartyRoom.tsx`

(`remotion/src/components/ArtworkAura.tsx` is a separate file for the Remotion video pipeline and is left untouched.)

The remaining mobile render cost is then two animation loops, both gated:

- **ArtworkAura** (`components/party/ArtworkAura.tsx`, a canvas aura animation) — rendered on **desktop only**. On mobile (`(pointer: coarse)`) it is not mounted. Detection via a shared `hooks/useCoarsePointer.ts` hook.
- **Web Audio analyser** (`hooks/useAudioAnalyser.ts`) — gains an `enabled` option; disabled by default on mobile (the `createMediaElementSource` reroute is a known iOS hazard), and respects `?noanalyser=1` on desktop for A/B testing.

---

## Sequencing

1. **P0a + P0b** — the glitch fix; shippable on its own.
2. **P1a + P1b** — proxy hardening.
3. **P2** — instrumentation (may be built first/in parallel as the verification harness).
4. **P3** — dead-code removal + render guards.

## Testing

Unit tests (Vitest) for the pure logic:
- `decideCorrection` — every band, both directions, boundary values.
- The diagnostics flag parser.
- The signed-URL cache TTL logic.
- `shouldRetryAfterError` — the `onError` retry-budget helper.

The existing `__tests__/hooks/usePlaybackSync.test.ts` must remain green (diagnostics are a no-op when disabled). Integration verification is the tethered `?debug=1` mobile session reading the 30s summary lines.

## Safety considerations

No change touches authentication, Row-Level Security, or the streaming proxy's no-direct-URL guarantee. The signed-URL cache lives only in server memory. All client diagnostics are gated behind `?debug=1`; server timing logs behind `DEBUG_STREAM`. The WebGL change only removes a decorative layer on mobile and is independently revertable.

## Risks and open items

- **P0b tuning** — the default band constants (2s / 5s / ±0.03) are estimates; they will be tuned from the P2 instrumentation data. A fixed 0.03 nudge closes large gaps slowly; if post-fix stalls prove rare this is fine, otherwise the `SEEK_THRESHOLD` may be lowered.
- **`preservesPitch` support** — modern browsers default it to `true`; set explicitly with the `webkit` alias for older Safari.
- **Proxy cache memory** — the module-scope `Map` is bounded by expiry-on-access; entry count is small (one per party/track) so no hard cap is required initially.
- **Vercel `maxDuration` cap** — must be verified against the active plan before setting the value.
