# Cron Jobs

The app uses [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) to run scheduled cleanup tasks. Cron schedules are defined in `vercel.json`.

Both endpoints are protected by a `CRON_SECRET` environment variable — Vercel sends this automatically as a Bearer token on each invocation.

---

## 1. Cleanup Stale Checkouts

| | |
|---|---|
| **Route** | `app/api/cron/cleanup-checkouts/route.ts` |
| **Schedule** | `0 4 * * *` (daily at 4:00 AM UTC) |
| **Logic** | `lib/cleanup-pending-checkout.ts` |

### What it does

Cleans up abandoned payment flows. When a user starts creating a party and uploads files but never completes the Stripe checkout, the uploaded files and `pending_checkouts` row remain in the database.

This cron:

1. Queries `pending_checkouts` rows older than **24 hours**
2. For each stale checkout:
   - Deletes uploaded track files from the `party-audio` storage bucket
   - Deletes the uploaded cover image from the `party-images` storage bucket
   - Deletes the `pending_checkouts` row from the database

### Why

Prevents orphaned files from accumulating in storage when users abandon the checkout flow.

---

## 2. Cleanup Party Files

| | |
|---|---|
| **Route** | `app/api/cron/cleanup-files/route.ts` |
| **Schedule** | `0 5 * * *` (daily at 5:00 AM UTC) |
| **Logic** | `lib/cleanup-party-files.ts` |

### What it does

Deletes audio track files for parties that have ended, freeing up storage. Cover images are intentionally preserved so past parties remain visually identifiable in the dashboard.

This cron:

1. Queries parties where `files_deleted = false` and `ended_at` is more than **48 hours** ago
2. For each eligible party:
   - Looks up all tracks and deletes their files from the `party-audio` storage bucket
   - Sets `files_deleted = true` on the party row
3. Returns a JSON summary: `{ cleaned, total, errors }`

### What it does NOT delete

- **Cover images** (`party-images` bucket) — kept so past party cards still show artwork
- **Database rows** — track and party records remain for history

### Dashboard behavior

When `files_deleted` is `true`, the party card in the dashboard shows a "Tracks Removed" badge below the "Past" badge.

### Manual trigger

The cleanup function accepts options for testing:

- `artistId` — scope cleanup to a single artist's parties
- `skipTimeCheck` — skip the 48-hour and `ended_at` filters (clean up all non-deleted parties)

The route at `app/api/party/cleanup-test/` uses these options to let an authenticated artist trigger cleanup on their own parties.
