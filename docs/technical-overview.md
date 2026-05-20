# Technical Overview — sideroom

## Architecture

Three services. No more.

| Service | Role |
|---|---|
| **Supabase** | Auth, Postgres database, file storage, real-time WebSocket channels |
| **Vercel** | Next.js hosting, API routes, cron jobs |
| **Stripe** | Payment processing |

No transcoding pipeline. No streaming server. No Redis. No separate WebSocket service. The entire application runs as a single Next.js deployment connected to one Supabase project.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Styling | Tailwind CSS + Geist font |
| Auth | Supabase magic link (email OTP) |
| Database | Supabase Postgres with Row Level Security |
| File Storage | Supabase Storage (private bucket, signed URLs) |
| Real-time | Supabase Realtime (Broadcast + Presence channels) |
| Client State | Zustand |
| Hosting | Vercel |

---

## Data Model

```
profiles
  id (UUID, references auth.users)
  display_name (TEXT)

parties
  id (UUID)
  invite_code (TEXT, unique) — human-readable slug like "cosmic-groove-42"
  artist_id (UUID, references profiles)
  title (TEXT)
  description (TEXT, nullable)
  seat_limit (INT, 1–50, default 10)
  scheduled_at (TIMESTAMPTZ)
  ended_at (TIMESTAMPTZ, nullable)
  playback_ended_at (TIMESTAMPTZ, nullable) — when the last track finished; the party then stays open for chat/notes until the host ends it
  files_deleted (BOOLEAN)
  payment_status (TEXT: pending | paid | refunded)
  file_path (TEXT) — path in Supabase Storage
  file_name (TEXT) — original filename for display

seats
  id (UUID)
  party_id (UUID, references parties)
  guest_name (TEXT)
  guest_token (TEXT, unique) — stored in httpOnly cookie
  joined_at (TIMESTAMPTZ)
  left_at (TIMESTAMPTZ, nullable)

chat_messages
  id (UUID)
  party_id (UUID, references parties)
  seat_id (UUID, references seats)
  sender_name (TEXT)
  text (TEXT, max 500 chars)
  sent_at (TIMESTAMPTZ)
```

### Seat Claiming (Race Condition Prevention)

The `claim_seat` Postgres function uses `pg_advisory_xact_lock` to atomically check the active seat count and insert a new seat in a single transaction. This prevents the scenario where 20 simultaneous requests all read "9 seats taken" and all insert, exceeding the limit.

```sql
PERFORM pg_advisory_xact_lock(hashtext(party_id::text));
-- count active seats
-- insert if under limit
-- lock releases when transaction ends
```

No Redis. No application-level mutex. The database handles it.

---

## Real-Time Synchronization

### How Playback Sync Works

All sync happens through a single Supabase Realtime channel per party: `party:{partyId}`.

**When the artist presses PLAY:**
1. Client requests a signed URL from `/api/party/[id]/stream-url`
2. Signed URL has a 4-hour expiry
3. Artist's browser starts playing the audio locally
4. Artist broadcasts to the channel: `{ type: "PLAY", position: 0, signed_url: "..." }`

**When a guest receives the PLAY event:**
1. Sets `audio.src` to the signed URL
2. Sets `audio.currentTime` to the position
3. Waits 200ms (latency buffer)
4. Calls `audio.play()`

**Drift correction:**
- Artist broadcasts a HEARTBEAT every 5 seconds with their current playback position
- Each guest compares their `audio.currentTime` to the heartbeat
- If drift > 300ms: silently seek to correct position
- If drift > 2s: pause, seek, resume (handles tab sleep / background)

**Expected accuracy:** 100–300ms. Imperceptible for music listening.

### Why This Works Without a Streaming Server

The audio file lives on Supabase Storage. Each guest's browser independently fetches the file via HTTP Range requests (standard browser behavior for `<audio>` elements). The Realtime channel only carries lightweight sync commands — not audio data.

This means:
- If the host disconnects, audio keeps playing for all guests (it comes from Supabase, not the host's computer)
- No media server to scale or maintain
- Bandwidth is Supabase egress, not your server's

### Presence (Who's in the Room)

Supabase Realtime Presence tracks connected guests. When a guest subscribes to the channel, they call `channel.track({ guest_name })`. The presence state is synced to all participants automatically. The SeatList component renders this state directly.

---

## Audio File Handling

### Upload Flow
1. Artist selects a file (WAV, FLAC, AIFF, or MP3)
2. File is uploaded directly from the browser to Supabase Storage (bypasses Vercel's 4.5MB body limit)
3. Stored in a private bucket (`party-audio`) under `{user_id}/{uuid}-{filename}`
4. Party record is created via API with the file path

### Delivery
- Private bucket — no public URLs exist
- Audio is served via signed URLs generated on-demand with a 4-hour expiry
- Signed URL is transmitted to guests via the Realtime channel (PLAY event), never stored in the database
- Browsers play WAV and FLAC natively — no transcoding needed

### Deletion Lifecycle
```
Party created → files uploaded
Last track finishes → wind-down: room stays open for chat/notes, playback_ended_at set, no audio cut off
Host taps End Party → ended_at set
  (if untouched: treated as ended 1h after wind-down, or 6h after scheduled_at)
+48 hours after the end (ended_at, or scheduled_at when never ended) →
  Vercel cron deletes files from storage, sets files_deleted = true
→ Artist receives deletion confirmation email
```

### No Transcoding (MVP Decision)

Modern browsers support FLAC and WAV natively. At 20 listeners per party with a 300MB FLAC file:
- Bandwidth cost: ~$0.54 per party
- At $10/party: 94% margin

The transcoding pipeline (FFmpeg, async workers, webhook callbacks) is the most complex subsystem in the original architecture. Removing it for MVP eliminates an entire failure surface and two third-party dependencies (Modal.com + FFmpeg worker). It can be added later when monthly egress costs exceed ~$500.

---

## Authentication & Authorization

### Artist Auth
- Supabase magic link (email OTP)
- On signup, a `profiles` row is auto-created via database trigger
- Middleware protects `/dashboard` and `/create-party` routes

### Guest Auth
- No account required
- Guest enters a name on the party invite page
- `claim_seat` RPC returns a `guest_token` (UUID)
- Token is stored in an httpOnly, SameSite=Strict cookie
- Cookie identifies the guest on subsequent requests and page reloads

### Row Level Security
- `parties`: anyone can read paid parties; only the artist can create/update their own
- `seats`: readable by everyone; created via RPC
- `chat_messages`: readable by everyone; insertable by any seat holder
- `profiles`: readable by everyone; updatable only by the owner

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/party` | POST | Create a new party (auth required) |
| `/api/party/[id]/join` | POST | Claim a seat (guest name required) |
| `/api/party/[id]/stream-url` | GET | Generate a signed URL for audio playback |

---

## Project Structure

```
sideroom/
├── app/
│   ├── page.tsx                          — landing page
│   ├── (auth)/login/page.tsx             — magic link login
│   ├── (auth)/auth/callback/route.ts     — Supabase auth callback
│   ├── (artist)/dashboard/page.tsx       — party list
│   ├── (artist)/create-party/page.tsx    — upload + create form
│   ├── party/[inviteCode]/page.tsx       — invite page / party room
│   ├── party/[inviteCode]/JoinForm.tsx   — guest name input
│   └── api/party/                        — API routes
├── components/party/
│   ├── PartyRoom.tsx                     — main room layout
│   ├── AudioPlayer.tsx                   — <audio> element + controls
│   ├── ChatPanel.tsx                     — real-time chat
│   └── SeatList.tsx                      — presence display
├── hooks/
│   ├── useRealtimeChannel.ts             — Supabase Realtime + Presence
│   ├── usePlaybackSync.ts               — sync logic (PLAY/PAUSE/SEEK/HEARTBEAT)
│   └── usePartyChat.ts                  — chat broadcast
├── lib/
│   ├── supabase/client.ts               — browser Supabase client
│   ├── supabase/server.ts               — server + service role client
│   └── invite-code.ts                   — human-readable code generator
├── middleware.ts                         — auth route protection
├── supabase/migrations/001_initial.sql   — full schema + RPC + RLS
└── types/index.ts                        — shared TypeScript types
```

---

## Infrastructure Costs (Projected)

| Scale | Parties/mo | Revenue | Infra Cost | Margin |
|---|---|---|---|---|
| Launch | 50 | $500 | ~$5–10 | ~98% |
| Growth | 500 | $5,000 | ~$200–350 | ~93–96% |
| Scale trigger | 1,500+ | $15,000 | ~$800+ | Add transcoding |

Primary cost driver is Supabase Storage egress. Storage itself is negligible due to the 48-hour ephemeral model.

---

## Security Hardening Roadmap (Post-MVP)

Not implemented yet. Documented for when they're needed.

| Level | What | When to Add |
|---|---|---|
| 1 | Audio watermarking (inaudible per-guest fingerprint) | First artist with >50K followers |
| 2 | HLS segmented streaming (token-per-segment) | Major-label or signed artist usage |
| 3 | DRM (Widevine/FairPlay) | Probably never for this product |
| 4 | Transcoding (AAC 256kbps) | Monthly egress > $500 |

### Honest Limitation

Signed URLs are the only content protection. A technically savvy guest can download the full file via browser DevTools. This is disclosed to artists: "We protect your music from public access. We cannot prevent a trusted guest from recording or downloading."
