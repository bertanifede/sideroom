# Security Design — sideroom

## Problem

The original MVP prioritized speed over security. An audit identified five vulnerabilities:

| Vulnerability | Impact | Pre-fix state |
|---|---|---|
| Invite code enumeration | Unauthorized party access | 57K combinations via `Math.random()` |
| Leaked invite links | Strangers claiming seats | No second factor on links |
| Bot seat claiming | All seats taken by scripts | No CAPTCHA, no verification |
| Audio theft via stream-url | Unreleased music downloaded | Endpoint had zero authentication |
| Missing input validation | Payload abuse, oversized data | No server-side length or format checks |

## Solution — Layered Security

Eight independent layers. Each one works alone — a failure in one doesn't compromise the others.

| Layer | What | Status |
|---|---|---|
| 1 | Cryptographic invite codes | Implemented |
| 2 | Optional party PIN (HMAC-signed cookie) | Implemented |
| 3 | Cloudflare Turnstile (bot protection) | Implemented |
| 4 | Rate limiting | Documented — not yet implemented |
| 5 | Stream URL authentication + party expiry check | Implemented |
| 6 | Stream URL broadcast isolation | Implemented |
| 7 | Server-side streaming proxy | Implemented |
| 8 | RLS policy lockdown (tracks, seats, storage) | Implemented |

Additionally: server-side input validation on all API endpoints.

---

## Layer 1: Cryptographic Invite Codes

**Before:** `cosmic-groove-42` — 24 adjectives × 24 nouns × 99 numbers = ~57K combinations, generated with `Math.random()`.

**After:** `cosmic-groove-a8f3e9b1` — 24 adjectives × 24 nouns × 2^32 hex values = ~2.3 trillion combinations, generated with `crypto.getRandomValues()`.

The human-readable prefix stays for friendliness. The 8-character hex suffix provides the entropy.

**Collision check:** Party creation retries up to 5 times if a generated code already exists in the database. Returns 500 after 5 collisions (astronomically unlikely at any realistic scale).

**Files:**
- `lib/invite-code.ts` — generation logic using Web Crypto API
- `app/api/party/route.ts` — collision check loop before insert

---

## Layer 2: Optional Party PIN

Artists can set an optional 4–8 character alphanumeric passcode when creating a party. Guests must enter it before seeing the join form.

### Why Alphanumeric, Not Numeric

- 36^4 = 1.7M vs 10^4 = 10K possible values at minimum length
- Artists can use memorable words ("midnight", "albumdrop")
- Rate limiting (Layer 4, future) adds further protection

### How It Works

**Database:** `pin_hash` is stored in a separate `party_secrets` table (not the publicly readable `parties` table). This table has artist-only RLS, so the bcrypt hash is never exposed to outsiders via the anon key. Hashed with bcrypt (10 salt rounds). Plaintext PIN is never stored or returned after creation.

**Artist flow:**
1. Toggle "Require a passcode" on the create-party form
2. Enter 4–8 alphanumeric characters
3. After creation, PIN is shown once in a copyable box with guidance: "Share this passcode separately from the link"

**Guest flow (PIN set):**
1. Open invite link → see party title + "This party requires a passcode"
2. Enter passcode → `POST /api/party/[id]/verify-pin` verifies against `pin_hash`
3. On success → httpOnly cookie set (`party_pin_verified_{id}`, 30-minute TTL) with an HMAC-SHA256 signature as the value
4. Join form appears → `POST /api/party/[id]/join` recomputes the HMAC and compares it to the cookie value
5. On failure → "Incorrect passcode" (no format hints disclosed)

**Cookie signing:** The cookie value is `HMAC-SHA256(party_id, COOKIE_SECRET)`, not a plain flag. This prevents an attacker from forging the cookie with curl — they would need the server-side secret to produce a valid signature. The HMAC is computed using `COOKIE_SECRET` (falls back to `SUPABASE_SERVICE_ROLE_KEY` if not set, but a dedicated secret is recommended in production).

**Guest flow (no PIN):** Unchanged — straight to name/avatar form.

**Files:**
- `lib/pin.ts` — bcrypt hash/verify helpers
- `supabase/migrations/007_party_pin.sql` — original `pin_hash` column (now migrated)
- `supabase/migrations/010_party_secrets.sql` — moves `pin_hash` to `party_secrets` table with artist-only RLS
- `app/api/party/route.ts` — hash PIN on creation
- `app/api/party/[id]/verify-pin/route.ts` — verification endpoint, sets cookie
- `app/api/party/[id]/join/route.ts` — checks PIN cookie before seat claim
- `app/(artist)/create-party/page.tsx` — PIN toggle + input on creation form
- `app/party/[inviteCode]/page.tsx` — passes `hasPin` prop to JoinForm
- `app/party/[inviteCode]/JoinForm.tsx` — PIN gate UI before join form

---

## Layer 3: Cloudflare Turnstile (Bot Protection)

Invisible CAPTCHA on the join form. Real users never see a challenge.

### How It Works

1. Turnstile widget loads on the join page (invisible mode — no UI)
2. On form submit, Turnstile generates a client-side token
3. Token is sent with the join request as `turnstile_token`
4. Server verifies the token against Cloudflare's `siteverify` endpoint
5. Invalid or missing token → 403

### What Gets Protected

Only `POST /api/party/[id]/join`. Other endpoints don't need it:
- Stream URL requires a valid seat cookie (Layer 5) — bots can't get one without passing Turnstile
- Party creation requires Supabase auth — bots need a real email

### Failure Mode

If Cloudflare is down or `TURNSTILE_SECRET_KEY` is not configured, Turnstile **fails open**. Better to let a human through than block all guests due to a third-party outage. In development, leaving the env vars empty skips verification entirely.

### Environment Variables

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Client | Renders the invisible widget |
| `TURNSTILE_SECRET_KEY` | Server | Verifies tokens against Cloudflare |

**Files:**
- `lib/turnstile.ts` — server-side token verification helper
- `app/party/[inviteCode]/JoinForm.tsx` — Turnstile widget + token state
- `app/api/party/[id]/join/route.ts` — verifies token before processing

**Dependency:** `@marsidev/react-turnstile`

---

## Layer 4: Rate Limiting (Not Yet Implemented)

Server-side rate limiting using Upstash Rate Limit. Documented for near-term implementation.

### Planned Limits

| Endpoint | Limit | Window | Key |
|---|---|---|---|
| `POST /api/party/[id]/join` | 5 requests | 1 minute | IP + party ID |
| `POST /api/party/[id]/join` (wrong PIN) | 3 failures | 5 minutes | IP + party ID |
| `GET /api/party/[id]/stream` | 30 requests | 1 minute | IP + party ID |
| `POST /api/party` | 5 requests | 10 minutes | User ID |
| Chat messages (realtime) | 20 messages | 1 minute | Seat ID |

### Implementation Approach

- `lib/rate-limit.ts` wrapper around `@upstash/ratelimit`
- Each API route calls `rateLimit.check(key)` before processing
- Returns 429 with `Retry-After` header on violation

**Dependencies:** `@upstash/ratelimit`, `@upstash/redis` + Upstash account (free tier sufficient)

---

## Layer 5: Stream URL Authentication

The most critical fix. The stream-url endpoint previously had zero authentication — anyone with a party ID could generate signed URLs and download unreleased audio.

### Auth Check Logic

The auth check is context-aware — it distinguishes between active parties and post-party review:

```
Fetch party status (ended_at, scheduled_at, files_deleted)
  → Party ended + files_deleted? → 410 Gone (no streaming)
  → Determine mode: isPostParty = ended_at set OR 6h past scheduled_at

Read party_token_{partyId} cookie
  → Cookie exists?
    → Active party: guest_token match + party_id match + left_at IS NULL?
    → Post-party:   guest_token match + party_id match (left_at NOT checked)
      → Yes → authorized
      → No → check artist fallback
  → No cookie?
    → Check Supabase auth user
      → Auth user is party's artist_id? → authorized (party owner)
      → Not artist or no auth → 403
```

**Why `left_at` is skipped post-party:** When a party ends, guests may have their `left_at` set. During active parties, `left_at IS NULL` ensures only currently-seated guests can stream. Post-party, all guests who were ever seated should be able to review tracks — the cookie proves they were admitted to the party.

### Party Expiry / Post-Party Streaming

The stream endpoint handles two modes:

- **Active party** (`ended_at` not set, within 6h of `scheduled_at`): Only currently-seated guests (`left_at IS NULL`) can stream. Standard behavior.
- **Post-party review** (`ended_at` set OR 6h past `scheduled_at`, `files_deleted` is false): Streaming is allowed for any guest who was ever seated. This enables the waveform annotation review experience. All other security layers (proxy, auth, no URL exposure) remain identical.
- **Files deleted** (`files_deleted` is true): 410 Gone. No streaming regardless of auth.

The post-party window is bounded by the file cleanup cron (~48h after party ends). Once `files_deleted` flips to true, streaming stops permanently. The security posture during post-party review is identical to active parties — audio is served through the server-side proxy (Layer 7), signed URLs never reach the client, and every request requires a valid auth cookie.

### Edge Cases

| Scenario | Behavior |
|---|---|
| Guest tab crash + reload | Cookie persists (24hr maxAge), seat still active → works |
| Artist accessing own party | Authenticated via Supabase, no seat cookie needed |
| Guest who left during active party | Cookie exists but `left_at` set → 403 (correct — party still active) |
| Guest revisiting after party ended | Cookie exists, `left_at` set but post-party mode → authorized (review access) |
| Guest revisiting after files deleted | 410 Gone regardless of auth |
| Party ended while guest is listening | Transitions to post-party mode — streaming continues for review |

**Files:**
- `app/api/party/[id]/stream/route.ts` — streaming proxy with auth check + party expiry check (see Layer 7 for details)

---

## Layer 6: Stream URL Broadcast Isolation

Layer 5 gates the stream endpoint behind seat or artist auth. But signed URLs were originally leaked through the Supabase Realtime broadcast.

### The Problem

When the artist pressed PLAY, the signed audio URL was broadcast to every guest via the shared Realtime channel:

```
Artist presses PLAY
  → Broadcasts: { type: "PLAY", signed_url: "https://supabase.co/storage/...?token=abc123" }
  → Every guest receives the full download URL in plaintext
```

That signed URL is a bearer token — anyone who has it can download the file from anywhere. No cookies, no IP check, no auth. It works for anyone until it expires (4 hours).

Worse: the Supabase Realtime channel itself has no subscription auth. The `party:{id}` channel is open to any client that knows the party ID. An eavesdropper doesn't need a seat — they just subscribe to the channel and wait for the PLAY event to arrive with the URL inside it.

This meant Layer 5's auth check on the stream endpoint was being bypassed entirely. The artist's own client was handing the URL to everyone on the channel, authenticated or not.

### The Fix

Signed URLs are no longer broadcast. PLAY events now contain only playback metadata:

```
Artist presses PLAY
  → Broadcasts: { type: "PLAY", position: 0, track_position: 1 }  ← no URL
  → Each guest receives the event
  → Each guest sets audio.src = /api/party/[id]/stream?track=1  (proxy URL)
  → Browser makes requests to the proxy, which checks auth + streams audio
  → Signed URL never reaches the client (see Layer 7)
```

### What This Changes

The `PlaybackEvent` type no longer carries `signed_url`:

```typescript
// Before
{ type: "PLAY"; position: number; signed_url: string; track_position?: number }

// After
{ type: "PLAY"; position: number; track_position: number }
```

### What This Solves

| Before | After |
|---|---|
| Every guest receives the download URL in plaintext | No URL in the broadcast — only playback positions |
| Channel eavesdroppers get the URL without a seat | Eavesdroppers see only positions and track numbers |
| One PLAY event leaks the URL to all subscribers | Audio is only available through the authenticated proxy |

### What This Doesn't Solve

- The Realtime channel itself remains unauthenticated. Eavesdroppers can still see playback positions and chat messages, but neither enables audio theft. Proper channel auth would require Supabase anonymous sessions for guests — a major architectural change disproportionate to the risk.

**Files:**
- `types/index.ts` — removed `signed_url` from `PlaybackEvent` PLAY variant
- `hooks/usePlaybackSync.ts` — broadcasts contain only positions, guests use proxy URL

---

## Layer 7: Server-Side Streaming Proxy

Layers 5 and 6 authenticated the stream endpoint and removed signed URLs from broadcasts. But signed URLs were still returned to the client — visible in the browser's Network tab and copyable for direct download. Layer 7 eliminates the signed URL from ever reaching the browser.

### How It Works

```
Browser <audio> element requests: /api/party/[id]/stream?track=1
  → Proxy authenticates the request (same auth as Layer 5)
  → Proxy generates a short-lived signed URL server-side (60s, never sent to client)
  → Proxy fetches audio from Supabase Storage, forwarding the browser's Range header
  → Proxy pipes the response body directly back to the browser
  → Browser receives raw audio bytes — no URL to copy
```

The `<audio>` element natively sends Range requests when seeking. The proxy handles these transparently, forwarding `Range`, `Content-Range`, `Content-Length`, and `Accept-Ranges` headers. Returns 206 for partial content, 200 for full requests.

### What Changed on the Client

The playback hook (`usePlaybackSync.ts`) no longer fetches signed URLs. Instead it builds the proxy URL synchronously:

```typescript
// Before (async — fetched signed URL from server)
const url = await fetchStreamUrl(trackPosition);  // returns "https://supabase.co/storage/...?token=abc"
audio.src = url;

// After (sync — proxy URL, no fetch needed)
const url = `/api/party/${partyId}/stream?track=${trackPosition}`;
audio.src = url;
```

The browser's audio element makes its own HTTP requests to the proxy URL with cookies automatically included. Each request triggers a fresh server-side signed URL generation.

### Client-Side Deterrents

- Right-click context menu disabled on the player area (`onContextMenu` prevention)
- Audio element uses custom UI only (no native `controls` attribute, no browser download button)
- `audio.src` in DevTools shows only `/api/party/[id]/stream?track=1` — not a downloadable URL

### What This Solves

| Before (Layers 5+6) | After (Layer 7) |
|---|---|
| Signed URL visible in Network tab | Only proxy URL visible — no Supabase URL exposed |
| Copy URL from Network tab → download works | Copy proxy URL → requires valid auth cookie |
| Signed URL valid for 4 hours | Each proxy request generates a 60-second signed URL server-side |
| `audio.src` reveals storage location | `audio.src` is `/api/party/[id]/stream?track=1` |

### What This Doesn't Solve

A technically determined guest can still record the audio output or use browser extensions to intercept the decoded audio stream. This is a fundamental limitation of browser-based audio playback — the audio must eventually reach the speakers. The proxy raises the bar from "copy a URL" to "record the output."

### Performance

No additional latency vs. the previous approach. Before, the client made a fetch to get the signed URL, then the browser fetched the audio. Now, the browser fetches audio directly from the proxy, which fetches from storage in one hop. The proxy streams (pipes) the response — it does not buffer the entire file in memory.

**Files:**
- `app/api/party/[id]/stream/route.ts` — streaming proxy route (new)
- `hooks/usePlaybackSync.ts` — replaced async `fetchStreamUrl` with sync proxy URL builder
- `components/party/AudioPlayer.tsx` — context menu prevention
- `app/api/party/[id]/stream-url/route.ts` — deleted (replaced by proxy)

---

## Layer 8: RLS Policy Lockdown

Layers 5–7 secured the streaming proxy, but the Supabase database itself was still wide open. The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is embedded in client-side JavaScript (by design — that's how Supabase works). Anyone could extract it and query Supabase directly, bypassing the proxy entirely.

### The Problem

Three overly permissive RLS policies allowed outsiders with just the anon key to:

1. **Query `tracks` table** → get every track's `file_path` (storage location)
2. **Generate signed download URLs** from storage → download full audio files
3. **Query `seats` table** → steal `guest_token` values → impersonate seated guests

This bypassed every other security layer — no invite code, no PIN, no Turnstile, no seat cookie needed.

### The Fix

**Tracks:** SELECT restricted to the party's artist only (`artist_id = auth.uid()`). Guests never query tracks directly — the server-side streaming proxy (Layer 7) uses the service role to resolve file paths.

**Seats:** SELECT restricted to the party's artist only. Guest seat lookups (returning guest detection, seat counts) are performed server-side using the service role client. The `guest_token` column is never exposed through client-queryable RLS.

**Storage (`party-audio` bucket):** The anon read policy was removed entirely. Only authenticated artists can read their own files (folder-scoped to their user ID). The streaming proxy uses the service role to generate short-lived signed URLs server-side — anon users never need direct storage access.

### Server-Side Data Access Pattern

All guest-facing data that was previously fetched via anon RLS is now fetched server-side:

| Data | Before | After |
|---|---|---|
| Track list for party room | Anon client SELECT on `tracks` | Service role client in server component |
| Returning guest seat lookup | Anon client SELECT on `seats` | Service role client in server component |
| Active seat count | Anon client SELECT on `seats` | Service role client in server component |
| Track file path for streaming | Service role (unchanged) | Service role (unchanged) |

The service role key (`SUPABASE_SERVICE_ROLE_KEY`) is never exposed to the client. It is only used in:
- Next.js server components (SSR)
- API route handlers (`app/api/...`)

### What Remains Client-Queryable

| Table | Client SELECT | Why |
|---|---|---|
| `profiles` | All profiles (display names) | Public information, no sensitive data |
| `parties` | Paid parties only | Needed for invite code lookup; `pin_hash` has been moved to the `party_secrets` table (artist-only RLS) |
| `chat_messages` | All messages | Needed for real-time chat display |

### RLS Policy Summary

| Table | Policy | Scope |
|---|---|---|
| `tracks` SELECT | Artist only | `parties.artist_id = auth.uid()` |
| `tracks` INSERT/UPDATE/DELETE | Artist only | `parties.artist_id = auth.uid()` |
| `seats` SELECT | Artist only | `parties.artist_id = auth.uid()` |
| `seats` INSERT | Via RPC | `claim_seat()` function |
| `party_secrets` SELECT/INSERT/UPDATE/DELETE | Artist only | `parties.artist_id = auth.uid()` |
| `storage.objects` SELECT | Authenticated artists (own folder) | `bucket_id = 'party-audio' AND folder = auth.uid()` |
| `storage.objects` SELECT (anon) | **Removed** | — |

### Sensitive Column Isolation

The `parties` table remains publicly readable (needed for invite code lookups by unauthenticated guests). To prevent sensitive data from leaking through this table:

- **`pin_hash`** was moved from `parties` to a separate `party_secrets` table with artist-only RLS. An outsider querying `parties` with the anon key can no longer extract bcrypt hashes for offline brute-forcing.
- **`file_path` / `file_name`** remain on `parties` as legacy fields. They expose the Supabase Storage path structure (including the artist's user ID), but cannot be used to download files — the anon storage read policy has been removed (see above). These fields are only used as a fallback in the server-side streaming proxy.

**Files:**
- `supabase/migrations/009_tighten_rls_policies.sql` — drops permissive policies, creates restricted ones
- `supabase/migrations/010_party_secrets.sql` — moves `pin_hash` to `party_secrets` table with artist-only RLS
- `app/party/[inviteCode]/page.tsx` — switched tracks/seats/pin queries to service role client
- `app/(artist)/dashboard/party/[id]/edit/page.tsx` — queries `party_secrets` for PIN state
- `app/api/party/[id]/verify-pin/route.ts` — reads `pin_hash` from `party_secrets`
- `app/api/party/[id]/join/route.ts` — reads `pin_hash` from `party_secrets`
- `app/api/party/[id]/route.ts` — writes PIN changes to `party_secrets`
- `app/api/party/route.ts` — inserts PIN into `party_secrets` on party creation
- `app/api/webhooks/stripe/route.ts` — inserts PIN into `party_secrets` on Stripe-created parties

---

## Input Validation

Server-side validation added to all API endpoints to match frontend constraints.

### Join API (`POST /api/party/[id]/join`)

| Field | Validation |
|---|---|
| `guest_name` | Required, max 50 characters |
| `avatar` | Must be in allowlist of 12 emoji strings |

### Party Creation API (`POST /api/party`)

| Field | Validation |
|---|---|
| `title` | Required, max 100 characters |
| `description` | Optional, max 500 characters |
| `pin` | Optional, 4–8 alphanumeric characters (if provided) |

### Party Status

The join API now checks `ended_at` before allowing joins. Returns "This party has ended" if the party is over.

---

## Dependencies Added

| Package | Purpose |
|---|---|
| `bcryptjs` + `@types/bcryptjs` | PIN hashing (pure JS, no native deps) |
| `@marsidev/react-turnstile` | React wrapper for Cloudflare Turnstile |

---

## Files Changed Summary

| File | What changed |
|---|---|
| `lib/invite-code.ts` | Crypto-safe generation with hex suffix |
| `lib/pin.ts` (new) | bcrypt hash/verify helpers |
| `lib/turnstile.ts` (new) | Cloudflare Turnstile server verification |
| `supabase/migrations/007_party_pin.sql` (new) | `pin_hash` column on parties |
| `supabase/migrations/009_tighten_rls_policies.sql` (new) | Drops permissive RLS on tracks, seats, storage; replaces with artist-only policies |
| `supabase/migrations/010_party_secrets.sql` (new) | Moves `pin_hash` from parties to `party_secrets` table with artist-only RLS |
| `app/api/party/route.ts` | Collision check, PIN hashing, input validation |
| `app/api/party/[id]/join/route.ts` | HMAC-signed PIN cookie check, Turnstile, input validation, party status check |
| `app/api/party/[id]/verify-pin/route.ts` (new) | PIN verification + HMAC-signed cookie setter |
| `app/api/party/[id]/stream/route.ts` (new) | Streaming proxy — auth + party expiry check + pipe audio from storage |
| `app/api/party/[id]/stream-url/route.ts` | Deleted — replaced by streaming proxy |
| `app/(artist)/create-party/page.tsx` | PIN toggle, input, validation |
| `app/party/[inviteCode]/page.tsx` | Passes `hasPin` to JoinForm; switched tracks/seats queries to service role client |
| `app/party/[inviteCode]/JoinForm.tsx` | PIN gate UI, Turnstile widget |
| `.env.local.example` | Turnstile + `COOKIE_SECRET` env vars documented |
| `types/index.ts` | Removed `signed_url` from PlaybackEvent type |
| `hooks/usePlaybackSync.ts` | Sync proxy URL builder, no more signed URL fetching |
| `components/party/AudioPlayer.tsx` | Context menu prevention on player |

---

## Honest Limitations

### What this protects against

Every known outsider audio theft vector is closed:

| Attack | Blocked by |
|---|---|
| Query `tracks` for file paths via anon key | Layer 8 — artist-only RLS on tracks |
| Generate signed storage URLs via anon key | Layer 8 — anon storage read policy removed |
| Steal `guest_token` from seats via anon key | Layer 8 — artist-only RLS on seats |
| Offline brute-force `pin_hash` via anon key | Layer 8 — `pin_hash` moved to `party_secrets` (artist-only RLS) |
| Forge PIN verification cookie via curl | Layer 2 — HMAC-signed cookie requires server-side secret |
| Enumerate invite codes | Layer 1 — ~2.3 trillion combinations via crypto RNG |
| Bot seat claiming | Layer 3 — Cloudflare Turnstile |
| Eavesdrop signed URLs via Realtime channel | Layer 6 — URLs no longer broadcast |
| Copy signed URL from browser DevTools | Layer 7 — proxy serves raw bytes, no URL exposed |
| Stream audio after party ends | Layer 5 — `ended_at` / expiry check returns 410 |

### What this doesn't protect against

**A seated guest recording audio.** Once audio bytes reach the browser, they can be captured — screen recording, browser extensions, Web Audio API interception, or simply holding a phone to the speakers. This is a fundamental limitation of browser-based audio playback, not a bug. The product's answer: "We protect your music from outsiders. We cannot prevent a trusted guest from recording what they hear."

**No forensic trail.** If audio leaks from a seated guest, there's no watermarking, per-guest audio fingerprinting, or download logs to identify the source.

### Infrastructure trust

Artists are trusting three external services with their audio:

| Service | What it holds | Risk |
|---|---|---|
| **Supabase** (AWS) | Raw audio files in Storage, all database records | A Supabase breach exposes all stored audio |
| **Vercel** | `SUPABASE_SERVICE_ROLE_KEY`, `COOKIE_SECRET` in env vars | A Vercel breach exposes keys that grant full database/storage access |
| **The platform operator** | Service role access to everything | Operator can access any artist's audio at any time |

Files are not encrypted at rest beyond Supabase/AWS defaults. There is no client-side encryption or zero-knowledge architecture.

### File lifecycle risks

- **48-hour cleanup window:** Audio files persist for up to 48 hours after a party ends. The cleanup cron runs once daily at 5 AM UTC (`vercel.json`). Worst case, files persist ~72 hours if the party ends right after the cron runs.
- **Cleanup reliability:** Vercel crons are best-effort. If the cron fails silently, files persist indefinitely. The `files_deleted` flag stays `false` but there's no alerting or retry mechanism.
- **`file_path` / `file_name` on `parties` table:** These legacy columns remain publicly queryable and expose the storage path structure (including artist user IDs). However, they are inert — the anon storage read policy has been removed, so knowing the path doesn't enable downloading.

### What's not yet implemented

- **Rate limiting (Layer 4)** would complete the defense-in-depth picture. Without it, an attacker can hammer the PIN verification endpoint without throttling. The Turnstile layer mitigates automated attempts, but a human attacker with the invite link could manually try PINs. For parties with sensitive content, artists should use strong passcodes (8 characters) until rate limiting is shipped.
- **Realtime channel subscription** is unauthenticated. Anyone who knows the party ID can subscribe to the `party:{id}` channel and see playback positions and chat messages. This doesn't enable audio theft (the URL is no longer broadcast), but it does allow chat eavesdropping. Fixing this requires Supabase anonymous auth sessions for guests — a significant architectural change documented for future consideration.
