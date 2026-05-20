# sideroom

Private, real-time listening sessions for unreleased music.

An artist uploads tracks, sets a seat limit, and shares a link. Everyone listens together in sync with live chat. Files are permanently deleted 48 hours after the party ends.

## How it works

1. **Artist creates a party** — uploads audio, sets a title, seat limit, and optional passcode
2. **Guests join via invite link** — no account required, just a name
3. **Everyone listens together** — synchronized playback with live chat
4. **Files disappear** — all audio is permanently deleted 48 hours after the party ends

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router), TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com) v4, [Radix UI](https://www.radix-ui.com) |
| Auth | [Supabase](https://supabase.com) magic link (email OTP) |
| Database | Supabase Postgres with Row-Level Security |
| File storage | Supabase Storage (private bucket, signed URLs) |
| Real-time | Supabase Realtime (Broadcast + Presence) |
| Payments | [Stripe](https://stripe.com) Checkout |
| Email | [Resend](https://resend.com) |
| Bot protection | [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) |
| Hosting | [Vercel](https://vercel.com) |

## Local development

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Stripe](https://stripe.com) account (test mode)

### Setup

```bash
# Clone and install
git clone https://github.com/your-username/sideroom.git
cd sideroom
npm install

# Configure environment
cp .env.local.example .env.local
# Fill in your Supabase, Stripe, and Resend credentials

# Run database migrations
# Apply each file in supabase/migrations/ to your Supabase project
# via the Supabase dashboard SQL editor or the Supabase CLI

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

See [`.env.local.example`](.env.local.example) for all required variables and where to get them.

## Project structure

```
sideroom/
├── app/
│   ├── (artist)/              # Authenticated artist routes
│   │   ├── dashboard/         # Party list and management
│   │   └── create-party/      # Upload tracks and create a party
│   ├── (auth)/                # Login and auth callback
│   ├── api/                   # API routes
│   │   ├── checkout/          # Stripe checkout
│   │   ├── cron/              # Scheduled cleanup jobs
│   │   ├── party/             # Party CRUD and guest operations
│   │   └── webhooks/stripe/   # Stripe webhook handler
│   ├── party/[inviteCode]/    # Guest-facing party page
│   └── trust/                 # Security and trust info
├── components/
│   ├── dashboard/             # Artist dashboard UI
│   ├── landing/               # Landing page
│   ├── party/                 # Party room (player, chat, seats)
│   └── ui/                    # Shared UI primitives
├── hooks/                     # Custom React hooks
│   ├── usePlaybackSync.ts     # Synchronized playback logic
│   ├── useRealtimeChannel.ts  # Supabase Realtime + Presence
│   └── usePartyChat.ts        # Live chat
├── lib/                       # Server utilities
│   ├── supabase/              # Supabase client factories
│   ├── shaders/               # WebGL background shaders
│   └── cleanup-*.ts           # File and checkout cleanup
├── supabase/migrations/       # Database schema (15 migrations)
├── remotion/                   # Hero video generation
└── docs/                      # Architecture and security docs
```

## Architecture

The entire app runs as a single Next.js deployment connected to one Supabase project. No transcoding pipeline, no streaming server, no Redis.

- **Audio delivery**: Files are stored in a private Supabase Storage bucket. The server generates short-lived signed URLs for playback. Audio is never exposed as a downloadable file.
- **Playback sync**: The artist's client broadcasts play/pause/seek events over a Supabase Realtime channel. Guests correct drift using periodic heartbeats (target accuracy: 100-300ms).
- **Seat management**: A Postgres advisory lock (`pg_advisory_xact_lock`) prevents race conditions when multiple guests join simultaneously.
- **File lifecycle**: A daily Vercel cron job deletes audio files 48 hours after a party ends and sends a confirmation email to the artist.

See [`docs/technical-overview.md`](docs/technical-overview.md) for the full architecture, and [`docs/security-design.md`](docs/security-design.md) for the security model.

## Security

- Cryptographic invite codes (~2.3 trillion combinations)
- Optional passcode protection with bcrypt + HMAC-signed cookies
- Cloudflare Turnstile bot protection on join
- Row-Level Security on all database tables
- Server-side audio streaming proxy (no direct file URLs)
- Automatic file deletion with email confirmation
- Stripe webhook signature verification

See [`docs/security-design.md`](docs/security-design.md) for details.

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run tests (Vitest)
```

## License

All rights reserved.
