# Upload System — TUS Resumable Multi-Track Uploads

## Overview

Artists upload one or more audio files (WAV, FLAC, AIFF, MP3) when creating a listening party. Files are uploaded directly to Supabase Storage using the **TUS resumable upload protocol**, which provides real progress tracking, automatic retry, and the ability to resume interrupted uploads.

## Architecture

```
Browser                        Supabase Storage             Postgres
┌──────────────┐               ┌──────────────┐            ┌──────────┐
│ useFileUpload│──TUS chunks──▶│ party-audio   │            │ tracks   │
│   hook       │  (6MB each)   │ bucket        │            │ table    │
└──────┬───────┘               └──────────────┘            └────┬─────┘
       │                                                        │
       │  on all complete                                       │
       ▼                                                        │
┌──────────────┐         POST /api/party                        │
│ create-party │────────────────────────────▶ insert party ──────┘
│   page       │   { title, tracks[] }        + bulk insert tracks
└──────────────┘
```

## How a Single File Upload Works

1. **User drops/selects files** → `addFiles()` creates an `UploadFile` entry per file with status `pending`
2. **User clicks "Upload & Create Party"** → `uploadAll()` is called
3. For each file, a `tus.Upload` instance is created with:
   - **Endpoint**: `{SUPABASE_URL}/storage/v1/upload/resumable`
   - **Auth**: `Authorization: Bearer {access_token}`
   - **Metadata**: `bucketName=party-audio`, `objectName={userId}/{uuid}-{filename}`
   - **Chunk size**: 6MB — each chunk is a separate HTTP request
4. TUS sends the file in 6MB chunks. On each chunk completion, `onProgress` fires and updates the file's `progress` (0–100) in React state
5. On success: status → `complete`, `storagePath` is stored
6. On error: status → `error`, error message saved, retry button appears

## How Batch (Multi-Track) Upload Works

Files upload **sequentially** (one at a time) to avoid bandwidth competition:

```
File 1: ████████████████████ 100%  ✓
File 2: ██████████░░░░░░░░░░  52%  uploading...
File 3: ░░░░░░░░░░░░░░░░░░░░   0%  pending
```

The `uploadAll()` function loops through the files array in order:
- Skips files already `complete` (e.g. from a previous partial attempt)
- Uploads the next `pending` or `error` file
- If a file fails, it's marked `error` but the loop continues to the next file
- After all files are attempted, the caller checks for failures

**Overall progress** is the average of all file progresses: `sum(file.progress) / fileCount`.

## Retry & Resume

TUS uploads are resumable by design:

- **Network interruption mid-chunk**: `tus-js-client` has built-in retry delays (`[0, 1000, 3000, 5000]ms`) and will retry the current chunk automatically
- **Full failure** (e.g. auth expired, server error): The file is marked `error`. The user clicks "retry" → `retryFile()` creates a new `tus.Upload` and calls `findPreviousUploads()` to resume from the last successful chunk offset
- **Page refresh**: TUS stores upload URLs in localStorage. If the user re-adds the same file, `findPreviousUploads()` can pick up where it left off (though the current UI doesn't persist file state across page loads)

## After Upload: Party Creation

Once all files are uploaded successfully:

1. A `tracks[]` array is built: `[{ file_path, file_name, position }]` — position is the array index + 1 (matches drag-to-reorder order)
2. `POST /api/party` receives this array along with `title`, `description`, `seat_limit`
3. The API inserts the party row, then bulk-inserts all tracks into the `tracks` table
4. If track insertion fails, the party row is rolled back (deleted)

## Storage Path Convention

```
party-audio/{user_id}/{upload_uuid}-{original_filename}
```

- `user_id` is the Supabase auth user ID — storage RLS enforces users can only write to their own folder
- `upload_uuid` is a client-generated UUID to prevent filename collisions
- Original filename is preserved for display purposes

## Playback: Streaming Tracks

When a party room loads:

1. `GET /api/party/{id}/stream-url?track=1` looks up the track's `file_path` from the `tracks` table
2. Falls back to `parties.file_path` for legacy single-file parties
3. Returns a 4-hour signed URL for the storage object
4. When a track ends, the artist's player auto-advances to the next track position and broadcasts the new signed URL to all guests

## Cleanup

The `cleanup_expired_party_audio()` function (meant to be called by a cron/pg_cron job) deletes storage objects for parties that ended more than 48 hours ago, then sets `files_deleted = true` on those parties.

## Key Files

| File | Purpose |
|---|---|
| `hooks/useFileUpload.ts` | TUS upload hook — manages file list, progress, retry |
| `app/(artist)/create-party/page.tsx` | Multi-file upload UI with drag-to-reorder |
| `app/api/party/route.ts` | Party + tracks creation endpoint |
| `app/api/party/[id]/stream-url/route.ts` | Signed URL generation per track |
| `hooks/usePlaybackSync.ts` | Multi-track playback with auto-advance |
| `supabase/migrations/002_tracks_and_storage.sql` | tracks table, RLS, cleanup function |
